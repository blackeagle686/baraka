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
            <i class="bi bi-stars fs-4"></i>
        </button>
        
        <!-- Chat Window -->
        <div class="ai-chat-window glass-panel" id="barakaAIChatWindow">
            <div class="ai-chat-bg-glow"></div>
            <div class="ai-chat-inner">
                <div class="ai-chat-header d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center gap-3">
                        <div class="ai-avatar-circle ai-float-anim">
                            <i class="bi bi-stars fs-4 text-white"></i>
                        </div>
                        <div>
                            <span class="d-block fw-bold text-espresso fs-5">مساعد بركة الذكي ✨</span>
                            <span class="d-block micro text-success fw-bold mt-1"><span class="pulse-dot"></span>متصل الآن - جاهز للتسوق</span>
                        </div>
                    </div>
                    <button class="btn btn-close-chat" onclick="toggleBarakaAIChat()"><i class="bi bi-x-lg text-espresso fs-4"></i></button>
                </div>
                <div class="ai-chat-messages" id="aiChatMessages">
                    <div class="chat-message bot-message animate-up">
                        <p class="mb-0">أهلاً بك يا غالي! 🌾 أنا مساعد بركة الذكي لمساعدتك في تسوق كل ما تحتاجه من محلات قريتك.</p>
                        <p class="mb-0 mt-2">اكتب لي مثلاً: <strong>"عايز أشتري طماطم تفاح"</strong> أو <strong>"أشرح لي فوائد العسل"</strong>، وأنا هدورلك على أفضل الأسعار والمحلات المتوفرة!</p>
                    </div>
                </div>
                <div class="ai-chat-input-wrapper">
                    <form id="aiChatForm" class="d-flex gap-3 align-items-center" onsubmit="sendBarakaChatMessage(event)">
                        <input type="text" id="aiChatInput" class="form-control ai-chat-input" placeholder="اكتب رسالتك هنا..." required autocomplete="off">
                        <button type="button" class="btn btn-mic-chat" id="aiChatMicBtn" onclick="toggleChatbotMic()" title="تحدث بالصوت"><i class="bi bi-mic-fill fs-5"></i></button>
                        <button type="submit" class="btn btn-send-chat" id="aiChatSendBtn" title="إرسال"><i class="bi bi-send-fill text-white fs-5"></i></button>
                    </form>
                </div>
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
            
        // Append local cart data
        const currentCart = JSON.parse(localStorage.getItem('baraka_cart')) || [];
        
        const response = await fetch(`${chatApiBase}/chatbot/chat/`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ message: userText, cart: currentCart })
        });
        
        // Remove typing indicator
        const typingMsg = messagesContainer.querySelector('.typing-indicator-msg');
        if (typingMsg) typingMsg.remove();
        
        if (!response.ok) {
            if (response.status === 401) {
                // Handle unauthenticated user
                const loginMsgDiv = document.createElement('div');
                loginMsgDiv.className = 'chat-message bot-message align-self-flex-start animate-up';
                loginMsgDiv.innerHTML = `
                    <div class="bot-text-wrapper text-danger">
                        <p class="mb-2 fw-bold"><i class="bi bi-lock-fill me-1"></i>عذراً يا فندم، لازم تسجل دخول الأول عشان أقدر أساعدك وأشوف طلباتك! 😊</p>
                        <p class="small mb-0">جاري تحويلك لصفحة تسجيل الدخول...</p>
                    </div>
                `;
                messagesContainer.appendChild(loginMsgDiv);
                scrollToBottom();
                
                setTimeout(() => {
                    window.location.href = '/html/auth/login.html';
                }, 2500);
                
                input.disabled = false;
                if (sendBtn) sendBtn.disabled = false;
                return; // Stop execution
            }
            throw new Error('API Error');
        }
        
        const data = await response.json();
        
        // Auto-play TTS audio if returned
        if (data.audio_url) {
            if (window.currentChatbotAudio) {
                window.currentChatbotAudio.pause();
            }
            window.currentChatbotAudio = new Audio(data.audio_url);
            window.currentChatbotAudio.play().catch(e => {
                console.log("Audio autoplay blocked by browser policy, user needs interaction:", e);
            });
        }

        // Render Bot Message
        const botMsgDiv = document.createElement('div');
        botMsgDiv.className = 'chat-message bot-message align-self-flex-start animate-up';
        
        let textContent = data.response || 'عذراً يا فندم، واجهت مشكلة في فهم طلبك.';
        // Simple markdown formatter for newlines and bold texts
        textContent = formatMarkdown(textContent);
        
        // Append a speaker button if audio_url is available
        const speakerHtml = data.audio_url 
            ? `<button class="btn btn-sm btn-link p-0 text-marigold ms-2" onclick="replayChatbotAudio('${data.audio_url}')" title="إعادة تشغيل الصوت"><i class="bi bi-volume-up-fill fs-5"></i></button>`
            : '';

        botMsgDiv.innerHTML = `
            <div class="bot-text-wrapper d-flex justify-content-between align-items-start gap-2">
                <div class="flex-grow-1">${textContent}</div>
                ${speakerHtml}
            </div>
        `;
        
        // If there are product recommendations, render them beautifully in a table
        if (data.products && data.products.length > 0) {
            const productTitle = document.createElement('div');
            productTitle.className = 'fw-bold text-espresso small mt-3 border-top pt-3 mb-2';
            productTitle.innerHTML = `<i class="bi bi-star-fill text-warning me-1"></i>المنتجات المرشحة لك:`;
            botMsgDiv.appendChild(productTitle);
            
            const mediaBase = (window.location.port === '8080') ? 'http://127.0.0.1:8000' : '';
            
            let tableHTML = `
                <div class="chat-products-container mt-2">
                    <div class="table-responsive">
                        <table class="table table-borderless align-middle table-sm chat-products-table mb-0">
                            <thead>
                                <tr>
                                    <th>المنتج</th>
                                    <th>المحل</th>
                                    <th class="text-nowrap">السعر</th>
                                    <th class="text-center">إجراء</th>
                                </tr>
                            </thead>
                            <tbody>
            `;
            
            data.products.forEach(prod => {
                const imgSrc = prod.image ? (prod.image.startsWith('http') ? prod.image : `${mediaBase}${prod.image}`) : '';
                const imgTag = imgSrc 
                    ? `<img src="${imgSrc}" class="rounded" style="width: 35px; height: 35px; object-fit: cover;">`
                    : `<div class="rounded d-flex align-items-center justify-content-center text-marigold" style="width: 35px; height: 35px; background-color: rgba(194, 146, 64, 0.1);"><i class="bi bi-box-seam"></i></div>`;
                
                const shopId = prod.shop_id || 1;
                const shopName = prod.shop_name || 'محل بركة';
                const maxQty = prod.quantity || 999;
                
                tableHTML += `
                    <tr>
                        <td>
                            <div class="d-flex align-items-center gap-2">
                                ${imgTag}
                                <span class="fw-bold small text-espresso">${escapeHtml(prod.name)}</span>
                            </div>
                        </td>
                        <td>
                            <span class="badge bg-mesa-soft text-mesa micro">${escapeHtml(shopName)}</span>
                        </td>
                        <td class="text-nowrap">
                            <span class="text-marigold fw-bold small">${prod.price} ج</span>
                        </td>
                        <td>
                            <div class="d-flex justify-content-center gap-1">
                                <button class="btn btn-marigold btn-sm text-white px-2 py-1 shadow-xs" onclick="window.addChatbotItemToCart(${prod.id}, '${escapeHtml(prod.name)}', ${prod.price}, '${prod.image || ''}', ${maxQty}, ${shopId}, '${escapeHtml(shopName)}')" title="أضف للسلة">
                                    <i class="bi bi-cart-plus"></i>
                                </button>
                                <a href="/html/shops/details.html?id=${shopId}" class="btn btn-outline-mesa btn-sm px-2 py-1" title="زيارة المحل">
                                    <i class="bi bi-shop"></i>
                                </a>
                            </div>
                        </td>
                    </tr>
                `;
            });
            
            tableHTML += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            
            const tableDiv = document.createElement('div');
            tableDiv.innerHTML = tableHTML;
            botMsgDiv.appendChild(tableDiv);
            
            // Add quick reply buttons for products
            const quickReplies = document.createElement('div');
            quickReplies.className = 'chat-quick-replies';
            quickReplies.innerHTML = `
                <button class="chat-quick-reply-btn" onclick="sendQuickReply('إتمام الطلب')">🛒 إتمام الطلب</button>
                <button class="chat-quick-reply-btn" onclick="sendQuickReply('عرض سلة المشتريات')">🛍️ سلة المشتريات</button>
                <button class="chat-quick-reply-btn" onclick="sendQuickReply('ايه أرخص حاجة؟')">💰 أرخص العروض</button>
            `;
            botMsgDiv.appendChild(quickReplies);
        } else {
            // Add general quick reply buttons if no products were recommended
            const quickReplies = document.createElement('div');
            quickReplies.className = 'chat-quick-replies mt-2';
            quickReplies.innerHTML = `
                <button class="chat-quick-reply-btn" onclick="sendQuickReply('ايه المنتجات الجديدة؟')">✨ المنتجات الجديدة</button>
                <button class="chat-quick-reply-btn" onclick="sendQuickReply('سلة المشتريات')">🛒 سلة المشتريات</button>
            `;
            botMsgDiv.appendChild(quickReplies);
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

// Global Quick Reply Handler
window.sendQuickReply = function(text) {
    const input = document.getElementById('aiChatInput');
    if (input) {
        input.value = text;
        const form = document.getElementById('aiChatForm');
        if (form) {
            // Trigger submit event
            const event = new Event('submit', { cancelable: true });
            form.dispatchEvent(event);
            if (!event.defaultPrevented) {
                window.sendBarakaChatMessage(event);
            }
        }
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
    text = text.replace(/`(.*?)`/g, '<code class="text-marigold bg-light px-1 rounded">$1</code>');
    
    // Handle Markdown Tables
    text = text.replace(/(?:^|\n)((?:\|.*\|\n?)+)/g, function(match, p1) {
        const lines = p1.trim().split('\n');
        // A valid markdown table must have at least 2 lines and the second line must contain |---
        if (lines.length < 2 || !lines[1].includes('|---')) return match;
        
        let html = '<div class="table-responsive mt-2 mb-3 shadow-sm rounded-3 border"><table class="table table-hover table-sm align-middle mb-0" style="font-size: 0.85rem; background: white;"><thead><tr>';
        
        const headers = lines[0].split('|').slice(1, -1).map(s => s.trim());
        headers.forEach(h => html += `<th class="bg-light text-espresso fw-bold py-2 px-3 border-bottom">${h}</th>`);
        html += '</tr></thead><tbody>';
        
        for (let i = 2; i < lines.length; i++) {
            html += '<tr>';
            const cells = lines[i].split('|').slice(1, -1).map(s => s.trim());
            cells.forEach(c => html += `<td class="px-3 py-2 border-bottom-0">${c}</td>`);
            html += '</tr>';
        }
        html += '</tbody></table></div>';
        return `\n${html}\n`;
    });

    // Bullet points (* point or - point)
    text = text.replace(/^\s*[\*\-]\s+(.*?)$/gm, '<li class="mb-1">$1</li>');
    
    // Wrap groups of <li> inside <ul>
    text = text.replace(/(<li class="mb-1">.*?<\/li>(\s*<li class="mb-1">.*?<\/li>)*)/gs, '<ul class="mb-2 ps-4 text-mesa">$1</ul>');
    
    // Convert newlines to <br> but protect block elements
    text = text.split('\n').map(line => {
        // If line is already an HTML block element we just added, don't add <br>
        if (line.trim().startsWith('<div') || line.trim().startsWith('</div') || 
            line.trim().startsWith('<ul') || line.trim().startsWith('</ul') ||
            line.trim().startsWith('<li') || line.trim().startsWith('</li') ||
            line.trim().startsWith('<table') || line.trim().startsWith('</table')) {
            return line;
        }
        return line + '<br>';
    }).join('\n');
    
    // Clean up excessive <br>s
    text = text.replace(/(<br>\s*)+$/g, ''); // Trim trailing
    text = text.replace(/<br>\s*<br>/g, '<br>'); // Prevent double spacing
    text = text.replace(/<div class="table-responsive/g, '<br><div class="table-responsive'); // Add space before table
    
    return text;
}

// ── Speech-to-Text & Text-to-Speech Voice Support ──
let speechRecognitionInstance = null;
let isSpeechRecording = false;

window.replayChatbotAudio = function(url) {
    if (window.currentChatbotAudio) {
        window.currentChatbotAudio.pause();
    }
    window.currentChatbotAudio = new Audio(url);
    window.currentChatbotAudio.play().catch(e => console.error("Failed to play audio:", e));
};

window.toggleChatbotMic = function() {
    const micBtn = document.getElementById('aiChatMicBtn');
    const input = document.getElementById('aiChatInput');
    if (!micBtn || !input) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        if (window.showBarakaToast) {
            window.showBarakaToast("عذراً، متصفحك الحالي لا يدعم خاصية التعرف على الصوت باللغة العربية.", "error", "bi-exclamation-triangle");
        } else {
            alert("عذراً، متصفحك الحالي لا يدعم خاصية التعرف على الصوت.");
        }
        return;
    }

    if (!speechRecognitionInstance) {
        speechRecognitionInstance = new SpeechRecognition();
        speechRecognitionInstance.lang = 'ar-EG'; // Egyptian Arabic
        speechRecognitionInstance.continuous = true;
        speechRecognitionInstance.interimResults = true;

        speechRecognitionInstance.onstart = function() {
            isSpeechRecording = true;
            micBtn.classList.add('recording');
            micBtn.innerHTML = '<i class="bi bi-mic-mute-fill fs-5"></i>';
            input.placeholder = "تحدث الآن... أنا أستمع إليك 🎙️";
        };

        speechRecognitionInstance.onresult = function(event) {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            // Real-time update in input box
            input.value = finalTranscript || interimTranscript;
        };

        speechRecognitionInstance.onerror = function(event) {
            console.error("Speech recognition error:", event.error);
            stopSpeechRecording();
        };

        speechRecognitionInstance.onend = function() {
            stopSpeechRecording();
        };
    }

    if (isSpeechRecording) {
        speechRecognitionInstance.stop();
    } else {
        speechRecognitionInstance.start();
    }

    function stopSpeechRecording() {
        isSpeechRecording = false;
        if (micBtn) {
            micBtn.classList.remove('recording');
            micBtn.innerHTML = '<i class="bi bi-mic-fill fs-5"></i>';
        }
        if (input) {
            input.placeholder = "اكتب رسالتك هنا...";
        }
    }
};
