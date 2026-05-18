import re
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.db.models import Q
from shops.models import Product, Shop
from openai import OpenAI

import logging
logger = logging.getLogger("Baraka.Chatbot")

# ── Singleton OpenAI client ──
_client = OpenAI(
    api_key="ak_2yp3Xw1Ny7ky2pF7er9x93ZO9jj6G",
    base_url="https://api.longcat.chat/openai",
)

SYSTEM_PROMPT = (
    "أنت مساعد بركة الذكي لمساعدة المستخدمين في شراء الخضروات والمنتجات وتأكيد الطلبات. "
    "أجب بالعربية بشكل ودود ومختصر. لا تستخدم أكثر من 3 أسطر في الرد."
)


class ChatbotView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        message = request.data.get('message', '').strip()
        if not message:
            return Response({"detail": "المسج مطلوب"}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Call LongCat LLM
        openai_response = None
        try:
            completion = _client.chat.completions.create(
                model="LongCat-Flash-Lite",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": message},
                ],
                max_tokens=1000,
            )
            openai_response = completion.choices[0].message.content.strip()
        except Exception as e:
            logger.warning(f"LongCat call failed: {e}")

        # 2. Intent Engine
        message_lower = message.lower()
        response_text = ""
        action = None
        products_data = []

        if any(kw in message_lower for kw in ["مساعدة", "help", "تعليمات", "كيف", "ماذا تفعل"]):
            response_text = (
                "مرحباً بك في مساعد بركة الذكي! 🍎🤖\n\n"
                "يمكنني مساعدتك في:\n"
                "1. 🔍 **البحث عن المنتجات ومقارنة الأسعار**: اكتب 'أبحث عن طماطم'.\n"
                "2. 🛒 **إضافة المنتجات للسلة**: اكتب 'أضف 3 كيلو تفاح'.\n"
                "3. 📋 **عرض سلة التسوق**: اكتب 'عرض السلة'.\n"
                "4. 💳 **إتمام الطلب**: اكتب 'إتمام الطلب'.\n\n"
                "كيف يمكنني مساعدتك اليوم؟ 😊"
            )
            action = {"type": "HELP"}

        elif any(kw in message_lower for kw in ["إتمام", "تأكيد", "طلب", "اطلب", "checkout", "confirm", "order"]):
            response_text = (
                "حاضر يا فندم! 🛒✨ يرجى مراجعة سلتك وتأكيد عنوان التوصيل."
            )
            action = {"type": "CHECKOUT"}

        elif any(kw in message_lower for kw in ["سلة", "سلتي", "العربة", "cart", "basket"]):
            response_text = "بالتأكيد! 🛒 إليك المنتجات في سلتك حالياً."
            action = {"type": "VIEW_CART"}

        elif any(kw in message_lower for kw in ["أضف", "اضف", "اريد", "أريد"]):
            qty = 1
            qty_match = re.search(r'(\d+)', message)
            if qty_match:
                qty = int(qty_match.group(1))

            clean_msg = message
            for kw in ["أضف", "اضف", "كيلو", "حبة", "من", "محل", "شراء", "اريد", "أريد", "المنتج", "رقم"]:
                clean_msg = clean_msg.replace(kw, "")
            clean_msg = re.sub(r'\d+', '', clean_msg).strip()

            best_product = None
            for prod in Product.objects.filter(available=True):
                if prod.name.lower() in clean_msg.lower() or clean_msg.lower() in prod.name.lower():
                    best_product = prod
                    break

            if best_product:
                shop_name = best_product.shop.name if best_product.shop else "المحل"
                response_text = (
                    f"تمت إضافة **{qty}** من **{best_product.name}** "
                    f"بسعر **{best_product.price} ج.م** من (**{shop_name}**) للسلة! 🍎🛒"
                )
                action = {"type": "ADD_TO_CART", "product_id": best_product.id, "quantity": qty}
            else:
                response_text = "عذراً، لم أجد المنتج. جرب: 'أضف 2 طماطم' أو 'أبحث عن تفاح'. 🥺"

        else:
            clean_search = message
            for kw in ["أبحث", "ابحث", "عن", "سعر", "أسعار", "اسعار", "بحث", "فين", "عايز"]:
                clean_search = clean_search.replace(kw, "")
            clean_search = clean_search.strip()

            if len(clean_search) >= 2:
                prods = Product.objects.filter(
                    Q(name__icontains=clean_search) | Q(description__icontains=clean_search),
                    available=True
                ).select_related('shop')

                if prods.exists():
                    response_text = f"وجدت المنتجات التالية لـ **{clean_search}**: 🔍✨\n\n"
                    for i, p in enumerate(prods[:5], 1):
                        sn = p.shop.name if p.shop else "محل غير معروف"
                        response_text += f"{i}. **{p.name}** — {p.price} ج.م في ({sn})\n"
                        products_data.append({
                            "id": p.id, "name": p.name, "price": float(p.price),
                            "shop_id": p.shop.id if p.shop else None, "shop_name": sn,
                            "image": p.image.url if p.image else None,
                        })
                    response_text += "\nاكتب 'أضف 2 كيلو تفاح' لإضافته للسلة!"
                    action = {"type": "RECOMMEND_PRODUCTS"}
                else:
                    response_text = openai_response or f"لم أجد منتجات تطابق **{clean_search}** حالياً. 🥺"
            else:
                response_text = openai_response or (
                    "أنا مساعد بركة الذكي! 🤖🍎 اكتب لي ما تريد البحث عنه."
                )

        return Response({"response": response_text, "action": action, "products": products_data})
