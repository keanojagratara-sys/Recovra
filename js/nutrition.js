/* =============================================================
   nutrition.js — Smart Nutrition & Food Recommendation Module
   ============================================================= */

const Nutrition = (() => {

  let foodsDB = null;
  let currentCondition = null;

  async function loadFoodsDB() {
    if (foodsDB) return foodsDB;
    try {
      const response = await fetch('data/foods.json');
      if (!response.ok) throw new Error('status ' + response.status);
      foodsDB = await response.json();
    } catch (e) {
      console.error('Failed to load foods database:', e);
      foodsDB = { conditions: {}, __loadFailed: true };
    }
    return foodsDB;
  }

  async function init() {
    await loadFoodsDB();

    // Set default condition from user profile or latest log
    const latestLog = App.state.healthLogs[0];
    const defaultCondition = latestLog?.condition || App.state.user.condition || 'pemulihan_umum';
    if (!currentCondition) currentCondition = defaultCondition;

    renderConditionSelector();
    renderFoods(currentCondition);
  }

  function renderConditionSelector() {
    const container = App.el('nutrition-condition-selector');
    if (!container || !foodsDB) return;

    if (foodsDB.__loadFailed) {
      container.innerHTML = `<div class="empty-state" style="padding:20px;width:100%;">
        <div class="emoji">⚠️</div>
        <h3>Data nutrisi gagal dimuat</h3>
        <p>Cek koneksi internet/server lalu <a href="#" onclick="location.reload();return false;" style="color:var(--green);text-decoration:underline;">muat ulang halaman</a>.</p>
      </div>`;
      return;
    }

    container.innerHTML = Object.entries(foodsDB.conditions).map(([key, cond]) => `
      <button class="condition-btn ${key === currentCondition ? 'active' : ''}"
              onclick="Nutrition.selectCondition('${key}')">
        <span class="icon">${cond.icon}</span>
        <span>${cond.label}</span>
      </button>
    `).join('');
  }

  function selectCondition(conditionKey) {
    currentCondition = conditionKey;

    // Update active state
    document.querySelectorAll('.condition-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.condition-btn').forEach(btn => {
      if (btn.textContent.includes(foodsDB.conditions[conditionKey]?.icon)) {
        btn.classList.add('active');
      }
    });

    renderConditionSelector(); // re-render to update active class properly
    renderFoods(conditionKey);
  }

  function renderFoods(conditionKey) {
    if (!foodsDB) return;
    const condition = foodsDB.conditions[conditionKey];
    if (!condition) return;

    // Update banner
    const banner = App.el('nutrition-info-banner');
    const titleEl = App.el('nutrition-condition-title');
    const descEl = App.el('nutrition-condition-desc');
    const iconEl = App.el('nutrition-condition-icon');

    if (titleEl) titleEl.textContent = `${condition.icon} ${condition.label}`;
    if (descEl) descEl.textContent = condition.description;
    if (iconEl) iconEl.textContent = condition.icon;
    if (banner) banner.style.display = 'flex';
    const nutritionInsight = App.el('nutrition-ai-insight');
    if (nutritionInsight) nutritionInsight.textContent = `Berdasarkan kondisi ${condition.label.toLowerCase()}${App.state.user.goal ? ` dan fokusmu untuk ${App.state.user.goal}` : ''}, pilihan di bawah diprioritaskan sebagai panduan umum. Pilih yang paling mudah kamu toleransi.`;

    // Update sidebar condition label
    const sidebar = App.el('sidebar-condition');
    if (sidebar) sidebar.textContent = condition.label;

    // Render food cards
    const grid = App.el('food-grid');
    if (!grid) return;

    if (!condition.foods?.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="emoji">🥗</div>
        <h3>Tidak ada data</h3>
        <p>Database makanan untuk kondisi ini belum tersedia</p>
      </div>`;
      return;
    }

    grid.innerHTML = condition.foods.map((food, index) => `
      <div class="food-card" style="animation-delay:${index * 0.06}s">
        <div class="food-card-header">
          <div class="food-emoji-box">${food.emoji}</div>
          <div>
            <div class="food-name">${App.escHtml(food.name)}</div>
            <div class="food-category">${App.escHtml(food.category)}</div>
          </div>
        </div>
        <div class="food-card-body">
          <div class="food-why">
            <strong style="color:var(--primary);font-size:12px;text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:6px;">🔬 Mengapa makanan ini?</strong>
            ${App.escHtml(food.why)}
          </div>

          <div class="nutrients-list">
            ${food.nutrients.map(n => `<span class="nutrient-chip">⚡ ${App.escHtml(n)}</span>`).join('')}
          </div>

          <div class="food-tags" style="margin-top:10px;">
            ${food.tags.map(t => `<span class="food-tag">#${App.escHtml(t)}</span>`).join('')}
          </div>

          <div class="food-info-row">
            <span>
              <strong>⏰ Waktu Makan</strong>
              ${App.escHtml(food.timing)}
            </span>
            <span style="text-align:right;">
              <strong>🍽️ Porsi</strong>
              ${App.escHtml(food.portion)}
            </span>
          </div>
        </div>
      </div>
    `).join('');

    // Animate cards
    document.querySelectorAll('.food-card').forEach((card, i) => {
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