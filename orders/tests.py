from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from shops.models import Shop, Product

User = get_user_model()

class ChatbotAPITests(APITestCase):
    def setUp(self):
        # Create user
        self.user = User.objects.create_user(phone="01012345678", password="password123")
        self.client.force_authenticate(user=self.user)
        
        # Create shop and product
        self.shop = Shop.objects.create(
            name="محل تجريبي",
            owner=self.user,
            is_approved=True
        )
        self.product = Product.objects.create(
            name="طماطم",
            price=20.0,
            shop=self.shop,
            quantity=100
        )
        self.url = reverse('chatbot-chat')

    def test_chatbot_help_intent(self):
        response = self.client.post(self.url, {"message": "مساعدة"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("مرحباً بك", response.data["response"])
        self.assertEqual(response.data["action"]["type"], "HELP")

    def test_chatbot_cart_intent_empty(self):
        response = self.client.post(self.url, {"message": "سلة المشتريات", "cart": []}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("فارغة", response.data["response"])
        self.assertEqual(response.data["action"]["type"], "SHOW_CART")

    def test_chatbot_cart_intent_with_items(self):
        cart_data = [
            {"product": self.product.id, "name": "طماطم", "price": 20.0, "quantity": 2}
        ]
        response = self.client.post(self.url, {"message": "عرض السلة", "cart": cart_data}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("طماطم", response.data["response"])
        self.assertIn("50.00", response.data["response"])  # (20 * 2) + 10 delivery = 50
        self.assertEqual(response.data["action"]["type"], "SHOW_CART")

    def test_chatbot_checkout_intent_empty(self):
        response = self.client.post(self.url, {"message": "إتمام الطلب", "cart": []}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("فارغة", response.data["response"])
        self.assertEqual(response.data["action"]["type"], "HELP")

    def test_chatbot_checkout_intent_with_items(self):
        cart_data = [
            {"product": self.product.id, "name": "طماطم", "price": 20.0, "quantity": 2}
        ]
        response = self.client.post(self.url, {"message": "checkout now", "cart": cart_data}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("إجمالي", response.data["response"])
        self.assertEqual(response.data["action"]["type"], "CHECKOUT")
        self.assertEqual(response.data["action"]["total_price"], 40.0)
        self.assertEqual(response.data["action"]["delivery_price"], 10.0)
        self.assertEqual(response.data["action"]["final_total"], 50.0)
