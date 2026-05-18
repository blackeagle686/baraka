import re
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.db.models import Q
from shops.models import Product, Shop
from phoenix.services.observability.logger import get_logger

logger = get_logger("Baraka.Chatbot")

# ── Singleton OpenAI client (initialized once, reused across requests) ──
_openai_client = None

def _get_openai_client():
    """Return a cached synchronous OpenAI client pointing at LongCat."""
    global _openai_client
    if _openai_client is None:
        from openai import OpenAI
        import httpx
        _openai_client = OpenAI(
            api_key="ak_2yp3Xw1Ny7ky2pF7er9x93ZO9jj6G",
            base_url="https://api.longcat.chat/openai",
            timeout=httpx.Timeout(60.0, connect=30.0),
        )
    return _openai_client


class ChatbotView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        message = request.data.get('message', '').strip()
        session_id = request.data.get('session_id', 'default_session')

        if not message:
            return Response({"detail": "المسج مطلوب"}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Call LongCat LLM directly (synchronous — no async_to_sync issues)
        openai_response = None
        try:
            client = _get_openai_client()
            system_prompt = (
                "أنت مساعد بركة الذكي لمساعدة المستخدمين في شراء الخضروات والمنتجات وتأكيد الطلبات. "
                "أجب بالعربية بشكل ودود ومختصر. لا تستخدم أكثر من 3 أسطر في الرد."
            )
            completion = client.chat.completions.create(
                model="LongCat-Flash-Lite",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message},
                ],
                max_tokens=512,
            )
            if completion and completion.choices:
                openai_response = completion.choices[0].message.content.strip()
                logger.info(f"LongCat LLM response received successfully.")
        except Exception as e:
            logger.warning(f"LongCat LLM call failed, falling back to local engine: {e}")

        # 2. Advanced Intent Parsing Engine (Arabic Natural Language & eCommerce Logic)
        message_lower = message.lower()
        response_text = ""
        action = None
        products_data = []

        # Intent: Help
        if any(kw in message_lower for kw in ["مساعدة", "help", "تعليمات", "كيف", "ماذا تفعل"]):
            response_text = (
                "مرحباً بك في مساعد بركة الذكي! 🍎🤖\n\n"
                "يمكنني مساعدتك في:\n"
                "1. 🔍 **البحث عن المنتجات ومقارنة الأسعار**: اكتب 'أبحث عن طماطم' أو 'أسعار التفاح'.\n"
                "2. 🛒 **إضافة المنتجات للسلة**: اكتب 'أضف 3 كيلو تفاح من محل البركة'.\n"
                "3. 📋 **عرض سلة التسوق**: اكتب 'عرض السلة' أو 'ماذا في سلتي؟'.\n"
                "4. 💳 **إتمام الطلب وتأكيده**: اكتب 'إتمام الطلب' أو 'تأكيد الشراء'.\n\n"
                "كيف يمكنني مساعدتك اليوم؟ 😊"
            )
            action = {"type": "HELP"}

        # Intent: Settle / Checkout / Order
        elif any(kw in message_lower for kw in ["إتمام", "شراء", "تأكيد", "طلب", "اطلب", "checkout", "confirm", "order"]):
            response_text = (
                "حاضر يا فندم! 🛒✨ سأقوم بتأكيد الطلب وإتمام عملية الشراء لجميع المنتجات الموجودة في سلتك الآن.\n\n"
                "يرجى مراجعة المنتجات في سلتك وتأكيد عنوان التوصيل."
            )
            action = {"type": "CHECKOUT"}

        # Intent: View Cart
        elif any(kw in message_lower for kw in ["سلة", "سلتي", "العربة", "cart", "basket"]):
            response_text = (
                "بالتأكيد! 🛒 إليك المنتجات الموجودة في سلة تسوقك حالياً. يمكنك تعديل الكميات أو إتمام الطلب في أي وقت."
            )
            action = {"type": "VIEW_CART"}

        # Intent: Add to Cart (e.g. "أضف 2 طماطم من محل البركة", "أريد شراء 3 تفاح")
        elif any(kw in message_lower for kw in ["أضف", "اضف", "شراء", "اريد", "أريد"]):
            # Try to extract quantity
            qty = 1
            qty_match = re.search(r'(\d+)', message)
            if qty_match:
                qty = int(qty_match.group(1))

            # Try to extract product name from database
            clean_msg = message
            for kw in ["أضف", "اضف", "كيلو", "حبة", "من", "محل", "شراء", "اريد", "أريد", "المنتج", "رقم"]:
                clean_msg = clean_msg.replace(kw, "")
            clean_msg = re.sub(r'\d+', '', clean_msg).strip()

            # Find matching products
            matching_products = Product.objects.filter(available=True)
            best_product = None
            
            for prod in matching_products:
                if prod.name.lower() in clean_msg.lower() or clean_msg.lower() in prod.name.lower():
                    best_product = prod
                    break

            if best_product:
                shop_name = best_product.shop.name if best_product.shop else "المحل"
                response_text = (
                    f"تمت إضافة **{qty}** من **{best_product.name}** "
                    f"بسعر (**{best_product.price} ج.م** للوحدة) من متجر (**{shop_name}**) إلى سلة تسوقك بنجاح! 🍎🛒\n\n"
                    "هل تريد البحث عن منتج آخر أم تريد الانتقال للسلة لتأكيد الطلب؟"
                )
                action = {
                    "type": "ADD_TO_CART",
                    "product_id": best_product.id,
                    "quantity": qty
                }
            else:
                response_text = (
                    "عذراً، لم أستطع تحديد المنتج بدقة في قاعدة البيانات. 🥺\n"
                    "هل يمكنك تحديد اسم المنتج بوضوح؟ مثل: 'أضف 2 طماطم' أو 'أبحث عن تفاح'."
                )

        # Intent: Search / Recommend
        else:
            # Extract search keyword
            clean_search = message
            for kw in ["أبحث", "ابحث", "عن", "سعر", "أسعار", "اسعار", "بحث", "فين", "عايز"]:
                clean_search = clean_search.replace(kw, "")
            clean_search = clean_search.strip()

            if len(clean_search) >= 2:
                matching_prods = Product.objects.filter(
                    Q(name__icontains=clean_search) | Q(description__icontains=clean_search),
                    available=True
                ).select_related('shop')
                
                if matching_prods.exists():
                    response_text = f"لقد وجدت المنتجات التالية لـ (**{clean_search}**) في قاعدة البيانات: 🔍✨\n\n"
                    for idx, prod in enumerate(matching_prods[:5], 1):
                        shop_name = prod.shop.name if prod.shop else "محل غير معروف"
                        response_text += f"{idx}. **{prod.name}** بسعر **{prod.price} ج.م** متوفر في متجر (**{shop_name}**)\n"
                        products_data.append({
                            "id": prod.id,
                            "name": prod.name,
                            "price": float(prod.price),
                            "shop_id": prod.shop.id if prod.shop else None,
                            "shop_name": shop_name,
                            "image": prod.image.url if prod.image else None,
                            "quantity": prod.quantity if hasattr(prod, 'quantity') else 999,
                        })
                    response_text += "\nاكتب لي المنتج مع الكمية لإضافته للسلة فوراً! (مثال: 'أضف 2 كيلو تفاح')."
                    action = {"type": "RECOMMEND_PRODUCTS"}
                else:
                    if openai_response:
                        response_text = openai_response
                    else:
                        response_text = (
                            f"لم أجد منتجات تطابق (**{clean_search}**) حالياً في قاعدة البيانات. 🥺\n"
                            "هل تريد أن أبحث لك عن شيء آخر؟"
                        )
            else:
                if openai_response:
                    response_text = openai_response
                else:
                    response_text = (
                        "أنا مساعد بركة الذكي! 🤖🍎 كيف يمكنني مساعدتك اليوم؟\n"
                        "اكتب لي ما تريد البحث عنه، مثل: 'أبحث عن خضروات طازجة' أو 'أسعار الفواكه'."
                    )

        return Response({
            "response": response_text,
            "action": action,
            "products": products_data
        })
