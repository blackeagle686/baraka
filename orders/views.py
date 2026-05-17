from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Order, OrderItem, OrderStatus
from .serializers import OrderSerializer
from shops.models import Shop, Product

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.role == 'ADMIN':
            return Order.objects.all().order_by('-created_at')
        elif user.role == 'SHOP_OWNER':
            return Order.objects.filter(shop__owner=user).order_by('-created_at')
        elif user.role == 'DRIVER':
            # Drivers can see their own assigned orders or accepted orders that need a driver
            from django.db.models import Q
            return Order.objects.filter(
                Q(driver=user) | Q(driver__isnull=True, status__in=['ACCEPTED', 'PREPARING'])
            ).order_by('-created_at')
        else:
            # Customer
            return Order.objects.filter(customer=user).order_by('-created_at')

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
        
        if is_shop_owner and not is_driver and not request.user.is_staff:
            if new_status == 'DELIVERED':
                return Response({"detail": "Only drivers can mark orders as DELIVERED."}, status=status.HTTP_403_FORBIDDEN)
            
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
                order.delivery_price = float(delivery_price)
            except ValueError:
                return Response({"detail": "Invalid delivery price."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            order.delivery_price = 15.00  # Default base delivery fee (15 ج.م)
            
        order.driver = request.user
        order.status = OrderStatus.ON_DELIVERY
        order.save()
        return Response(self.get_serializer(order).data)
