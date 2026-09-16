/* =========================================================
   RECOVRA — RECOVERY INTELLIGENCE
   Recovery Score + Journey + Insight + Today
   ========================================================= */

(function () {

  function getLogs() {
    return (App.state.healthLogs || [])
      .slice()
      .sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
  }

  function average(arr, key = 'pain') {
    if (!arr.length) return null;

    const values = arr
      .map(x => Number(x[key]))
      .filter(Number.isFinite);

    if (!values.length) return null;

    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  function uniqueDays(logs) {
    return new Set(
      logs.map(log => {
        const d = new Date(log.datetime);
        return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      })
    ).size;
  }

  /* =========================================================
     RECOVERY SCORE
     ========================================================= */

  function calculateScore() {

    const logs = getLogs();

    if (!logs.length) {
      return {
        value: null,
        label: 'Belum cukup data',
        summary:
          'Catat kondisi kesehatanmu untuk mulai membangun Recovery Score.'
      };
    }

    const recent = logs.slice(0, 7);
    const previous = logs.slice(7, 14);

    const pain = average(recent);

    /*
      Base score:
      pain 0  = 100
      pain 10 = 25

      Ini bukan nilai medis.
      Hanya indikator visual berdasarkan data pengguna.
    */

    let score = 100 - ((pain || 0) * 7.5);

    /* Konsistensi logging */
    const days = uniqueDays(recent);
    score += Math.min(days * 2.5, 15);

    /* Perubahan dibanding periode sebelumnya */
    const previousPain = average(previous);

    if (previousPain !== null && pain !== null) {

      if (pain < previousPain) {
        score += 10;
      }

      if (pain > previousPain) {
        score -= 10;
      }
    }

    /* Sleep jika tersedia */
    const sleepValues = recent
      .map(x => Number(x.sleep))
      .filter(Number.isFinite);

    if (sleepValues.length) {

      const sleepAverage =
        sleepValues.reduce((a, b) => a + b, 0) /
        sleepValues.length;

      score += Math.max(
        -5,
        Math.min(5, (sleepAverage - 6) * 1.5)
      );
    }

    score = Math.round(
      Math.max(0, Math.min(100, score))
    );

    let label;
    let summary;

    if (score >= 80) {

      label = 'On Track';

      summary =
        'Progress recovery terlihat cukup baik. Pertahankan kebiasaan yang sudah berjalan dan ikuti arahan tenaga kesehatan.';
    }

    else if (score >= 60) {

      label = 'Steady';

      summary =
        'Recovery terlihat cukup stabil. Tetap pantau perubahan dan jangan memaksakan aktivitas.';
    }

    else {

      label = 'Needs Attention';

      summary =
        'Beberapa indikator perlu dipantau lebih dekat. Jika kondisi memburuk atau terasa mengkhawatirkan, beri tahu orang tua/wali dan tenaga kesehatan.';
    }

    return {
      value: score,
      label,
      summary
    };
  }


  /* =========================================================
     TODAY
     ========================================================= */

  function todayKey() {

    const d = new Date();

    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');
  }


  function getTasks() {

    const key = todayKey();

    if (!App.state.dailyTasks) {
      App.state.dailyTasks = {};
    }

    if (!Array.isArray(App.state.dailyTasks[key])) {

      App.state.dailyTasks[key] = [

        {
          id: 'checkin',
          title: 'Catat kondisi hari ini',
          done: false
        },

        {
          id: 'activity',
          title: 'Ikuti aktivitas yang sudah direncanakan',
          done: false
        },

        {
          id: 'nutrition',
          title: 'Perhatikan makan dan minum hari ini',
          done: false
        }

      ];
    }

    return App.state.dailyTasks[key];
  }


  function toggleTask(id) {

    const tasks = getTasks();

    const task = tasks.find(x => x.id === id);

    if (!task) return;

    task.done = !task.done;

    App.saveState();

    render();
  }


  /* =========================================================
     INSIGHTS
     ========================================================= */

  function generateInsights() {

    const logs = getLogs();

    if (!logs.length) {

      return [
        'Belum ada insight. Tambahkan beberapa catatan kesehatan untuk melihat pola recovery.'
      ];
    }

    const recent = logs.slice(0, 5);
    const previous = logs.slice(5, 10);

    const recentPain = average(recent);
    const previousPain = average(previous);

    const insights = [];

    /* Pain trend */

    if (previousPain !== null && recentPain !== null) {

      const difference = recentPain - previousPain;

      if (difference < 0) {

        insights.push(
          `Rata-rata nyeri turun ${Math.abs(difference).toFixed(1)} poin dibanding periode sebelumnya.`
        );

      } else if (difference > 0) {

        insights.push(
          `Rata-rata nyeri naik ${difference.toFixed(1)} poin dibanding periode sebelumnya.`
        );

      } else {

        insights.push(
          'Rata-rata nyeri relatif stabil pada dua periode terakhir.'
        );
      }

    } else {

      insights.push(
        'Tambahkan beberapa catatan lagi agar Recovra dapat membandingkan perkembanganmu.'
      );
    }


    /* Logging consistency */

    const days = uniqueDays(logs);

    insights.push(
      `Kamu sudah mencatat kondisi pada ${days} hari berbeda.`
    );


    /* High pain warning */

    const highPain = logs.filter(
      x => Number(x.pain) >= 7
    ).length;

    if (highPain > 0) {

      insights.push(
        `${highPain} catatan menunjukkan nyeri tinggi. Pertimbangkan untuk membicarakannya dengan orang tua/wali atau tenaga kesehatan.`
      );
    }


    /* Latest comparison */

    if (logs.length >= 2) {

      const latest = Number(logs[0].pain);
      const previous = Number(logs[1].pain);

      if (
        Number.isFinite(latest) &&
        Number.isFinite(previous)
      ) {

        const diff = latest - previous;

        if (diff < 0) {

          insights.push(
            `Catatan terbaru menunjukkan nyeri ${Math.abs(diff)} poin lebih rendah dari catatan sebelumnya.`
          );

        } else if (diff > 0) {

          insights.push(
            `Catatan terbaru menunjukkan nyeri ${diff} poin lebih tinggi dari catatan sebelumnya.`
          );
        }
      }
    }


    return insights;
  }


  /* =========================================================
     RENDER TODAY
     ========================================================= */

  function renderToday() {

    const tasks = getTasks();

    const completed =
      tasks.filter(x => x.done).length;

    const percent =
      tasks.length
        ? Math.round(
            (completed / tasks.length) * 100
          )
        : 0;


    const progressText =
      document.getElementById(
        'today-progress-text'
      );

    const progressPercent =
      document.getElementById(
        'today-progress-percent'
      );

    const progressBar =
      document.getElementById(
        'today-progress-bar'
      );

    const list =
      document.getElementById(
        'today-mini-list'
      );


    if (progressText) {
      progressText.textContent =
        `${completed}/${tasks.length} selesai`;
    }

    if (progressPercent) {
      progressPercent.textContent =
        `${percent}%`;
    }

    if (progressBar) {
      progressBar.style.width =
        `${percent}%`;
    }


    if (list) {

      list.innerHTML = tasks.map(task => `

        <button
          class="today-task ${task.done ? 'done' : ''}"
          onclick="RecoveryModule.toggleTask('${App.escHtml(task.id)}')"
        >

          <span>
            ${task.done ? '✓' : '○'}
          </span>

          ${App.escHtml(task.title)}

        </button>

      `).join('');
    }
  }


  /* =========================================================
     MAIN RENDER
     ========================================================= */

  function render() {

    const result = calculateScore();


    /* Dashboard score */

    const dashboardScore =
      document.getElementById(
        'dash-recovery-score'
      );

    if (dashboardScore) {

      dashboardScore.textContent =
        result.value === null
          ? '--'
          : result.value;
    }


    /* Recovery page score */

    const recoveryScore =
      document.getElementById(
        'recovery-page-score'
      );

    if (recoveryScore) {

      recoveryScore.textContent =
        result.value === null
          ? '--'
          : result.value;
    }


    /* Ring */

    const ring =
      document.getElementById(
        'dash-recovery-ring'
      );

    if (ring) {

      ring.style.setProperty(
        '--score',
        result.value === null
          ? '0deg'
          : `${result.value * 3.6}deg`
      );
    }


    /* Labels */

    [
      'dash-recovery-label',
      'recovery-status'
    ].forEach(id => {

      const element =
        document.getElementById(id);

      if (element) {
        element.textContent =
          result.label;
      }

    });


    /* Summary */

    [
      'dash-recovery-summary',
      'recovery-status-detail'
    ].forEach(id => {

      const element =
        document.getElementById(id);

      if (element) {
        element.textContent =
          result.summary;
      }

    });


    /* Log count */

    const logs = getLogs();

    const logCount =
      document.getElementById(
        'recovery-log-count'
      );

    if (logCount) {

      logCount.textContent =
        `${uniqueDays(logs)} hari`;
    }


    /* Pain trend */

    const trend =
      document.getElementById(
        'recovery-pain-trend'
      );

    if (trend) {

      const recent =
        average(logs.slice(0, 5));

      const previous =
        average(logs.slice(5, 10));

      if (
        recent === null ||
        previous === null
      ) {

        trend.textContent =
          'Butuh data';

      } else if (recent < previous) {

        trend.textContent =
          `↓ ${Math.abs(recent - previous).toFixed(1)} poin`;

      } else if (recent > previous) {

        trend.textContent =
          `↑ ${(recent - previous).toFixed(1)} poin`;

      } else {

        trend.textContent =
          'Stabil';
      }
    }


    /* Timeline */

    const timeline =
      document.getElementById(
        'recovery-timeline'
      );

    if (timeline) {

      if (!logs.length) {

        timeline.innerHTML = `
          <div class="empty-state">
            Belum ada catatan recovery.
          </div>
        `;

      } else {

        timeline.innerHTML =
          logs
            .slice(0, 14)
            .reverse()
            .map((log, index) => `

              <div class="journey-node">

                <span>
                  ${index + 1}
                </span>

                <div>

                  <strong>
                    ${App.formatDate(
                      log.datetime,
                      'short'
                    )}
                  </strong>

                  <p>
                    Nyeri
                    ${App.escHtml(log.pain)}/10

                    ${
                      log.temp
                        ? ` · ${App.escHtml(log.temp)}°C`
                        : ''
                    }

                  </p>

                </div>

              </div>

            `)
            .join('');
      }
    }


    /* Insights */

    const insights =
      generateInsights();

    const insightList =
      document.getElementById(
        'recovery-insights'
      );

    if (insightList) {

      insightList.innerHTML =
        insights.map(text => `

          <div class="insight-item">
            ✦ ${App.escHtml(text)}
          </div>

        `).join('');
    }


    /* Dashboard insight */

    const dashboardInsight =
      document.getElementById(
        'dashboard-insight'
      );

    if (dashboardInsight) {

      dashboardInsight.textContent =
        insights[0];
    }


    renderToday();
  }


  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.RecoveryModule = {

    init: render,
    refresh: render,
    toggleTask
  };

})();