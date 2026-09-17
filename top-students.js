// حساب وترتيب أوائل السنتر مباشرة من قاعدة بيانات Supabase

const monthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

async function loadTopStudents() {
  const currentMonth = monthKey();
  const podiumEl = document.querySelector('#podium');
  const tableBody = document.querySelector('#topTableBody');

  try {
    // 1. جلب الطلاب وإعدادات الشهر والحضور والامتحانات بالتوازي
    const [studentsRes, attendanceRes, examsRes, settingsRes] = await Promise.all([
      db.from('students').select('id, student_id, student_name, student_group'),
      db.from('attendance').select('student_id, created_at'),
      db.from('exam_results').select('student_id, score, max_score, month_key').eq('month_key', currentMonth),
      db.from('monthly_settings').select('*').eq('month_key', currentMonth).maybeSingle()
    ]);

    if (studentsRes.error) throw studentsRes.error;
    const students = studentsRes.data || [];
    const attendance = attendanceRes.data || [];
    const exams = examsRes.data || [];
    const totalSessions = settingsRes?.data?.total_sessions || 8;

    // 2. تجميع الحضور للشهر الحالي لكل طالب
    const attMap = {};
    attendance.forEach(a => {
      const aMonth = `${new Date(a.created_at).getFullYear()}-${String(new Date(a.created_at).getMonth() + 1).padStart(2, '0')}-01`;
      if (aMonth === currentMonth) {
        attMap[a.student_id] = (attMap[a.student_id] || 0) + 1;
      }
    });

    // 3. تجميع الامتحانات للشهر الحالي لكل طالب
    const examMap = {};
    exams.forEach(e => {
      if (!examMap[e.student_id]) examMap[e.student_id] = [];
      examMap[e.student_id].push((Number(e.score) / Number(e.max_score)) * 100);
    });

    // 4. حساب التقييم لكل طالب وتصنيف الطلاب الذين لديهم نشاط
    const evaluated = students.map(s => {
      const attCount = attMap[s.id] || 0;
      const studentExams = examMap[s.id] || [];

      const presenceRate = Math.min(100, (attCount / totalSessions) * 100);
      const avgExam = studentExams.length
        ? studentExams.reduce((a, b) => a + b, 0) / studentExams.length
        : 0;

      // المعادلة: الحضور 50% + الامتحانات 50%
      const totalScore = Math.round(presenceRate * 0.5 + avgExam * 0.5);

      return {
        ...s,
        attCount,
        presenceRate: Math.round(presenceRate),
        avgExam: Math.round(avgExam),
        totalScore,
        examsCount: studentExams.length
      };
    });

    // 5. الترتيب من الأعلى تقييماً إلى الأقل
    evaluated.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.avgExam !== a.avgExam) return b.avgExam - a.avgExam;
      return b.presenceRate - a.presenceRate;
    });

    // أخذ أفضل 10 طلاب
    const top10 = evaluated.slice(0, 10);

    // إذا لم يكن هناك نشاط بعد
    if (!top10.length || top10[0].totalScore === 0) {
      podiumEl.innerHTML = '<div class="empty" style="grid-column: 1/-1;">لا توجد درجات مسجلة لهذا الشهر حتى الآن. عند تسجيل الحضور والامتحانات ستظهر لوحة الأوائل تلقائياً.</div>';
      tableBody.innerHTML = '<tr><td colspan="8" class="empty">لا توجد تقييمات للشهر الحالي حتى الآن.</td></tr>';
      return;
    }

    // 6. رسم المنصة (Podium) للمراكز الثلاثة الأولى
    const first = top10[0];
    const second = top10[1];
    const third = top10[2];

    let podiumHtml = '';
    
    // المركز الثاني (على اليمين في RTL)
    if (second && second.totalScore > 0) {
      podiumHtml += `
        <div class="podium-card second">
          <div class="podium-medal">🥈</div>
          <span class="badge">المركز الثاني</span>
          <h3>${second.student_name}</h3>
          <div class="podium-details">
            <span>المجموعة: <strong>${second.student_group}</strong></span>
            <span>التقدير: <strong>${second.totalScore}%</strong></span>
          </div>
          <div class="podium-score">${second.totalScore}%</div>
          <small class="hint">حضور: ${second.presenceRate}% | امتحانات: ${second.avgExam}%</small>
        </div>
      `;
    } else {
      podiumHtml += '<div></div>';
    }

    // المركز الأول (في المنتصف وأعلى)
    if (first && first.totalScore > 0) {
      podiumHtml += `
        <div class="podium-card first">
          <div class="podium-medal">🥇</div>
          <span class="badge" style="background:#fff3c4;color:#b7791f">🏆 المركز الأول</span>
          <h3>${first.student_name}</h3>
          <div class="podium-details">
            <span>المجموعة: <strong>${first.student_group}</strong></span>
            <span>التقدير: <strong>${first.totalScore}%</strong></span>
          </div>
          <div class="podium-score" style="color:#d97706">${first.totalScore}%</div>
          <small class="hint">حضور: ${first.presenceRate}% | امتحانات: ${first.avgExam}%</small>
        </div>
      `;
    }

    // المركز الثالث (على اليسار في RTL)
    if (third && third.totalScore > 0) {
      podiumHtml += `
        <div class="podium-card third">
          <div class="podium-medal">🥉</div>
          <span class="badge">المركز الثالث</span>
          <h3>${third.student_name}</h3>
          <div class="podium-details">
            <span>المجموعة: <strong>${third.student_group}</strong></span>
            <span>التقدير: <strong>${third.totalScore}%</strong></span>
          </div>
          <div class="podium-score">${third.totalScore}%</div>
          <small class="hint">حضور: ${third.presenceRate}% | امتحانات: ${third.avgExam}%</small>
        </div>
      `;
    } else {
      podiumHtml += '<div></div>';
    }

    podiumEl.innerHTML = podiumHtml;

    // 7. رسم جدول العشرة الأوائل
    const medals = ['🥇 الأول', '🥈 الثاني', '🥉 الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];

    tableBody.innerHTML = top10.map((s, index) => `
      <tr class="${index < 3 ? 'top-rank-row' : ''}">
        <td>
          <span class="rank-badge" style="${index === 0 ? 'background:#fef3c7;color:#b45309;' : index === 1 ? 'background:#e2e8f0;color:#334155;' : index === 2 ? 'background:#ffedd5;color:#c2410c;' : ''}">
            ${index + 1}
          </span>
          <span style="margin-right:8px">${medals[index]}</span>
        </td>
        <td><b>${s.student_id}</b></td>
        <td>${s.student_name}</td>
        <td>${s.student_group}</td>
        <td>${s.presenceRate}% <small class="muted">(${s.attCount}/${totalSessions})</small></td>
        <td>${s.avgExam}% <small class="muted">(${s.examsCount} امتحانات)</small></td>
        <td><b class="payment-paid" style="font-size:1.1rem">${s.totalScore}%</b></td>
        <td>
          <a class="btn outline tiny" href="student-portal.html?code=${encodeURIComponent(s.student_id)}">
            عرض الملف 🎒
          </a>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    console.error(err);
    podiumEl.innerHTML = `<div class="message error" style="grid-column: 1/-1;">فشل تحميل الأوائل: ${err.message}</div>`;
    tableBody.innerHTML = `<tr><td colspan="8" class="empty">خطأ في جلب البيانات: ${err.message}</td></tr>`;
  }
}

window.addEventListener('DOMContentLoaded', loadTopStudents);
