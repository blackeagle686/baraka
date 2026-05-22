from rest_framework import viewsets, permissions, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from django.db import transaction
from django.db.models import Q

from .models import Order, OrderItem, OrderStatus
from shops.models import Shop, Product, Notification

from .serializers import OrderSerializer

from users.permissions import IsApprovedOrReadOnly, IsApprovedUser
from users.permissions import IsAdminUserRole
from .tasks import (
    send_order_notifications_to_drivers,
    auto_cancel_expired_orders,
    recalculate_driver_rating_stats,
    auto_escalate_unresolved_disputes
)

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated, IsApprovedOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        # High-Performance Query Optimization: join related objects in a single query
        base_qs = Order.objects.select_related(
            'customer', 'driver',
            'shop', 'shop__owner'
        ).prefetch_related( 'items',
                           'items__product').order_by('-created_at')

        # Admins have their own dedicated AdminOrderListView (/api/admin/orders/) for global access.
        # When an admin uses the standard order endpoint (e.g. from their personal cart),
        # they should only see their own personal orders.
        if user.role == 'SHOP_OWNER':
            return base_qs.filter(items__product__shop__owner=user).distinct()
        
        elif user.role == 'DRIVER':
            if not user.is_approved:
                return base_qs.filter(driver=user)
            return base_qs.filter(
                Q(driver=user) | Q(driver__isnull=True, status__in=['PENDING', 'ACCEPTED', 'PREPARING', 'ON_DELIVERY'])
            )
            
        else:
            # Customer
            return base_qs.filter(customer=user)

    def create(self, request, *args, **kwargs):
        if request.user.role != 'CUSTOMER' and not request.user.is_staff:
            return Response({"detail": "Only customers can place orders."}, status=status.HTTP_403_FORBIDDEN)

        if not request.user.is_phone_verified and not request.user.is_staff:
            return Response(
                {"detail": "يرجى تفعيل حسابك عن طريق رمز التحقق المرسل لهاتفك أولاً لتتمكن من إتمام الطلبات."},
                status=status.HTTP_403_FORBIDDEN
            )

        data = request.data
        address = data.get('address')
        items_data = data.get('items', [])

        if not items_data:
            return Response({"detail": "Missing items data."}, status=status.HTTP_400_BAD_REQUEST)

        # ── 1) Atomic transaction: single DB commit for order + items + stock + race protection ──
        with transaction.atomic():
            product_ids = [it['product'] for it in items_data]
            # Use select_for_update() to lock the product rows and prevent concurrent checkout stock race conditions!
            products_map = {
                p.id: p for p in Product.objects.select_for_update().filter(id__in=product_ids).select_related('shop', 'shop__owner')
            }

            # ── 2) Validate all items and compute totals (zero DB hits, thread-safe) ──
            total_price = 0
            order_items = []
            unique_shops = set()

            for it in items_data:
                prod = products_map.get(int(it['product']))
                if not prod:
                    return Response(
                        {"detail": f"المنتج {it['product']} غير موجود."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                
                if prod.shop and not prod.shop.is_open:
                    return Response(
                        {"detail": f"عذراً، المحل '{prod.shop.name}' مغلق حالياً. لا يمكنك الطلب منه."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                qty = int(it.get('quantity', 1))
                if qty > prod.quantity:
                    return Response(
                        {"detail": f"المنتج '{prod.name}' لا يحتوي على كمية كافية في المخزن! المتاح حالياً: {prod.quantity} فقط."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                price = prod.price
                total_price += price * qty
                order_items.append((prod, qty, price))
                if prod.shop:
                    unique_shops.add(prod.shop)

            order_shop = list(unique_shops)[0] if len(unique_shops) == 1 else None

            order = Order.objects.create(
                customer=request.user,
                shop=order_shop,
                total_price=total_price,
                address=address or request.user.location or '',
                status=OrderStatus.PENDING,
            )

            # Bulk insert all OrderItems in ONE query (replaces N inserts)
            OrderItem.objects.bulk_create([
                OrderItem(order=order, product=prod, quantity=qty, price=price)
                for prod, qty, price in order_items
            ])

            # Bulk update all product stock in ONE query (replaces N updates)
            products_to_update = []
            for prod, qty, price in order_items:
                prod.quantity -= qty
                if prod.quantity == 0:
                    prod.available = False
                products_to_update.append(prod)

            Product.objects.bulk_update(products_to_update, ['quantity', 'available'])

            # Notify all unique shop owners about the new order.
            for s in unique_shops:
                Notification.objects.create(
                    user=s.owner,
                    shop=s,
                    title="طلب جديد من الزبون",
                    message=(
                        f"تلقيت طلبًا جديدًا من عميلك يشمل متجر '{s.name}'. "
                        f"إجمالي الطلب: {total_price:.2f} ج.م. راجع الطلب الآن لإدارته."
                    ),
                    notification_type='new_order'
                )

        # ── 4) Async driver notification (non-blocking) ──
        send_order_notifications_to_drivers.delay(order.id)
        # Schedule auto-cancellation after 30 minutes (1800 seconds) if order remains unaccepted (PENDING)
        auto_cancel_expired_orders.apply_async(args=[order.id], countdown=1800)

        # ── 5) Re-fetch with joins so the serializer doesn't trigger lazy queries ──
        order = Order.objects.select_related(
            'customer', 'driver', 'shop', 'shop__owner'
        ).prefetch_related(
            'items', 'items__product'
        ).get(pk=order.pk)

        serializer = self.get_serializer(order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def update_status(self, request, pk=None):
        order = self.get_object()
        new_status = request.data.get('status')
        
        is_shop_owner = order.items.filter(product__shop__owner=request.user).exists()
        is_driver = (order.driver == request.user)
        
        if not (is_shop_owner or is_driver or request.user.is_staff):
            return Response({"detail": "Not authorized to update this order's status."}, status=status.HTTP_403_FORBIDDEN)
        
        if new_status not in [c[0] for c in OrderStatus.choices]:
            return Response({"detail": "Invalid status value."}, status=status.HTTP_400_BAD_REQUEST)

        # Enforce role-specific transition constraints
        if is_driver and not is_shop_owner and not request.user.is_staff:
            if new_status != 'DELIVERED':
                return Response({"detail": "Drivers are only authorized to mark orders as DELIVERED."}, status=status.HTTP_403_FORBIDDEN)
            
            # Enforce Customer OTP code verification for drivers marking delivered
            customer_otp = request.data.get('customer_otp')
            if not customer_otp or customer_otp != order.customer_otp:
                return Response({"detail": "رمز التوصيل غير صحيح! يرجى إدخال الرمز المكون من 4 أرقام المستلم من العميل لتأكيد التوصيل."}, status=status.HTTP_400_BAD_REQUEST)
        
        if is_shop_owner and not is_driver and not request.user.is_staff:
            if new_status == 'DELIVERED':
                return Response({"detail": "Only drivers can mark orders as DELIVERED."}, status=status.HTTP_403_FORBIDDEN)
            
        if new_status == 'CANCELLED' and order.status != 'CANCELLED':
            for item in order.items.all():
                if item.product:
                    item.product.quantity += item.quantity
                    item.product.available = True
                    item.product.save()

        order.status = new_status
        order.save()
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsApprovedUser])
    def accept_delivery(self, request, pk=None):
        if request.user.role != 'DRIVER':
            return Response({"detail": "Only drivers can accept delivery assignment."}, status=status.HTTP_403_FORBIDDEN)
        
        # Check active orders limit: at most 5 active orders in progress
        active_count = Order.objects.filter(
            driver=request.user,
            status__in=['ACCEPTED', 'PREPARING', 'ON_DELIVERY']
        ).count()
        if active_count >= 5:
            return Response({
                "detail": "عذراً، لقد وصلت للحد الأقصى للطلبات النشطة (5 طلبات) في رحلتك الحالية. يرجى توصيل الطلبات الحالية وتصفيتها أولاً."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check for overdue payments (> 5 hours since picked_up_at)
        from django.utils import timezone
        from datetime import timedelta
        limit_time = timezone.now() - timedelta(hours=5)
        
        delivered_unpaid = Order.objects.filter(
            driver=request.user,
            status='DELIVERED',
            is_paid_to_shop=False,
            picked_up_at__lt=limit_time
        )
        
        has_overdue_unpaid = False
        for overdue_order in delivered_unpaid:
            if overdue_order.has_unpaid_non_postponed_shops():
                has_overdue_unpaid = True
                break
                
        if has_overdue_unpaid:
            return Response({
                "detail": "عذراً، تم تعليق حسابك مؤقتاً لوجود مستحقات مالية معلقة للمحلات لأكثر من 5 ساعات! يرجى تسوية الحساب أو تأجيل السداد بسبب إغلاق المحلات لتتمكن من استقبال طلبات جديدة."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check for outstanding emergency custody returns
        if Order.objects.filter(driver=request.user, status='PENDING_RETURN').exists():
            return Response({
                "detail": "عذراً، لا يمكنك قبول طلبات جديدة لوجود عهدة مرتجعة معلقة لم تقم بإرجاعها للمحلات بعد! يرجى إرجاع المنتجات للمحل وتأكيد الاستلام لتنشيط حسابك."
            }, status=status.HTTP_400_BAD_REQUEST)

        order = self.get_object()
        if order.driver:
            return Response({"detail": "Order already has an assigned driver."}, status=status.HTTP_400_BAD_REQUEST)
        
        delivery_price = request.data.get('delivery_price')
        if delivery_price is not None:
            try:
                price_val = float(delivery_price)
            except ValueError:
                return Response({"detail": "سعر التوصيل غير صالح."}, status=status.HTTP_400_BAD_REQUEST)
            
            # Enforce constraints: Minimum 15.00 EGP, Maximum 2% of the total order price (capped to at least 15.00 EGP)
            min_price = 15.00
            max_price = max(15.00, float(order.total_price) * 0.02)
            
            if price_val < min_price:
                return Response({"detail": f"سعر خدمة التوصيل لا يمكن أن يقل عن {min_price} ج.م."}, status=status.HTTP_400_BAD_REQUEST)
            if price_val > max_price:
                return Response({"detail": f"سعر خدمة التوصيل لا يمكن أن يتخطى الحد الأقصى المسموح به (2% من إجمالي الطلب: {max_price:.2f} ج.م)."}, status=status.HTTP_400_BAD_REQUEST)
            
            order.delivery_price = price_val
        else:
            order.delivery_price = 15.00  # Default base delivery fee (15 ج.م)
            
        order.driver = request.user
        order.status = OrderStatus.ON_DELIVERY
        order.save()

        # Notify all unique shop owners involved in this order
        unique_shops = set(item.product.shop for item in order.items.select_related('product__shop').all() if item.product and item.product.shop)
        for s in unique_shops:
            Notification.objects.create(
                user=s.owner,
                shop=s,
                title="السائق قبل طلب التوصيل",
                message=(
                    f"تم قبول طلب #{order.id} من قبل السائق {request.user.phone}. "
                    f"يمكنك متابعة حالة التوصيل الآن."
                ),
                notification_type='driver_accepted_order'
            )

        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsApprovedUser])
    def confirm_payment_received(self, request, pk=None):
        order = self.get_object()
        
        # Identify the shops owned by this user that are involved in this order
        from shops.models import Shop
        shops_owned_by_user = Shop.objects.filter(owner=request.user)
        order_items_belonging_to_user_shops = order.items.filter(product__shop__in=shops_owned_by_user)
        
        if not order_items_belonging_to_user_shops.exists() and not request.user.is_staff:
            return Response({"detail": "Not authorized to settle this order's cash."}, status=status.HTTP_403_FORBIDDEN)
            
        # Enforce Driver OTP code verification for shop owners confirming receipt of money
        driver_otp = request.data.get('driver_otp')
        
        # Verify the shop-specific OTP for each shop owned by this user
        for item in order_items_belonging_to_user_shops:
            if item.product and item.product.shop:
                shop_otp = order.get_or_create_shop_otp(item.product.shop.id)
                if not driver_otp or driver_otp != shop_otp:
                    return Response({"detail": "رمز تصفية الحساب غير صحيح! يرجى إدخال الرمز المكون من 4 أرقام الموضح على شاشة الطيار لتأكيد التصفية."}, status=status.HTTP_400_BAD_REQUEST)

        # Parse current paid shops list
        paid_shops_list = [id_str for id_str in order.paid_shops.split(',') if id_str]
        
        # Add the shops belonging to the current user to the paid shops list
        for item in order_items_belonging_to_user_shops:
            if item.product and item.product.shop:
                shop_id_str = str(item.product.shop.id)
                if shop_id_str not in paid_shops_list:
                    paid_shops_list.append(shop_id_str)
                    
        order.paid_shops = ','.join(paid_shops_list)
        
        # Check if all shops involved in this order have been paid
        all_involved_shop_ids = set(str(item.product.shop.id) for item in order.items.all() if item.product and item.product.shop)
        
        if all_involved_shop_ids.issubset(set(paid_shops_list)):
            order.is_paid_to_shop = True
            
        order.save()
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsApprovedUser])
    def postpone_shop_settlement(self, request, pk=None):
        order = self.get_object()
        if order.driver != request.user:
            return Response({"detail": "Not authorized to postpone this order's settlement."}, status=status.HTTP_403_FORBIDDEN)
            
        shop_id = request.data.get('shop_id')
        if not shop_id:
            return Response({"detail": "shop_id is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        from shops.models import Shop
        try:
            shop = Shop.objects.get(id=shop_id)
        except Shop.DoesNotExist:
            return Response({"detail": "Shop not found."}, status=status.HTTP_404_NOT_FOUND)
            
        postponed_list = [sid for sid in order.postponed_shops.split(',') if sid]
        shop_id_str = str(shop_id)
        
        if shop_id_str not in postponed_list:
            postponed_list.append(shop_id_str)
            order.postponed_shops = ','.join(postponed_list)
            order.save()
            
            # Send notification to the shop owner about the postponement
            Notification.objects.create(
                user=shop.owner,
                shop=shop,
                title="🚪 تأجيل تصفية الحساب لإغلاق المحل",
                message=(
                    f"أبلغ الطيار {request.user.phone} عن إغلاق المحل أو عدم توفر المالك للطلب #{order.id}. "
                    f"تم تأجيل تصفية حسابه مؤقتاً حتى تقوم بالفتح وإعادة التسوية."
                ),
                notification_type='shop_settlement_postponed'
            )
            
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsApprovedUser])
    def raise_dispute(self, request, pk=None):
        order = self.get_object()
        is_customer = (order.customer == request.user)
        is_shop_owner = order.items.filter(product__shop__owner=request.user).exists()
        is_driver = (order.driver == request.user)
        
        if not (is_customer or is_shop_owner or is_driver or request.user.is_staff):
            return Response({"detail": "Not authorized to dispute this order."}, status=status.HTTP_403_FORBIDDEN)
            
        reason = request.data.get('reason')
        if not reason:
            return Response({"detail": "Please provide a reason for the dispute."}, status=status.HTTP_400_BAD_REQUEST)
            
        order.dispute_status = 'PENDING'
        order.dispute_reason = reason
        order.disputed_by = request.user
        order.save()
        
        # Create a Report in core app to make it visible in the admin dashboard reports panel
        from core.models import Report
        Report.objects.create(
            user=request.user,
            subject=f"نزاع على الطلب #{order.id}",
            description=f"سبب تقديم الشكوى: {reason}"
        )
        
        # Schedule auto-escalation check after 6 hours (21600 seconds)
        auto_escalate_unresolved_disputes.apply_async(args=[order.id], countdown=21600)
        
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsApprovedUser])
    def toggle_item_ready(self, request, pk=None):
        order = self.get_object()
        user = request.user
        item_id = request.data.get('item_id')
        
        if not item_id:
            return Response({"detail": "Missing item_id parameter."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            item = order.items.get(id=item_id)
        except OrderItem.DoesNotExist:
            return Response({"detail": "Item not found in this order."}, status=status.HTTP_404_NOT_FOUND)
            
        if user.role != 'SHOP_OWNER' or item.product.shop.owner != user:
            return Response({"detail": "Not authorized to update this item's readiness."}, status=status.HTTP_403_FORBIDDEN)
            
        item.is_ready = not item.is_ready
        item.save()
        
        return Response({
            "item_id": item.id,
            "is_ready": item.is_ready,
            "detail": f"Item marked as {'ready' if item.is_ready else 'not ready'}."
        })

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsApprovedUser])
    def report_emergency(self, request, pk=None):
        if request.user.role != 'DRIVER':
            return Response({"detail": "Only drivers can report a delivery emergency."}, status=status.HTTP_403_FORBIDDEN)
            
        order = self.get_object()
        if order.driver != request.user:
            return Response({"detail": "You are not the assigned driver for this order."}, status=status.HTTP_403_FORBIDDEN)
            
        if order.status not in ['ACCEPTED', 'PREPARING', 'ON_DELIVERY']:
            return Response({"detail": "لا يمكن إلغاء هذا الطلب لأنه مكتمل أو غير نشط بالفعل."}, status=status.HTTP_400_BAD_REQUEST)
            
        reason = request.data.get('reason', 'ظرف طارئ / عطل بالمركبة')
        
        # Determine if driver already took possession of the items
        if order.status == 'ON_DELIVERY':
            # Driver has the products! Set status to PENDING_RETURN. Keep driver assigned so we know who has it.
            order.status = 'PENDING_RETURN'
            order.save()
            
            # Notify all unique shop owners involved that they must receive their returned items
            unique_shops = set(item.product.shop for item in order.items.select_related('product__shop').all() if item.product and item.product.shop)
            for s in unique_shops:
                Notification.objects.create(
                    user=s.owner,
                    shop=s,
                    title="🚨 مرتجع عهدة طوارئ معلق",
                    message=(
                        f"أبلغ الطيار {request.user.phone} عن حالة طارئة ({reason}) بعد استلام المنتجات. "
                        f"المنتجات حالياً في حوزة المندوب وهو مطالب بإرجاعها إليك فوراً. يرجى تأكيد الاستلام فور استلامها لتسوية حسابه."
                    ),
                    notification_type='driver_emergency_returned_pending'
                )
            
            return Response({
                "status": "PENDING_RETURN",
                "detail": "تم تسجيل الحالة الطارئة. نظراً لأنك استلمت المنتجات بالفعل، تم تعليق حسابك مؤقتاً حتى تقوم بإرجاع المنتجات للمحلات وتأكيد استلامهم للعهدة."
            })
        else:
            # Driver has NOT picked up the products yet! Safely release the order back to PENDING.
            order.driver = None
            order.picked_up_at = None
            order.status = OrderStatus.PENDING
            order.save()
            
            # Notify all unique shop owners involved
            unique_shops = set(item.product.shop for item in order.items.select_related('product__shop').all() if item.product and item.product.shop)
            for s in unique_shops:
                Notification.objects.create(
                    user=s.owner,
                    shop=s,
                    title="🚨 إلغاء توصيل الطلب لحالة طارئة",
                    message=(
                        f"اعتذر الطيار {request.user.phone} عن توصيل طلبك #{order.id} بسبب: ({reason}). "
                        f"تم إرجاع الطلب فوراً للوحة الطلبات المتاحة للبحث عن طيار بديل."
                    ),
                    notification_type='driver_emergency_cancelled'
                )
                
            # Notify the customer
            Notification.objects.create(
                user=order.customer,
                title="⏳ جاري البحث عن طيار بديل لطلبك",
                message=(
                    f"نعتذر منك، الطيار المكلف بطلبك #{order.id} واجه ظرفاً طارئاً يمنعه من إكمال الرحلة. "
                    f"تم إرجاع طلبك فوراً للبحث عن طيار آخر للتوصيل بأسرع وقت ممكن!"
                ),
                notification_type='driver_emergency_cancelled'
            )
            
            return Response({
                "status": "PENDING",
                "detail": "تم إبلاغ النظام بالحالة الطارئة وإرجاع الطلب للوحة الطيارين بنجاح."
            })

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsApprovedUser])
    def confirm_emergency_returned(self, request, pk=None):
        order = self.get_object()
        
        # Verify if the requesting user is a shop owner involved in this order
        is_shop_owner = order.items.filter(product__shop__owner=request.user).exists()
        if not is_shop_owner and not request.user.is_staff:
            return Response({"detail": "Not authorized to confirm return receipt for this order."}, status=status.HTTP_403_FORBIDDEN)
            
        if order.status != 'PENDING_RETURN':
            return Response({"detail": "هذا الطلب ليس بانتظار مرتجع طوارئ حالياً."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Reset the order so a new driver can accept it!
        old_driver = order.driver
        order.driver = None
        order.picked_up_at = None
        order.status = OrderStatus.PENDING
        order.save()
        
        # Notify the driver that the shop owner confirmed receipt and their account has been reactivated!
        if old_driver:
            Notification.objects.create(
                user=old_driver,
                title="✅ تم تسوية العهدة بنجاح",
                message=(
                    f"أكد صاحب المحل استلام المنتجات المرتجعة للطلب #{order.id}. "
                    f"تمت تسوية عهدتك وتنشيط حسابك لتلقي طلبات جديدة بنجاح! سلامتك تهمنا. ❤️"
                ),
                notification_type='driver_emergency_returned_confirmed'
            )
            
        # Notify the customer that the order is back in queue
        Notification.objects.create(
            user=order.customer,
            title="⏳ جاري البحث عن طيار بديل لطلبك",
            message=(
                f"تمت إعادة جدولة طلبك #{order.id} للبحث عن طيار آخر للتوصيل بأسرع وقت ممكن! شكراً لصبرك."
            ),
            notification_type='driver_emergency_cancelled'
        )
        
        return Response({"detail": "تم تأكيد استلام المنتجات المرتجعة وإعادة طرح الطلب للطيارين بنجاح."})

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def rate_driver(self, request, pk=None):
        order = self.get_object()
        user = request.user
        
        if order.status != OrderStatus.DELIVERED:
            return Response(
                {"detail": "يمكنك تقييم الطيار فقط بعد توصيل الطلب بنجاح."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        if not order.driver:
            return Response(
                {"detail": "لم يتم تعيين طيار لهذا الطلب بعد."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        is_customer = (order.customer == user)
        is_shop_owner = order.items.filter(product__shop__owner=user).exists()
        
        if not (is_customer or is_shop_owner):
            return Response(
                {"detail": "غير مصرح لك بتقييم الطيار لهذا الطلب."},
                status=status.HTTP_403_FORBIDDEN
            )
            
        rater_type = 'CUSTOMER' if is_customer else 'SHOP_OWNER'
        rating_val = request.data.get('rating')
        review_val = request.data.get('review', '')
        
        try:
            rating_val = int(rating_val)
            if rating_val < 1 or rating_val > 5:
                raise ValueError
        except (TypeError, ValueError):
            return Response({"detail": "التقييم يجب أن يكون رقماً صحيحاً بين 1 و 5."}, status=status.HTTP_400_BAD_REQUEST)
            
        from .models import DriverRating
        from .serializers import DriverRatingSerializer
        
        rating_obj, created = DriverRating.objects.update_or_create(
            order=order,
            rater=user,
            rater_type=rater_type,
            defaults={
                'driver': order.driver,
                'rating': rating_val,
                'review': review_val
            }
        )

        if order.driver:
            reviewer = 'العميل' if is_customer else 'صاحب المحل'
            Notification.objects.create(
                user=order.driver,
                shop=order.shop,
                title='تم تقييمك كسائق',
                message=(
                    f'لقد قام {reviewer} بتقييمك على طلب #{order.id}. ' 
                    f'التقييم: {rating_val} نجوم. راجع التفاصيل في لوحة التحكم الخاصة بك.'
                ),
                notification_type='driver_rated'
            )
            # Trigger background aggregation task
            recalculate_driver_rating_stats.delay(order.driver.id)
        
        serializer = DriverRatingSerializer(rating_obj)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def driver_rating_status(self, request, pk=None):
        order = self.get_object()
        user = request.user
        
        is_customer = (order.customer == user)
        is_shop_owner = order.items.filter(product__shop__owner=user).exists()
        
        can_rate = (
            order.status == OrderStatus.DELIVERED and 
            order.driver is not None and 
            (is_customer or is_shop_owner)
        )
        
        from .models import DriverRating
        existing_rating = None
        if can_rate:
            existing_rating_obj = DriverRating.objects.filter(
                order=order, rater=user
            ).first()
            if existing_rating_obj:
                existing_rating = {
                    'rating': existing_rating_obj.rating,
                    'review': existing_rating_obj.review
                }
                
        return Response({
            'can_rate': can_rate,
            'existing_rating': existing_rating,
            'driver_name': order.driver.first_name if order.driver else None,
            'driver_phone': order.driver.phone if order.driver else None
        })

#===== Admin Dashboard - All Orders View ==========================================

class AdminOrderPagination(PageNumberPagination):
    page_size = 15
    page_size_query_param = 'page_size'
    max_page_size = 100

class AdminOrderListView(generics.ListAPIView):
    """Admin can view all orders with search and filter."""
    serializer_class = OrderSerializer
    permission_classes = [IsAdminUserRole]
    pagination_class = AdminOrderPagination

    def get_queryset(self):
        qs = Order.objects.select_related(
            'customer', 'driver', 'shop', 'shop__owner'
        ).prefetch_related(
            'items', 'items__product'
        ).order_by('-created_at')

        search = self.request.query_params.get('search', '')
        order_status = self.request.query_params.get('status', '')

        if search:
            # Search by order ID or customer phone
            if search.isdigit():
                qs = qs.filter(Q(id=int(search)) | Q(customer__phone__icontains=search))
            else:
                qs = qs.filter(Q(customer__name__icontains=search) | Q(customer__phone__icontains=search))

        if order_status:
            qs = qs.filter(status=order_status)

        return qs

