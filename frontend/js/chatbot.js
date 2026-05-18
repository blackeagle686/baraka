// ==========================================
// Baraka AI Chatbot Client Side Logic
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Only render chatbot for customer roles or guest users
    const userRole = localStorage.getItem('user_role');
    if (userRole && userRole !== 'CUSTOMER') {
        return; // Don't show chatbot for drivers, shop owners, or admins
    }
    
    injectChatbotHTML();
});

function injectChatbotHTML() {
    // Check if widget already exists to prevent duplicate injections
    if (document.getElementById('barakaAIChatWidgetWrapper')) return;

    const container = document.createElement('div');
    container.id = 'barakaAIChatWidgetWrapper';
    container.className = 'baraka-ai-assistant-widget';
    container.innerHTML = `
        <!-- Chat Toggle Button -->
        <button class="ai-chat-toggle-btn shadow" onclick="toggleBarakaAIChat()" id="aiChatToggleBtn">
            <span class="ai-badge-pulse"></span>
            <i class="bi bi-robot fs-4"></i>
        </button>
        
        <!-- Chat Window -->
        <div class="ai-chat-window glass-panel" id="barakaAIChatWindow">
            <div class="ai-chat-header d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center gap-2">
                    <div class="ai-avatar-circle">
                        <i class="bi bi-robot fs-5 text-white"></i>
                    </div>
                    <div>
                        <span class="d-block fw-bold text-white fs-6">مساعد بركة الذكي 🤖</span>
                        <span class="d-block micro text-success fw-bold"><span class="pulse-dot"></span>متصل الآن - جاهز للتسوق</span>
                    </div>
                </div>
                <button class="btn btn-close-chat" onclick="toggleBarakaAIChat()"><i class="bi bi-x-lg text-white"></i></button>
            </div>
            <div class="ai-chat-messages" id="aiChatMessages">
                <div class="chat-message bot-message animate-up">
                    <p class="mb-0">أهلاً بك يا غالي! 🌾 أنا مساعد بركة الذكي لمساعدتك في تسوق كل ما تحتاجه من محلات قريتك.</p>
                    <p class="mb-0 mt-2">اكتب لي مثلاً: <strong>"عايز أشتري طماطم تفاح"</strong> أو <strong>"أشرح لي فوائد العسل"</strong>، وأنا هدورلك على أفضل الأسعار والمحلات المتوفرة!</p>
                </div>
            </div>
            <div class="ai-chat-input-wrapper">
                <form id="aiChatForm" class="d-flex gap-2 align-items-center" onsubmit="sendBarakaChatMessage(event)">
                    <input type="text" id="aiChatInput" class="form-control ai-chat-input" placeholder="اكتب رسالتك هنا..." required autocomplete="off">
                    <button type="submit" class="btn btn-send-chat" id="aiChatSendBtn"><i class="bi bi-send-fill text-white"></i></button>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(container);
}

window.toggleBarakaAIChat = function() {
    const chatWindow = document.getElementById('barakaAIChatWindow');
    if (chatWindow) {
        chatWindow.classList.toggle('active');
        if (chatWindow.classList.contains('active')) {
            const input = document.getElementById('aiChatInput');
            if (input) input.focus();
            scrollToBottom();
        }
    }
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('aiChatMessages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

window.sendBarakaChatMessage = async function(event) {
    if (event) event.preventDefault();
    
    const input = document.getElementById('aiChatInput');
    const sendBtn = document.getElementById('aiChatSendBtn');
    const messagesContainer = document.getElementById('aiChatMessages');
    
    if (!input || !messagesContainer || !input.value.trim()) return;
    
    const userText = input.value.trim();
    input.value = '';
    
    // Disable inputs during search
    input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    
    // Render User Message
    const userMsgDiv = document.createElement('div');
    userMsgDiv.className = 'chat-message user-message align-self-flex-end animate-up';
    userMsgDiv.innerHTML = `<p class="mb-0">${escapeHtml(userText)}</p>`;
    messagesContainer.appendChild(userMsgDiv);
    scrollToBottom();
    
    // Render Typing / Loading Indicator
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message bot-message align-self-flex-start animate-up typing-indicator-msg';
    typingDiv.innerHTML = `
        <div class="d-flex align-items-center gap-2">
            <span class="spinner-grow spinner-grow-sm text-marigold" role="status" aria-hidden="true"></span>
            <span class="small text-mesa">جاري البحث في المحلات...</span>
        </div>
    `;
    messagesContainer.appendChild(typingDiv);
    scrollToBottom();
    
    // Send request to API
    const token = localStorage.getItem('access_token');
    const headers = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const chatApiBase = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
            ? (window.location.port === '8080' ? 'http://127.0.0.1:8000/api' : '/api')
            : '/api';
        const response = await fetch(`${chatApiBase}/chatbot/chat/`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ message: userText })
        });
        
        // Remove typing indicator
        const typingMsg = messagesContainer.querySelector('.typing-indicator-msg');
        if (typingMsg) typingMsg.remove();
        
        if (!response.ok) {
            throw new Error('API Error');
        }
        
        const data = await response.json();
        
        // Render Bot Message
        const botMsgDiv = document.createElement('div');
        botMsgDiv.className = 'chat-message bot-message align-self-flex-start animate-up';
        
        let textContent = data.response || 'عذراً يا فندم، واجهت مشكلة في فهم طلبك.';
        // Simple markdown formatter for newlines and bold texts
        textContent = formatMarkdown(textContent);
        
        botMsgDiv.innerHTML = `<div class="bot-text-wrapper">${textContent}</div>`;
        
        // If there are product recommendations, render them beautifully
        if (data.products && data.products.length > 0) {
            const productTitle = document.createElement('div');
            productTitle.className = 'fw-bold text-espresso small mt-3 border-top pt-2';
            productTitle.innerHTML = `<i class="bi bi-star-fill text-warning me-1"></i>المنتجات المرشحة لك:`;
            botMsgDiv.appendChild(productTitle);
            
            data.products.forEach(prod => {
                const prodCard = document.createElement('div');
                prodCard.className = 'chat-product-card d-flex flex-column animate-up mt-2';
                
                let imgHtml = '';
                if (prod.image) {
                    imgHtml = `<img src="${prod.image}" class="chat-product-img">`;
                } else {
                    imgHtml = `<div class="chat-product-img d-flex align-items-center justify-content-center text-marigold fw-bold fs-4" style="height: 80px; background-color: rgba(194, 146, 64, 0.05);"><i class="bi bi-box-seam"></i></div>`;
                }
                
                const maxQty = prod.quantity || 999;
                const shopId = prod.shop_id || 1;
                const shopName = prod.shop_name || 'محل بركة';
                
                prodCard.innerHTML = `
                    ${imgHtml}
                    <div class="p-2 text-start">
                        <span class="badge bg-mesa-soft text-mesa rounded-pill mb-1 micro">${escapeHtml(shopName)}</span>
                        <h6 class="fw-bold text-espresso small mb-1" style="font-size: 0.85rem;">${escapeHtml(prod.name)}</h6>
                        <div class="d-flex justify-content-between align-items-center mt-2">
                            <span class="text-marigold fw-bold small" style="font-size: 0.85rem;">${prod.price} ج.م</span>
                            <button class="btn btn-marigold btn-sm chat-product-btn px-2.5 py-1 text-white fw-bold shadow-xs" onclick="window.addChatbotItemToCart(${prod.id}, '${escapeHtml(prod.name)}', ${prod.price}, '${prod.image || ''}', ${maxQty}, ${shopId}, '${escapeHtml(shopName)}')">
                                <i class="bi bi-plus-lg me-1"></i>أضف للسلة
                            </button>
                        </div>
                    </div>
                `;
                botMsgDiv.appendChild(prodCard);
            });
        }
        
        messagesContainer.appendChild(botMsgDiv);
        
    } catch (error) {
        console.error("Chatbot request failed:", error);
        const typingMsg = messagesContainer.querySelector('.typing-indicator-msg');
        if (typingMsg) typingMsg.remove();
        
        const errorMsgDiv = document.createElement('div');
        errorMsgDiv.className = 'chat-message bot-message align-self-flex-start animate-up';
        errorMsgDiv.innerHTML = `<p class="mb-0 text-danger"><i class="bi bi-exclamation-triangle me-1"></i>عذراً، حدث خطأ أثناء الاتصال بالمساعد الذكي. برجاء المحاولة مرة أخرى.</p>`;
        messagesContainer.appendChild(errorMsgDiv);
    } finally {
        input.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
        input.focus();
        scrollToBottom();
    }
}

// Global Cart Addition Handler from Chatbot recommendations
window.addChatbotItemToCart = function(id, name, price, image = '', maxQty = 999, shopId, shopName) {
    const token = localStorage.getItem('access_token');
    if (!token) {
        if (window.showBarakaToast) {
            window.showBarakaToast('يرجى تسجيل الدخول أولاً لتتمكن من الطلب.', 'error', 'bi-exclamation-circle');
        } else {
            alert('يرجى تسجيل الدخول أولاً لتتمكن من الطلب.');
        }
        return;
    }
    
    const role = localStorage.getItem('user_role');
    if (role && role !== 'CUSTOMER') {
        if (window.showBarakaToast) {
            window.showBarakaToast('عذراً، الحسابات التجارية لا يمكنها الشراء.', 'warning', 'bi-exclamation-triangle');
        } else {
            alert('عذراً، الحسابات التجارية لا يمكنها تقديم طلبات شراء.');
        }
        return;
    }
    
    let cart = JSON.parse(localStorage.getItem('baraka_cart')) || [];
    
    const existing = cart.find(it => it.product === id);
    if (existing) {
        if (existing.quantity >= maxQty) {
            if (window.showBarakaToast) {
                window.showBarakaToast(`عذراً، الكمية المطلوبة تتخطى المتاح في المخزن (${maxQty} قطع).`, 'error', 'bi-exclamation-triangle');
            } else {
                alert(`عذراً، الكمية المطلوبة تتخطى المتاح في المخزن (${maxQty} قطع).`);
            }
            return;
        }
        existing.quantity += 1;
    } else {
        cart.push({ 
            product: id, 
            name: name, 
            price: price, 
            quantity: 1, 
            image: image, 
            shop: shopId, 
            shopName: shopName, 
            maxQty: maxQty 
        });
    }
    
    // Save back to localStorage
    localStorage.setItem('baraka_cart', JSON.stringify(cart));
    
    // Sync to window global cart state if on details page
    if (window.cart) {
        window.cart = cart;
    }
    
    // Update header navbar badge count
    if (window.updateHeaderCartUI) {
        window.updateHeaderCartUI();
    }
    
    // Update current checkout sidebar if on the specific details page
    if (typeof updateCartUI === 'function') {
        updateCartUI();
    }
    
    if (window.showBarakaToast) {
        window.showBarakaToast(`تم إضافة "${name}" من "${shopName}" للسلة بنجاح!`, 'success', 'bi-cart-check');
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatMarkdown(text) {
    if (!text) return '';
    // Bold text (**text**)
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Code blocks/inline code (`code`)
    text = text.replace(/`(.*?)`/g, '<code>$1</code>');
    // Bullet points (* point)
    text = text.replace(/^\s*\*\s+(.*?)$/gm, '<li>$1</li>');
    // Wrap groups of <li> inside <ul>
    text = text.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    // Convert newlines to <br>
    text = text.replace(/\n/g, '<br>');
    return text;
}
