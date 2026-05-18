import re
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.db.models import Q, Min, Max, Avg
from shops.models import Product, Shop, Category
from openai import OpenAI

import logging
logger = logging.getLogger("Baraka.Chatbot")

# ── Singleton OpenAI client ──
_client = OpenAI(
    api_key="ak_2yp3Xw1Ny7ky2pF7er9x93ZO9jj6G",
    base_url="https://api.longcat.chat/openai",
)


def _build_db_context(message):
    """
    Query the database and build a rich context string for the LLM.
    Returns (context_text, products_list_for_frontend).
    """
    products_data = []

    # 1. Get all open shops
    open_shops = Shop.objects.filter(is_open=True)
    shop_names = [s.name for s in open_shops]

    # 2. Get all available products with shop info
    all_products = (
        Product.objects
        .filter(available=True, quantity__gt=0)
        .select_related('shop', 'category')
        .order_by('-created_at')
    )

    # 3. Try to find products matching user's query keywords
    clean = message
    for kw in ["أبحث", "ابحث", "عن", "سعر", "أسعار", "اسعار", "بحث", "فين",
               "عايز", "محل", "منتجات", "ايه", "إيه", "شو", "وريني", "عندكم",
               "أرخص", "ارخص", "أفضل", "افضل", "أغلى", "اغلى", "جديد", "new",
               "ما", "هي", "هو", "في", "لو", "سمحت", "ممكن", "أعرف", "اعرف"]:
        clean = clean.replace(kw, "")
    clean = clean.strip()

    # Check if asking about a specific shop
    target_shop = None
    for shop in open_shops:
        if shop.name in message:
            target_shop = shop
            break

    # Filter products based on context
    if target_shop:
        matched = all_products.filter(shop=target_shop)
    elif len(clean) >= 2:
        matched = all_products.filter(
            Q(name__icontains=clean) | Q(description__icontains=clean) |
            Q(category__name__icontains=clean)
        )
    else:
        matched = all_products  # Show everything for general questions

    # 4. Build the context string
    context_lines = []
    context_lines.append(f"عدد المحلات المفتوحة حالياً: {open_shops.count()}")
    context_lines.append(f"أسماء المحلات: {', '.join(shop_names) if shop_names else 'لا توجد محلات مفتوحة'}")
    context_lines.append(f"إجمالي المنتجات المتاحة: {all_products.count()}")

    if target_shop:
        context_lines.append(f"\nالمستخدم يسأل عن محل: {target_shop.name}")

    # Add product details (limit to 15 for token efficiency)
    product_list = matched[:15]
    if product_list:
        context_lines.append(f"\nالمنتجات المطابقة ({matched.count()} منتج):")
        for p in product_list:
            shop_name = p.shop.name if p.shop else "غير معروف"
            cat = p.category.name if p.category else "بدون تصنيف"
            context_lines.append(
                f"- {p.name} | السعر: {p.price} ج.م | الكمية المتاحة: {p.quantity} | "
                f"المحل: {shop_name} | التصنيف: {cat}"
            )
            products_data.append({
                "id": p.id, "name": p.name, "price": float(p.price),
                "shop_id": p.shop.id if p.shop else None,
                "shop_name": shop_name,
                "image": p.image.url if p.image else None,
                "quantity": p.quantity,
            })

        # Add price stats
        stats = matched.aggregate(
            min_price=Min('price'), max_price=Max('price'), avg_price=Avg('price')
        )
        context_lines.append(
            f"\nإحصائيات الأسعار: أقل سعر {stats['min_price']} ج.م | "
            f"أعلى سعر {stats['max_price']} ج.م | متوسط {stats['avg_price']:.1f} ج.م"
        )
    else:
        context_lines.append("\nلا توجد منتجات مطابقة لبحث المستخدم.")

    # Cheapest products (best deals)
    cheapest = all_products.order_by('price')[:5]
    if cheapest:
        context_lines.append("\nأرخص 5 منتجات (أفضل العروض):")
        for p in cheapest:
            context_lines.append(f"- {p.name}: {p.price} ج.م من {p.shop.name}")

    # Newest products
    newest = all_products.order_by('-created_at')[:5]
    if newest:
        context_lines.append("\nأحدث 5 منتجات مضافة:")
        for p in newest:
            context_lines.append(f"- {p.name}: {p.price} ج.م من {p.shop.name}")

    return "\n".join(context_lines), products_data


SYSTEM_PROMPT = (
    "أنت مساعد بركة الذكي — مساعد تسوق إلكتروني لمنصة بركة لتوصيل الطلبات في القرى المصرية.\n"
    "ستحصل على بيانات حقيقية من قاعدة البيانات عن المنتجات والمحلات المتاحة.\n"
    "مهمتك:\n"
    "1. أجب فقط بناءً على البيانات الحقيقية المقدمة لك — لا تخترع منتجات أو أسعار.\n"
    "2. إذا سأل المستخدم عن منتج غير موجود، أخبره بوضوح.\n"
    "3. إذا سأل عن أفضل سعر أو عرض، قارن الأسعار من البيانات وأخبره.\n"
    "4. أجب بالعربية بشكل ودود ومختصر واستخدم إيموجي مناسبة.\n"
    "5. إذا وجدت منتجات مناسبة، اقترح على المستخدم إضافتها للسلة بكتابة 'أضف [اسم المنتج]'.\n"
    "6. لا تزد عن 5 أسطر في الرد."
)


class ChatbotView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        message = request.data.get('message', '').strip()
        if not message:
            return Response({"detail": "المسج مطلوب"}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Build real database context
        db_context, products_data = _build_db_context(message)

        # 2. Call LongCat with real data context
        response_text = ""
        action = None
        try:
            completion = _client.chat.completions.create(
                model="LongCat-Flash-Lite",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"بيانات المنتجات والمحلات:\n{db_context}\n\nسؤال المستخدم: {message}"},
                ],
                max_tokens=1000,
            )
            response_text = completion.choices[0].message.content.strip()
            if products_data:
                action = {"type": "RECOMMEND_PRODUCTS"}
        except Exception as e:
            logger.warning(f"LongCat call failed: {e}")
            # Fallback: return raw data summary
            if products_data:
                response_text = f"وجدت {len(products_data)} منتج لك! 🔍✨\n"
                for i, p in enumerate(products_data[:5], 1):
                    response_text += f"{i}. **{p['name']}** — {p['price']} ج.م في ({p['shop_name']})\n"
                action = {"type": "RECOMMEND_PRODUCTS"}
            else:
                response_text = "عذراً، لم أجد منتجات تطابق بحثك حالياً. جرب كلمة أخرى! 🥺"

        return Response({"response": response_text, "action": action, "products": products_data})
