from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Order, OrderItem, OrderStatus
from .serializers import OrderSerializer
from shops.models import Shop, Product
from users.permissions import IsApprovedOrReadOnly

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated, IsApprovedOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        # High-Performance Query Optimization: join related objects in a single query
        base_qs = Order.objects.select_related(
            'customer', 'driver', 'shop', 'shop__owner'
        ).prefetch_related(
            'items', 'items__product', 'items__product__shop'
        ).order_by('-created_at')

        # Admins have their own dedicated AdminOrderListView (/api/admin/orders/) for global access.
        # When an admin uses the standard order endpoint (e.g. from their personal cart),
        # they should only see their own personal orders.
        if user.role == 'SHOP_OWNER':
            return base_qs.filter(shop__owner=user)
        elif user.role == 'DRIVER':
            from django.db.models import Q
            return base_qs.filter(
                Q(driver=user) | Q(driver__isnull=True, status__in=['PENDING', 'ACCEPTED', 'PREPARING', 'ON_DELIVERY'])
            )
        else:
            # Customer
            return base_qs.filter(customer=user)

    def create(self, request, *args, **kwargs):
        if request.user.role != 'CUSTOMER' and not request.user.is_staff:
            return Response({"detail": "Only customers can place orders."}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        shop_id = data.get('shop')
        address = data.get('address')
        items_data = data.get('items', [])
        
        if not shop_id or not items_data:
            return Response({"detail": "Missing shop or items data."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            shop = Shop.objects.get(id=shop_id)
        except Shop.DoesNotExist:
            return Response({"detail": "Shop not found."}, status=status.HTTP_404_NOT_FOUND)
            
        total_price = 0
        order_items = []
        
        for it in items_data:
            try:
                prod = Product.objects.get(id=it['product'], shop=shop)
            except Product.DoesNotExist:
                return Response({"detail": f"Product {it['product']} not found in this shop."}, status=status.HTTP_400_BAD_REQUEST)
            
            qty = int(it.get('quantity', 1))
            if qty > prod.quantity:
                return Response({"detail": f"المنتج '{prod.name}' لا يحتوي على كمية كافية في المخزن! المتاح حالياً: {prod.quantity} فقط."}, status=status.HTTP_400_BAD_REQUEST)
            
            price = prod.price
            total_price += price * qty
            order_items.append((prod, qty, price))
            
        order = Order.objects.create(
            customer=request.user,
            shop=shop,
            total_price=total_price,
            address=address or request.user.location or '',
            status=OrderStatus.PENDING
        )
        
        for prod, qty, price in order_items:
            OrderItem.objects.create(
                order=order,
                product=prod,
                quantity=qty,
                price=price
            )
            # Deduct stock and save
            prod.quantity -= qty
            if prod.quantity == 0:
                prod.available = False
            prod.save()
            
        # High-Performance Asynchronous Dispatch: Alert nearby drivers in the background
        from .tasks import send_order_notifications_to_drivers
        send_order_notifications_to_drivers.delay(order.id)
            
        serializer = self.get_serializer(order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def update_status(self, request, pk=None):
        order = self.get_object()
        new_status = request.data.get('status')
        
        is_shop_owner = (order.shop.owner == request.user)
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

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def accept_delivery(self, request, pk=None):
        if request.user.role != 'DRIVER':
            return Response({"detail": "Only drivers can accept delivery assignment."}, status=status.HTTP_403_FORBIDDEN)
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
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def confirm_payment_received(self, request, pk=None):
        order = self.get_object()
        if order.shop.owner != request.user and not request.user.is_staff:
            return Response({"detail": "Not authorized to settle this order's cash."}, status=status.HTTP_403_FORBIDDEN)
            
        # Enforce Driver OTP code verification for shop owners confirming receipt of money
        driver_otp = request.data.get('driver_otp')
        if not driver_otp or driver_otp != order.driver_otp:
            return Response({"detail": "رمز تصفية الحساب غير صحيح! يرجى إدخال الرمز المكون من 4 أرقام الموضح على شاشة الطيار لتأكيد التصفية."}, status=status.HTTP_400_BAD_REQUEST)

        order.is_paid_to_shop = True
        order.save()
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def raise_dispute(self, request, pk=None):
        order = self.get_object()
        is_customer = (order.customer == request.user)
        is_shop_owner = (order.shop.owner == request.user)
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
        return Response(self.get_serializer(order).data)


# ==========================================
# Admin Dashboard - All Orders View
# ==========================================
from rest_framework import generics
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q
from users.permissions import IsAdminUserRole


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

