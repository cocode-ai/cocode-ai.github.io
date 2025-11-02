document.addEventListener('DOMContentLoaded', () => {
    // URL Backend
    const API_BASE_URL = 'https://cocode.androidbutut.workers.dev';

    // Seleksi Elemen DOM
    const modeSegment = document.getElementById('mode-segment');
    const messageList = document.getElementById('message-list');
    const chatContent = document.getElementById('chat-content');
    const loadingIndicator = document.getElementById('loading-indicator');

    // Footer & Input
    const chatCodeFooter = document.getElementById('chat-code-footer');
    const redesignFooter = document.getElementById('redesign-footer');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const urlInput = document.getElementById('url-input');
    const styleSelect = document.getElementById('style-select');
    const redesignButton = document.getElementById('redesign-button');
    
    // Seleksi Elemen Modal
    const previewModal = document.getElementById('preview-modal');
    const previewFrame = document.getElementById('preview-frame');
    const closeModalButton = document.getElementById('close-modal-button');
    const reasoningOutput = document.getElementById('reasoning-output');
    const sourceCodeOutput = document.getElementById('source-code-output');
    const copyCodeButton = document.getElementById('copy-code-button');

    // Elemen Pengaturan
    const settingsModal = document.getElementById('settings-modal');
    const settingsButton = document.getElementById('settings-button');
    const closeSettingsModalButton = document.getElementById('close-settings-modal-button');
    const clearHistoryButton = document.getElementById('clear-history-button');
    const subscribeButton = document.getElementById('subscribe-button');
    const premiumStatusMessage = document.getElementById('premium-status-message');
    const generationCountDisplay = document.getElementById('generation-count-display');

    // State Aplikasi
    const MAX_FREE_GENERATIONS = 2;
    let currentMode = 'chat';
    let chatHistory = []; 
    let isLoading = false;
    let isPremium = false;
    let generationCount = 0;

    // --- FUNGSI STATUS PENGGUNA ---

    const updateSettingsUI = () => {
        if (isPremium) {
            premiumStatusMessage.textContent = 'Status: Akun Premium Aktif';
            premiumStatusMessage.color = 'success';
            generationCountDisplay.classList.add('hidden');
            subscribeButton.classList.add('hidden');
        } else {
            premiumStatusMessage.textContent = 'Status: Akun Gratis';
            premiumStatusMessage.color = 'medium';
            generationCountDisplay.classList.remove('hidden');
            const remaining = MAX_FREE_GENERATIONS - generationCount;
            generationCountDisplay.textContent = `Sisa penggunaan (Code/Redesign): ${remaining > 0 ? remaining : 0} kali.`;
            subscribeButton.classList.remove('hidden');
        }
    };

    const loadUserStatus = () => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('payment') === 'success') {
            showToast('Pembayaran berhasil! Selamat datang di mode Premium.', 'success');
            isPremium = true;
            const expiryDate = new Date().getTime() + (30 * 24 * 60 * 60 * 1000);
            localStorage.setItem('aiPartnerPremium', JSON.stringify({ premium: true, expiry: expiryDate }));
            localStorage.removeItem('aiPartnerGenCount');
            generationCount = 0;
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            const premiumData = JSON.parse(localStorage.getItem('aiPartnerPremium'));
            if (premiumData && premiumData.premium && new Date().getTime() < premiumData.expiry) {
                isPremium = true;
            } else {
                isPremium = false;
                if(premiumData) localStorage.removeItem('aiPartnerPremium');
            }
        }

        if (!isPremium) {
            generationCount = parseInt(localStorage.getItem('aiPartnerGenCount')) || 0;
        }

        updateSettingsUI();
    };

    // --- FUNGSI UTAMA ---

    const handleSend = async () => {
        if (isLoading) return;

        let userMessageContent = '';
        let endpoint = '';
        let payload = {};

        if ((currentMode === 'code' || currentMode === 'redesign') && !isPremium) {
            if (generationCount >= MAX_FREE_GENERATIONS) {
                showToast('Anda telah mencapai batas penggunaan gratis. Silakan berlangganan Premium.', 'warning');
                setLoading(false);
                return;
            }
        }

        setLoading(true);

        try {
            if (currentMode === 'chat' || currentMode === 'code') {
                userMessageContent = chatInput.value.trim();
                if (!userMessageContent) { setLoading(false); return; }
                addMessage(userMessageContent, 'user', currentMode === 'chat');
                chatInput.value = '';
                endpoint = currentMode === 'chat' ? '/chat' : '/code';
                payload = currentMode === 'chat' ? { messages: chatHistory } : { prompt: userMessageContent };
            } else if (currentMode === 'redesign') {
                const url = urlInput.value.trim();
                if (!url) { console.error("URL tidak boleh kosong"); setLoading(false); return; }
                const style = styleSelect.value;
                userMessageContent = `Redesign website dari URL: ${url} dengan gaya ${style}.`;
                addMessage(userMessageContent, 'user', false);
                urlInput.value = '';
                endpoint = '/redesign';
                payload = { url, style, framework: 'html' };
            }

            const response = await fetch(API_BASE_URL + endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }

            const data = await response.json();
            
            if (currentMode === 'chat') {
                addMessage(data.response, 'assistant', true);
            } else if (currentMode === 'code') {
                addMessage(data.code, 'assistant', false);
            } else if (currentMode === 'redesign') {
                addPreviewMessage(data.code, data.explanation); 
            }

            if ((currentMode === 'code' || currentMode === 'redesign') && !isPremium) {
                generationCount++;
                localStorage.setItem('aiPartnerGenCount', generationCount);
                updateSettingsUI();
            }

        } catch (error) {
            console.error('Gagal mengambil data dari API:', error);
            addMessage(`Maaf, terjadi kesalahan: ${error.message}`, 'assistant', false);
        } finally {
            setLoading(false);
        }
    };

    // --- FUNGSI PEMBANTU ---

    const addPreviewMessage = (generatedCode, reasoning) => {
        const bubble = document.createElement('div');
        bubble.classList.add('message-bubble', 'assistant-message');

        const text = document.createElement('p');
        text.textContent = 'Desain berhasil dibuat! Klik tombol di bawah untuk melihat Preview dan Kode Sumber.';
        
        const previewButton = document.createElement('ion-button');
        previewButton.color = 'primary';
        previewButton.fill = 'solid';
        previewButton.innerHTML = '<ion-icon name="eye-outline" slot="start"></ion-icon>Lihat Preview & Kode';
        
        previewButton.onclick = () => {
            reasoningOutput.textContent = reasoning;
            sourceCodeOutput.textContent = generatedCode;
            hljs.highlightElement(sourceCodeOutput);
            
            const blob = new Blob([generatedCode], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            previewFrame.src = url;
            previewModal.present();
            
            previewFrame.onload = () => {
                URL.revokeObjectURL(url);
            }
        };

        copyCodeButton.onclick = async () => {
            try {
                await navigator.clipboard.writeText(generatedCode);
                showToast('Kode berhasil disalin!', 'success');
            } catch (err) {
                console.error('Gagal menyalin kode: ', err);
                showToast('Gagal menyalin kode.', 'danger');
            }
        };

        bubble.appendChild(text);
        bubble.appendChild(previewButton);
        messageList.appendChild(bubble);
        scrollToBottom();
    };

    const saveHistory = () => {
        try {
            localStorage.setItem('aiPartnerChatHistory', JSON.stringify(chatHistory));
        } catch (e) { console.error("Gagal menyimpan riwayat chat:", e); }
    };

    const loadHistory = () => {
        try {
            const savedHistory = localStorage.getItem('aiPartnerChatHistory');
            if (savedHistory) { chatHistory = JSON.parse(savedHistory); }
        } catch (e) { console.error("Gagal memuat riwayat chat:", e); chatHistory = []; }
    };

    // BARU: Fungsi untuk menambahkan tombol copy pada setiap code block
    const addCopyButtonToCodeBlocks = (container) => {
        const codeBlocks = container.querySelectorAll('pre code');
        
        codeBlocks.forEach((codeBlock) => {
            const pre = codeBlock.parentElement;
            
            // Cek apakah sudah ada tombol copy
            if (pre.querySelector('.copy-button')) return;
            
            // Buat wrapper untuk pre agar bisa positioning relative
            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            wrapper.style.marginBottom = '10px';
            
            // Pindahkan pre ke dalam wrapper
            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(pre);
            
            // Buat tombol copy
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-button';
            copyBtn.innerHTML = '<ion-icon name="copy-outline"></ion-icon>';
            copyBtn.title = 'Salin kode';
            
            // Style tombol
            copyBtn.style.position = 'absolute';
            copyBtn.style.top = '8px';
            copyBtn.style.right = '8px';
            copyBtn.style.background = 'rgba(255, 255, 255, 0.1)';
            copyBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            copyBtn.style.borderRadius = '6px';
            copyBtn.style.padding = '6px 10px';
            copyBtn.style.cursor = 'pointer';
            copyBtn.style.color = '#fff';
            copyBtn.style.fontSize = '18px';
            copyBtn.style.display = 'flex';
            copyBtn.style.alignItems = 'center';
            copyBtn.style.justifyContent = 'center';
            copyBtn.style.transition = 'all 0.2s ease';
            copyBtn.style.zIndex = '10';
            
            // Hover effect
            copyBtn.onmouseenter = () => {
                copyBtn.style.background = 'rgba(255, 255, 255, 0.2)';
                copyBtn.style.transform = 'scale(1.05)';
            };
            copyBtn.onmouseleave = () => {
                copyBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                copyBtn.style.transform = 'scale(1)';
            };
            
            // Event click untuk copy
            copyBtn.onclick = async (e) => {
                e.preventDefault();
                const code = codeBlock.textContent;
                
                try {
                    await navigator.clipboard.writeText(code);
                    
                    // Feedback visual
                    const originalHTML = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<ion-icon name="checkmark-outline"></ion-icon>';
                    copyBtn.style.background = 'rgba(16, 185, 129, 0.3)';
                    
                    setTimeout(() => {
                        copyBtn.innerHTML = originalHTML;
                        copyBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                    }, 2000);
                    
                    showToast('Kode berhasil disalin!', 'success', 1500);
                } catch (err) {
                    console.error('Gagal menyalin:', err);
                    showToast('Gagal menyalin kode', 'danger');
                }
            };
            
            wrapper.appendChild(copyBtn);
        });
    };

    const addMessage = (text, role, save = false) => {
        if (save) {
            chatHistory.push({ role, content: text });
            saveHistory();
        }

        const bubble = document.createElement('div');
        bubble.classList.add('message-bubble', `${role}-message`);
        
        if (role === 'assistant') { 
            bubble.innerHTML = marked.parse(text);
            
            // Highlight code blocks
            bubble.querySelectorAll('pre code').forEach(hljs.highlightElement);
            
            // BARU: Tambahkan tombol copy ke semua code blocks
            addCopyButtonToCodeBlocks(bubble);
        } 
        else { 
            bubble.textContent = text; 
        }

        messageList.appendChild(bubble);
        scrollToBottom();
    };
    
    const setLoading = (state) => {
        isLoading = state;
        loadingIndicator.classList.toggle('hidden', !state);
        if (state) { scrollToBottom(); }
    };
    
    const scrollToBottom = () => {
        chatContent.scrollToBottom(500);
    };

    const showToast = async (message, color = 'dark', duration = 2000) => {
        const toast = document.createElement('ion-toast');
        toast.message = message;
        toast.duration = duration;
        toast.color = color;
        document.body.appendChild(toast);
        return toast.present();
    };

    const handleClearHistory = () => {
        chatHistory = [];
        saveHistory();
        messageList.innerHTML = '';
        addMessage("Riwayat chat telah dibersihkan.", 'assistant', false);
        showToast('Riwayat chat berhasil dihapus', 'success');
        settingsModal.dismiss();
    };

    const handleSubscribe = async () => {
        setLoading(true);
        try {
            const response = await fetch(API_BASE_URL + '/create-paypal-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                throw new Error('Gagal membuat pesanan PayPal.');
            }

            const data = await response.json();
            if (data.approvalUrl) {
                window.location.href = data.approvalUrl;
            } else {
                throw new Error('Tidak ada URL persetujuan dari PayPal.');
            }
        } catch (error) {
            console.error('Error berlangganan:', error);
            showToast(error.message, 'danger');
        } finally {
            setLoading(false);
        }
    };

    const switchMode = (newMode) => {
        currentMode = newMode;
        messageList.innerHTML = '';

        const isRedesign = newMode === 'redesign';
        chatCodeFooter.classList.toggle('hidden', isRedesign);
        redesignFooter.classList.toggle('hidden', !isRedesign);
        
        if (newMode === 'chat') {
            chatHistory.forEach(msg => addMessage(msg.content, msg.role, false));
             if (chatHistory.length === 0) {
                 addMessage("Halo! Saya AI Assistant yang dapat membantu Anda dengan berbagai hal:\n\n💬 **Chat**: Tanya apa saja tentang berbagai topik\n💻 **Code Generator**: Buat kode dalam berbagai bahasa programming (JavaScript, Python, HTML, CSS, dll)\n🎨 **Website Redesign**: Desain ulang website dengan gaya modern, minimalist, glassmorphism, cyberpunk, dan lainnya\n\nApa yang bisa saya bantu hari ini?", 'assistant', true);
             }
        } else if (newMode === 'code') {
            addMessage("Mode **Code Generator** aktif!\n\nSilakan deskripsikan kode yang Anda inginkan. Contoh:\n- Buat fungsi JavaScript untuk validasi email\n- Buat kode Python untuk web scraping\n- Buat landing page HTML dengan CSS modern\n\nKode akan otomatis dilengkapi dengan syntax highlighting dan tombol copy.", 'assistant', false);
        } else {
            addMessage("Mode **Website Redesign** aktif!\n\nMasukkan URL website yang ingin Anda desain ulang, kemudian pilih gaya desain:\n- **Modern**: Gradient, shadow, animasi smooth\n- **Minimalist**: Clean, whitespace, typography focus\n- **Glassmorphism**: Backdrop blur, transparansi\n- **Cyberpunk**: Neon colors, futuristic style\n\nHasil akan ditampilkan dengan preview langsung dan source code yang bisa Anda salin.", 'assistant', false);
        }
    };

    // --- EVENT LISTENERS ---

    modeSegment.addEventListener('ionChange', (e) => switchMode(e.detail.value));
    sendButton.addEventListener('click', handleSend);
    redesignButton.addEventListener('click', handleSend);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });
    
    closeModalButton.addEventListener('click', () => {
        previewModal.dismiss();
    });

    settingsButton.addEventListener('click', () => settingsModal.present());
    closeSettingsModalButton.addEventListener('click', () => settingsModal.dismiss());
    clearHistoryButton.addEventListener('click', handleClearHistory);
    subscribeButton.addEventListener('click', handleSubscribe);

    // --- INISIALISASI ---
    loadHistory(); 
    loadUserStatus();
    switchMode('chat');
});