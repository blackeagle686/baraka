// ==========================================
// Baraka - Delivery Revenue & Earnings Module
// Modular, clean, and highly aesthetic UI logic
// ==========================================

window.loadDeliveryRevenue = async function() {
    const token = localStorage.getItem('access_token');
    const container = document.getElementById('revenueDashboardContainer');
    if (!container) return;

    try {
        // Fetch all orders assigned to this driver
        const orders = await api.orders.getAll(token);
        
        // Filter for completed/delivered orders
        const myDeliveredOrders = orders.filter(o => o.driver && o.driver_details && o.driver_details.id === o.driver && o.status === 'DELIVERED');
        
        // ── 1) CALCULATE CORE FINANCIAL STATS ──
        const totalEarnings = myDeliveredOrders.reduce((sum, o) => sum + parseFloat(o.delivery_price || 0), 0);
        const completedCount = myDeliveredOrders.length;
        const avgEarning = completedCount > 0 ? (totalEarnings / completedCount) : 0;
        
        const pendingSettlements = myDeliveredOrders.filter(o => !o.is_paid_to_shop);
        const cashInHand = pendingSettlements.reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0);
        
        const paidSettlements = myDeliveredOrders.filter(o => o.is_paid_to_shop);
        const settledAmount = paidSettlements.reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0);

        // ── 2) RENDER STATS CARDS WITH SLEEK GLASSMORPHISM & GRADIENTS ──
        let html = `
            <!-- Financial Summary Cards -->
            <div class="row g-3 mb-4 animate-up">
                <div class="col-md-3">
                    <div class="dashboard-card p-3 d-flex align-items-center gap-3 border-0 shadow-sm" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border-radius: 20px;">
                        <div class="rounded-circle d-flex align-items-center justify-content-center" style="width: 54px; height: 54px; background: rgba(255, 255, 255, 0.2);">
                            <i class="bi bi-wallet2 fs-3 text-white"></i>
                        </div>
                        <div>
                            <div class="fs-4 fw-extrabold" style="line-height: 1.2;">${totalEarnings.toFixed(2)} ج.م</div>
                            <div class="small fw-semibold" style="opacity: 0.85; font-size: 0.82rem;">إجمالي أرباح التوصيل الصافية</div>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-3">
                    <div class="dashboard-card p-3 d-flex align-items-center gap-3 border-0 shadow-sm" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; border-radius: 20px;">
                        <div class="rounded-circle d-flex align-items-center justify-content-center" style="width: 54px; height: 54px; background: rgba(255, 255, 255, 0.2);">
                            <i class="bi bi-check2-circle fs-3 text-white"></i>
                        </div>
                        <div>
                            <div class="fs-4 fw-extrabold" style="line-height: 1.2;">${completedCount} رحلة</div>
                            <div class="small fw-semibold" style="opacity: 0.85; font-size: 0.82rem;">الرحلات المكتملة بنجاح</div>
                        </div>
                    </div>
                </div>

                <div class="col-md-3">
                    <div class="dashboard-card p-3 d-flex align-items-center gap-3 border shadow-sm" style="background: white; border-radius: 20px; border-color: rgba(201,153,151,0.15) !important;">
                        <div class="rounded-circle d-flex align-items-center justify-content-center bg-warning-subtle" style="width: 54px; height: 54px;">
                            <i class="bi bi-currency-exchange fs-3 text-warning"></i>
                        </div>
                        <div>
                            <div class="fs-4 fw-extrabold text-espresso" style="line-height: 1.2;">${avgEarning.toFixed(2)} ج.م</div>
                            <div class="small text-muted fw-semibold" style="font-size: 0.82rem;">معدل الربح لكل طلب</div>
                        </div>
                    </div>
                </div>

                <div class="col-md-3">
                    <div class="dashboard-card p-3 d-flex align-items-center gap-3 border shadow-sm" style="background: white; border-radius: 20px; border-color: rgba(220, 53, 69, 0.15) !important;">
                        <div class="rounded-circle d-flex align-items-center justify-content-center bg-danger-subtle" style="width: 54px; height: 54px;">
                            <i class="bi bi-shop fs-3 text-danger"></i>
                        </div>
                        <div>
                            <div class="fs-4 fw-extrabold text-danger" style="line-height: 1.2;">${cashInHand.toFixed(2)} ج.م</div>
                            <div class="small text-muted fw-semibold" style="font-size: 0.82rem;">كاش المحلات واجب السداد</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Detailed Earnings Log Section -->
            <div class="dashboard-card p-4 shadow-sm border" style="background: rgba(255,255,255,0.85); border-color: rgba(201,153,151,0.12) !important; border-radius: 24px;">
                <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <div>
                        <h4 class="fw-extrabold text-espresso mb-1"><i class="bi bi-calendar-check text-marigold me-1"></i>سجل عمليات التوصيل المفصل</h4>
                        <p class="text-muted small mb-0">قائمة بكافة الطلبات التي قمت بتوصيلها وقيمة عمولتك وحالة التسوية المالية مع المحلات</p>
                    </div>
                    <span class="badge bg-success-subtle text-success rounded-pill px-3 py-2 fw-bold"><i class="bi bi-bar-chart-fill me-1"></i>أداء مالي متميز</span>
                </div>

                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0" style="direction: rtl;">
                        <thead>
                            <tr class="text-espresso fw-bold" style="border-bottom: 2px solid rgba(201,153,151,0.1);">
                                <th scope="col" class="py-3">رقم الطلب</th>
                                <th scope="col" class="py-3">العميل المستلم</th>
                                <th scope="col" class="py-3 text-center">تاريخ التوصيل</th>
                                <th scope="col" class="py-3 text-center">قيمة التوصيل (ربحك)</th>
                                <th scope="col" class="py-3 text-center">حساب المحل</th>
                                <th scope="col" class="py-3 text-center">حالة السداد للمحل</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        if (myDeliveredOrders.length === 0) {
            html += `
                            <tr>
                                <td colspan="6" class="text-center py-5 text-mesa">
                                    <div class="mb-3 fs-1 text-muted"><i class="bi bi-cash-stack"></i></div>
                                    <p class="fw-bold fs-5 mb-1">لا توجد أرباح مسجلة بعد</p>
                                    <p class="small text-muted">ابدأ بقبول الطلبات وإيصالها للعملاء لتشاهد أرباحك الصافية تنمو هنا!</p>
                                </td>
                            </tr>
            `;
        } else {
            myDeliveredOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).forEach(order => {
                const deliveryDate = new Date(order.picked_up_at || order.created_at).toLocaleString('ar-EG', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                });
                
                const customerName = order.customer_details ? order.customer_details.name : 'عميل بركة';
                
                // Settlement Badge
                let settleBadge = '';
                if (order.is_paid_to_shop) {
                    settleBadge = `<span class="badge bg-success-subtle text-success rounded-pill px-2.5 py-1.5 fw-bold"><i class="bi bi-check-circle-fill me-1"></i>تم السداد والتصفية</span>`;
                } else {
                    settleBadge = `<span class="badge bg-danger-subtle text-danger rounded-pill px-2.5 py-1.5 fw-bold animate-pulse"><i class="bi bi-clock-history me-1"></i>انتظار السداد</span>`;
                }

                html += `
                            <tr class="hover-row" style="border-bottom: 1px solid rgba(201,153,151,0.05); transition: background-color 0.2s;">
                                <td class="py-3 fw-bold text-espresso">#${order.id}</td>
                                <td class="py-3">
                                    <div class="fw-bold text-espresso">${customerName}</div>
                                    <div class="text-muted small" style="font-size: 0.76rem;"><i class="bi bi-geo-alt me-0.5"></i>${order.address || 'العنوان'}</div>
                                </td>
                                <td class="py-3 text-center text-espresso small">${deliveryDate}</td>
                                <td class="py-3 text-center fw-extrabold text-success fs-6">+${parseFloat(order.delivery_price).toFixed(2)} ج.م</td>
                                <td class="py-3 text-center fw-extrabold text-marigold fs-6">${parseFloat(order.total_price).toFixed(2)} ج.م</td>
                                <td class="py-3 text-center">${settleBadge}</td>
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
        console.error("Error loading revenue data:", error);
        container.innerHTML = `
            <div class="alert alert-danger text-center p-4 rounded-4 shadow-sm">
                <i class="bi bi-exclamation-octagon-fill fs-2 mb-2 d-block"></i>
                <h5 class="fw-bold">فشل تحميل سجل الأرباح</h5>
                <p class="small mb-0">حدث خطأ أثناء الاتصال بالخادم. يرجى إعادة المحاولة لاحقاً.</p>
            </div>
        `;
    }
}
