import re
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.db.models import Q, Min, Max, Avg
from shops.models import Product, Shop, Category
from .models import Order
from openai import OpenAI

import logging
logger = logging.getLogger("Baraka.Chatbot")

# ── Singleton OpenAI client ──
_client = OpenAI(
    api_key="ak_2yp3Xw1Ny7ky2pF7er9x93ZO9jj6G",
    base_url="https://api.longcat.chat/openai",
)

SYSTEM_PROMPT = (
    "أنت مساعد بركة الذكي — مساعد تسوق إلكتروني لمنصة بركة لتوصيل الطلبات في القرى المصرية.\n"
    "ستحصل على بيانات حقيقية عن المنتجات والمحلات المتاحة، بالإضافة إلى محتويات سلة المستخدم الحالية وطلباته السابقة أو النشطة.\n"
    "مهمتك:\n"
    "1. أجب فقط بناءً على البيانات الحقيقية المقدمة لك.\n"
    "2. إذا سأل المستخدم عن سلة مشترياته، أخبره بالمنتجات الموجودة فيها وإجمالي السعر بدقة من البيانات المرفقة.\n"
    "3. إذا سأل عن طلباته، أخبره بحالة طلباته النشطة أو السابقة بناءً على البيانات.\n"
    "4. إذا سأل عن أفضل سعر أو عرض، قارن الأسعار من البيانات وأخبره.\n"
    "5. أجب بالعربية بشكل ودود ومختصر واستخدم إيموجي مناسبة.\n"
    "6. إذا وجدت منتجات مناسبة ليست في سلة المستخدم، اقترح عليه إضافتها.\n"
    "7. لا تزد عن 5 أسطر في الرد إلا إذا كنت تسرد تفاصيل السلة."
)


# ── Intent Detection ──

ADD_KEYWORDS = ["أضف", "اضف", "ضيف", "حط", "أريد", "اريد", "عايز اشتري"]
CART_KEYWORDS = ["سلة", "سلتي", "العربة", "cart", "basket"]
CHECKOUT_KEYWORDS = ["إتمام", "تأكيد", "طلب", "اطلب", "checkout", "confirm", "order", "اشتري كل"]
HELP_KEYWORDS = ["مساعدة", "help", "تعليمات", "ماذا تفعل"]


def _detect_intent(message_lower):
    """Detect user intent from message keywords. Returns (intent, None) or None."""
    if any(kw in message_lower for kw in HELP_KEYWORDS):
        return "HELP"
    if any(kw in message_lower for kw in CHECKOUT_KEYWORDS):
        return "CHECKOUT"
    if any(kw in message_lower for kw in ADD_KEYWORDS):
        return "ADD_TO_CART"
    return None


def _handle_add_to_cart(message):
    """Extract product name & quantity, find it in DB, return response."""
    # Extract quantity
    qty = 1
    qty_match = re.search(r'(\d+)', message)
    if qty_match:
        qty = int(qty_match.group(1))

    # Clean message to extract product name
    clean = message
    for kw in ADD_KEYWORDS + ["كيلو", "حبة", "قطعة", "من", "محل", "شراء", "المنتج", "رقم", "للسلة", "في", "السلة"]:
        clean = clean.replace(kw, "")
    clean = re.sub(r'\d+', '', clean).strip()

    if not clean:
        return None, None, None

    # Search DB for matching product
    products = Product.objects.filter(available=True, quantity__gt=0, shop__is_open=True).select_related('shop')
    best = None
    for prod in products:
        pname = prod.name.lower()
        cname = clean.lower()
        if pname in cname or cname in pname:
            best = prod
            break

    # Fuzzy fallback: match any word in the cleaned text
    if not best:
        words = [w for w in clean.split() if len(w) >= 2]
        for word in words:
            found = products.filter(Q(name__icontains=word))
            if found.exists():
                best = found.first()
                break

    if best:
        shop_name = best.shop.name if best.shop else "المحل"
        actual_qty = min(qty, best.quantity)
        text = (
            f"تمت إضافة **{actual_qty}** من **{best.name}** "
            f"بسعر **{best.price} ج.م** من (**{shop_name}**) للسلة! 🍎🛒"
        )
        action = {"type": "ADD_TO_CART", "product_id": best.id, "quantity": actual_qty}
        prod_data = [{
            "id": best.id, "name": best.name, "price": float(best.price),
            "shop_id": best.shop.id if best.shop else None, "shop_name": shop_name,
            "image": best.image.url if best.image else None, "quantity": best.quantity,
        }]
        return text, action, prod_data

    return None, None, None


