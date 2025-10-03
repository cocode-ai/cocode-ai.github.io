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
    
    // BARU: Seleksi Elemen Modal
    const previewModal = document.getElementById('preview-modal');
    const previewFrame = document.getElementById('preview-frame');
    const closeModalButton = document.getElementById('close-modal-button');
    // TAMBAHKAN DUA ELEMENT BARU INI
    const reasoningOutput = document.getElementById('reasoning-output');
    const sourceCodeOutput = document.getElementById('source-code-output');
    const copyCodeButton = document.getElementById('copy-code-button');

    // State Aplikasi
    let currentMode = 'chat';
    let chatHistory = []; 
    let isLoading = false;

    // --- FUNGSI UTAMA ---

    const handleSend = async () => {
        if (isLoading) return;

        let userMessageContent = '';
        let endpoint = '';
        let payload = {};

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
            // BARU: Tangani respons redesign secara khusus
            } else if (currentMode === 'redesign') {
                // KIRIM KODE DAN ALASAN SEBAGAI OBJECT
                addPreviewMessage(data.code, data.explanation); 
            }
        } catch (error) {
            console.error('Gagal mengambil data dari API:', error);
            addMessage(`Maaf, terjadi kesalahan: ${error.message}`, 'assistant', false);
        } finally {
            setLoading(false);
        }
    };

    // --- FUNGSI PEMBANTU ---

    /**
     * BARU: Fungsi untuk menampilkan pesan dengan tombol preview
     * @param {string} generatedCode - Kode HTML murni hasil dari API
     * @param {string} reasoning - Alasan/penjelasan desain dari API
     */
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
            // 1. ISI ELEMENT MODAL DENGAN KODE & REASONING
            
            // Tampilkan Reasoning
            reasoningOutput.textContent = reasoning;
            
            // Tampilkan Kode Sumber
            sourceCodeOutput.textContent = generatedCode;
            hljs.highlightElement(sourceCodeOutput); // Highlight kode
            
            // 2. MUAT PREVIEW KE IFRAME
            const blob = new Blob([generatedCode], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            previewFrame.src = url;
            previewModal.present();
            
            previewFrame.onload = () => {
                URL.revokeObjectURL(url);
            }
        };

        // Tambahkan Event Listener Copy
        copyCodeButton.onclick = async () => {
            try {
                await navigator.clipboard.writeText(generatedCode);
                alert('Kode berhasil disalin!');
            } catch (err) {
                console.error('Gagal menyalin kode: ', err);
                alert('Gagal menyalin kode. Browser tidak mendukung clipboard API.');
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

    const addMessage = (text, role, save = false) => {
        if (save) {
            chatHistory.push({ role, content: text });
            saveHistory();
        }

        const bubble = document.createElement('div');
        bubble.classList.add('message-bubble', `${role}-message`);
        
        if (role === 'assistant') { bubble.innerHTML = marked.parse(text); } 
        else { bubble.textContent = text; }

        messageList.appendChild(bubble);
        bubble.querySelectorAll('pre code').forEach(hljs.highlightElement);
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

    const switchMode = (newMode) => {
        currentMode = newMode;
        messageList.innerHTML = '';

        const isRedesign = newMode === 'redesign';
        chatCodeFooter.classList.toggle('hidden', isRedesign);
        redesignFooter.classList.toggle('hidden', !isRedesign);
        
        if (newMode === 'chat') {
            chatHistory.forEach(msg => addMessage(msg.content, msg.role, false));
             if (chatHistory.length === 0) {
                 addMessage("Halo! Ada yang bisa saya bantu hari ini?", 'assistant', true);
             }
        } else {
            let welcomeMessage = newMode === 'code'
                ? "Silakan deskripsikan kode yang Anda inginkan..."
                : "Masukkan URL website yang ingin Anda desain ulang...";
            addMessage(welcomeMessage, 'assistant', false);
        }
    };

    // --- EVENT LISTENERS ---

    modeSegment.addEventListener('ionChange', (e) => switchMode(e.detail.value));
    sendButton.addEventListener('click', handleSend);
    redesignButton.addEventListener('click', handleSend);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });
    
    // BARU: Event listener untuk tombol close modal
    closeModalButton.addEventListener('click', () => {
        previewModal.dismiss();
    });

    // --- INISIALISASI ---
    loadHistory(); 
    switchMode('chat');
});

