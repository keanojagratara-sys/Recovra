const Medicine = (() => {
  let db = null;
  let currentCondition = null;
  let query = '';
  const conditionIcons = { cedera_fisik: '🦴', demam: '🌡️', flu_pilek: '🤧', peradangan: '🔥', pemulihan_umum: '💪' };

  async function init() {
    if (!db) {
      try {
        const response = await fetch(`data/medicines.json?v=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('status ' + response.status);
        db = await response.json();
      } catch (error) {
        console.error('Medicine: data gagal dimuat', error);
        db = { conditions: {}, __loadFailed: true };
      }
    }
    currentCondition = currentCondition || App.state.user.condition || 'pemulihan_umum';
    renderFilters();
    render();
  }

  function renderFilters() {
    const container = App.el('medicine-condition-selector');
    if (!container || !db) return;
    if (db.__loadFailed) {
      container.innerHTML = `<div class="empty-state" style="padding:20px;width:100%;">
        <div class="emoji">⚠️</div>
        <h3>Data obat gagal dimuat</h3>
        <p>Cek koneksi internet/server lalu <a href="#" onclick="location.reload();return false;" style="color:var(--green);text-decoration:underline;">muat ulang halaman</a>.</p>
      </div>`;
      return;
    }
    container.innerHTML = Object.entries(db.conditions).map(([key, condition]) => `
      <button type="button" class="medicine-filter ${key === currentCondition ? 'active' : ''}" onclick="Medicine.selectCondition('${key}')">
        <span>${conditionIcons[key] || '💊'}</span><span>${App.escHtml(condition.label)}</span>
      </button>`).join('');
  }

  function selectCondition(key) {
    if (!db?.conditions?.[key]) return;
    currentCondition = key;
    renderFilters();
    render();
  }

  function search(value) {
    query = value.trim().toLowerCase();
    render();
  }

  function render() {
    const grid = App.el('medicine-grid');
    const condition = db?.conditions?.[currentCondition];
    if (!grid || !condition) return;
    const medicines = (condition.medicines || []).filter(item => {
      if (!query) return true;
      return [item.name, item.category, item.use, item.why, item.caution, ...(item.tags || [])].join(' ').toLowerCase().includes(query);
    });
    if (!medicines.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="emoji">🔎</div><h3>Obat tidak ditemukan</h3><p>Coba kata kunci lain atau pilih kondisi berbeda.</p></div>`;
      return;
    }
    grid.innerHTML = medicines.map(item => `
      <article class="medicine-page-card">
        <div class="medicine-page-card-head"><div class="medicine-page-icon">${item.emoji || '💊'}</div><div><h3>${App.escHtml(item.name)}</h3><span>${App.escHtml(item.category)}</span></div></div>
        <div class="medicine-page-copy"><strong>Untuk apa?</strong><p>${App.escHtml(item.use)}</p></div>
        <div class="medicine-page-copy"><strong>Catatan</strong><p>${App.escHtml(item.why)}</p></div>
        <div class="medicine-page-warning"><strong>⚠️ Perhatian</strong><p>${App.escHtml(item.caution)}</p></div>
      </article>`).join('');
  }

  return { init, selectCondition, search };
})();