def _build_db_context(message, user, cart_data):
    """Query the database and build context for the LLM."""
    products_data = []

    open_shops = Shop.objects.filter(is_open=True)
    shop_names = [s.name for s in open_shops]

    all_products = (
        Product.objects.filter(available=True, quantity__gt=0, shop__is_open=True)
        .select_related('shop', 'category')
        .order_by('-created_at')
    )

    # Extract search terms
    clean = message
    for kw in ["أبحث", "ابحث", "عن", "سعر", "أسعار", "اسعار", "بحث", "فين",
               "عايز", "محل", "منتجات", "ايه", "إيه", "شو", "وريني", "عندكم",
               "أرخص", "ارخص", "أفضل", "افضل", "أغلى", "اغلى", "جديد", "new",
               "ما", "هي", "هو", "في", "لو", "سمحت", "ممكن", "أعرف", "اعرف",
               "حاجة", "حاجات", "اضفهم", "اضفها", "كلهم", "عنوان", "موقع", "مكان"]:
        clean = clean.replace(kw, "")
    clean = clean.strip()

    # Check if asking about a specific shop
    target_shop = None
    for shop in open_shops:
        if shop.name in message:
            target_shop = shop
            break

    if target_shop:
        matched = all_products.filter(shop=target_shop)
    elif len(clean) >= 2:
        matched = all_products.filter(
            Q(name__icontains=clean) | Q(description__icontains=clean) |
            Q(category__name__icontains=clean)
        )
    else:
        matched = all_products

    # Build context
    ctx = []
    shop_info_list = [f"{s.name} (العنوان: {s.address})" for s in open_shops]
    ctx.append(f"المحلات المفتوحة ({open_shops.count()}): {', '.join(shop_info_list) or 'لا توجد'}")
    ctx.append(f"إجمالي المنتجات المتاحة: {all_products.count()}")

    if target_shop:
        ctx.append(f"\nالمستخدم يسأل عن محل: {target_shop.name} (العنوان: {target_shop.address})")

    product_list = list(matched[:15])
    if product_list:
        ctx.append(f"\nالمنتجات المطابقة ({matched.count()}):")
        for p in product_list:
            sn = p.shop.name if p.shop else "غير معروف"
            cat = p.category.name if p.category else "عام"
            ctx.append(f"- {p.name} | {p.price} ج.م | متاح: {p.quantity} | محل: {sn} | تصنيف: {cat}")
            products_data.append({
                "id": p.id, "name": p.name, "price": float(p.price),
                "shop_id": p.shop.id if p.shop else None, "shop_name": sn,
                "image": p.image.url if p.image else None, "quantity": p.quantity,
            })

        stats = matched.aggregate(min_price=Min('price'), max_price=Max('price'), avg_price=Avg('price'))
        ctx.append(f"\nالأسعار: أقل {stats['min_price']} | أعلى {stats['max_price']} | متوسط {stats['avg_price']:.1f} ج.م")
    else:
        ctx.append("\nلا توجد منتجات مطابقة.")

    cheapest = all_products.order_by('price')[:5]
    if cheapest:
        ctx.append("\nأرخص 5 منتجات:")
        for p in cheapest:
            ctx.append(f"- {p.name}: {p.price} ج.م من {p.shop.name}")

    newest = all_products.order_by('-created_at')[:5]
    if newest:
        ctx.append("\nأحدث 5 منتجات:")
        for p in newest:
            ctx.append(f"- {p.name}: {p.price} ج.م من {p.shop.name}")

    # Add Cart Info
    if cart_data:
        ctx.append("\n--- سلة مشتريات المستخدم الحالية ---")
        total_cart = 0
        for item in cart_data:
            qty = item.get('quantity', 1)
            price = float(item.get('price', 0))
            subtotal = qty * price
            total_cart += subtotal
            ctx.append(f"- {item.get('name')} | الكمية: {qty} | السعر: {price} | الإجمالي: {subtotal} ج.م")
        ctx.append(f"إجمالي سلة المشتريات: {total_cart} ج.م")
    else:
        ctx.append("\n--- سلة مشتريات المستخدم الحالية ---")
        ctx.append("السلة فارغة حالياً.")

    # Add Orders Info
    recent_orders = Order.objects.filter(customer=user).order_by('-created_at')[:3]
    if recent_orders.exists():
        ctx.append("\n--- طلبات المستخدم السابقة/النشطة ---")
        for o in recent_orders:
            ctx.append(f"- طلب رقم #{o.id} | الحالة: {o.get_status_display()} | الإجمالي: {o.total_price} ج.م | التاريخ: {o.created_at.strftime('%Y-%m-%d %H:%M')}")

    return "\n".join(ctx), products_data


