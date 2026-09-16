/* =============================================================
   activity.js — Action Plan: Exercise/Activity Recommendation Module
   Pola sama dengan nutrition.js, supaya konsisten dengan App.el /
   App.escHtml / App.state yang sudah ada.
   ============================================================= */

const Activity = (() => {

  let activitiesDB = null;
  let currentCondition = null;

  async function loadActivitiesDB() {
    if (activitiesDB) return activitiesDB;
    try {
      const response = await fetch('data/exercises.json');
      if (!response.ok) throw new Error('status ' + response.status);
      activitiesDB = await response.json();
    } catch (e) {
      console.error('Failed to load exercises database:', e);
      activitiesDB = { conditions: {}, __loadFailed: true };
    }
    return activitiesDB;
  }

  async function init() {
    await loadActivitiesDB();

    // Samakan default kondisi dengan modul Nutrition, supaya kedua modul
    // selalu menunjukkan rekomendasi yang konsisten untuk kondisi yang sama.
    const latestLog = App.state.healthLogs[0];
    const defaultCondition = latestLog?.condition || App.state.user.condition || 'pemulihan_umum';
    if (!currentCondition) currentCondition = defaultCondition;

    renderConditionSelector();
    renderActivities(currentCondition);
  }

  function renderConditionSelector() {
    const container = App.el('activity-condition-selector');
    if (!container || !activitiesDB) return;

    if (activitiesDB.__loadFailed) {
      container.innerHTML = `<div class="empty-state" style="padding:20px;width:100%;">
        <div class="emoji">⚠️</div>
        <h3>Data aktivitas gagal dimuat</h3>
        <p>Cek koneksi internet/server lalu <a href="#" onclick="location.reload();return false;" style="color:var(--green);text-decoration:underline;">muat ulang halaman</a>.</p>
      </div>`;
      return;
    }

    container.innerHTML = Object.entries(activitiesDB.conditions).map(([key, cond]) => `
      <button class="condition-btn ${key === currentCondition ? 'active' : ''}"
              onclick="Activity.selectCondition('${key}')">
        <span class="icon">${cond.icon}</span>
        <span>${cond.label}</span>
      </button>
    `).join('');
  }

  function selectCondition(conditionKey) {
    currentCondition = conditionKey;
    renderConditionSelector();
    renderActivities(conditionKey);
  }

  function intensityClass(intensity) {
    const map = {
      'Tidak ada aktivitas fisik': 'intensity-none',
      'Sangat Ringan': 'intensity-veryeasy',
      'Ringan': 'intensity-easy',
      'Ringan-Sedang': 'intensity-mediumlow',
      'Sedang': 'intensity-medium',
    };
    return map[intensity] || 'intensity-easy';
  }

  function renderActivities(conditionKey) {
    if (!activitiesDB) return;
    const condition = activitiesDB.conditions[conditionKey];
    if (!condition) return;

    // Banner info (id berbeda dari nutrition supaya kedua modul bisa
    // ditampilkan di halaman/tab terpisah tanpa bentrok)
    const banner = App.el('activity-info-banner');
    const titleEl = App.el('activity-condition-title');
    const descEl = App.el('activity-condition-desc');
    const iconEl = App.el('activity-condition-icon');

    if (titleEl) titleEl.textContent = `${condition.icon} ${condition.label}`;
    if (descEl) descEl.textContent = condition.description;
    if (iconEl) iconEl.textContent = condition.icon;
    if (banner) banner.style.display = 'flex';
    const activityInsight = App.el('activity-ai-insight');
    if (activityInsight) activityInsight.textContent = `Untuk ${condition.label.toLowerCase()}, mulai dari intensitas yang terasa ringan${App.state.user.goal ? ` sambil mengejar fokus ${App.state.user.goal}` : ''}. Berhenti bila nyeri, pusing, atau sesak bertambah.`;

    const sidebar = App.el('sidebar-condition');
    if (sidebar) sidebar.textContent = condition.label;

    const grid = App.el('activity-grid');
    if (!grid) return;

    if (!condition.activities?.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="emoji">🏃</div>
        <h3>Tidak ada data</h3>
        <p>Rekomendasi aktivitas untuk kondisi ini belum tersedia</p>
      </div>`;
      return;
    }

    grid.innerHTML = condition.activities.map((act, index) => `
      <div class="food-card activity-card" style="animation-delay:${index * 0.06}s">
        <div class="food-card-header">
          <div class="food-emoji-box">${act.emoji}</div>
          <div>
            <div class="food-name">${App.escHtml(act.name)}</div>
            <div class="food-category">${App.escHtml(act.category)}</div>
          </div>
        </div>
        <div class="food-card-body">
          <div class="food-why">
            <strong style="color:var(--primary);font-size:12px;text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:6px;">🔬 Mengapa aktivitas ini?</strong>
            ${App.escHtml(act.why)}
          </div>

          <div class="nutrients-list">
            <span class="nutrient-chip ${intensityClass(act.intensity)}">⚡ ${App.escHtml(act.intensity)}</span>
          </div>

          <div class="food-tags" style="margin-top:10px;">
            ${act.tags.map(t => `<span class="food-tag">#${App.escHtml(t)}</span>`).join('')}
          </div>

          <div class="food-info-row">
            <span>
              <strong>⏰ Waktu</strong>
              ${App.escHtml(act.timing)}
            </span>
            <span style="text-align:right;">
              <strong>⏱️ Durasi</strong>
              ${App.escHtml(act.duration)}
            </span>
          </div>

          ${act.caution ? `
          <div class="food-info-row" style="margin-top:10px;background:rgba(232,132,107,0.1);border-radius:8px;padding:8px 10px;">
            <span style="flex:1;">
              <strong style="color:var(--warning, #E8846B);">⚠️ Perhatian</strong>
              ${App.escHtml(act.caution)}
            </span>
          </div>` : ''}
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.activity-card').forEach((card, i) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      setTimeout(() => {
        card.style.transition = 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, i * 60);
    });
  }

  return {
    init,
    selectCondition,
  };
})();