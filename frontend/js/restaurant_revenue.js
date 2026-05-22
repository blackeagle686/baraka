window.loadRestaurantRevenue = async function() {
    const token = localStorage.getItem('access_token');
    const container = document.getElementById('restaurantRevenueDashboardContainer');
    if (!container || !currentRestaurantId) return;

    try {
        const orders = await api.orders.getAll(token);

        const restOrders = orders.filter(o =>
            o.items?.some(i => i.menu_item_details)
        );

        const completedOrders = restOrders.filter(o => o.status === 'DELIVERED');
        const pendingOrders = restOrders.filter(o => ['PENDING', 'ACCEPTED', 'PREPARING', 'ON_DELIVERY'].includes(o.status));
        const cancelledOrders = restOrders.filter(o => o.status === 'CANCELLED');

        let totalRevenue = 0;
        completedOrders.forEach(o => {
            const restItems = o.items.filter(i => i.menu_item_details);
            restItems.forEach(i => {
                totalRevenue += parseFloat(i.price) * i.quantity;
            });
        });

        const avgRevenue = completedOrders.length > 0 ? (totalRevenue / completedOrders.length) : 0;

        let html = `
            <div class="row g-3 mb-4 animate-up">
                <div class="col-md-3">
                    <div class="dashboard-card p-3 d-flex align-items-center gap-3 border-0 shadow-sm" style="background: linear-gradient(135deg, #f97316, #c2410c); color: white; border-radius: 20px;">
                        <div class="rounded-circle d-flex align-items-center justify-content-center" style="width: 54px; height: 54px; background: rgba(255,255,255,0.2);">
                            <i class="bi bi-cash-stack fs-3 text-white"></i>
                        </div>
                        <div>
                            <div class="fs-4 fw-extrabold" style="line-height: 1.2;">${totalRevenue.toFixed(2)} ج.م</div>
                            <div class="small fw-semibold" style="opacity: 0.85; font-size: 0.82rem;">إجمالي أرباح الطلبات المكتملة</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="dashboard-card p-3 d-flex align-items-center gap-3 border-0 shadow-sm" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; border-radius: 20px;">
                        <div class="rounded-circle d-flex align-items-center justify-content-center" style="width: 54px; height: 54px; background: rgba(255,255,255,0.2);">
                            <i class="bi bi-check2-circle fs-3 text-white"></i>
                        </div>
                        <div>
                            <div class="fs-4 fw-extrabold" style="line-height: 1.2;">${completedOrders.length}</div>
                            <div class="small fw-semibold" style="opacity: 0.85; font-size: 0.82rem;">طلبات مكتملة</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="dashboard-card p-3 d-flex align-items-center gap-3 border shadow-sm" style="background: white; border-radius: 20px; border-color: rgba(255,193,7,0.15) !important;">
                        <div class="rounded-circle d-flex align-items-center justify-content-center bg-warning-subtle" style="width: 54px; height: 54px;">
                            <i class="bi bi-clock-history fs-3 text-warning"></i>
                        </div>
                        <div>
                            <div class="fs-4 fw-extrabold text-warning" style="line-height: 1.2;">${pendingOrders.length}</div>
                            <div class="small text-muted fw-semibold" style="font-size: 0.82rem;">طلبات قادمة</div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="dashboard-card p-3 d-flex align-items-center gap-3 border shadow-sm" style="background: white; border-radius: 20px; border-color: rgba(220,53,69,0.15) !important;">
                        <div class="rounded-circle d-flex align-items-center justify-content-center bg-danger-subtle" style="width: 54px; height: 54px;">
                            <i class="bi bi-x-circle fs-3 text-danger"></i>
                        </div>
                        <div>
                            <div class="fs-4 fw-extrabold text-danger" style="line-height: 1.2;">${cancelledOrders.length}</div>
                            <div class="small text-muted fw-semibold" style="font-size: 0.82rem;">طلبات ملغية</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="dashboard-card p-4 shadow-sm border" style="background: rgba(255,255,255,0.85); border-color: rgba(201,153,151,0.12) !important; border-radius: 24px;">
                <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <div>
                        <h4 class="fw-extrabold text-espresso mb-1"><i class="bi bi-calendar-check text-marigold me-1"></i>سجل الطلبات المكتملة</h4>
                        <p class="text-muted small mb-0">قائمة بكافة الطلبات التي تم توصيلها والأرباح المحققة</p>
                    </div>
                    <span class="badge bg-success-subtle text-success rounded-pill px-3 py-2 fw-bold"><i class="bi bi-bar-chart-fill me-1"></i>${completedOrders.length > 0 ? 'أداء ممتاز' : 'لا توجد بيانات بعد'}</span>
                </div>

                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0" style="direction: rtl;">
                        <thead>
                            <tr class="text-espresso fw-bold" style="border-bottom: 2px solid rgba(201,153,151,0.1);">
                                <th scope="col" class="py-3">رقم الطلب</th>
                                <th scope="col" class="py-3">العميل</th>
                                <th scope="col" class="py-3">الأصناف</th>
                                <th scope="col" class="py-3 text-center">تاريخ التوصيل</th>
                                <th scope="col" class="py-3 text-center">المبلغ</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        if (completedOrders.length === 0) {
            html += `
                            <tr>
                                <td colspan="5" class="text-center py-5 text-mesa">
                                    <div class="mb-3 fs-1 text-muted"><i class="bi bi-shop"></i></div>
                                    <p class="fw-bold fs-5 mb-1">لا توجد طلبات مكتملة بعد</p>
                                    <p class="small text-muted">بمجرد طلب العملاء وتوصيل الطلبات، ستظهر أرباحك هنا!</p>
                                </td>
                            </tr>
            `;
        } else {
            completedOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).forEach(o => {
                const dateStr = new Date(o.created_at).toLocaleString('ar-EG', { day: 'numeric', month: 'short' });
                const customerName = o.customer_details?.name || o.customer_details?.phone || 'عميل';
                const restItems = o.items.filter(i => i.menu_item_details);
                const itemNames = restItems.map(i => `${i.menu_item_details.name} (x${i.quantity})`).join('<br>');
                const restTotal = restItems.reduce((sum, i) => sum + parseFloat(i.price) * i.quantity, 0);

                html += `
                            <tr class="hover-row" style="border-bottom: 1px solid rgba(201,153,151,0.05);">
                                <td class="py-3 fw-bold text-espresso">#${o.id}</td>
                                <td class="py-3">
                                    <div class="fw-bold text-espresso">${customerName}</div>
                                    ${o.customer_details?.phone ? `<div class="text-muted small">${o.customer_details.phone}</div>` : ''}
                                </td>
                                <td class="py-3 text-espresso small fw-semibold">${itemNames}</td>
                                <td class="py-3 text-center text-espresso small">${dateStr}</td>
                                <td class="py-3 text-center fw-extrabold text-success fs-6">+${restTotal.toFixed(2)} ج.م</td>
                            </tr>
                `;
            });
        }

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error("Error loading restaurant revenue:", error);
        container.innerHTML = `
            <div class="alert alert-danger text-center p-4 rounded-4 shadow-sm">
                <i class="bi bi-exclamation-octagon-fill fs-2 mb-2 d-block"></i>
                <h5 class="fw-bold">فشل تحميل سجل الأرباح</h5>
                <p class="small mb-0">حدث خطأ أثناء الاتصال بالخادم. يرجى إعادة المحاولة لاحقاً.</p>
            </div>
        `;
    }
};