class ChatbotView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        message = request.data.get('message', '').strip()
        cart_data = request.data.get('cart', [])
        
        if not message:
            return Response({"detail": "المسج مطلوب"}, status=status.HTTP_400_BAD_REQUEST)

        message_lower = message.lower()

        # ── Layer 1: Local Intent Detection for cart actions ──
        intent = _detect_intent(message_lower)

        if intent == "HELP":
            return Response({"response": (
                "مرحباً بك في مساعد بركة الذكي! 🍎🤖\n\n"
                "اكتب لي أي حاجة زي:\n"
                "• 'ايه المنتجات الجديدة؟' أو 'ايه أرخص حاجة؟'\n"
                "• 'منتجات محل [اسم المحل]'\n"
                "• 'أضف 2 طماطم' لإضافة منتج للسلة\n"
                "• 'إتمام الطلب' لتأكيد الشراء 😊"
            ), "action": {"type": "HELP"}, "products": []})

        if intent == "CHECKOUT":
            return Response({"response": (
                "حاضر يا فندم! 🛒✨ يرجى مراجعة سلتك وتأكيد عنوان التوصيل."
            ), "action": {"type": "CHECKOUT"}, "products": []})

        if intent == "ADD_TO_CART":
            text, action, prods = _handle_add_to_cart(message)
            if text:
                return Response({"response": text, "action": action, "products": prods})
            # Product not found — fall through to LLM for a helpful answer

        # ── Layer 2: LLM with real database context ──
        db_context, products_data = _build_db_context(message, request.user, cart_data)

        response_text = ""
        action = None
        try:
            completion = _client.chat.completions.create(
                model="LongCat-Flash-Lite",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"بيانات المنتجات:\n{db_context}\n\nسؤال المستخدم: {message}"},
                ],
                max_tokens=1000,
            )
            response_text = completion.choices[0].message.content.strip()
            if products_data:
                action = {"type": "RECOMMEND_PRODUCTS"}
        except Exception as e:
            logger.warning(f"LongCat call failed: {e}")
            if products_data:
                response_text = f"وجدت {len(products_data)} منتج! 🔍✨\n"
                for i, p in enumerate(products_data[:5], 1):
                    response_text += f"{i}. **{p['name']}** — {p['price']} ج.م في ({p['shop_name']})\n"
                action = {"type": "RECOMMEND_PRODUCTS"}
            else:
                response_text = "عذراً، لم أجد منتجات تطابق بحثك حالياً. جرب كلمة أخرى! 🥺"

        return Response({"response": response_text, "action": action, "products": products_data})
