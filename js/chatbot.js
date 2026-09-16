/**
 * Recovra AI — halaman asisten AI tersendiri, ala Claude/ChatGPT:
 * ada daftar percakapan (sidebar) dan bisa mulai percakapan baru kapan saja.
 * Nyambung ke backend AI (js/server.js). Kalau server itu tidak terjangkau,
 * otomatis balik ke jawaban offline (rule-based) supaya fitur tetap jalan.
 */

const ChatModule = {
  AI_SERVER_URL: '/api/chat',

  conversations: [],
  activeId: null,
  foodsDB: null,
  exercisesDB: null,
  medicinesDB: null,
  isReplying: false,
  aiOffline: false,
  searchQuery: '',
  openMenuId: null,
  showArchived: false,
  chatListMode: 'recent',
  sidebarOpen: false,

  emptyMemory() {
    return { condition: null, goal: null, symptoms: [], lastTopic: null, facts: [], turnCount: 0, usedVariants: {} };
  },

  makeConversation() {
    return {
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      title: 'Percakapan baru',
      messages: [
        { sender: 'assistant', text: 'Halo! Aku Recovra AI. Cerita aja lagi ngerasa gimana, atau pilih salah satu topik di bawah ya.', time: Date.now() }
      ],
      memory: this.emptyMemory(),
      updatedAt: Date.now()
    };
  },

  async init() {
    try {
      const raw = JSON.parse(localStorage.getItem('recovra_conversations') || 'null');
      this.conversations = Array.isArray(raw) && raw.length ? raw : [this.makeConversation()];
    } catch (e) {
      this.conversations = [this.makeConversation()];
    }
    this.conversations.forEach(c => { if (!c.memory) c.memory = this.emptyMemory(); if (!c.memory.usedVariants) c.memory.usedVariants = {}; });
    this.activeId = localStorage.getItem('recovra_active_conversation');
    if (!this.activeId || !this.conversations.find(c => c.id === this.activeId)) {
      this.activeId = this.conversations[0].id;
    }
    this.saveConversations();
    this.bindSearch();
    this.bindSidebar();
    this.setSidebarState(false, false);
    // Tutup popup opsi percakapan kalau klik di luar popup/tombol "•••"-nya
    if (!this._menuOutsideBound) {
      this._menuOutsideBound = true;
      document.addEventListener('click', (event) => {
        if (this.openMenuId === null) return;
        const portal = document.getElementById('chatai-context-menu-portal');
        if (portal && (portal.contains(event.target) || event.target.closest('.chatai-conv-menu'))) return;
        this.closeConversationMenu();
      });
    }
    this.renderConversationList();
    this.renderMessages();
    this.renderQuickPrompts();
    try {
      const cacheBust = `?v=${Date.now()}`;
      const [foodsRes, exercisesRes, medicinesRes] = await Promise.all([
        fetch(`data/foods.json${cacheBust}`, { cache: 'no-store' }),
        fetch(`data/exercises.json${cacheBust}`, { cache: 'no-store' }),
        fetch(`data/medicines.json${cacheBust}`, { cache: 'no-store' })
      ]);
      if (foodsRes.ok) this.foodsDB = await foodsRes.json();
      if (exercisesRes.ok) this.exercisesDB = await exercisesRes.json();
      if (medicinesRes.ok) this.medicinesDB = await medicinesRes.json();
    } catch (error) {
      console.warn('Recovra AI: data lokal tidak lengkap, fallback tetap aktif.', error);
    }
  },

  getActive() {
    let conv = this.conversations.find(c => c.id === this.activeId);
    if (!conv) {
      conv = this.conversations[0];
      this.activeId = conv ? conv.id : null;
    }
    return conv;
  },

  saveConversations() {
    this.conversations.sort((a, b) => b.updatedAt - a.updatedAt);
    localStorage.setItem('recovra_conversations', JSON.stringify(this.conversations.slice(0, 30)));
    if (this.activeId) localStorage.setItem('recovra_active_conversation', this.activeId);
  },

  newChat() {
    const conv = this.makeConversation();
    this.conversations.unshift(conv);
    this.activeId = conv.id;
    this.aiOffline = false;
    this.saveConversations();
    this.renderConversationList();
    this.renderMessages();
    this.renderQuickPrompts();
    const input = document.getElementById('chat-input');
    if (input) input.focus();
  },

  switchConversation(id) {
    if (this.isReplying) return;
    this.activeId = id;
    localStorage.setItem('recovra_active_conversation', id);
    this.renderConversationList();
    this.renderMessages();
    this.renderQuickPrompts();
    this.closeSidebar();
  },

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
    }[char]));
  },

  formatAIReply(raw) {
    let safe = this.escapeHtml(raw);
    safe = safe.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    safe = safe.replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
    return safe;
  },

  formatTime(ts) {
    try {
      return new Date(ts || Date.now()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  },

  setChatListMode(mode) {
    this.chatListMode = mode === 'pinned' ? 'pinned' : 'recent';
    this.showArchived = false;
    this.openMenuId = null;
    const search = document.getElementById('chat-search');
    if (search && this.searchQuery) { search.value = this.searchQuery; }
    this.renderConversationList();
  },

  renderConversationList() {
    const container = document.getElementById('chat-conversation-list');
    if (!container) return;
    // Popup opsi (kalau lagi kebuka) ditutup dulu tiap list di-render ulang, biar gak nyangkut nunjukin data lama.
    document.getElementById('chatai-context-menu-portal')?.classList.remove('open');

    const query = this.searchQuery.trim().toLowerCase();
    const sorted = [...this.conversations]
      .sort((a, b) => (b.pinned === true) - (a.pinned === true) || b.updatedAt - a.updatedAt)
      .filter(conv => this.showArchived ? conv.archived === true : conv.archived !== true)
      .filter(conv => !query || String(conv.title || '').toLowerCase().includes(query) ||
        conv.messages.some(m => String(m.text || '').toLowerCase().includes(query)));

    if (!sorted.length) {
      container.innerHTML = `<div class="chatai-empty-history"><span>${this.showArchived ? '▱' : '⌕'}</span><p>${this.showArchived ? 'Belum ada chat yang diarsipkan.' : 'Tidak ada percakapan yang cocok.'}</p></div>`;
      return;
    }

    const groups = { pinned: [], today: [], older: [] };
    const today = new Date();
    sorted.forEach(conv => {
      if (!this.showArchived && this.chatListMode === 'pinned') return groups.pinned.push(conv);
      if (!this.showArchived && conv.pinned) return groups.pinned.push(conv);
      const d = new Date(conv.updatedAt || Date.now());
      const sameDay = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
      groups[sameDay ? 'today' : 'older'].push(conv);
    });

    const renderRow = (conv) => `
      <div class="chatai-conv-row ${conv.id === this.activeId ? 'active' : ''} ${conv.pinned ? 'pinned' : ''}">
        <button type="button" class="chatai-conv-item" onclick="ChatModule.switchConversation('${this.escapeHtml(conv.id)}')">
          <span class="chatai-conv-icon">${conv.pinned ? '⌖' : '○'}</span>
          <span class="chatai-conv-title">${this.escapeHtml(conv.title || 'Percakapan baru')}</span>
        </button>
        <button type="button" class="chatai-conv-menu" title="Opsi percakapan" aria-label="Opsi percakapan" onclick="ChatModule.toggleConversationMenu(event, '${this.escapeHtml(conv.id)}')">•••</button>
      </div>`;

    const renderGroup = (label, list) => !list.length ? '' : `
      <div class="chatai-history-group">
        <div class="chatai-history-label">${label}</div>
        ${list.map(renderRow).join('')}
      </div>`;

    container.innerHTML =
      (this.showArchived
        ? renderGroup('Diarsipkan', sorted)
        : this.chatListMode === 'pinned'
          ? renderGroup('Pinned', groups.pinned)
          : renderGroup('Pinned', groups.pinned) + renderGroup('Recent chats', groups.today) + renderGroup('Sebelumnya', groups.older)
      );

    const pinnedBtn = document.getElementById('chat-nav-pinned');
    const recentBtn = document.getElementById('chat-nav-recent');
    pinnedBtn?.classList.toggle('active', !this.showArchived && this.chatListMode === 'pinned');
    recentBtn?.classList.toggle('active', !this.showArchived && this.chatListMode === 'recent');
    const archiveLabel = document.getElementById('chat-archive-toggle-label');
    if (archiveLabel) archiveLabel.textContent = this.showArchived ? 'Tutup Archive' : 'Buka Archive';
  },

  closeConversationMenu() {
    if (this.openMenuId !== null) {
      this.openMenuId = null;
      const portal = document.getElementById('chatai-context-menu-portal');
      if (portal) portal.classList.remove('open');
    }
  },

  bindSearch() {
    const input = document.getElementById('chat-search');
    if (!input || input.dataset.bound === '1') return;
    input.dataset.bound = '1';
    input.addEventListener('input', () => {
      this.searchQuery = input.value || '';
      this.renderConversationList();
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        input.value = '';
        this.searchQuery = '';
        this.renderConversationList();
        input.blur();
      }
    });
  },

  openActionModal({ title, body, confirmText = 'Simpan', danger = false, onConfirm }) {
    const overlay = document.getElementById('chat-action-modal');
    const content = document.getElementById('chat-action-modal-content');
    if (!overlay || !content) return;
    content.innerHTML = `
      <div class="chatai-action-modal-title">${this.escapeHtml(title)}</div>
      <div class="chatai-action-modal-body">${body}</div>
      <div class="chatai-action-modal-footer">
        <button type="button" class="chatai-modal-btn" onclick="ChatModule.closeActionModal()">Batal</button>
        <button type="button" class="chatai-modal-btn ${danger ? 'danger' : 'primary'}" id="chat-action-confirm">${this.escapeHtml(confirmText)}</button>
      </div>`;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    const confirm = document.getElementById('chat-action-confirm');
    if (confirm) confirm.onclick = () => { onConfirm(); this.closeActionModal(); };
  },

  closeActionModal() {
    const overlay = document.getElementById('chat-action-modal');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  },

  toggleConversationMenu(event, id) {
    event.preventDefault();
    event.stopPropagation();
    const portal = document.getElementById('chatai-context-menu-portal');
    if (!portal) return;

    if (this.openMenuId === id) {
      this.closeConversationMenu();
      return;
    }

    const conv = this.conversations.find(c => c.id === id);
    if (!conv) return;

    portal.innerHTML = `
      <button type="button" onclick="ChatModule.renameConversation('${this.escapeHtml(id)}')"><span>✎</span> Rename</button>
      <button type="button" onclick="ChatModule.togglePinConversation('${this.escapeHtml(id)}')"><span>⌖</span> ${conv.pinned ? 'Unpin' : 'Pin'}</button>
      <button type="button" onclick="ChatModule.toggleArchiveConversation('${this.escapeHtml(id)}')"><span>▱</span> ${conv.archived ? 'Unarchive' : 'Archive'}</button>
      <button type="button" onclick="ChatModule.shareConversation('${this.escapeHtml(id)}')"><span>↗</span> Share</button>
      <div class="chatai-menu-divider"></div>
      <button type="button" class="danger" onclick="ChatModule.deleteConversation('${this.escapeHtml(id)}')"><span>⌫</span> Delete</button>
    `;

    // Posisiin popup persis di bawah tombol "•••" yang diklik, pakai koordinat layar asli
    // (position: fixed) — jadi gak keclip lagi sama sidebar yang overflow:auto.
    portal.classList.add('open'); // biar offsetWidth kebaca akurat (elemen kudu visible dulu)
    const btnRect = event.currentTarget.getBoundingClientRect();
    const menuWidth = portal.offsetWidth || 190;
    const spaceBelow = window.innerHeight - btnRect.bottom;
    const openUpward = spaceBelow < 220;
    portal.style.top = openUpward ? '' : `${btnRect.bottom + 4}px`;
    portal.style.bottom = openUpward ? `${window.innerHeight - btnRect.top + 4}px` : '';
    let left = btnRect.right - menuWidth;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
    portal.style.left = `${left}px`;

    this.openMenuId = id;
  },

  renameConversation(id) {
    this.openMenuId = null;
    const conv = this.conversations.find(c => c.id === id);
    if (!conv) return;
    const current = this.escapeHtml(conv.title || 'Percakapan baru');
    this.openActionModal({
      title: 'Rename percakapan',
      body: `<label class="chatai-modal-label">Nama percakapan</label><input id="chat-rename-input" class="chatai-modal-input" maxlength="80" value="${current}">`,
      confirmText: 'Rename',
      onConfirm: () => {
        const input = document.getElementById('chat-rename-input');
        const title = String(input?.value || '').trim();
        if (!title) return;
        conv.title = title;
        conv.updatedAt = Date.now();
        this.saveConversations();
        this.renderConversationList();
      }
    });
    setTimeout(() => document.getElementById('chat-rename-input')?.focus(), 50);
  },

  togglePinConversation(id) {
    this.openMenuId = null;
    const conv = this.conversations.find(c => c.id === id);
    if (!conv) return;
    conv.pinned = !conv.pinned;
    conv.updatedAt = Date.now();
    this.saveConversations();
    this.renderConversationList();
  },

  toggleArchiveConversation(id) {
    this.openMenuId = null;
    const conv = this.conversations.find(c => c.id === id);
    if (!conv) return;
    conv.archived = !conv.archived;
    conv.updatedAt = Date.now();
    if (conv.archived && this.activeId === id) {
      const next = [...this.conversations]
        .filter(c => !c.archived && c.id !== id)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (next) {
        this.activeId = next.id;
      } else {
        const fresh = this.createConversation();
        this.activeId = fresh.id;
      }
    }
    this.saveConversations();
    this.renderConversationList();
    this.renderMessages();
  },

  showArchivedChats() {
    this.openMenuId = null;
    this.showArchived = !this.showArchived;
    if (this.showArchived) this.chatListMode = 'recent';
    this.renderConversationList();
  },

  setSidebarState(open, persist = true) {
    this.sidebarOpen = !!open;
    const layout = document.getElementById('chatai-layout');
    const toggle = document.getElementById('chatai-sidebar-toggle');
    const backdrop = document.getElementById('chatai-sidebar-backdrop');
    layout?.classList.toggle('sidebar-open', this.sidebarOpen);
    toggle?.setAttribute('aria-expanded', String(this.sidebarOpen));
    toggle?.setAttribute('title', this.sidebarOpen ? 'Tutup sidebar' : 'Buka sidebar');
    if (backdrop) backdrop.setAttribute('aria-hidden', String(!this.sidebarOpen));
    if (persist) localStorage.setItem('recovra_ai_sidebar_open', this.sidebarOpen ? '1' : '0');
  },

  toggleSidebar() {
    this.setSidebarState(!this.sidebarOpen);
  },

  closeSidebar() {
    this.setSidebarState(false);
  },

  bindSidebar() {
    if (document.body.dataset.chatSidebarBound === '1') return;
    document.body.dataset.chatSidebarBound = '1';
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.sidebarOpen) this.closeSidebar();
    });
  },

  shareConversation(id) {
    this.openMenuId = null;
    const conv = this.conversations.find(c => c.id === id);
    if (!conv) return;
    const text = (conv.messages || []).map(m => `${m.sender === 'user' ? 'Kamu' : 'Recovra AI'}: ${m.text}`).join('\n\n');
    const title = conv.title || 'Percakapan Recovra AI';
    if (navigator.share) {
      navigator.share({ title, text }).catch(() => {});
      return;
    }
    navigator.clipboard?.writeText(text).then(() => {
      if (window.App?.showToast) App.showToast('Percakapan disalin', 'Isi chat sudah disalin ke clipboard.');
    }).catch(() => {
      this.openActionModal({ title: 'Share percakapan', body: `<textarea class="chatai-share-text" readonly>${this.escapeHtml(text)}</textarea>`, confirmText: 'Tutup', onConfirm: () => {} });
    });
  },

  deleteConversation(id) {
    this.openMenuId = null;
    if (this.isReplying) return;
    const conv = this.conversations.find(c => c.id === id);
    if (!conv) return;
    const title = this.escapeHtml(conv.title || 'Percakapan ini');
    this.openActionModal({
      title: 'Hapus percakapan?',
      body: `<p>Percakapan <strong>“${title}”</strong> akan dihapus dari riwayat Recovra di perangkat ini dan tidak bisa dikembalikan.</p>`,
      confirmText: 'Hapus',
      danger: true,
      onConfirm: () => {
        this.conversations = this.conversations.filter(c => c.id !== id);
        if (!this.conversations.length) {
          const fresh = this.makeConversation();
          this.conversations = [fresh];
          this.activeId = fresh.id;
        } else if (this.activeId === id) {
          this.activeId = [...this.conversations].filter(c => !c.archived).sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id || this.conversations[0].id;
        }
        this.saveConversations();
        this.renderConversationList();
        this.renderMessages();
        this.renderQuickPrompts();
      }
    });
  },

  clearAllConversations() {
    this.openMenuId = null;
    if (this.isReplying || !this.conversations.length) return;
    this.openActionModal({
      title: 'Hapus semua riwayat?',
      body: '<p>Semua percakapan Recovra AI akan dihapus dari perangkat ini. Tindakan ini tidak bisa dikembalikan.</p>',
      confirmText: 'Hapus semua',
      danger: true,
      onConfirm: () => {
        const fresh = this.makeConversation();
        this.conversations = [fresh];
        this.activeId = fresh.id;
        this.aiOffline = false;
        this.showArchived = false;
        this.saveConversations();
        this.renderConversationList();
        this.renderMessages();
        this.renderQuickPrompts();
      }
    });
  },

  renderMessages() {
    const container = document.getElementById('chat-messages');
    const home = document.getElementById('chat-home');
    const quick = document.getElementById('chat-quick-prompts');
    if (!container) return;
    const conv = this.getActive();
    if (!conv) { container.innerHTML = ''; return; }

    const hasUserMessage = conv.messages.some(msg => msg.sender === 'user');
    if (!hasUserMessage) {
      container.classList.remove('visible');
      if (home) home.classList.add('visible');
      if (quick) quick.classList.remove('visible');
      container.innerHTML = '';
      return;
    }

    if (home) home.classList.remove('visible');
    container.classList.add('visible');
    if (quick) quick.classList.add('visible');

    let lastTime = null;
    const parts = [];
    conv.messages.forEach(msg => {
      const t = msg.time || Date.now();
      if (!lastTime || (t - lastTime) > 5 * 60 * 1000) {
        parts.push(`<div class="chat-time-divider">${this.formatTime(t)}</div>`);
      }
      lastTime = t;
      const bodyHtml = msg.sender === 'user' ? this.escapeHtml(msg.text) : msg.text;
      parts.push(`<div class="chat-bubble ${msg.sender === 'user' ? 'user' : 'assistant'}">${bodyHtml}</div>`);
    });
    container.innerHTML = parts.join('');
    this.scrollToBottom();
  },

  renderQuickPrompts() {
    const container = document.getElementById('chat-quick-prompts');
    if (!container) return;
    const prompts = ['Check-in kondisi', 'Tanya nutrisi', 'Aktivitas ringan', 'Tanya jadwal'];
    const values = [
      'Aku mau check-in kondisi hari ini',
      'Makanan apa yang cocok untuk kondisiku?',
      'Aktivitas ringan apa yang aman untukku?',
      'Bantu aku mengatur jadwal pemulihan'
    ];
    container.innerHTML = prompts.map((prompt, i) => `<button type="button" onclick="ChatModule.usePrompt('${this.escapeHtml(values[i])}')">${this.escapeHtml(prompt)}</button>`).join('');
  },

  usePrompt(text) {
    const input = document.getElementById('chat-input');
    if (!input || this.isReplying) return;
    input.value = text;
    input.focus();
    const form = document.getElementById('chat-form');
    if (form) form.requestSubmit();
  },

  scrollToBottom() {
    const container = document.getElementById('chat-messages');
    if (container) requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
  },

  setTyping(show) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const existing = document.getElementById('chat-typing');
    if (show && !existing) {
      container.insertAdjacentHTML('beforeend', '<div class="chat-bubble assistant chat-typing" id="chat-typing"><span></span><span></span><span></span></div>');
      this.scrollToBottom();
    } else if (!show && existing) {
      existing.remove();
    }
  },

  pushMessage(sender, text) {
    const conv = this.getActive();
    if (!conv) return;
    conv.messages.push({ sender, text, time: Date.now() });
    conv.messages = conv.messages.slice(-40);
    conv.updatedAt = Date.now();
    if (sender === 'user' && conv.title === 'Percakapan baru') {
      const clean = text.trim();
      conv.title = clean.length > 34 ? clean.slice(0, 34) + '…' : clean;
    }
    this.saveConversations();
  },

  async fetchAIReply() {
    const conv = this.getActive();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const payload = {
        messages: conv.messages.slice(-16).map(m => ({ sender: m.sender, text: m.text }))
      };
      const response = await fetch(this.AI_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Server AI merespons status ${response.status}`);
      }
      const data = await response.json();
      if (!data.reply) throw new Error('Balasan AI kosong.');
      return data.reply;
    } finally {
      clearTimeout(timeout);
    }
  },

  async sendMessage(event) {
    event.preventDefault();
    if (this.isReplying) return;
    const input = document.getElementById('chat-input');
    const submit = document.querySelector('#chat-form button[type="submit"]');
    const userText = input?.value.trim() || '';
    if (!userText) return;

    this.isReplying = true;
    if (submit) submit.disabled = true;
    this.pushMessage('user', userText);
    this.remember(userText);
    if (input) input.value = '';
    this.renderConversationList();
    this.renderMessages();
    this.setTyping(true);

    let reply;
    try {
      reply = await this.fetchAIReply();
      reply = this.formatAIReply(reply);
      this.aiOffline = false;
    } catch (error) {
      console.warn('Recovra AI: server AI tidak terjangkau, pakai jawaban offline.', error);
      reply = this.generateReply(userText);
      if (!this.aiOffline) {
        reply = `<span class="chat-offline-note">⚠️ Server AI belum aktif — jawaban ini masih pakai mode offline.</span><br>${reply}`;
        this.aiOffline = true;
      }
    }

    this.setTyping(false);
    this.pushMessage('assistant', reply);
    this.renderConversationList();
    this.renderMessages();
    this.isReplying = false;
    if (submit) submit.disabled = false;
    input?.focus();
  },


  initKeyboardShortcuts() {
    if (document.body.dataset.chatShortcutsBound === '1') return;
    document.body.dataset.chatShortcutsBound = '1';
    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        const page = document.getElementById('page-chatai');
        if (page && page.classList.contains('active')) {
          event.preventDefault();
          this.newChat();
        }
      }
    });
  },

  normalize(text) {
    let t = text.toLowerCase()
      .replace(/[.,!?;:()[\]{}"“”'’]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    t = t.replace(/([a-z])\1{2,}/g, '$1$1');
    return t;
  },

  levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i += 1) {
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[a.length][b.length];
  },

  fuzzyContains(text, keyword) {
    if (text.includes(keyword)) return true;
    if (keyword.includes(' ')) return false;
    if (keyword.length < 4) return false;
    const tokens = text.split(' ');
    const threshold = keyword.length <= 6 ? 1 : 2;
    return tokens.some(token => {
      if (Math.abs(token.length - keyword.length) > threshold) return false;
      return this.levenshtein(token, keyword) <= threshold;
    });
  },

  matchAny(text, keywords) {
    return keywords.some(word => this.fuzzyContains(text, word));
  },

  countMatches(text, keywords) {
    return keywords.reduce((total, word) => total + (this.fuzzyContains(text, word) ? (word.includes(' ') ? 2 : 1) : 0), 0);
  },

  pickVariant(memory, topicKey, variants) {
    if (!memory.usedVariants) memory.usedVariants = {};
    const lastIndex = memory.usedVariants[topicKey];
    let pool = variants.map((_, i) => i);
    if (pool.length > 1 && lastIndex !== undefined) pool = pool.filter(i => i !== lastIndex);
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    memory.usedVariants[topicKey] = chosen;
    return variants[chosen];
  },

  findCondition(text, memory) {
    const aliases = {
      cedera_fisik: [
        'cedera', 'keseleo', 'terkilir', 'kesleo', 'kesenggol', 'patah', 'patah tulang', 'tulang',
        'memar', 'lebam', 'pasca operasi', 'habis operasi', 'baru operasi', 'luka operasi', 'jahitan',
        'jatuh', 'kepeleset', 'terjatuh', 'engkel', 'sendi bergeser', 'otot tertarik', 'otot robek', 'salah bantal'
      ],
      demam: [
        'demam', 'panas', 'panas badan', 'meriang', 'menggigil', 'suhu naik', 'badan panas', 'sumeng',
        'anget badan', 'greges', 'mriang', 'panas dingin', 'suhu tinggi', 'kepanasan badan'
      ],
      flu_pilek: [
        'flu', 'pilek', 'batuk', 'hidung mampet', 'hidung tersumbat', 'bersin', 'tenggorokan', 'grok grok',
        'meler', 'ingusan', 'radang tenggorokan', 'suara serak', 'gatal tenggorokan', 'batpil'
      ],
      peradangan: [
        'radang', 'peradangan', 'arthritis', 'sendi bengkak', 'sendi sakit', 'sendi kaku', 'encok',
        'linu', 'nyeri sendi', 'rematik', 'asam urat', 'bengkak sendi', 'kaku sendi'
      ],
      pemulihan_umum: [
        'pemulihan', 'baru sembuh', 'habis sakit', 'kurang fit', 'stamina turun', 'baru pulih',
        'masih lemes', 'belum fit', 'drop', 'ngedrop', 'kecapean', 'kelelahan', 'gak fit'
      ]
    };
    let best = { key: null, score: 0 };
    Object.entries(aliases).forEach(([key, words]) => {
      const score = this.countMatches(text, words);
      if (score > best.score) best = { key, score };
    });
    if (best.key) memory.condition = best.key;
    return best.key || memory.condition;
  },

  remember(rawText) {
    const conv = this.getActive();
    const memory = conv.memory;
    const text = this.normalize(rawText);
    this.findCondition(text, memory);
    const goals = [
      ['nyeri', 'mengurangi nyeri'], ['sakit', 'mengurangi nyeri'], ['aktif', 'kembali aktif'],
      ['tidur', 'tidur lebih baik'], ['rutinitas', 'menjaga rutinitas'], ['makan', 'menjaga nutrisi'],
      ['obat', 'memahami obat'], ['jadwal', 'menjaga jadwal']
    ];
    const matchedGoal = goals.find(([word]) => this.fuzzyContains(text, word));
    if (matchedGoal) memory.goal = matchedGoal[1];
    const symptomWords = [
      'demam', 'pusing', 'sakit kepala', 'mual', 'muntah', 'batuk', 'pilek', 'lemas', 'lemes',
      'sesak', 'bengkak', 'nyeri', 'haus', 'berkeringat', 'sulit tidur', 'puyeng', 'keliyengan',
      'mules', 'kembung', 'gak nafsu makan', 'capek', 'ngilu', 'gemetar', 'kesemutan'
    ];
    memory.symptoms = [...new Set([...memory.symptoms, ...symptomWords.filter(word => this.fuzzyContains(text, word))].slice(-12))];
    const topic = this.matchAny(text, ['obat', 'paracetamol', 'oralit', 'apoteker', 'minum apa']) ? 'medicine'
      : this.matchAny(text, ['makan', 'nutrisi', 'menu', 'minum', 'gizi']) ? 'food'
      : this.matchAny(text, ['olahraga', 'aktivitas', 'gerak', 'latihan', 'senam']) ? 'activity'
      : this.matchAny(text, ['jadwal', 'pengingat', 'kalender']) ? 'schedule'
      : this.matchAny(text, ['nyeri', 'sakit', 'pusing', 'mual']) ? 'symptom'
      : memory.lastTopic;
    if (topic) memory.lastTopic = topic;
    const factMatch = rawText.match(/(?:aku|saya|gue|gw)\s+[^.!?]{4,80}/i);
    if (factMatch) memory.facts = [...new Set([...memory.facts, factMatch[0].trim()])].slice(-8);
    memory.turnCount += 1;
  },

  memoryContext(memory) {
    const parts = [];
    if (memory.condition) parts.push(`konteks ${this.conditionLabel(memory.condition)}`);
    if (memory.goal) parts.push(`fokus ${memory.goal}`);
    if (memory.symptoms.length) parts.push(`gejala yang pernah disebut: ${memory.symptoms.slice(-5).join(', ')}`);
    return parts.join('; ');
  },

  conditionLabel(key) {
    return this.foodsDB?.conditions?.[key]?.label || ({
      cedera_fisik: 'cedera fisik', demam: 'demam/infeksi', flu_pilek: 'flu atau pilek',
      peradangan: 'peradangan/sendi', pemulihan_umum: 'pemulihan umum'
    }[key] || 'kondisimu');
  },

  sampleFrom(db, condition, key, count = 3) {
    const list = db?.conditions?.[condition]?.[key] || [];
    return list.slice(0, count).map(item => `${item.emoji || '•'} <b>${this.escapeHtml(item.name)}</b>`).join(', ');
  },

  generateReply(rawText) {
    const conv = this.getActive();
    const memory = conv.memory;
    const text = this.normalize(rawText);
    const condition = this.findCondition(text, memory) || memory.condition;

    const isFollowUp = this.matchAny(text, [
      'terus', 'lalu', 'terus gimana', 'kalau begitu', 'trus gmn', 'trs', 'gimana', 'bagaimana',
      'yang mana', 'itu maksudnya', 'boleh', 'teruskan', 'jelaskan lagi', 'lanjut', 'terus abis itu'
    ]) && text.split(' ').length <= 6;

    const asksMedicine = this.matchAny(text, ['obat', 'medis', 'minum apa', 'pil', 'paracetamol', 'oralit', 'apoteker', 'farmasi', 'obat apa ya', 'boleh minum obat']);
    const asksFood = this.matchAny(text, ['makan', 'makanan', 'minum', 'nutrisi', 'gizi', 'menu', 'buah', 'sayur', 'boleh makan apa', 'enaknya makan apa']);
    const asksActivity = this.matchAny(text, ['olahraga', 'aktivitas', 'gerak', 'latihan', 'senam', 'stretch', 'jalan jalan', 'boleh bergerak', 'boleh olahraga', 'gym', 'boleh gerak']);
    const asksSchedule = this.matchAny(text, ['jadwal', 'pengingat', 'reminder', 'kalender', 'kontrol', 'fisioterapi']);
    const asksPain = this.matchAny(text, ['nyeri', 'sakit', 'perih', 'ngilu', 'cenut', 'berdenyut', 'senut senut', 'sakit banget']);
    const asksUrgent = this.matchAny(text, ['sesak', 'sulit bernapas', 'pingsan', 'bingung', 'kejang', 'perdarahan banyak', 'bibir biru', 'tidak sadar', 'gabisa napas', 'lemes banget sampe pingsan']);
    const asksGreeting = /^(hai+|halo+|hi+|hello+|hey+|woy|woi|pagi|siang|sore|malam|permisi|assalamualaikum)\b/.test(text);
    const asksThanks = this.matchAny(text, ['terima kasih', 'makasih', 'thanks', 'thank you', 'tengkyu', 'mksh']);
    const asksHelp = this.matchAny(text, ['kamu bisa apa', 'bisa bantu', 'fitur apa', 'caranya gimana', 'apa yang bisa', 'bisa ngapain aja', 'bantuin apa']);
    const asksIdentity = this.matchAny(text, ['kamu siapa', 'kamu apa', 'ini apa', 'namamu siapa', 'kamu robot', 'kamu ai apa bukan']);

    if (asksUrgent) {
      return this.pickVariant(memory, 'urgent', [
        '<b>Kalau kamu ngalamin tanda bahaya kayak sesak berat, pingsan, bingung parah, kejang, perdarahan banyak, atau sulit dibangunkan — segera cari pertolongan darurat sekarang juga.</b> Jangan nunggu balesan chatbot dulu ya.',
        '<b>Ini kedengarannya perlu penanganan segera</b> — sesak napas berat, pingsan, kejang, atau perdarahan banyak itu tanda bahaya. Tolong langsung ke IGD/telepon layanan darurat.'
      ]);
    }
    if (asksIdentity) {
      return this.pickVariant(memory, 'identity', [
        'Aku Recovra AI, asisten yang bantu kamu mikirin makanan, aktivitas ringan, jadwal, dan info obat bebas selama masa pemulihan.',
        'Namaku Recovra AI — pendamping digital buat urusan pemulihan: nutrisi, gerak badan, jadwal kontrol/obat, sampai info obat bebas.'
      ]);
    }
    if (isFollowUp && memory.lastTopic === 'medicine') {
      return this.pickVariant(memory, 'followup_medicine', [
        `Oke lanjut ke soal obat ya. Yang masih aku inget: ${this.escapeHtml(this.memoryContext(memory))}. Kamu mau tau fungsinya, efek samping, atau kapan sebaiknya cari bantuan medis?`,
        `Lanjut bahas obat. Sejauh ini konteksnya: ${this.escapeHtml(this.memoryContext(memory))}. Mau aku jelasin cara pakainya atau tanda kalau harus ke dokter?`
      ]);
    }
    if (isFollowUp && memory.lastTopic === 'food') {
      return this.pickVariant(memory, 'followup_food', [
        `Lanjut dari rekomendasi makanan buat ${this.escapeHtml(this.conditionLabel(condition))} ya. Mau contoh menu, waktu makan yang pas, atau opsi kalau lagi mual?`,
        `Oke, masih soal makanan buat ${this.escapeHtml(this.conditionLabel(condition))}. Penasaran soal porsi, jenis makanan yang dihindari, atau ide menu praktis?`
      ]);
    }
    if (isFollowUp && memory.lastTopic === 'activity') {
      return this.pickVariant(memory, 'followup_activity', [
        `Lanjut ke aktivitas buat ${this.escapeHtml(this.conditionLabel(condition))}. Ceritain bagian yang paling ngeganggu ya.`,
        `Masih bahas gerak badan buat ${this.escapeHtml(this.conditionLabel(condition))}. Mau tau durasi amannya atau tanda kalau harus berhenti?`
      ]);
    }
    if (asksGreeting) {
      return this.pickVariant(memory, 'greeting', [
        'Halo! 👋 Cerita aja lagi ngerasa apa — bisa gejala, mau tanya makanan, aktivitas ringan, atau info obat bebas.',
        'Hai! Boleh langsung cerita keluhannya pakai bahasa sehari-hari kok.',
        'Halo juga! Mau mulai dari mana — gejala, ide makanan, atau tanya soal aktivitas dan obat?'
      ]);
    }
    if (asksThanks) {
      return this.pickVariant(memory, 'thanks', [
        'Sama-sama! Semoga cepat enakan ya.',
        'Sama-sama, senang bisa bantu. Cerita lagi aja di sini kalau ada yang berubah.'
      ]);
    }
    if (asksHelp) {
      return this.pickVariant(memory, 'help', [
        'Aku bisa bantu jelasin pilihan makanan, aktivitas ringan, info obat bebas, sama cara pakai fitur Cek Kondisi.',
        'Aku bisa bantu: rekomendasi makanan, batasan aktivitas/olahraga, info umum obat bebas, dan jadwal pemulihan.'
      ]);
    }

    const wantsMultiple = [asksMedicine, asksFood, asksActivity].filter(Boolean).length >= 2;
    if (wantsMultiple && condition) {
      const pieces = [];
      if (asksFood) pieces.push(`makanan: ${this.sampleFrom(this.foodsDB, condition, 'foods', 2) || 'cek halaman Nutrisi'}`);
      if (asksActivity) pieces.push(`aktivitas: ${this.sampleFrom(this.exercisesDB, condition, 'activities', 2) || 'gerak ringan sesuai toleransi'}`);
      if (asksMedicine) pieces.push(`obat: ${this.sampleFrom(this.medicinesDB, condition, 'medicines', 2) || 'konsultasikan ke apoteker'}`);
      return `Buat <b>${this.escapeHtml(this.conditionLabel(condition))}</b>, sekaligus ya — ${pieces.join('; ')}.`;
    }

    if (asksMedicine) {
      if (!condition) {
        return this.pickVariant(memory, 'medicine_no_condition', [
          'Bisa, tapi aku perlu tau dulu keluhannya apa — misal "demam sama sakit kepala".',
          'Boleh, tapi ceritain dulu gejalanya — contoh "batuk pilek" atau "abis operasi masih nyeri".'
        ]);
      }
      const sample = this.sampleFrom(this.medicinesDB, condition, 'medicines', 3);
      return this.pickVariant(memory, 'medicine_with_condition', [
        `Untuk konteks <b>${this.escapeHtml(this.conditionLabel(condition))}</b>: ${sample || '<b>konsultasikan ke apoteker</b>'}. Ini bukan resep, baca label dan tanya apoteker kalau ragu.`,
        `Kalau lagi ${this.escapeHtml(this.conditionLabel(condition))}: ${sample || '<b>konsultasikan ke apoteker</b>'}. Tetap bukan pengganti resep dokter ya.`
      ]);
    }
    if (asksFood) {
      if (!condition) {
        return this.pickVariant(memory, 'food_no_condition', [
          'Boleh! Sebutin dulu kondisi/gejalanya, misal "makanan pas demam dan mual".',
          'Sip, kasih tau dulu lagi ngerasain apa — contoh "lagi flu, enaknya makan apa".'
        ]);
      }
      const sample = this.sampleFrom(this.foodsDB, condition, 'foods', 3);
      return this.pickVariant(memory, 'food_with_condition', [
        `Untuk <b>${this.escapeHtml(this.conditionLabel(condition))}</b>, coba ${sample || 'pilihan di halaman Nutrisi'}. Buka halaman <b>Nutrisi</b> buat detailnya.`,
        `Buat <b>${this.escapeHtml(this.conditionLabel(condition))}</b>, ada opsi kayak ${sample || 'yang ada di halaman Nutrisi'}.`
      ]);
    }
    if (asksActivity) {
      if (!condition) {
        return this.pickVariant(memory, 'activity_no_condition', [
          'Tergantung keluhanmu. Sebutin kondisinya, misal "aman gak jalan santai pas demam?"',
          'Bisa, ceritain dulu kondisinya — misal "abis keseleo boleh jalan gak".'
        ]);
      }
      const sample = this.sampleFrom(this.exercisesDB, condition, 'activities', 3);
      return this.pickVariant(memory, 'activity_with_condition', [
        `Untuk <b>${this.escapeHtml(this.conditionLabel(condition))}</b>, coba ${sample || '<b>aktivitas ringan sesuai toleransi</b>'}. Detail di halaman <b>Aktivitas</b>.`,
        `Kalau lagi ${this.escapeHtml(this.conditionLabel(condition))}, bisa coba ${sample || '<b>gerakan ringan sesuai kemampuan</b>'}.`
      ]);
    }
    if (asksSchedule) {
      return this.pickVariant(memory, 'schedule', [
        'Kamu bisa bikin jadwal kontrol, fisioterapi, atau pengingat obat lewat halaman <b>Jadwal</b>.',
        'Buat urusan jadwal, atur di halaman <b>Jadwal</b>. Tetap ikutin resep dokter ya.'
      ]);
    }
    if (asksPain) {
      return this.pickVariant(memory, 'pain', [
        `Aku nangkep ada keluhan nyeri${condition ? ` di konteks <b>${this.escapeHtml(this.conditionLabel(condition))}</b>` : ''}. Coba catat skala, lokasi, sejak kapan.`,
        `Nyeri yang kamu rasain${condition ? ` di konteks <b>${this.escapeHtml(this.conditionLabel(condition))}</b>` : ''} perlu diperhatiin skalanya. Kalau makin parah, jangan tunda ke dokter.`
      ]);
    }
    if (condition) {
      const remembered = memory.symptoms.length
        ? `Aku juga inget gejala yang pernah kamu sebut: <b>${this.escapeHtml(memory.symptoms.slice(-4).join(', '))}</b>.`
        : '';
      return this.pickVariant(memory, 'condition_generic', [
        `Paham, kamu lagi bahas soal <b>${this.escapeHtml(this.conditionLabel(condition))}</b>. ${remembered} Bagian mana yang paling kamu butuhin — makanan, aktivitas, jadwal, atau obat?`,
        `Oke, ini soal <b>${this.escapeHtml(this.conditionLabel(condition))}</b>. ${remembered} Mau aku bahas dari sisi makanan, gerak badan, jadwal, atau obat dulu?`
      ]);
    }
    return this.pickVariant(memory, 'unclear_fresh', [
      'Boleh diceritain lebih detail? Kerasa apa, sejak kapan, seberapa mengganggu.',
      'Aku belum nangkep bagian utamanya nih — cerita aja pakai bahasa sehari-hari ya.'
    ]);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  ChatModule.init();
  ChatModule.initKeyboardShortcuts();
});