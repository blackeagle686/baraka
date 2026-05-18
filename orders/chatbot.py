import re
import asyncio
import threading
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.db.models import Q
from shops.models import Product, Shop
from phoenix.framework.chatbot import ChatBot
from phoenix.services.observability.logger import get_logger

logger = get_logger("Baraka.Chatbot")

# ── Module-level bot instance (built once, reused across requests) ──
_bot_instance = None

def _get_bot():
    """Return cached ChatBot instance following the Phoenix framework pattern."""
    global _bot_instance
    if _bot_instance is None:
        _bot_instance = (
            ChatBot(local=False)
            .with_openai(
                api_key="ak_2yp3Xw1Ny7ky2pF7er9x93ZO9jj6G",
                base_url="https://api.longcat.chat/openai"
            )
            .with_model(llm="LongCat-Flash-Lite")
            .with_system_prompt(
                "أنت مساعد بركة الذكي لمساعدة المستخدمين في شراء الخضروات والمنتجات وتأكيد الطلبات. "
                "أجب بالعربية بشكل ودود ومختصر. لا تستخدم أكثر من 3 أسطر في الرد."
            )
            .build()
        )
    return _bot_instance


def _run_bot_chat(text, session_id):
    """Run async bot.chat() in a dedicated thread with its own event loop."""
    result = [None]
    error = [None]

    def _target():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            bot = _get_bot()
            bot.set_session(session_id)
            result[0] = loop.run_until_complete(bot.chat(text=text))
        except Exception as e:
            error[0] = e
        finally:
            loop.close()

    thread = threading.Thread(target=_target)
    thread.start()
    thread.join(timeout=30)

    if thread.is_alive():
        raise TimeoutError("LongCat LLM call timed out after 30s")
    if error[0]:
        raise error[0]
    return result[0]


class ChatbotView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        message = request.data.get('message', '').strip()
        session_id = request.data.get('session_id', 'default_session')

        if not message:
            return Response({"detail": "المسج مطلوب"}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Call LongCat via Phoenix ChatBot framework
        openai_response = None
        try:
            openai_response = _run_bot_chat(message, session_id)
            logger.info("LongCat LLM response received successfully.")
        except Exception as e:
            logger.warning(f"LongCat LLM call failed, falling back to local engine: {e}")

        # 2. Intent Parsing Engine
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

        elif any(kw in message_lower for kw in ["إتمام", "تأكيد", "طلب", "اطلب", "checkout", "confirm", "order"]):
            response_text = (
                "حاضر يا فندم! 🛒✨ سأقوم بتأكيد الطلب وإتمام عملية الشراء لجميع المنتجات الموجودة في سلتك الآن.\n\n"
                "يرجى مراجعة المنتجات في سلتك وتأكيد عنوان التوصيل."
            )
            action = {"type": "CHECKOUT"}

        elif any(kw in message_lower for kw in ["سلة", "سلتي", "العربة", "cart", "basket"]):
            response_text = (
                "بالتأكيد! 🛒 إليك المنتجات الموجودة في سلة تسوقك حالياً. يمكنك تعديل الكميات أو إتمام الطلب في أي وقت."
            )
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
                action = {"type": "ADD_TO_CART", "product_id": best_product.id, "quantity": qty}
            else:
                response_text = (
                    "عذراً، لم أستطع تحديد المنتج بدقة في قاعدة البيانات. 🥺\n"
                    "هل يمكنك تحديد اسم المنتج بوضوح؟ مثل: 'أضف 2 طماطم' أو 'أبحث عن تفاح'."
                )

        # Intent: Search / Recommend
        else:
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
                            "id": prod.id, "name": prod.name,
                            "price": float(prod.price),
                            "shop_id": prod.shop.id if prod.shop else None,
                            "shop_name": shop_name,
                            "image": prod.image.url if prod.image else None,
                        })
                    response_text += "\nاكتب لي المنتج مع الكمية لإضافته للسلة فوراً! (مثال: 'أضف 2 كيلو تفاح')."
                    action = {"type": "RECOMMEND_PRODUCTS"}
                else:
                    response_text = openai_response if openai_response else (
                        f"لم أجد منتجات تطابق (**{clean_search}**) حالياً في قاعدة البيانات. 🥺\n"
                        "هل تريد أن أبحث لك عن شيء آخر؟"
                    )
            else:
                response_text = openai_response if openai_response else (
                    "أنا مساعد بركة الذكي! 🤖🍎 كيف يمكنني مساعدتك اليوم؟\n"
                    "اكتب لي ما تريد البحث عنه، مثل: 'أبحث عن خضروات طازجة' أو 'أسعار الفواكه'."
                )

        return Response({"response": response_text, "action": action, "products": products_data})
