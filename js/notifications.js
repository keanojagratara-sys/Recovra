/* =============================================================
   notifications.js — Reminder & Browser Notification Module
   ============================================================= */

const NotifModule = (() => {

  let notifPermission = Notification?.permission || 'default';
  let reminderIntervals = {};

  const TYPE_META = {
    obat:        { emoji: '💊', color: '#f43f5e', bg: 'rgba(244,63,94,0.1)' },
    makan:       { emoji: '🍽️', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    olahraga:    { emoji: '🏃', color: '#818cf8', bg: 'rgba(129,140,248,0.1)' },
    dokter:      { emoji: '👨‍⚕️', color: '#0ed8a4', bg: 'rgba(14,216,164,0.1)' },
    istirahat:   { emoji: '😴', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    fisioterapi: { emoji: '🏥', color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
    lainnya:     { emoji: '📌', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  };

  function init() {
    notifPermission = Notification?.permission || 'default';
    renderPermissionBanner();
    renderActiveReminders();
    renderNotifHistory();
    startReminderChecker();
  }

  function renderPermissionBanner() {
    const banner = App.el('permission-banner');
    if (!banner) return;
    banner.style.display = notifPermission !== 'granted' ? 'flex' : 'none';
  }

  async function requestPermission() {
    if (!('Notification' in window)) {
      App.showToast('error', 'Tidak didukung', 'Browser kamu tidak mendukung notifikasi.');
      return;
    }
    const result = await Notification.requestPermission();
    notifPermission = result;
    renderPermissionBanner();
    if (result === 'granted') {
      App.showToast('success', 'Notifikasi aktif! 🎉', 'Pengingat akan muncul tepat waktu.');
    } else {
      App.showToast('warning', 'Notifikasi diblokir', 'Pengingat akan tetap muncul di dalam aplikasi.');
    }
  }

  function addReminder() {
    const type = App.el('notif-type')?.value || 'lainnya';
    const label = App.el('notif-label')?.value?.trim().slice(0, 60);
    const time = App.el('notif-time')?.value;
    const note = App.el('notif-note')?.value?.trim().slice(0, 120);

    if (!label) {
      App.showToast('warning', 'Label diperlukan', 'Isi label pengingat terlebih dahulu.');
      return;
    }
    if (!time) {
      App.showToast('warning', 'Waktu diperlukan', 'Pilih waktu pengingat.');
      return;
    }

    const reminder = {
      id: Date.now().toString(),
      type,
      label,
      time,
      note,
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    App.state.reminders.push(reminder);
    App.saveState();

    // Reset form
    if (App.el('notif-label')) App.el('notif-label').value = '';
    if (App.el('notif-time')) App.el('notif-time').value = '';
    if (App.el('notif-note')) App.el('notif-note').value = '';

    renderActiveReminders();
    updateBadge();
    App.showToast('success', 'Pengingat ditambahkan!', `${TYPE_META[type]?.emoji} ${label} — ${time}`);
  }

  function toggleReminder(id, enabled) {
    const reminder = App.state.reminders.find(r => r.id === id);
    if (reminder) {
      reminder.enabled = enabled;
      App.saveState();
    }
  }

  function deleteReminder(id) {
    App.state.reminders = App.state.reminders.filter(r => r.id !== id);
    App.saveState();
    renderActiveReminders();
    updateBadge();
    App.showToast('info', 'Pengingat dihapus.');
  }

  function renderActiveReminders() {
    const container = App.el('active-reminders');
    if (!container) return;

    const reminders = App.state.reminders;

    if (!reminders.length) {
      container.innerHTML = `<div class="empty-state" style="padding:24px;">
        <div class="emoji">🔔</div>
        <h3>Belum ada pengingat</h3>
        <p>Tambah pengingat menggunakan form di sebelah kiri</p>
      </div>`;
      return;
    }

    container.innerHTML = reminders.map(r => {
      const meta = TYPE_META[r.type] || TYPE_META.lainnya;
      return `
        <div class="reminder-card">
          <div class="reminder-icon" style="background:${meta.bg};">${meta.emoji}</div>
          <div class="reminder-info">
            <div class="reminder-title">${App.escHtml(r.label)}</div>
            <div class="reminder-desc">
              ⏰ ${r.time}
              ${r.note ? ` · ${App.escHtml(r.note)}` : ''}
            </div>
          </div>
          <label class="toggle" title="${r.enabled ? 'Nonaktifkan' : 'Aktifkan'}">
            <input type="checkbox" ${r.enabled ? 'checked' : ''} 
                   onchange="NotifModule.toggleReminder('${r.id}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
          <button class="event-delete" style="margin-left:6px;" onclick="NotifModule.deleteReminder('${r.id}')">🗑️</button>
        </div>
      `;
    }).join('');
  }

  function renderNotifHistory() {
    const container = App.el('notification-history');
    if (!container) return;

    const history = App.state.notifHistory;

    if (!history.length) {
      container.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:24px;">
        Belum ada riwayat notifikasi
      </div>`;
      return;
    }

    container.innerHTML = history.map(h => {
      const meta = TYPE_META[h.type] || TYPE_META.lainnya;
      return `<div class="notif-item">
        <div class="notif-dot" style="background:${meta.color}"></div>
        <div>
          <div class="notif-title">${meta.emoji} ${App.escHtml(h.title)}</div>
          <div class="notif-body">${App.escHtml(h.body)}</div>
          <div class="notif-time">${formatTime(h.firedAt)}</div>
        </div>
      </div>`;
    }).slice(0, 30).join('');
  }

  function clearHistory() {
    App.state.notifHistory = [];
    App.saveState();
    renderNotifHistory();
    App.showToast('info', 'Riwayat dihapus.');
  }

  // ─── Reminder Checker ─────────────────────────────────────────
  function startReminderChecker() {
    // Check every 30 seconds
    setInterval(checkReminders, 30000);
    checkReminders(); // immediate check
  }

  function checkReminders() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    App.state.reminders.forEach(reminder => {
      if (!reminder.enabled) return;
      if (reminder.time !== currentTime) return;

      // Check if already fired in last 2 minutes
      const lastFired = reminder.lastFired;
      if (lastFired) {
        const diff = (now - new Date(lastFired)) / 1000 / 60;
        if (diff < 2) return; // Already fired recently
      }

      fireReminder(reminder);
      reminder.lastFired = now.toISOString();
      App.saveState();
    });
  }

  function fireReminder(reminder) {
    const meta = TYPE_META[reminder.type] || TYPE_META.lainnya;
    const title = `${meta.emoji} ${reminder.label}`;
    const body = reminder.note || 'Saatnya melakukan aktivitas kesehatanmu!';

    // Browser notification
    if (notifPermission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: meta.emoji,
          tag: reminder.id,
        });
      } catch (e) { console.warn('Notification failed:', e); }
    }

    // In-app toast
    App.showToast('info', title, body, 6000);

    // Add to history
    App.state.notifHistory.unshift({
      id: Date.now().toString(),
      type: reminder.type,
      title: reminder.label,
      body,
      firedAt: new Date().toISOString(),
    });

    if (App.state.notifHistory.length > 50) App.state.notifHistory = App.state.notifHistory.slice(0, 50);

    App.saveState();
    renderNotifHistory();
    updateBadge();
  }

  function updateBadge() {
    const count = App.state.notifHistory.length;
    const badges = document.querySelectorAll('.nav-badge');
    const dot = App.el('notif-dot');

    badges.forEach(badge => {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-grid' : 'none';
    });
    if (dot) dot.style.display = count > 0 ? 'block' : 'none';
  }

  function formatTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  return {
    init,
    requestPermission,
    addReminder,
    toggleReminder,
    deleteReminder,
    clearHistory,
    fireReminder,
  };
})();