/* =============================================================
   healthhub.js — Recovra Health Hub
   Informational tools only; no diagnosis or treatment prescribing.
   ============================================================= */

const HealthHub = (() => {
  let foodsDB = null;
  let initialized = false;

  const esc = (value) => App.escHtml(String(value ?? ''));
  const el = (id) => App.el(id);

  const resultCard = (title, value, detail, tone = 'neutral', extra = '') => {
    const toneClass = tone === 'good' ? 'healthhub-result-good' : tone === 'attention' ? 'healthhub-result-attention' : 'healthhub-result-neutral';
    return `
      <div class="healthhub-result-card ${toneClass}">
        <div class="healthhub-result-head">
          <span>${esc(title)}</span>
          <span class="healthhub-result-dot" aria-hidden="true"></span>
        </div>
        <div class="healthhub-result-value">${value}</div>
        <div class="healthhub-result-detail">${detail}</div>
        ${extra ? `<div class="healthhub-result-extra">${extra}</div>` : ''}
      </div>`;
  };

  function setResult(node, html) {
    if (node) node.innerHTML = html;
  }

  async function loadFoods() {
    if (foodsDB) return foodsDB;
    try {
      const response = await fetch('data/foods.json');
      if (!response.ok) throw new Error('status ' + response.status);
      foodsDB = await response.json();
    } catch (error) {
      console.warn('Health Hub nutrition data failed:', error);
      foodsDB = { conditions: {} };
    }
    return foodsDB;
  }

  function restoreValue(id, storageKey) {
    const value = localStorage.getItem(storageKey);
    if (value !== null && el(id)) el(id).value = value;
  }

  async function init() {
    await loadFoods();
    renderDietOptions();

    if (!initialized) {
      restoreValue('hub-bmi-age', 'hub_bmi_age');
      restoreValue('hub-bmi-sex', 'hub_bmi_sex');
      restoreValue('hub-bmi-height', 'hub_bmi_height');
      restoreValue('hub-bmi-weight', 'hub_bmi_weight');

      restoreValue('hub-cal-age', 'hub_cal_age');
      restoreValue('hub-cal-sex', 'hub_cal_sex');
      restoreValue('hub-cal-weight', 'hub_cal_weight');
      restoreValue('hub-cal-height', 'hub_cal_height');
      restoreValue('hub-cal-activity', 'hub_cal_activity');

      loadSavedRecoveryCheck();
      initialized = true;
    }
  }

  function renderDietOptions() {
    const select = el('hub-diet-condition');
    if (!select || !foodsDB?.conditions) return;

    const entries = Object.entries(foodsDB.conditions);
    select.innerHTML = entries.length
      ? entries.map(([key, cond]) => `<option value="${esc(key)}">${esc(cond.icon || '🥗')} ${esc(cond.label)}</option>`).join('')
      : '<option value="">Data nutrisi belum tersedia</option>';
  }

  function calculateBMI() {
    const age = Number(el('hub-bmi-age')?.value);
    const sex = el('hub-bmi-sex')?.value;
    const heightCm = Number(el('hub-bmi-height')?.value);
    const weightKg = Number(el('hub-bmi-weight')?.value);
    const result = el('hub-bmi-result');

    if (!result || !Number.isFinite(age) || !Number.isFinite(heightCm) || !Number.isFinite(weightKg) || age < 2 || heightCm <= 0 || weightKg <= 0) {
      if (result) result.innerHTML = resultCard('Data belum lengkap', 'Lengkapi data', 'Masukkan usia, jenis kelamin, tinggi, dan berat badan dengan angka yang valid.', 'attention');
      return;
    }

    const bmi = weightKg / Math.pow(heightCm / 100, 2);

    localStorage.setItem('hub_bmi_age', age);
    localStorage.setItem('hub_bmi_sex', sex || 'male');
    localStorage.setItem('hub_bmi_height', heightCm);
    localStorage.setItem('hub_bmi_weight', weightKg);

    if (age < 20) {
      const sexLabel = sex === 'female' ? 'perempuan' : 'laki-laki';
      const ageText = Number.isInteger(age) ? `${age} tahun` : `${age.toFixed(1)} tahun`;

      setResult(result, resultCard(
        'BMI kamu',
        `${bmi.toFixed(1)} <small>kg/m²</small>`,
        `Data: ${ageText} · ${sexLabel} · ${heightCm} cm · ${weightKg} kg.`,
        'neutral',
        '<strong>Interpretasi remaja:</strong> BMI pada usia 2–19 tahun tidak dinilai memakai batas BMI dewasa. Hasil perlu dibandingkan dengan BMI-for-age berdasarkan usia dan jenis kelamin. Jadi angka BMI ini adalah hasil hitung, bukan diagnosis atau penilaian bentuk tubuh.'
      ));
      return;
    }

    let category = '';
    let tone = 'neutral';
    if (bmi < 18.5) {
      category = 'di bawah rentang BMI dewasa';
      tone = 'attention';
    } else if (bmi < 25) {
      category = 'rentang BMI dewasa 18,5–<25';
      tone = 'good';
    } else if (bmi < 30) {
      category = 'rentang BMI dewasa 25–<30';
      tone = 'attention';
    } else {
      category = 'BMI dewasa ≥30';
      tone = 'attention';
    }

    setResult(result, resultCard(
      'BMI kamu',
      `${bmi.toFixed(1)} <small>kg/m²</small>`,
      `Kategori skrining dewasa: ${esc(category)}.`,
      tone,
      'BMI adalah alat skrining dan perlu dilihat bersama faktor kesehatan lain; bukan diagnosis medis.'
    ));
  }

  function calculateEnergy() {
    const age = Number(el('hub-cal-age')?.value);
    const sex = el('hub-cal-sex')?.value;
    const weight = Number(el('hub-cal-weight')?.value);
    const height = Number(el('hub-cal-height')?.value);
    const activity = Number(el('hub-cal-activity')?.value || 1.2);
    const result = el('hub-cal-result');

    if (!result || !Number.isFinite(age) || !Number.isFinite(weight) || !Number.isFinite(height) || age < 13 || weight <= 0 || height <= 0) {
      if (result) result.innerHTML = resultCard('Data belum lengkap', 'Lengkapi data', 'Masukkan usia, tinggi, dan berat badan dengan angka yang valid.', 'attention');
      return;
    }

    localStorage.setItem('hub_cal_age', age);
    localStorage.setItem('hub_cal_sex', sex || 'male');
    localStorage.setItem('hub_cal_weight', weight);
    localStorage.setItem('hub_cal_height', height);
    localStorage.setItem('hub_cal_activity', activity);

    // Recovra deliberately does not generate calorie targets for users under 20.
    if (age < 20) {
      setResult(result, resultCard(
        'Energy Guide',
        'Panduan, bukan target',
        'Input kamu sudah terbaca dan tersimpan.',
        'neutral',
        '<strong>Untuk remaja:</strong> kebutuhan energi dipengaruhi pertumbuhan, perkembangan, aktivitas, dan kondisi individu. Recovra tidak memberikan angka kalori atau target defisit agar fitur ini tidak dipakai untuk membatasi makan. Jika membutuhkan kebutuhan energi yang personal, gunakan penilaian dari orang tua/wali bersama tenaga kesehatan atau ahli gizi.'
      ));
      return;
    }

    const bmr = sex === 'female'
      ? (10 * weight + 6.25 * height - 5 * age - 161)
      : (10 * weight + 6.25 * height - 5 * age + 5);
    const maintenance = Math.round(bmr * activity);

    setResult(result, resultCard(
      'Estimated daily energy',
      `≈ ${maintenance.toLocaleString('id-ID')} <small>kkal/hari</small>`,
      'Estimasi kebutuhan pemeliharaan untuk pengguna dewasa.',
      'neutral',
      'Angka ini adalah perkiraan berbasis rumus, bukan target diet, resep medis, atau anjuran untuk mengurangi makan.'
    ));
  }

  function getSleepInsight(sleep, quality, age) {
    if (age >= 13 && age <= 17) {
      if (sleep < 8) return { title: 'Tidur cukup singkat', text: 'Remaja umumnya membutuhkan sekitar 8–10 jam tidur per 24 jam. Coba prioritaskan waktu istirahat jika memungkinkan.', tone: 'attention' };
      if (sleep <= 10) return { title: 'Durasi tidur sesuai panduan umum', text: 'Durasi tidurmu berada di kisaran 8–10 jam. Tetap perhatikan kualitas dan bagaimana tubuh terasa.', tone: 'good' };
      return { title: 'Durasi tidur cukup panjang', text: 'Catatan tidurmu lebih dari 10 jam. Perhatikan pola beberapa hari, bukan satu catatan saja.', tone: 'neutral' };
    }

    if (sleep < 7) return { title: 'Tidur cukup singkat', text: 'Orang dewasa umumnya dianjurkan mendapatkan setidaknya 7 jam tidur per hari.', tone: 'attention' };
    return { title: 'Durasi tidur tercatat', text: 'Durasi tidur sudah tercatat. Kualitas dan konsistensi juga penting untuk dilihat dari waktu ke waktu.', tone: quality >= 3 ? 'good' : 'neutral' };
  }

  function getQualityText(quality) {
    if (quality >= 3) return 'Baik';
    if (quality === 2) return 'Cukup';
    return 'Kurang';
  }

  function saveRecoveryCheck() {
    const sleep = Number(el('hub-sleep-hours')?.value);
    const quality = Number(el('hub-sleep-quality')?.value || 0);
    const water = Number(el('hub-water')?.value);
    const result = el('hub-recovery-result');

    if (!result || !Number.isFinite(sleep) || sleep < 0 || sleep > 24 || !Number.isFinite(water) || water < 0 || water > 30) {
      if (result) result.innerHTML = resultCard('Data belum lengkap', 'Periksa input', 'Masukkan durasi tidur 0–24 jam dan jumlah gelas air 0–30.', 'attention');
      return;
    }

    const age = Number(el('hub-bmi-age')?.value || el('hub-cal-age')?.value || 0);
    const insight = getSleepInsight(sleep, quality, age);
    const check = {
      date: new Date().toISOString(),
      sleep,
      quality,
      water,
      age: Number.isFinite(age) ? age : null
    };

    localStorage.setItem('recovra_hub_recovery_check', JSON.stringify(check));

    setResult(result, resultCard(
      insight.title,
      `${sleep} <small>jam tidur</small>`,
      `Kualitas: ${esc(getQualityText(quality))} · Air tercatat: ${water} gelas.`,
      insight.tone,
      `${esc(insight.text)} <br><span style="opacity:.78">Catatan hidrasi disimpan sebagai kebiasaan yang kamu pantau; kebutuhan cairan dapat berbeda menurut aktivitas, cuaca, usia, dan kondisi.</span>`
    ));
  }

  function loadSavedRecoveryCheck() {
    const result = el('hub-recovery-result');
    const raw = localStorage.getItem('recovra_hub_recovery_check');
    if (!result || !raw) return;

    try {
      const check = JSON.parse(raw);
      const savedDate = new Date(check.date);
      const isToday = savedDate.toDateString() === new Date().toDateString();
      if (!isToday) return;

      if (el('hub-sleep-hours')) el('hub-sleep-hours').value = check.sleep ?? '';
      if (el('hub-sleep-quality')) el('hub-sleep-quality').value = check.quality ?? 2;
      if (el('hub-water')) el('hub-water').value = check.water ?? '';

      const insight = getSleepInsight(Number(check.sleep), Number(check.quality), Number(check.age || 0));
      setResult(result, resultCard(
        insight.title,
        `${Number(check.sleep)} <small>jam tidur</small>`,
        `Check-in hari ini · Kualitas: ${esc(getQualityText(Number(check.quality)))} · Air: ${Number(check.water)} gelas.`,
        insight.tone,
        esc(insight.text)
      ));
    } catch (error) {
      console.warn('Health Hub recovery check could not be restored:', error);
    }
  }

  function loadDietAssistant() {
    const key = el('hub-diet-condition')?.value;
    const condition = foodsDB?.conditions?.[key];
    const grid = el('hub-diet-result');

    if (!condition || !grid) {
      if (grid) grid.innerHTML = '<div class="empty-state" style="padding:16px;">Data nutrisi belum tersedia.</div>';
      return;
    }

    const foods = (condition.foods || []).slice(0, 4);
    grid.innerHTML = foods.length
      ? foods.map(food => `
          <div class="healthhub-food-mini">
            <span>${esc(food.emoji || '🥗')}</span>
            <div><b>${esc(food.name)}</b><small>${esc(food.category || 'Pilihan makanan')}</small></div>
          </div>`).join('')
      : '<div class="empty-state" style="padding:16px;">Belum ada pilihan makanan untuk kondisi ini.</div>';
  }

  function showCareNote(type) {
    const note = el('hub-care-note');
    if (!note) return;

    const messages = {
      'Fisioterapis': 'Fisioterapis dapat mengevaluasi gerak dan fungsi lalu membantu menyusun latihan yang sesuai. Untuk pemulihan cedera, evaluasi profesional dapat membantu menentukan aktivitas yang aman.',
      'Dokter': 'Dokter dapat menilai keluhan, riwayat kesehatan, dan kebutuhan pemeriksaan. Pertimbangkan konsultasi jika keluhan menetap, memburuk, atau mengganggu aktivitas sehari-hari.'
    };

    note.innerHTML = resultCard(
      type,
      'Dukungan profesional',
      messages[type] || 'Pilih bantuan profesional yang sesuai dengan kebutuhanmu.',
      'neutral'
    );
  }

  function findFacility(type) {
    const location = (el('hub-location')?.value || '').trim();
    const note = el('hub-care-note');

    if (!location) {
      if (note) note.innerHTML = resultCard('Lokasi belum diisi', 'Masukkan kota/daerah', 'Contoh: Yogyakarta, Magelang, atau Jakarta.', 'attention');
      return;
    }

    const query = `${type} near ${location}`;
    const url = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
    window.open(url, '_blank', 'noopener,noreferrer');

    if (note) {
      note.innerHTML = resultCard('Pencarian dibuka', esc(type), `Mencari layanan di sekitar <strong>${esc(location)}</strong> melalui peta.`, 'neutral');
    }
  }

  return {
    init,
    calculateBMI,
    calculateEnergy,
    saveRecoveryCheck,
    loadDietAssistant,
    showCareNote,
    findFacility
  };
})();
