/* =============================================================
   calendar.js — Calendar & Scheduling Module
   ============================================================= */

const CalendarModule = (() => {

  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth();
  let selectedDate = null;

  const DAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const EVENT_COLORS = {
    obat: '#f43f5e',
    makan: '#10b981',
    olahraga: '#818cf8',
    dokter: '#0ed8a4',
    istirahat: '#f59e0b',
    fisioterapi: '#6366f1',
    lainnya: '#94a3b8',
  };

  function init() {
    selectedDate = new Date();
    renderCalendar();
    renderSelectedDateEvents();
    renderAllEvents();
    renderRecurringEvents();
  }

  function renderCalendar() {
    // Headers
    const headersContainer = App.el('calendar-day-headers');
    if (headersContainer) {
      headersContainer.innerHTML = DAYS_ID.map(d => `<div class="calendar-day-header">${d}</div>`).join('');
    }

    // Month title
    const titleEl = App.el('calendar-month-title');
    if (titleEl) titleEl.textContent = `${MONTHS_ID[currentMonth]} ${currentYear}`;

    // Calendar days
    const grid = App.el('calendar-grid');
    if (!grid) return;

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const today = new Date();

    let html = '';

    // Prev month filler
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const date = new Date(currentYear, currentMonth - 1, dayNum);
      html += renderDayCell(date, dayNum, true, today);
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(currentYear, currentMonth, d);
      html += renderDayCell(date, d, false, today);
    }

    // Next month filler
    const totalCells = firstDay + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(currentYear, currentMonth + 1, d);
      html += renderDayCell(date, d, true, today);
    }

    grid.innerHTML = html;
  }

  function renderDayCell(date, dayNum, isOtherMonth, today) {
    const dateStr = toDateStr(date);
    const isToday = isSameDay(date, today);
    const isSelected = selectedDate && isSameDay(date, selectedDate);
    const events = getEventsForDate(date);

    const classes = [
      'calendar-day',
      isOtherMonth ? 'other-month' : '',
      isToday ? 'today' : '',
      isSelected ? 'selected' : '',
    ].filter(Boolean).join(' ');

    const dots = events.slice(0, 3).map(ev => `
      <div class="day-event-dot" style="background:${EVENT_COLORS[ev.type] || '#94a3b8'};"></div>
    `).join('');

    return `<div class="${classes}" onclick="CalendarModule.selectDate('${dateStr}')" title="${dateStr}">
      <span class="day-num">${dayNum}</span>
      <div class="day-events">${dots}</div>
    </div>`;
  }

  function selectDate(dateStr) {
    selectedDate = new Date(dateStr + 'T00:00:00');
    renderCalendar();
    renderSelectedDateEvents();
  }

  function getEventsForDate(date) {
    const dayOfWeek = date.getDay();
    const dateStr = toDateStr(date);

    return App.state.events.filter(ev => {
      if (ev.date === dateStr) return true;
      if (ev.recurring === 'daily') return true;
      if (ev.recurring === 'weekly' && ev.days?.includes(dayOfWeek)) return true;
      return false;
    }).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }

  function renderSelectedDateEvents() {
    const titleEl = App.el('selected-date-title');
    const container = App.el('selected-date-events');
    if (!container) return;

    const date = selectedDate || new Date();
    const label = date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
    if (titleEl) titleEl.textContent = `📅 ${label}`;

    const events = getEventsForDate(date);

    if (!events.length) {
      container.innerHTML = `<div class="empty-state" style="padding:20px;">
        <div class="emoji">📋</div>
        <h3>Tidak ada jadwal</h3>
        <p>Klik tombol "Tambah Jadwal" untuk menambahkan</p>
      </div>`;
      return;
    }

    container.innerHTML = events.map(ev => `
      <div class="event-item">
        <div class="event-color" style="background:${EVENT_COLORS[ev.type] || '#94a3b8'}"></div>
        <div style="flex:1;">
          <div class="event-title">${App.escHtml(ev.title)}</div>
          <div class="event-meta">
            ${App.typeLabel(ev.type)}
            ${ev.time ? ` · ⏰ ${ev.time}` : ''}
            ${ev.recurring ? ` · 🔁 ${recurringLabel(ev.recurring, ev.days)}` : ''}
          </div>
          ${ev.note ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">📝 ${App.escHtml(ev.note)}</div>` : ''}
        </div>
        <button class="event-delete" onclick="CalendarModule.deleteEvent('${ev.id}')" title="Hapus">🗑️</button>
      </div>
    `).join('');
  }

  function renderAllEvents() {
    const container = App.el('all-events-list');
    if (!container) return;

    const events = [...App.state.events].sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));

    if (!events.length) {
      container.innerHTML = `<div class="empty-state">
        <div class="emoji">📅</div>
        <h3>Belum ada jadwal</h3>
        <p>Tambahkan jadwal menggunakan tombol di atas</p>
      </div>`;
      return;
    }

    container.innerHTML = events.map(ev => `
      <div class="event-item">
        <div class="event-color" style="background:${EVENT_COLORS[ev.type] || '#94a3b8'}"></div>
        <div style="flex:1;">
          <div class="event-title">${App.escHtml(ev.title)}</div>
          <div class="event-meta">
            ${ev.date ? `📆 ${formatDateStr(ev.date)}` : ''}
            ${ev.time ? ` · ⏰ ${ev.time}` : ''}
            ${ev.recurring ? ` · 🔁 ${recurringLabel(ev.recurring, ev.days)}` : ''}
            · ${App.typeLabel(ev.type)}
          </div>
        </div>
        <button class="event-delete" onclick="CalendarModule.deleteEvent('${ev.id}')" title="Hapus">🗑️</button>
      </div>
    `).join('');
  }

  function renderRecurringEvents() {
    const container = App.el('recurring-events-list');
    if (!container) return;

    const recurring = App.state.events.filter(ev => ev.recurring);

    if (!recurring.length) {
      container.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:12px;">Belum ada jadwal rutin</div>`;
      return;
    }

    container.innerHTML = recurring.map(ev => `
      <div class="event-item">
        <div class="event-color" style="background:${EVENT_COLORS[ev.type] || '#94a3b8'}"></div>
        <div style="flex:1;">
          <div class="event-title">${App.escHtml(ev.title)}</div>
          <div class="event-meta">🔁 ${recurringLabel(ev.recurring, ev.days)} · ${ev.time || 'Tanpa waktu'}</div>
        </div>
        <button class="event-delete" onclick="CalendarModule.deleteEvent('${ev.id}')" title="Hapus">🗑️</button>
      </div>
    `).join('');
  }

  function showAddEventModal() {
    const todayStr = toDateStr(selectedDate || new Date());
    App.openModal(`
      <div class="modal-title">📅 Tambah Jadwal Baru</div>

      <div class="form-group">
        <label class="form-label">Judul Jadwal</label>
        <input type="text" class="form-input" id="ev-title" placeholder="Contoh: Fisioterapi, Minum Amoxicillin, Jalan Pagi...">
      </div>

      <div class="form-group">
        <label class="form-label">Jenis Aktivitas</label>
        <select class="form-select" id="ev-type">
          <option value="obat">💊 Minum Obat</option>
          <option value="makan">🍽️ Waktu Makan</option>
          <option value="olahraga">🏃 Olahraga / Rehabilitasi</option>
          <option value="dokter">👨‍⚕️ Kontrol Dokter</option>
          <option value="istirahat">😴 Waktu Istirahat</option>
          <option value="fisioterapi">🏥 Fisioterapi</option>
          <option value="lainnya">📌 Lainnya</option>
        </select>
      </div>

      <div class="grid-2" style="gap:12px;">
        <div class="form-group">
          <label class="form-label">Tanggal</label>
          <input type="date" class="form-input" id="ev-date" value="${todayStr}">
        </div>
        <div class="form-group">
          <label class="form-label">Jam</label>
          <input type="time" class="form-input" id="ev-time">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Pengulangan</label>
        <select class="form-select" id="ev-recurring" onchange="CalendarModule.toggleRecurringOptions(this.value)">
          <option value="">Tidak Berulang (Sekali)</option>
          <option value="daily">🔁 Setiap Hari</option>
          <option value="weekly">📆 Mingguan (Pilih Hari)</option>
        </select>
      </div>

      <div id="ev-days-picker" style="display:none;margin-bottom:16px;">
        <div class="form-label" style="margin-bottom:8px;">Pilih Hari</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map((d, i) => `
            <label style="display:flex;align-items:center;gap:4px;padding:5px 10px;background:var(--bg-glass);border:1px solid var(--border);border-radius:8px;cursor:pointer;font-size:13px;">
              <input type="checkbox" name="ev-day" value="${i}" style="accent-color:var(--primary)"> ${d}
            </label>
          `).join('')}
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Catatan</label>
        <input type="text" class="form-input" id="ev-note" placeholder="Catatan tambahan (opsional)">
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="App.closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="CalendarModule.saveEvent()">✅ Simpan Jadwal</button>
      </div>
    `);
  }

  function toggleRecurringOptions(val) {
    const picker = document.getElementById('ev-days-picker');
    if (picker) picker.style.display = val === 'weekly' ? 'block' : 'none';
  }

  function saveEvent() {
    const title = document.getElementById('ev-title')?.value?.trim().slice(0, 80);
    const type = document.getElementById('ev-type')?.value || 'lainnya';
    const date = document.getElementById('ev-date')?.value;
    const time = document.getElementById('ev-time')?.value;
    const recurring = document.getElementById('ev-recurring')?.value || '';
    const note = document.getElementById('ev-note')?.value?.trim().slice(0, 200);

    if (!title) {
      App.showToast('warning', 'Judul diperlukan', 'Isi judul jadwal terlebih dahulu.');
      return;
    }

    let days = [];
    if (recurring === 'weekly') {
      days = [...document.querySelectorAll('input[name="ev-day"]:checked')].map(cb => parseInt(cb.value));
      if (!days.length) {
        App.showToast('warning', 'Pilih hari', 'Pilih minimal satu hari untuk jadwal mingguan.');
        return;
      }
    }

    const event = {
      id: Date.now().toString(),
      title,
      type,
      date: recurring ? '' : date,
      time,
      recurring: recurring || null,
      days: recurring === 'weekly' ? days : null,
      note,
    };

    App.state.events.push(event);
    App.saveState();
    App.closeModal();
    App.showToast('success', 'Jadwal ditambahkan!', App.escHtml(title));

    renderCalendar();
    renderSelectedDateEvents();
    renderAllEvents();
    renderRecurringEvents();
  }

  function deleteEvent(id) {
    App.state.events = App.state.events.filter(ev => ev.id !== id);
    App.saveState();
    renderCalendar();
    renderSelectedDateEvents();
    renderAllEvents();
    renderRecurringEvents();
    App.showToast('info', 'Jadwal dihapus.');
  }

  function prevMonth() {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
  }

  function nextMonth() {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
  }

  // ─── Helpers ──────────────────────────────────────────────────
  function toDateStr(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function formatDateStr(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function recurringLabel(recurring, days) {
    if (recurring === 'daily') return 'Setiap Hari';
    if (recurring === 'weekly' && days?.length) {
      const names = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      return 'Tiap ' + days.map(d => names[d]).join(', ');
    }
    return recurring;
  }

  return {
    init,
    prevMonth,
    nextMonth,
    selectDate,
    showAddEventModal,
    toggleRecurringOptions,
    saveEvent,
    deleteEvent,
  };
})();