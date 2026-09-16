/* =============================================================
   health.js — Health Monitoring Module
   ============================================================= */

const HealthMonitor = (() => {

  const PAIN_EMOJIS = ['😊','😌','🙂','😐','😕','😟','😣','😖','😫','😩','😭'];
  const PAIN_COLORS = [
    'var(--success)', 'var(--success)', 'var(--success)',
    '#7dd87d', '#b8d87d',
    'var(--accent)', 'var(--accent)',
    '#f97316', '#ef4444',
    'var(--danger)', 'var(--danger)'
  ];

  function init() {
    renderLogList();
    renderStats();
    renderTrendChart();
    renderAiInsight();

    // Set default datetime
    const logDt = App.el('log-datetime');
    if (logDt && !logDt.value) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      logDt.value = now.toISOString().slice(0, 16);
    }

    // Reset slider display
    const slider = App.el('pain-slider');
    if (slider) updatePainDisplay(slider.value);
  }

  function updatePainDisplay(val) {
    val = parseInt(val);
    const display = App.el('pain-value-display');
    const emoji = App.el('pain-emoji-display');
    if (display) {
      display.textContent = val;
      display.style.color = PAIN_COLORS[val];
    }
    if (emoji) emoji.textContent = PAIN_EMOJIS[val];
  }

  function saveLog() {
    const datetime = App.el('log-datetime')?.value;
    const pain = parseInt(App.el('pain-slider')?.value || '0');
    const rawTemp = App.el('log-temp')?.value;
    const temp = rawTemp !== '' && rawTemp !== undefined && Number.isFinite(parseFloat(rawTemp)) ? parseFloat(rawTemp) : null;
    const condition = App.el('log-condition')?.value || 'pemulihan_umum';
    const notes = App.el('log-notes')?.value?.trim().slice(0, 500) || '';
    const mobility = App.el('log-mobility')?.value || 'normal';

    if (!datetime) {
      App.showToast('warning', 'Tanggal diperlukan', 'Pilih tanggal dan waktu pencatatan.');
      return;
    }

    if (new Date(datetime).getTime() > Date.now() + 5 * 60 * 1000) {
      App.showToast('warning', 'Tanggal tidak valid', 'Waktu pencatatan tidak boleh di masa depan.');
      return;
    }

    if (temp !== null && (temp < 35 || temp > 42)) {
      App.showToast('warning', 'Suhu tidak valid', 'Masukkan suhu antara 35°C – 42°C');
      return;
    }

    const entry = {
      id: Date.now().toString(),
      datetime,
      pain,
      temp,
      condition,
      notes,
      mobility,
    };

    App.state.healthLogs.unshift(entry);
    App.saveState();

    // Reset form
    const slider = App.el('pain-slider');
    if (slider) { slider.value = 0; updatePainDisplay(0); }
    if (App.el('log-temp')) App.el('log-temp').value = '';
    if (App.el('log-notes')) App.el('log-notes').value = '';

    renderLogList();
    renderStats();
    renderTrendChart();
    renderAiInsight();

    App.showToast('success', 'Catatan disimpan!', `Nyeri: ${pain}/10${temp ? ', Suhu: ' + temp + '°C' : ''}`);
  }

  function clearAllLogs() {
    if (!App.state.healthLogs.length) {
      App.showToast('info', 'Tidak ada catatan', 'Belum ada catatan untuk dihapus.');
      return;
    }

    App.openModal(`
      <div class="modal-title">🗑️ Hapus Semua Catatan</div>
      <p style="color:var(--text-secondary);font-size:14px;margin-bottom:20px;">
        Apakah kamu yakin ingin menghapus <strong style="color:var(--danger)">${App.state.healthLogs.length} catatan</strong>? 
        Tindakan ini tidak dapat dibatalkan.
      </p>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="App.closeModal()">Batal</button>
        <button class="btn btn-danger" onclick="HealthMonitor.confirmClearLogs()">🗑️ Ya, Hapus Semua</button>
      </div>
    `);
  }

  function confirmClearLogs() {
    App.state.healthLogs = [];
    App.saveState();
    App.closeModal();
    renderLogList();
    renderStats();
    renderTrendChart();
    renderAiInsight();
    App.showToast('success', 'Semua catatan dihapus.');
  }

  function deleteLog(id) {
    App.state.healthLogs = App.state.healthLogs.filter(l => l.id !== id);
    App.saveState();
    renderLogList();
    renderStats();
    renderTrendChart();
    renderAiInsight();
    App.showToast('info', 'Catatan dihapus.');
  }

  function renderAiInsight() {
    const target = App.el('health-ai-insight-text');
    if (!target) return;
    const logs = App.state.healthLogs || [];
    if (!logs.length) {
      target.textContent = 'Tambahkan catatan untuk melihat pola kesehatanmu.';
      return;
    }
    const latest = logs[0];
    const previous = logs[1];
    if (previous && latest.pain < previous.pain) {
      target.textContent = `Nyeri kamu hari ini lebih rendah dibanding catatan sebelumnya (${previous.pain} → ${latest.pain}). Pertahankan ritme pemulihan yang terasa nyaman.`;
    } else if (previous && latest.pain > previous.pain) {
      target.textContent = `Nyeri kamu meningkat dibanding catatan sebelumnya (${previous.pain} → ${latest.pain}). Kurangi beban aktivitas dan pantau apakah keluhan terus memburuk.`;
    } else {
      target.textContent = `Catatan terbaru menunjukkan nyeri ${latest.pain}/10. Konsistensi check-in akan membantu Recovra membaca tren minggu ini.`;
    }
  }

  function renderLogList() {
    const container = App.el('health-log-list');
    if (!container) return;
    const logs = App.state.healthLogs;

    if (!logs.length) {
      container.innerHTML = `<div class="empty-state">
        <div class="emoji">📋</div>
        <h3>Belum ada catatan</h3>
        <p>Catat kondisi pertamamu menggunakan form di atas</p>
      </div>`;
      return;
    }

    container.innerHTML = logs.map(log => `
      <div class="log-entry" id="log-${log.id}">
        <div class="log-entry-icon">${PAIN_EMOJIS[log.pain] || '😊'}</div>
        <div style="flex:1;">
          <div class="log-entry-meta">${App.formatDate(log.datetime)}</div>
          <div class="log-entry-title">
            Nyeri: <strong style="color:${PAIN_COLORS[log.pain]}">${log.pain}/10</strong>
            ${log.temp ? ` — Suhu: <strong style="color:var(--accent)">${log.temp}°C</strong>` : ''}
            — <span class="badge badge-${getMobilityBadge(log.mobility)}">${mobilityLabel(log.mobility)}</span>
          </div>
          <div class="log-entry-body">${App.escHtml(log.notes) || '<em style="color:var(--text-muted)">Tidak ada catatan gejala</em>'}</div>
          <div style="margin-top:6px;">
            <span class="badge badge-secondary">${conditionLabel(log.condition)}</span>
          </div>
        </div>
        <button onclick="HealthMonitor.deleteLog('${log.id}')" class="event-delete" title="Hapus">🗑️</button>
      </div>
    `).join('');
  }

  function renderStats() {
    const logs = App.state.healthLogs;

    App.el('stat-total-logs').textContent = logs.length;

    if (!logs.length) {
      App.el('stat-avg-pain').textContent = '—';
      App.el('stat-avg-temp').textContent = '—';
      App.el('stat-best-day').textContent = '—';
      return;
    }

    const avgPain = (logs.reduce((s, l) => s + l.pain, 0) / logs.length).toFixed(1);
    App.el('stat-avg-pain').textContent = avgPain;

    const withTemp = logs.filter(l => l.temp);
    if (withTemp.length) {
      const avgTemp = (withTemp.reduce((s, l) => s + l.temp, 0) / withTemp.length).toFixed(1);
      App.el('stat-avg-temp').textContent = avgTemp + '°C';
    } else {
      App.el('stat-avg-temp').textContent = '—';
    }

    // Best day = lowest pain
    const best = logs.reduce((a, b) => a.pain <= b.pain ? a : b);
    const bestDate = new Date(best.datetime);
    App.el('stat-best-day').textContent = `${bestDate.getDate()}/${bestDate.getMonth() + 1}`;
  }

  function renderTrendChart() {
    const canvas = App.el('trendChart');
    if (!canvas) return;
    const logs = App.state.healthLogs.slice(0, 14).reverse();
    App.drawTrendChart(canvas, logs, 140);
  }

  // ─── Helpers ──────────────────────────────────────────────────
  function getMobilityBadge(m) {
    return { normal: 'primary', terbatas: 'warning', sangat_terbatas: 'danger', bed_rest: 'danger' }[m] || 'secondary';
  }

  function mobilityLabel(m) {
    return { normal: '✅ Normal', terbatas: '⚠️ Terbatas', sangat_terbatas: '🚫 Sangat Terbatas', bed_rest: '🛏️ Bed Rest' }[m] || m;
  }

  function conditionLabel(c) {
    return { cedera_fisik: '🦴 Cedera Fisik', demam: '🌡️ Demam', flu_pilek: '🤧 Flu/Pilek', peradangan: '🔥 Peradangan', pemulihan_umum: '💪 Pemulihan Umum' }[c] || c;
  }

  return {
    init,
    updatePainDisplay,
    saveLog,
    clearAllLogs,
    confirmClearLogs,
    deleteLog,
    renderLogList,
    renderTrendChart,
  };
})();