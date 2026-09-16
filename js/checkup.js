/* =============================================================
   checkup.js — Cek Kondisi: input bebas + pilihan gejala bertahap
   ============================================================= */

const Checkup = (() => {
  let foodsDB = null;
  let activitiesDB = null;
  let medicinesDB = null;
  let currentCondition = null;
  let selectedSymptoms = new Set();
  const moreOpen = { food: false, activity: false, medicine: false };

  const conditionKeywords = {
    cedera_fisik: ['cedera', 'patah', 'keseleo', 'terkilir', 'pasca operasi', 'operasi', 'tulang', 'sendi terkilir', 'jatuh', 'terbentur', 'memar'],
    demam: ['demam', 'panas badan', 'meriang', 'suhu tinggi', 'menggigil', 'berkeringat'],
    flu_pilek: ['flu', 'pilek', 'batuk', 'hidung tersumbat', 'bersin', 'tenggorokan'],
    peradangan: ['radang', 'peradangan', 'arthritis', 'sendi bengkak', 'nyeri sendi', 'kaku sendi'],
    pemulihan_umum: ['pemulihan', 'baru sembuh', 'baru sakit', 'lemas', 'capek', 'kurang fit', 'nafsu makan turun'],
  };

  const conditionMeta = {
    cedera_fisik: { icon: '🦴', label: 'Cedera Fisik / Pemulihan Tulang', short: 'Nyeri, memar, atau pemulihan setelah cedera' },
    demam: { icon: '🌡️', label: 'Demam / Infeksi', short: 'Panas badan, meriang, dan butuh istirahat' },
    flu_pilek: { icon: '🤧', label: 'Flu / Pilek', short: 'Hidung, tenggorokan, dan gejala pernapasan ringan' },
    peradangan: { icon: '🔥', label: 'Peradangan / Arthritis', short: 'Sendi kaku, bengkak, atau terasa nyeri' },
    pemulihan_umum: { icon: '💪', label: 'Pemulihan Umum / Pasca Sakit', short: 'Energi turun dan ingin kembali fit bertahap' },
  };

  // Tag di sini dicocokkan dengan tags pada data/foods.json.
  const symptomProfiles = {
    cedera_fisik: {
      label: 'Pilih bagian yang paling terasa supaya pilihan makan lebih relevan.',
      symptoms: [
        { id: 'nyeri', label: 'Nyeri / ngilu', icon: '💢', keywords: ['nyeri', 'sakit', 'ngilu'], tags: ['pereda-nyeri', 'anti-inflamasi'] },
        { id: 'bengkak', label: 'Bengkak / memar', icon: '🟣', keywords: ['bengkak', 'memar'], tags: ['anti-inflamasi', 'antioksidan'] },
        { id: 'gerak_terbatas', label: 'Gerak terasa terbatas', icon: '🦿', keywords: ['sulit bergerak', 'gerak terbatas', 'tidak bisa bergerak'], tags: ['pemulihan-otot', 'pemulihan-jaringan'] },
        { id: 'tulang', label: 'Fokus pemulihan tulang', icon: '🦴', keywords: ['tulang', 'patah'], tags: ['tulang-kuat', 'protein'] },
        { id: 'lemas_cedera', label: 'Badan terasa lemas', icon: '🪫', keywords: ['lemas', 'capek'], tags: ['energi', 'protein'] },
        { id: 'luka', label: 'Ada luka / kulit perlu pulih', icon: '🩹', keywords: ['luka', 'sayatan', 'jahitan'], tags: ['pemulihan-jaringan', 'kolagen', 'protein'] },
        { id: 'nafsu_makan_cedera', label: 'Sulit memenuhi kebutuhan makan', icon: '🍽️', keywords: ['sulit makan', 'tidak selera'], tags: ['mudah-dimakan', 'energi'] },
      ],
    },
    demam: {
      label: 'Pilih gejala penyerta agar saran tidak terlalu umum.',
      symptoms: [
        { id: 'dehidrasi', label: 'Banyak berkeringat / haus', icon: '💧', keywords: ['haus', 'keringat', 'berkeringat', 'dehidrasi'], tags: ['hidrasi', 'rehidrasi', 'elektrolit'] },
        { id: 'mual', label: 'Mual / perut kurang nyaman', icon: '🤢', keywords: ['mual', 'muntah', 'perut'], tags: ['anti-mual', 'mudah-cerna'] },
        { id: 'nafsu_makan', label: 'Nafsu makan turun', icon: '🥣', keywords: ['nafsu makan', 'tidak selera', 'sulit makan'], tags: ['mudah-dimakan', 'mudah-cerna', 'energi'] },
        { id: 'meriang', label: 'Meriang / badan terasa panas', icon: '🌡️', keywords: ['meriang', 'panas', 'menggigil'], tags: ['penurun-demam', 'antioksidan'] },
        { id: 'sakit_kepala', label: 'Pusing / sakit kepala', icon: '🤕', keywords: ['pusing', 'sakit kepala'], tags: ['hidrasi', 'elektrolit', 'istirahat'] },
        { id: 'sulit_tidur', label: 'Sulit tidur / istirahat', icon: '🌙', keywords: ['sulit tidur', 'tidak bisa tidur'], tags: ['relaksasi', 'istirahat'] },
        { id: 'tenggorokan_demam', label: 'Tenggorokan terasa kering', icon: '🫗', keywords: ['tenggorokan kering', 'kering di tenggorokan'], tags: ['hidrasi', 'mudah-dimakan'] },
      ],
    },
    flu_pilek: {
      label: 'Pilih keluhan yang paling mengganggu saat ini.',
      symptoms: [
        { id: 'hidung', label: 'Hidung tersumbat / pilek', icon: '👃', keywords: ['hidung tersumbat', 'pilek', 'sinus'], tags: ['dekongestan'] },
        { id: 'batuk', label: 'Batuk / tenggorokan', icon: '🫁', keywords: ['batuk', 'tenggorokan', 'gatal'], tags: ['dekongestan', 'anti-inflamasi'] },
        { id: 'lemas', label: 'Lemas / energi turun', icon: '🪫', keywords: ['lemas', 'capek', 'energi'], tags: ['energi', 'mudah-cerna'] },
        { id: 'imun', label: 'Ingin fokus dukung imun', icon: '🛡️', keywords: ['imun', 'infeksi'], tags: ['imun', 'antiviral', 'antioksidan'] },
        { id: 'suara_serak', label: 'Suara serak', icon: '🗣️', keywords: ['serak', 'suara hilang'], tags: ['mudah-dimakan', 'hidrasi'] },
        { id: 'mata_berair', label: 'Mata berair / terasa berat', icon: '👁️', keywords: ['mata berair', 'mata berat'], tags: ['istirahat', 'relaksasi'] },
        { id: 'tidur_flu', label: 'Butuh tidur lebih banyak', icon: '🌙', keywords: ['mengantuk', 'butuh tidur'], tags: ['istirahat', 'relaksasi'] },
      ],
    },
    peradangan: {
      label: 'Pilih keluhan sendi atau fokus pemulihanmu.',
      symptoms: [
        { id: 'nyeri_sendi', label: 'Nyeri sendi', icon: '💢', keywords: ['nyeri sendi', 'sakit sendi'], tags: ['sendi', 'anti-inflamasi'] },
        { id: 'kaku', label: 'Kaku saat bergerak', icon: '🦿', keywords: ['kaku', 'sulit ditekuk'], tags: ['sendi', 'anti-inflamasi'] },
        { id: 'bengkak', label: 'Sendi bengkak', icon: '🟣', keywords: ['bengkak', 'merah'], tags: ['anti-inflamasi', 'sendi'] },
        { id: 'antioksidan', label: 'Fokus antioksidan', icon: '🍒', keywords: ['antioksidan'], tags: ['antioksidan', 'polifenol'] },
        { id: 'gerak_terbatas_sendi', label: 'Rentang gerak berkurang', icon: '↔️', keywords: ['rentang gerak', 'gerak terbatas'], tags: ['sendi', 'mobilitas', 'low-impact'] },
        { id: 'mudah_lelah_sendi', label: 'Mudah lelah saat bergerak', icon: '🪫', keywords: ['mudah lelah', 'cepat lelah'], tags: ['relaksasi', 'low-impact'] },
        { id: 'tidur_sendi', label: 'Nyeri mengganggu tidur', icon: '🌙', keywords: ['tidur terganggu', 'sulit tidur'], tags: ['relaksasi', 'istirahat'] },
      ],
    },
    pemulihan_umum: {
      label: 'Pilih kebutuhan utama tubuhmu saat pemulihan.',
      symptoms: [
        { id: 'lemas', label: 'Lemas / stamina turun', icon: '🪫', keywords: ['lemas', 'capek', 'stamina'], tags: ['energi', 'protein'] },
        { id: 'nafsu_makan', label: 'Nafsu makan belum pulih', icon: '🍽️', keywords: ['nafsu makan', 'tidak selera'], tags: ['mudah-cerna', 'energi'] },
        { id: 'pencernaan', label: 'Pencernaan perlu dijaga', icon: '🌿', keywords: ['pencernaan', 'perut', 'kembung'], tags: ['pencernaan', 'probiotik', 'serat'] },
        { id: 'jaringan', label: 'Bangun kembali jaringan tubuh', icon: '💪', keywords: ['otot', 'jaringan', 'pemulihan'], tags: ['pemulihan-jaringan', 'protein'] },
        { id: 'tidur_pulih', label: 'Tidur belum berkualitas', icon: '🌙', keywords: ['tidur', 'insomnia'], tags: ['istirahat', 'relaksasi'] },
        { id: 'hidrasi_pulih', label: 'Perlu lebih banyak cairan', icon: '💧', keywords: ['kurang minum', 'cairan', 'haus'], tags: ['hidrasi', 'rehidrasi'] },
        { id: 'napas_pulih', label: 'Ingin mulai bergerak pelan', icon: '🌿', keywords: ['mulai bergerak', 'aktivitas ringan'], tags: ['bertahap', 'kardio-ringan', 'fleksibilitas'] },
      ],
    },
  };

  async function loadData() {
    if (foodsDB && activitiesDB) return;
    try {
      const cacheBust = `?v=${Date.now()}`;
      const [foodsRes, actRes, medRes] = await Promise.all([
        fetch(`data/foods.json${cacheBust}`, { cache: 'no-store' }),
        fetch(`data/exercises.json${cacheBust}`, { cache: 'no-store' }),
        fetch(`data/medicines.json${cacheBust}`, { cache: 'no-store' }),
      ]);
      if (!foodsRes.ok || !actRes.ok || !medRes.ok) throw new Error('Data rekomendasi tidak tersedia');
      foodsDB = await foodsRes.json();
      activitiesDB = await actRes.json();
      medicinesDB = await medRes.json();
    } catch (e) {
      console.error('Checkup: gagal memuat data', e);
      App.showToast('error', 'Data belum siap', 'Coba muat ulang halaman untuk melihat rekomendasi.');
    }
  }

  async function init() {
    await loadData();
    renderConditionSelector();
    updateFlowProgress(currentCondition ? 2 : 1);
  }

  function updateFlowProgress(stage) {
    const steps = document.querySelectorAll('.checkup-flow-step');
    if (!steps.length) return;
    steps.forEach((step, index) => {
      step.classList.toggle('active', index + 1 <= stage);
      step.classList.toggle('completed', index + 1 < stage);
    });
  }

  function renderConditionSelector() {
    const container = App.el('checkup-condition-selector');
    if (!container || !foodsDB) return;

    container.innerHTML = Object.entries(conditionMeta).map(([key, meta]) => `
      <button type="button" class="condition-btn ${key === currentCondition ? 'active' : ''}"
              onclick="Checkup.selectCondition('${key}')" aria-pressed="${key === currentCondition}">
        <span class="condition-icon">${meta.icon}</span>
        <span class="condition-copy"><strong>${App.escHtml(meta.label)}</strong><small>${App.escHtml(meta.short)}</small></span>
        <span class="condition-arrow">›</span>
      </button>
    `).join('');
  }

  function selectCondition(key) {
    if (!conditionMeta[key]) return;
    currentCondition = key;
    selectedSymptoms = new Set();
    moreOpen.food = false;
    moreOpen.activity = false;
    moreOpen.medicine = false;
    renderConditionSelector();
    renderSymptomStep();
    updateFlowProgress(2);
    hideResults();
    const input = App.el('checkup-input');
    if (input) input.focus();
  }

  function renderSymptomStep() {
    const step = App.el('checkup-symptom-step');
    const chips = App.el('checkup-symptom-chips');
    const profile = symptomProfiles[currentCondition];
    if (!step || !chips || !profile) return;

    step.style.display = 'block';
    App.el('checkup-symptom-label').textContent = profile.label;
    chips.innerHTML = profile.symptoms.map(symptom => `
      <button type="button" class="symptom-chip ${selectedSymptoms.has(symptom.id) ? 'selected' : ''}"
              onclick="Checkup.toggleSymptom('${symptom.id}')" aria-pressed="${selectedSymptoms.has(symptom.id)}">
        <span>${symptom.icon}</span><span>${App.escHtml(symptom.label)}</span>
        <span class="symptom-chip-check">${selectedSymptoms.has(symptom.id) ? '✓' : '+'}</span>
      </button>
    `).join('');

    const count = selectedSymptoms.size;
    App.el('checkup-symptom-hint').textContent = count
      ? `${count} gejala dipilih. Makin spesifik pilihanmu, makin terarah rekomendasinya.`
      : 'Boleh pilih lebih dari satu, atau langsung tekan tombol untuk saran umum kondisi ini.';
    const submit = App.el('checkup-submit');
    if (submit) submit.textContent = count ? '🔎 Lihat Saran yang Cocok' : '🔎 Lihat Saran Umum';
  }

  function toggleSymptom(id) {
    if (!currentCondition) return;
    if (selectedSymptoms.has(id)) selectedSymptoms.delete(id);
    else selectedSymptoms.add(id);
    renderSymptomStep();
    hideResults();
  }

  function detectConditionFromText(text) {
    const t = text.toLowerCase();
    let bestKey = null;
    let bestScore = 0;
    for (const [key, keywords] of Object.entries(conditionKeywords)) {
      const score = keywords.reduce((total, keyword) => total + (t.includes(keyword) ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        bestKey = key;
      }
    }
    return bestKey;
  }

  function detectSymptomsFromText(text, conditionKey) {
    const t = text.toLowerCase();
    const profile = symptomProfiles[conditionKey];
    return new Set((profile?.symptoms || [])
      .filter(symptom => symptom.keywords.some(keyword => t.includes(keyword)))
      .map(symptom => symptom.id));
  }

  function getSelectedTags() {
    const profile = symptomProfiles[currentCondition];
    if (!profile) return [];
    return profile.symptoms
      .filter(symptom => selectedSymptoms.has(symptom.id))
      .flatMap(symptom => symptom.tags);
  }

  function rankItems(items, tags) {
    const tagSet = new Set(tags);
    return [...(items || [])]
      .map((item, index) => ({
        item,
        index,
        score: (item.tags || []).reduce((score, tag) => score + (tagSet.has(tag) ? 1 : 0), 0),
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index);
  }

  function analyze() {
    const input = App.el('checkup-input');
    const text = input?.value.trim() || '';
    if (!text && !currentCondition) {
      App.showToast('warning', 'Pilih atau ceritakan kondisimu', 'Ketik keluhan atau pilih salah satu kondisi terlebih dahulu.');
      return;
    }

    const detected = text ? detectConditionFromText(text) : null;
    if (detected) {
      currentCondition = detected;
      selectedSymptoms = detectSymptomsFromText(text, currentCondition);
      renderConditionSelector();
      renderSymptomStep();
    } else if (!currentCondition) {
      currentCondition = 'pemulihan_umum';
      selectedSymptoms = new Set();
      renderConditionSelector();
      renderSymptomStep();
    } else if (text && selectedSymptoms.size === 0) {
      selectedSymptoms = detectSymptomsFromText(text, currentCondition);
      renderSymptomStep();
    }

    const meta = conditionMeta[currentCondition];
    const symptomNames = (symptomProfiles[currentCondition]?.symptoms || [])
      .filter(symptom => selectedSymptoms.has(symptom.id))
      .map(symptom => symptom.label);
    let note = text
      ? `Keluhanmu dipetakan ke ${meta.label.toLowerCase()}.`
      : `Kamu memilih ${meta.label.toLowerCase()}.`;
    if (symptomNames.length) note += ` Fokus saat ini: ${symptomNames.join(', ')}.`;
    else note += ' Ini adalah pilihan umum karena belum ada gejala penyerta yang dipilih.';

    showResults(currentCondition, note);
  }

  function foodCard(food) {
    return `
      <div class="food-card">
        <div class="food-card-header">
          <div class="food-emoji-box">${food.emoji}</div>
          <div>
            <div class="food-name">${App.escHtml(food.name)}</div>
            <div class="food-category">${App.escHtml(food.category)}</div>
          </div>
        </div>
        <div class="food-card-body">
          <div class="food-why">
            <strong class="recommendation-label">🔬 Mengapa ini?</strong>
            ${App.escHtml(food.why)}
          </div>
          <div class="nutrients-list">
            ${(food.nutrients || []).map(n => `<span class="nutrient-chip">⚡ ${App.escHtml(n)}</span>`).join('')}
          </div>
          <div class="food-info-row">
            <span><strong>⏰ Waktu</strong>${App.escHtml(food.timing)}</span>
            <span style="text-align:right;"><strong>🍽️ Porsi</strong>${App.escHtml(food.portion)}</span>
          </div>
        </div>
      </div>
    `;
  }

  function activityCard(act) {
    return `
      <div class="food-card">
        <div class="food-card-header">
          <div class="food-emoji-box">${act.emoji}</div>
          <div>
            <div class="food-name">${App.escHtml(act.name)}</div>
            <div class="food-category">${App.escHtml(act.category)}</div>
          </div>
        </div>
        <div class="food-card-body">
          <div class="food-why">
            <strong class="recommendation-label">🔬 Mengapa ini?</strong>
            ${App.escHtml(act.why)}
          </div>
          <div class="nutrients-list"><span class="nutrient-chip">⚡ ${App.escHtml(act.intensity)}</span></div>
          <div class="food-info-row">
            <span><strong>⏰ Waktu</strong>${App.escHtml(act.timing)}</span>
            <span style="text-align:right;"><strong>⏱️ Durasi</strong>${App.escHtml(act.duration)}</span>
          </div>
          ${act.caution ? `<div class="food-info-row checkup-caution"><span style="flex:1;"><strong>⚠️ Perhatian</strong>${App.escHtml(act.caution)}</span></div>` : ''}
        </div>
      </div>
    `;
  }

  function medicineCard(medicine) {
    return `
      <div class="medicine-card">
        <div class="medicine-card-header">
          <div class="medicine-emoji-box">${medicine.emoji}</div>
          <div>
            <div class="medicine-name">${App.escHtml(medicine.name)}</div>
            <div class="medicine-category">${App.escHtml(medicine.category)}</div>
          </div>
        </div>
        <div class="medicine-card-body">
          <div class="medicine-use"><strong>Untuk apa?</strong>${App.escHtml(medicine.use)}</div>
          <div class="medicine-why"><strong>Catatan</strong>${App.escHtml(medicine.why)}</div>
          <div class="medicine-caution"><strong>⚠️ Perhatian</strong>${App.escHtml(medicine.caution)}</div>
        </div>
      </div>
    `;
  }

  function renderRecommendationGroup(kind, rankedItems, primaryCount, cardRenderer) {
    const primary = rankedItems.slice(0, primaryCount);
    const more = rankedItems.slice(primaryCount);
    const primaryEl = App.el(`checkup-${kind}-grid`);
    const moreEl = App.el(`checkup-${kind}-more`);
    const toggle = App.el(`checkup-${kind}-more-toggle`);
    if (primaryEl) primaryEl.innerHTML = primary.map(entry => cardRenderer(entry.item)).join('');
    if (moreEl) {
      moreEl.innerHTML = more.map(entry => cardRenderer(entry.item)).join('');
      moreEl.style.display = moreOpen[kind] && more.length ? 'grid' : 'none';
    }
    if (toggle) {
      toggle.style.display = more.length ? 'inline-flex' : 'none';
      const label = kind === 'food' ? 'pilihan' : kind === 'activity' ? 'aktivitas' : 'obat';
      toggle.textContent = moreOpen[kind] ? '− Sembunyikan pilihan lainnya' : `＋ Lihat ${label} lainnya (${more.length})`;
    }
  }

  function toggleMore(kind) {
    moreOpen[kind] = !moreOpen[kind];
    const foodCond = foodsDB?.conditions?.[currentCondition];
    const actCond = activitiesDB?.conditions?.[currentCondition];
    const tags = getSelectedTags();
    const medCond = medicinesDB?.conditions?.[currentCondition];
    if (kind === 'food') renderRecommendationGroup('food', rankItems(foodCond?.foods, tags), 3, foodCard);
    if (kind === 'activity') renderRecommendationGroup('activity', rankItems(actCond?.activities, tags), 2, activityCard);
    if (kind === 'medicine') renderRecommendationGroup('medicine', rankItems(medCond?.medicines, tags), 2, medicineCard);
  }

  function showResults(conditionKey, note) {
    const meta = conditionMeta[conditionKey];
    const foodCond = foodsDB?.conditions?.[conditionKey];
    const actCond = activitiesDB?.conditions?.[conditionKey];
    const medCond = medicinesDB?.conditions?.[conditionKey];
    if (!meta || !foodCond || !actCond || !medCond) return;

    moreOpen.food = false;
    moreOpen.activity = false;
    moreOpen.medicine = false;
    App.el('checkup-empty').style.display = 'none';
    App.el('checkup-results').style.display = 'block';
    App.el('checkup-result-title').textContent = `${meta.icon} ${meta.label}`;
    App.el('checkup-result-desc').textContent = foodCond.description || 'Pilihan yang dapat membantu mendukung kondisi tubuhmu.';
    App.el('checkup-result-icon').textContent = meta.icon;
    App.el('checkup-result-note').textContent = note;
    updateFlowProgress(3);

    const tags = getSelectedTags();
    renderRecommendationGroup('food', rankItems(foodCond.foods, tags), 3, foodCard);
    renderRecommendationGroup('medicine', rankItems(medCond.medicines, tags), 2, medicineCard);
    renderRecommendationGroup('activity', rankItems(actCond.activities, tags), 2, activityCard);
    document.getElementById('checkup-results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideResults() {
    updateFlowProgress(currentCondition ? 2 : 1);
    const results = App.el('checkup-results');
    const empty = App.el('checkup-empty');
    if (results) results.style.display = 'none';
    if (empty) empty.style.display = 'block';
  }

  return { init, analyze, selectCondition, toggleSymptom, toggleMore };
})();
