/* =============================================================
   app.js — Recovra Core: State, Routing, Utilities
   ============================================================= */

const App = (() => {

  // ─── State ───────────────────────────────────────────────────
  const state = {
    currentPage: 'dashboard',
    user: { name: 'Pengguna', condition: 'pemulihan_umum' },
    healthLogs: [],
    events: [],
    reminders: [],
    notifHistory: [],
  };

  // ─── Page metadata ───────────────────────────────────────────
  const pages = {
    dashboard:     { title: 'Dashboard',            subtitle: 'Ringkasan kesehatan harianmu' },
    checkup:       { title: 'Cek Kondisi',          subtitle: 'Ceritakan keluhanmu, dapat rekomendasi instan' },
    health:        { title: 'Monitoring Kesehatan', subtitle: 'Catat dan pantau kondisi fisik' },
    healthhub:     { title: 'Health Hub',            subtitle: 'Alat kesehatan dan akses dukungan pemulihan' },
    nutrition:     { title: 'Rekomendasi Nutrisi',  subtitle: 'Makanan terbaik untuk pemulihan' },
    medicine:      { title: 'Medicine',             subtitle: 'Informasi obat bebas dan cara menggunakannya dengan aman' },
    activity:      { title: 'Aktivitas & Olahraga', subtitle: 'Olahraga terbaik untuk pemulihan' },
    calendar:      { title: 'Kalender & Jadwal',    subtitle: 'Atur jadwal aktivitas harian' },
    notifications: { title: 'Pengingat',            subtitle: 'Manajemen notifikasi' },
    chatai:        { title: 'Asisten AI',           subtitle: 'Ngobrol bebas soal pemulihanmu' },
  };

  // ─── Persist / Load ──────────────────────────────────────────
  function saveState() {
    try {
      localStorage.setItem('hg_state', JSON.stringify({
        user: state.user,
        healthLogs: state.healthLogs,
        events: state.events,
        reminders: state.reminders,
        notifHistory: state.notifHistory,
      }));
    } catch(e) { console.warn('Save failed:', e); }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem('hg_state');
      if (!raw) return;
      const saved = JSON.parse(raw);
      Object.assign(state.user, saved.user || {});
      state.healthLogs = saved.healthLogs || [];
      state.events = saved.events || [];
      state.reminders = saved.reminders || [];
      state.notifHistory = saved.notifHistory || [];
    } catch(e) { console.warn('Load failed:', e); }
  }

  // ─── Navigation ──────────────────────────────────────────────
  function navigate(page) {
    if (!pages[page]) return;

    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    // Show target page
    document.getElementById('page-' + page)?.classList.add('active');

    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    // Update header
    document.getElementById('header-title').textContent = pages[page].title;
    document.getElementById('header-subtitle').textContent = pages[page].subtitle;

    state.currentPage = page;

    // Trigger page-specific render
    switch (page) {
      case 'dashboard':     renderDashboard(); break;
      case 'health':        HealthMonitor.init(); break;
      case 'healthhub':     HealthHub.init(); break;
      case 'checkup':       Checkup.init(); break;
      case 'nutrition':     Nutrition.init(); break;
      case 'medicine':      Medicine.init(); break;
      case 'activity':      Activity.init(); break;
      case 'calendar':      CalendarModule.init(); break;
      case 'notifications': NotifModule.init(); break;
      case 'chatai':        ChatModule.renderConversationList(); ChatModule.renderMessages(); break;
    }

    // Scroll ke atas tiap pindah halaman, biar gak nyangkut di posisi scroll halaman sebelumnya
    document.querySelector('.content')?.scrollTo({ top: 0, behavior: 'auto' });

    // Close sidebar on mobile
    if (window.innerWidth <= 850) {
      closeSidebar();
    }
  }

  // ─── Dashboard Render ─────────────────────────────────────────
  let dashboardFoodsDB = null;
  let dashboardExercisesDB = null;
  let dashboardMedicinesDB = null;

  async function loadDashboardRecommendationData() {
    if (dashboardFoodsDB && dashboardExercisesDB && dashboardMedicinesDB) return;
    try {
      const [foodsRes, exRes, medRes] = await Promise.all([
        fetch('data/foods.json'), fetch('data/exercises.json'), fetch('data/medicines.json')
      ]);
      dashboardFoodsDB = foodsRes.ok ? await foodsRes.json() : { conditions: {} };
      dashboardExercisesDB = exRes.ok ? await exRes.json() : { conditions: {} };
      dashboardMedicinesDB = medRes.ok ? await medRes.json() : { conditions: {} };
    } catch (e) {
      console.warn('Dashboard: gagal memuat data rekomendasi', e);
      dashboardFoodsDB = dashboardFoodsDB || { conditions: {} };
      dashboardExercisesDB = dashboardExercisesDB || { conditions: {} };
      dashboardMedicinesDB = dashboardMedicinesDB || { conditions: {} };
    }
    if (state.currentPage === 'dashboard') renderRecoveryOverview(getTodayEvents());
  }

  function calcStreak(allLogs) {
    const days = new Set(allLogs.map(log => {
      const d = new Date(log.datetime);
      return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    }));
    let streak = 0;
    const cursor = new Date();
    while (true) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth() + 1}-${cursor.getDate()}`;
      if (days.has(key)) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  function animateNumber(node, target) {
    if (!node) return;
    const start = parseInt(node.textContent, 10) || 0;
    if (start === target) { node.textContent = target; return; }
    const duration = 450;
    const startTime = performance.now();
    function step(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      node.textContent = Math.round(start + (target - start) * progress);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  let lastInsightSignature = null;

  async function aiEnhanceInsight(allLogs, recent, fallbackInsight) {
    if (recent.length < 2) return; // belum cukup data buat insight yang bermakna
    const signature = allLogs.slice(0, 7).map(l => `${l.datetime}-${l.pain}`).join('|');
    if (signature === lastInsightSignature) return; // data sama, gak perlu panggil AI lagi
    lastInsightSignature = signature;

    const summary = recent.map((l, i) => `Hari ke-${i + 1} lalu: nyeri ${l.pain}/10, mobilitas ${l.mobility || 'normal'}${l.notes ? `, catatan: ${l.notes}` : ''}`).join('. ');
    const prompt = `Berdasarkan data kesehatan berikut (dari yang terbaru): ${summary}. ` +
      `Tulis SATU insight singkat (maksimal 2 kalimat, bahasa Indonesia santai) tentang tren pemulihan pengguna ini. ` +
      `Fokus ke pola atau perubahan yang terlihat, akhiri dengan satu saran singkat. Jangan pakai salam pembuka.`;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ sender: 'user', text: prompt }] })
      });
      if (!response.ok) return; // diem-diem gagal, insight rule-based tetap kepasang
      const data = await response.json();
      if (data.reply && signature === lastInsightSignature) {
        const node = el('recovery-insight-text');
        if (node) node.textContent = data.reply.replace(/\*\*/g, '');
      }
    } catch (e) {
      // Server AI gak aktif — biarin insight rule-based (fallbackInsight) yang tetap tampil
    }
  }

  let lastScoreBreakdown = null;

  function showScoreBreakdown() {
    if (!lastScoreBreakdown || !lastScoreBreakdown.hasData) {
      showToast('info', 'Belum ada data', 'Catat kondisimu dulu di halaman Kesehatan untuk melihat rincian skor.');
      return;
    }
    const b = lastScoreBreakdown;
    const row = (label, value, max) => `
      <div class="score-breakdown-row">
        <span>${escHtml(label)}</span>
        <strong>${value >= 0 ? '+' : ''}${value}${max ? ` / ${max}` : ''}</strong>
      </div>`;
    openModal(`
      <div class="modal-title">📊 Rincian Recovery Score</div>
      <div class="score-breakdown-total">${b.score}<span>/100</span></div>
      <div class="score-breakdown-list">
        ${row('Dasar', 25, 25)}
        ${row('Nyeri (rata-rata ' + (b.painAvg !== null ? b.painAvg.toFixed(1) : '-') + '/10)', b.painPoints, 75)}
        ${row('Konsistensi check-in', b.consistencyPoints, 15)}
        ${row('Tren dibanding periode lalu', b.trendPoints)}
        ${row('Rutinitas pengingat', b.reminderPoints, 5)}
      </div>
      <div class="form-hint" style="margin-top:12px;">Skor dihitung dari 7 catatan kesehatan terakhirmu — bukan angka acak.</div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="App.closeModal()">Oke, ngerti</button>
      </div>
    `);
  }

  function renderDashboard() {
    // Update user display
    const latestLog = state.healthLogs[0];
    const todayEvents = getTodayEvents();

    // Stats
    if (latestLog) {
      el('dash-pain').textContent = latestLog.pain + '/10';
      el('dash-temp').textContent = latestLog.temp ? latestLog.temp + '°C' : '—°';
      el('dash-pain-change').textContent = 'Log terakhir: ' + formatDate(latestLog.datetime, 'short');
      el('dash-pain-change').className = 'stat-change ' + (latestLog.pain <= 3 ? 'up' : latestLog.pain <= 6 ? 'neutral' : 'down');
    }

    el('dash-events').textContent = todayEvents.length;
    el('dash-logs').textContent = state.healthLogs.length;
    el('dash-logs-change').textContent = 'Total catatan';

    // Recovery overview: jadikan dashboard sebagai pusat pemantauan, bukan hanya menu.
    renderRecoveryOverview(todayEvents);
    loadDashboardRecommendationData();

    // Today's schedule
    renderTodaySchedule(todayEvents);

    // Mini trend chart
    renderDashTrend();

    // Recent log
    renderDashRecentLog();

    // Welcome
    const hour = new Date().getHours();
    let greeting = hour < 12 ? 'Selamat Pagi' : hour < 17 ? 'Selamat Siang' : 'Selamat Malam';
    el('welcome-name').textContent = state.user.name;
    el('welcome-message').textContent = `${greeting}! Semoga pemulihan kamu berjalan baik hari ini. 🌟`;

    // Sidebar info
    el('sidebar-username').textContent = state.user.name;
    el('user-avatar-text').textContent = state.user.name.charAt(0).toUpperCase();
    const dayNode = el('sidebar-recovery-day');
    if (dayNode) {
      const day = Math.max(1, Math.min(30, (state.healthLogs || []).length + 1));
      dayNode.textContent = `Recovery Day ${day}`;
    }
  }

  function renderRecoveryOverview(todayEvents) {
    const allLogs = (state.healthLogs || []).slice().sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
    const latest = allLogs[0];
    const recent = allLogs.slice(0, 7);
    const previousPeriod = allLogs.slice(7, 14);

    const avg = (arr) => {
      const values = arr.map(x => Number(x.pain)).filter(Number.isFinite);
      return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    };
    const uniqueDays = (arr) => new Set(arr.map(log => {
      const d = new Date(log.datetime);
      return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    })).size;

    let score = 82;
    let statusLabel = 'Belum ada data personal';
    let painPoints = null, consistencyPoints = 0, trendPoints = 0, reminderPoints = 0, painAvgForBreakdown = null;
    if (recent.length) {
      const painAvg = avg(recent);
      painAvgForBreakdown = painAvg;
      painPoints = Math.round(75 - ((painAvg || 0) * 7.5));
      consistencyPoints = Math.round(Math.min(uniqueDays(recent) * 2.5, 15));
      const prevPainAvg = avg(previousPeriod);
      if (prevPainAvg !== null && painAvg !== null) {
        if (painAvg < prevPainAvg) trendPoints = 10;
        if (painAvg > prevPainAvg) trendPoints = -10;
      }
      // Bonus kecil kalau pengingat hari ini rutin ditandai selesai — konsistensi rutinitas ikut dihitung
      const todayKey = (() => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; })();
      const remindersToday = (state.reminders || []).filter(r => r.enabled);
      if (remindersToday.length) {
        const doneToday = remindersToday.filter(r => Array.isArray(r.completedDates) && r.completedDates.includes(todayKey)).length;
        reminderPoints = Math.round((doneToday / remindersToday.length) * 5);
      }
      score = Math.round(Math.max(0, Math.min(100, painPoints + consistencyPoints + trendPoints + reminderPoints + 25)));
      statusLabel = score >= 80
        ? 'Progress recovery terlihat cukup baik. Pertahankan kebiasaan yang sudah berjalan.'
        : score >= 60
        ? 'Recovery terlihat cukup stabil. Tetap pantau perubahan dan jangan memaksakan aktivitas.'
        : 'Beberapa indikator perlu dipantau lebih dekat. Kalau kondisi memburuk, hubungi tenaga kesehatan.';
    }

    lastScoreBreakdown = { score, painPoints, consistencyPoints, trendPoints, reminderPoints, painAvg: painAvgForBreakdown, hasData: recent.length > 0 };

    const pain = Number(latest?.pain);
    const day = Math.max(1, Math.min(30, allLogs.length + 1));
    const completed = Math.min(3, (latest ? 1 : 0) + (todayEvents.length ? 1 : 0));
    const status = statusLabel;
    const previous = allLogs[1];
    const painDelta = latest && previous ? latest.pain - previous.pain : null;
    const changedTitle = painDelta === null ? 'Belum ada pembanding' : painDelta < 0 ? `Nyeri turun ${Math.abs(painDelta)} poin` : painDelta > 0 ? `Nyeri naik ${painDelta} poin` : 'Nyeri relatif stabil';
    const changedText = painDelta === null ? 'Tambahkan satu catatan lagi untuk melihat apa yang berubah.' : 'Dibandingkan catatan sebelumnya. Pantau trennya, bukan satu angka saja.';
    const actionTitle = !latest ? 'Check-in kondisi' : pain >= 7 ? 'Prioritaskan istirahat' : pain >= 4 ? 'Atur ritme lebih pelan' : 'Pertahankan ritme baik';
    const actionText = !latest ? 'Catat kondisi tubuhmu hari ini untuk mendapat saran yang lebih personal.' : pain >= 7 ? 'Kurangi aktivitas berat dan cari bantuan bila keluhan memburuk.' : 'Pilih aktivitas ringan sesuai batas nyaman dan tetap dengarkan tubuhmu.';
    const nextEvent = todayEvents[0];
    const nextTitle = nextEvent ? (nextEvent.title || 'Jadwal berikutnya') : latest ? 'Lanjutkan check-in' : 'Mulai satu langkah';
    const nextText = nextEvent ? `${nextEvent.time || 'Hari ini'} · ${typeLabel(nextEvent.type)}` : latest ? 'Catat lagi nanti untuk menjaga perjalananmu tetap terlihat.' : 'Tambahkan jadwal atau rencana kecil untuk hari ini.';
    const recentCount = recent.length;
    const insight = recentCount >= 2
      ? `Dari ${recentCount} catatan terakhirmu, rata-rata nyeri ${avg(recent).toFixed(1)}/10${uniqueDays(recent) >= 3 ? ' dan konsistensi check-in-mu bagus' : ''}. Terus catat secara rutin agar polanya makin jelas.`
      : latest
      ? `Catatan terakhirmu menunjukkan nyeri ${pain}/10. Terus catat secara konsisten agar perubahan kecil lebih mudah terlihat.`
      : 'Mulai dari satu check-in sederhana hari ini. Dari sana, Recovra bisa membantu membaca pola pemulihanmu.';
    const setText = (id, value) => { const node = el(id); if (node) node.textContent = value; };
    animateNumber(el('recovery-score-value'), score);
    setText('recovery-score-status', status);
    setText('recovery-change-title', changedTitle);
    setText('recovery-change-text', changedText);
    setText('recovery-action-title', actionTitle);
    setText('recovery-action-text', actionText);
    setText('recovery-next-title', nextTitle);
    setText('recovery-next-text', nextText);
    setText('recovery-score-meta', latest ? `Dihitung dari ${recentCount} catatan terakhir` : 'Belum ada data personal');
    setText('recovery-day-title', `Recovery Day ${day}`);
    setText('recovery-consistency', allLogs.length ? `${allLogs.length} catatan tersimpan · teruskan ritmemu` : 'Mulai catatan pertamamu hari ini');
    setText('recovery-journey-score', score);
    setText('today-plan-count', `${completed}/3`);
    setText('recovery-insight-text', insight);
    aiEnhanceInsight(allLogs, recent, insight);
    const meter = el('recovery-score-meter-fill');
    if (meter) meter.style.width = `${score}%`;
    const journeyNodes = document.querySelectorAll('.journey-node');
    journeyNodes.forEach((node, index) => node.classList.toggle('active', index === (score >= 75 ? 3 : score >= 50 ? 2 : 1)));

    // Streak nyata (hari berturut-turut ada catatan) ditampilin di journey track
    const streak = calcStreak(allLogs);
    const track = el('recovery-journey-track');
    if (track) {
      const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      const nodes = [];
      for (let i = 6; i >= 0; i -= 1) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const isFilled = i < streak;
        const isToday = i === 0;
        nodes.push(`<span class="journey-node ${isFilled ? 'done' : ''} ${isToday ? 'active' : ''}">${isToday ? 'Now' : dayNames[d.getDay()]}</span>`);
      }
      track.innerHTML = nodes.join('<i></i>');
    }

    // Milestone: pencapaian kecil biar terasa progres, bukan cuma angka
    const painAvgRecent = avg(recent);
    const painAvgPrev = avg(previousPeriod);
    const milestones = [
      { icon: '🏁', label: 'First Check-in', earned: allLogs.length >= 1 },
      { icon: '🔥', label: '3 Hari Beruntun', earned: streak >= 3 },
      { icon: '📈', label: 'Nyeri Membaik', earned: painAvgPrev !== null && painAvgRecent !== null && painAvgRecent < painAvgPrev },
      { icon: '💪', label: '7 Hari Beruntun', earned: streak >= 7 },
      { icon: '✦', label: 'Insight AI Pertama', earned: recentCount >= 2 },
      { icon: '🏆', label: 'Skor 90+', earned: score >= 90 },
    ];
    const milestoneEl = el('recovery-milestones');
    if (milestoneEl) {
      milestoneEl.innerHTML = milestones.map(m => `
        <span class="milestone-badge ${m.earned ? 'earned' : ''}" title="${m.earned ? 'Tercapai' : 'Belum tercapai'}">
          <span class="milestone-icon">${m.icon}</span>${escHtml(m.label)}
        </span>
      `).join('');
    }

    // Tombol CTA: arahkan ke halaman paling relevan sesuai kondisi user sekarang
    const ctaBtn = el('recovery-action-cta');
    if (ctaBtn) {
      let targetPage = 'checkup';
      let ctaLabel = 'Check-in sekarang →';
      if (latest) {
        if (pain >= 5) { targetPage = 'nutrition'; ctaLabel = 'Lihat rekomendasi makanan →'; }
        else { targetPage = 'activity'; ctaLabel = 'Lihat aktivitas ringan →'; }
      }
      ctaBtn.textContent = ctaLabel;
      ctaBtn.onclick = () => navigate(targetPage);
    }

    // Rencana Hari Ini: ambil 1 contoh makanan & aktivitas nyata sesuai kondisi user
    const planContainer = el('recovery-today-plan');
    if (planContainer) {
      const condition = latest?.condition || state.user.condition || 'pemulihan_umum';
      const hasLogToday = allLogs.some(log => {
        const d = new Date(log.datetime);
        const today = new Date();
        return d.toDateString() === today.toDateString();
      });
      const foodSample = dashboardFoodsDB?.conditions?.[condition]?.foods?.[0];
      const activitySample = dashboardExercisesDB?.conditions?.[condition]?.activities?.[0];
      const medicineSample = dashboardMedicinesDB?.conditions?.[condition]?.medicines?.[0];
      const nextTodayEvent = todayEvents[0];
      const planItems = [
        { done: hasLogToday, title: 'Check-in kondisi', desc: 'Catat bagaimana tubuhmu hari ini' },
        { done: false, title: foodSample ? `Makan ${foodSample.name}` : 'Jaga asupan makanan', desc: 'Sesuai rekomendasi nutrisi untuk kondisimu', link: 'nutrition' },
        { done: false, title: activitySample ? activitySample.name : 'Gerak ringan', desc: 'Lakukan sesuai batas nyamanmu', link: 'activity' },
        { done: false, title: medicineSample ? medicineSample.name : 'Cek info obat', desc: 'Info umum, bukan resep — baca label dulu', link: 'medicine' },
        { done: false, title: nextTodayEvent ? nextTodayEvent.title : 'Belum ada jadwal hari ini', desc: nextTodayEvent ? `${nextTodayEvent.time || ''} · ${typeLabel(nextTodayEvent.type)}` : 'Tambahkan jadwal biar harimu lebih terarah', link: 'calendar' },
      ];
      planContainer.innerHTML = planItems.map(item => `
        <div class="recovery-plan-item ${item.link ? 'clickable' : ''}" ${item.link ? `onclick="App.navigate('${item.link}')"` : ''}>
          <span>${item.done ? '☑' : '○'}</span>
          <div><strong>${escHtml(item.title)}</strong><small>${escHtml(item.desc)}</small></div>
        </div>
      `).join('');
      const doneCount = planItems.filter(i => i.done).length;
      setText('today-plan-count', `${doneCount}/${planItems.length}`);
    }
  }

  function renderTodaySchedule(events) {
    const container = el('today-schedule-list');
    if (!events.length) {
      container.innerHTML = `<div class="empty-state" style="padding:24px">
        <div class="emoji">📋</div>
        <h3>Belum ada jadwal</h3>
        <p>Tambahkan jadwal di Kalender</p>
      </div>`;
      return;
    }

    const colors = { obat: '#f43f5e', makan: '#10b981', olahraga: '#818cf8', dokter: '#0ed8a4', istirahat: '#f59e0b', fisioterapi: '#6366f1', lainnya: '#94a3b8' };
    container.innerHTML = events.map(ev => `
      <div class="schedule-item">
        <div class="schedule-dot" style="background:${colors[ev.type] || '#94a3b8'}"></div>
        <span class="schedule-time">${ev.time || '—'}</span>
        <span class="schedule-label">${escHtml(ev.title)}</span>
        <span class="schedule-type">${typeLabel(ev.type)}</span>
      </div>
    `).join('');
  }

  function renderDashTrend() {
    const canvas = el('dashTrendChart');
    if (!canvas) return;
    const logs = state.healthLogs.slice(0, 14).reverse();
    drawTrendChart(canvas, logs, 90);
  }

  function renderDashRecentLog() {
    const container = el('dash-recent-log');
    if (!state.healthLogs.length) {
      container.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:8px 0;">Belum ada catatan kesehatan</div>`;
      return;
    }
    const log = state.healthLogs[0];
    container.innerHTML = `
      <div class="log-entry">
        <div class="log-entry-icon">📋</div>
        <div>
          <div class="log-entry-meta">${formatDate(log.datetime)}</div>
          <div class="log-entry-title">Nyeri: ${log.pain}/10 — Suhu: ${log.temp ? log.temp + '°C' : 'N/A'}</div>
          <div class="log-entry-body">${escHtml(log.notes) || 'Tidak ada catatan'}</div>
        </div>
      </div>`;
  }

  // ─── Shared Chart Drawing ─────────────────────────────────────
  function drawTrendChart(canvas, logs, height = 140) {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth || 400;
    canvas.height = height;

    const W = canvas.width, H = height;
    ctx.clearRect(0, 0, W, H);

    if (!logs.length) {
      ctx.fillStyle = 'rgba(148,163,184,0.3)';
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Belum ada data', W / 2, H / 2);
      return;
    }

    const padL = 30, padR = 20, padT = 10, padB = 24;
    const w = W - padL - padR;
    const h = H - padT - padB;
    const n = Math.min(logs.length, 14);
    const dataSlice = logs.slice(-n);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i += 2) {
      const y = padT + h - (i / 10) * h;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + w, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(148,163,184,0.4)';
      ctx.font = '9px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(i, padL - 4, y + 3);
    }

    // Gradient fill
    const grd = ctx.createLinearGradient(0, padT, 0, padT + h);
    grd.addColorStop(0, 'rgba(14,216,164,0.25)');
    grd.addColorStop(1, 'rgba(14,216,164,0.0)');

    const pts = dataSlice.map((log, i) => ({
      x: padL + (n === 1 ? w / 2 : (i / (n - 1)) * w),
      y: padT + h - (log.pain / 10) * h,
    }));

    // Fill area
    ctx.beginPath();
    ctx.moveTo(pts[0].x, padT + h);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, padT + h);
    ctx.closePath();
    ctx.fillStyle = grd;
    ctx.fill();

    // Line
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = '#0ed8a4';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Dots
    pts.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#0ed8a4';
      ctx.fill();
      ctx.strokeStyle = '#070b18';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Date label
      if (i === 0 || i === pts.length - 1 || n <= 7) {
        const d = new Date(dataSlice[i].datetime);
        const label = `${d.getDate()}/${d.getMonth() + 1}`;
        ctx.fillStyle = 'rgba(148,163,184,0.6)';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, p.x, padT + h + 14);
      }
    });
  }

  // ─── Utility helpers ─────────────────────────────────────────
  function el(id) { return document.getElementById(id); }

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(dateStr, mode = 'full') {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    if (mode === 'short') return `${d.getDate()}/${d.getMonth() + 1}`;
    return d.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function getTodayEvents() {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return state.events.filter(ev => {
      if (ev.date === todayStr) return true;
      if (ev.recurring) {
        const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon,...
        if (ev.recurring === 'daily') return true;
        if (ev.recurring === 'weekly' && ev.days?.includes(dayOfWeek)) return true;
      }
      return false;
    }).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }

  function typeLabel(type) {
    const map = { obat: '💊 Obat', makan: '🍽️ Makan', olahraga: '🏃 Olahraga', dokter: '👨‍⚕️ Dokter', istirahat: '😴 Istirahat', fisioterapi: '🏥 Fisioterapi', lainnya: '📌 Lainnya' };
    return map[type] || type;
  }

  function showToast(type, title, desc = '', duration = 3500) {
    const icons = { success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️' };
    const container = el('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <div class="toast-body">
        <div class="toast-title">${escHtml(title)}</div>
        ${desc ? `<div class="toast-desc">${escHtml(desc)}</div>` : ''}
      </div>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function openModal(html) {
    el('modal-content').innerHTML = html;
    el('modal-overlay').classList.add('open');
  }

  function closeModal() {
    el('modal-overlay').classList.remove('open');
  }

  function toggleSidebar() {
    const isOpen = document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('nav-drawer-backdrop')?.classList.toggle('open', isOpen);
    document.body.classList.toggle('nav-drawer-open', isOpen);
  }

  function closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('nav-drawer-backdrop')?.classList.remove('open');
    document.body.classList.remove('nav-drawer-open');
  }

  function openSettingsModal() {
    openModal(`
      <div class="modal-title">⚙️ Pengaturan Profil</div>
      <div class="form-group">
        <label class="form-label">Nama Pengguna</label>
        <input type="text" class="form-input" id="settings-name" value="${escHtml(state.user.name)}">
      </div>
      <div class="form-group">
        <label class="form-label">Kondisi Kesehatan Default</label>
        <select class="form-select" id="settings-condition">
          <option value="cedera_fisik" ${state.user.condition === 'cedera_fisik' ? 'selected' : ''}>🦴 Cedera Fisik</option>
          <option value="demam" ${state.user.condition === 'demam' ? 'selected' : ''}>🌡️ Demam</option>
          <option value="flu_pilek" ${state.user.condition === 'flu_pilek' ? 'selected' : ''}>🤧 Flu / Pilek</option>
          <option value="peradangan" ${state.user.condition === 'peradangan' ? 'selected' : ''}>🔥 Peradangan</option>
          <option value="pemulihan_umum" ${state.user.condition === 'pemulihan_umum' ? 'selected' : ''}>💪 Pemulihan Umum</option>
        </select>
      </div>
      <div class="divider" style="margin:18px 0;"></div>
      <div class="form-group">
        <label class="form-label">Cadangan Data</label>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">
          Semua catatan kesehatan, jadwal, dan riwayat chat tersimpan di browser ini saja.
          Export untuk backup atau pindah ke device lain.
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="App.exportData()">⬇️ Export Data</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('import-file-input').click()">⬆️ Import Data</button>
          <input type="file" id="import-file-input" accept="application/json" style="display:none" onchange="App.importData(event)">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="App.closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="App.saveSettings()">💾 Simpan</button>
      </div>
    `);
  }

  function exportData() {
    const backup = {
      exportedAt: new Date().toISOString(),
      app: 'Recovra',
      version: 1,
      hg_state: localStorage.getItem('hg_state'),
      recovra_conversations: localStorage.getItem('recovra_conversations'),
      recovra_active_conversation: localStorage.getItem('recovra_active_conversation'),
      recovra_onboarding_done: localStorage.getItem('recovra_onboarding_done')
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateTag = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `recovra-backup-${dateTag}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('success', 'Data di-export!', 'File backup sudah diunduh.');
  }

  function importData(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = JSON.parse(reader.result);
        if (!backup || (backup.app !== 'Recovra' && backup.app !== 'Recovra HealthGuard')) {
          throw new Error('File bukan backup Recovra yang valid.');
        }
        if (!confirm('Import akan MENGGANTI semua data kamu saat ini dengan isi file backup. Lanjutkan?')) return;
        ['hg_state', 'recovra_conversations', 'recovra_active_conversation', 'recovra_onboarding_done'].forEach(key => {
          if (backup[key] !== undefined && backup[key] !== null) {
            localStorage.setItem(key, backup[key]);
          }
        });
        showToast('success', 'Data berhasil di-import!', 'Halaman akan dimuat ulang...');
        setTimeout(() => window.location.reload(), 1200);
      } catch (err) {
        showToast('error', 'Import gagal', 'Pastikan file backup benar dan tidak rusak.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function saveSettings() {
    const name = el('settings-name')?.value.trim() || 'Pengguna';
    const condition = el('settings-condition')?.value || 'pemulihan_umum';
    state.user.name = name;
    state.user.condition = condition;
    saveState();
    closeModal();
    showToast('success', 'Profil disimpan!', `Halo, ${name}!`);
    renderDashboard();
  }

  // ─── Date Display ─────────────────────────────────────────────
  function updateHeaderDate() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const dateEl = el('header-date');
    if (dateEl) dateEl.textContent = dateStr;
  }

  // ─── Init ─────────────────────────────────────────────────────
  function init() {
    loadState();
    updateHeaderDate();
    setInterval(updateHeaderDate, 60000);

    // Set now as default datetime for log form
    const logDt = document.getElementById('log-datetime');
    if (logDt) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      logDt.value = now.toISOString().slice(0, 16);
    }

    renderDashboard();
    if (!localStorage.getItem('recovra_onboarding_done')) {
      window.setTimeout(() => openOnboarding(), 350);
    }

    // Close modal on overlay click
    el('modal-overlay')?.addEventListener('click', (e) => {
      if (e.target === el('modal-overlay')) closeModal();
    });

    console.log('Recovra initialized ✅');
  }

  function openOnboarding() {
    openModal(`
      <div class="onboarding-shell">
        <div class="onboarding-kicker">WELCOME TO RECOVRA</div>
        <h2>Let's understand your recovery.</h2>
        <p class="onboarding-intro">Jawab singkat supaya dashboard dan saranmu terasa lebih personal.</p>
        <div class="onboarding-question"><strong>What are you recovering from?</strong><div class="onboarding-options" id="onboarding-condition-options">
          <button type="button" data-value="cedera_fisik" onclick="App.pickOnboarding(this)">🦴 Cedera</button>
          <button type="button" data-value="demam" onclick="App.pickOnboarding(this)">🌡️ Sakit</button>
          <button type="button" data-value="cedera_fisik" onclick="App.pickOnboarding(this)">🏥 Operasi</button>
          <button type="button" data-value="pemulihan_umum" onclick="App.pickOnboarding(this)">✦ Kondisi lain</button>
        </div></div>
        <div class="onboarding-question"><strong>What matters most to you?</strong><div class="onboarding-options" id="onboarding-goal-options">
          <button type="button" data-value="nyeri" onclick="App.pickOnboarding(this)">Menurunkan nyeri</button>
          <button type="button" data-value="aktif" onclick="App.pickOnboarding(this)">Kembali aktif</button>
          <button type="button" data-value="tidur" onclick="App.pickOnboarding(this)">Tidur lebih baik</button>
          <button type="button" data-value="rutin" onclick="App.pickOnboarding(this)">Menjaga rutinitas</button>
        </div></div>
        <div class="modal-footer"><button class="btn btn-primary" onclick="App.finishOnboarding()">Mulai perjalanan →</button></div>
      </div>`);
  }

  function pickOnboarding(button) {
    const group = button.parentElement;
    group.querySelectorAll('button').forEach(item => item.classList.remove('selected'));
    button.classList.add('selected');
  }

  function finishOnboarding() {
    const condition = document.querySelector('#onboarding-condition-options button.selected')?.dataset.value;
    const goal = document.querySelector('#onboarding-goal-options button.selected')?.dataset.value;
    if (!condition || !goal) {
      showToast('warning', 'Pilih dua jawaban dulu', 'Pilih kondisi dan fokus utama agar dashboard bisa disesuaikan.');
      return;
    }
    state.user.condition = condition;
    state.user.goal = goal;
    saveState();
    localStorage.setItem('recovra_onboarding_done', '1');
    closeModal();
    renderDashboard();
    showToast('success', 'Perjalananmu dimulai', 'Dashboard Recovra sudah disesuaikan.');
  }

  // ─── Public API ───────────────────────────────────────────────
  return {
    state,
    navigate,
    saveState,
    showToast,
    openModal,
    closeModal,
    toggleSidebar,
    closeSidebar,
    openSettingsModal,
    saveSettings,
    exportData,
    importData,
    showScoreBreakdown,
    openOnboarding,
    pickOnboarding,
    finishOnboarding,
    drawTrendChart,
    el,
    escHtml,
    formatDate,
    getTodayEvents,
    typeLabel,
    init,
  };
})();

// Boot
window.addEventListener('DOMContentLoaded', () => App.init());