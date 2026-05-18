import os

def main():
    filepath = r"C:\Users\The_Last_King\OneDrive\Documents\Projects\baraka\frontend\js\driver_profile.js"
    with open(filepath, 'rb') as f:
        content = f.read().decode('utf-8')

    is_crlf = '\r\n' in content
    content = content.replace('\r\n', '\n')

    # 1. Update renderShopStops function
    target_stops = """function renderShopStops(group) {
    return group.shops.map((shop, index) => {
        const readyBadge = shop.allItemsReady 
            ? `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-1 fw-bold" style="font-size: 0.76rem;"><i class="bi bi-check-circle-fill me-1"></i>الطلب جاهز للاستلام 🟢</span>` 
            : `<span class="badge bg-warning-subtle text-warning border border-warning-subtle rounded-pill px-2 py-1 fw-bold" style="font-size: 0.76rem;"><i class="bi bi-hourglass-split me-1"></i>جاري التحضير بالمحل ⏳</span>`;
            
        return `"""

    new_stops = """function renderShopStops(group) {
    return group.shops.map((shop, index) => {
        const order = group.orders[0];
        const isShopPaid = order && order.paid_shops && order.paid_shops.split(',').includes(String(shop.id));
        
        const readyBadge = isShopPaid
            ? `<span class="badge bg-success text-white border border-success rounded-pill px-2 py-1 fw-bold" style="font-size: 0.76rem;"><i class="bi bi-check-circle-fill me-1"></i>تم سداد مستحقات المحل ✅</span>`
            : (shop.allItemsReady 
                ? `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-1 fw-bold" style="font-size: 0.76rem;"><i class="bi bi-check-circle-fill me-1"></i>الطلب جاهز للاستلام 🟢</span>` 
                : `<span class="badge bg-warning-subtle text-warning border border-warning-subtle rounded-pill px-2 py-1 fw-bold" style="font-size: 0.76rem;"><i class="bi bi-hourglass-split me-1"></i>جاري التحضير بالمحل ⏳</span>`);
            
        return `"""

    if target_stops in content:
        content = content.replace(target_stops, new_stops)
        print("Replaced shop stops rendering")
    else:
        print("Could not find target_stops in driver_profile.js")

    # 2. Update renderActiveTrips inner loop for isDeliveredUnpaid
    target_unpaid = """                    ${isDeliveredUnpaid ? (() => {
                        const pickedUpTime = trip.picked_up_at ? new Date(trip.picked_up_at).getTime() : new Date(trip.created_at).getTime();
                        const elapsedHours = (Date.now() - pickedUpTime) / (1000 * 60 * 60);
                        const remainingHours = 5 - elapsedHours;
                        let timerBadge = '';
                        if (remainingHours <= 0) {
                            timerBadge = `<div class="badge bg-danger text-white w-100 py-2 rounded-3 fw-bold mb-2 fs-7 animate-pulse"><i class="bi bi-exclamation-octagon-fill me-1"></i>متأخر لأكثر من 5 ساعات! حسابك معلق مؤقتاً ⚠️</div>`;
                        } else {
                            const remHrs = Math.floor(remainingHours);
                            const remMins = Math.floor((remainingHours - remHrs) * 60);
                            timerBadge = `<div class="badge bg-warning-subtle text-warning border border-warning-subtle w-100 py-2 rounded-3 fw-bold mb-2 fs-7"><i class="bi bi-clock-history me-1"></i>متبقي للتسوية: ${remHrs} ساعة و ${remMins} دقيقة ⏳</div>`;
                        }
                        return `
                            <div class="mt-2 p-2 bg-white rounded-3 border text-espresso text-center">
                                ${timerBadge}
                                <span class="small text-mesa d-block mb-1">رمز تصفية حساب هذا المحل:</span>
                                <strong class="fs-5 text-success" style="font-family: monospace; letter-spacing: 4px;">${trip.driver_otp || '----'}</strong>
                                <div id="qrcode-driver-${trip.id}" class="d-flex justify-content-center my-2"></div>
                            </div>
                            <button onclick="raiseDriverDispute(${trip.id})" class="btn btn-sm btn-outline-danger rounded-pill w-100 mt-1">
                                <i class="bi bi-exclamation-octagon me-1"></i>نزاع مع هذا المحل
                            </button>
                        `;
                    })() : ''}"""

    new_unpaid = """                    ${isDeliveredUnpaid ? (() => {
                        const pickedUpTime = trip.picked_up_at ? new Date(trip.picked_up_at).getTime() : new Date(trip.created_at).getTime();
                        const elapsedHours = (Date.now() - pickedUpTime) / (1000 * 60 * 60);
                        const remainingHours = 5 - elapsedHours;
                        let timerBadge = '';
                        if (remainingHours <= 0) {
                            timerBadge = `<div class="badge bg-danger text-white w-100 py-2 rounded-3 fw-bold mb-2 fs-7 animate-pulse"><i class="bi bi-exclamation-octagon-fill me-1"></i>متأخر لأكثر من 5 ساعات! حسابك معلق مؤقتاً ⚠️</div>`;
                        } else {
                            const remHrs = Math.floor(remainingHours);
                            const remMins = Math.floor((remainingHours - remHrs) * 60);
                            timerBadge = `<div class="badge bg-warning-subtle text-warning border border-warning-subtle w-100 py-2 rounded-3 fw-bold mb-2 fs-7"><i class="bi bi-clock-history me-1"></i>متبقي للتسوية: ${remHrs} ساعة و ${remMins} دقيقة ⏳</div>`;
                        }
                        
                        const paidShopsList = trip.paid_shops ? trip.paid_shops.split(',') : [];
                        const unpaidShops = trip.shops_details ? trip.shops_details.filter(s => !paidShopsList.includes(String(s.id))) : [];
                        const unpaidShopsNames = unpaidShops.map(s => s.name).join(' ، ') || (trip.shop_details ? trip.shop_details.name : 'المحل');
                        
                        return `
                            <div class="mt-2 p-2 bg-white rounded-3 border text-espresso text-center">
                                ${timerBadge}
                                <div class="alert alert-warning py-1.5 rounded-3 mb-2 border-0 small text-center fw-bold text- espresso">
                                    المحلات المتبقية للسداد: <span class="text-danger">${unpaidShopsNames}</span>
                                </div>
                                <span class="small text-mesa d-block mb-1">رمز تصفية حساب هذا المحل:</span>
                                <strong class="fs-5 text-success" style="font-family: monospace; letter-spacing: 4px;">${trip.driver_otp || '----'}</strong>
                                <div id="qrcode-driver-${trip.id}" class="d-flex justify-content-center my-2"></div>
                            </div>
                            <button onclick="raiseDriverDispute(${trip.id})" class="btn btn-sm btn-outline-danger rounded-pill w-100 mt-1">
                                <i class="bi bi-exclamation-octagon me-1"></i>نزاع مع هذا المحل
                            </button>
                        `;
                    })() : ''}"""

    if target_unpaid in content:
        content = content.replace(target_unpaid, new_unpaid)
        print("Replaced driver unpaid details block")
    else:
        print("Could not find target_unpaid in driver_profile.js")

    if is_crlf:
        content = content.replace('\n', '\r\n')

    with open(filepath, 'wb') as f:
        f.write(content.encode('utf-8'))

if __name__ == '__main__':
    main()
