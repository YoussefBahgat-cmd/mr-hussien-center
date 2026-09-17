const db = supabase.createClient('https://aknhxrhlahusgfpiknau.supabase.co', 'sb_publishable_BFsu6iC-nWsKfdKQgoXimQ_dNmbgxTj');

const scannerSection = document.querySelector('#portalScannerSection');
const scannerContainer = document.querySelector('#scannerContainer');
const startScanBtn = document.querySelector('#startScanBtn');
const stopScanBtn = document.querySelector('#stopScanBtn');
const errorMsg = document.querySelector('#portalErrorMsg');
const content = document.querySelector('#portalContent');

let active = {
  student: null,
  exams: [],
  attendance: [],
  sessions: [],
  payments: [],
  examMaterials: [],
  topRank: null
};

let html5QrCode = null;

const safe = v => String(v || '—').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const monthKey = d => `${new Date(d).getFullYear()}-${String(new Date(d).getMonth() + 1).padStart(2, '0')}-01`;
const label = m => new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(new Date(`${m}T00:00:00`));

const showError = (text) => {
  errorMsg.textContent = text;
  errorMsg.classList.remove('hidden');
};

const hideError = () => {
  errorMsg.classList.add('hidden');
};

const beep = () => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.1;
    osc.frequency.value = 900;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {}
};

// توليد قائمة الشهور منذ انضمام الطالب وحتى الآن
function monthsFrom(start) {
  const out = [], now = new Date();
  const d = new Date(`${start || monthKey(now)}T00:00:00`);
  d.setDate(1);
  while (d <= now) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
    d.setMonth(d.getMonth() + 1);
  }
  return out.reverse();
}

// حساب تقييم الشهر بمعادلة 50% حضور + 50% امتحانات
function evaluation(month) {
  const exams = active.exams.filter(x => x.month_key === month);
  const att = active.attendance.filter(x => monthKey(x.created_at) === month).length;
  const setting = active.sessions.find(x => x.month_key === month);
  const sessions = setting?.total_sessions || 8;

  // حساب متوسط الامتحانات بناءً على عدد الامتحانات الفعلية التي امتحنها الطالب
  const avg = exams.length
    ? exams.reduce((a, x) => a + (Number(x.score) / Number(x.max_score) * 100), 0) / exams.length
    : 0;

  const presence = Math.min(100, (att / sessions) * 100);

  // المعادلة الجديدة المطلوبة: 50% حضور + 50% امتحانات
  const score = Math.round(presence * 0.5 + avg * 0.5);

  return {
    avg,
    presence,
    score,
    count: exams.length,
    att,
    sessions
  };
}

// صياغة وصف ذكي وتلقائي لعدد الامتحانات في الشهر
function formatExamCount(count, avg) {
  if (count === 0) {
    return {
      title: '0 امتحان',
      sub: 'لم تُسجل اختبارات بعد'
    };
  }
  if (count === 1) {
    return {
      title: '1 امتحان',
      sub: `تم أداء امتحان الشهر (متوسط: ${Math.round(avg)}%)`
    };
  }
  if (count === 2) {
    return {
      title: '2 امتحان',
      sub: `تم أداء امتحانين (متوسط: ${Math.round(avg)}%)`
    };
  }
  return {
    title: `${count} امتحانات`,
    sub: `متوسط الدرجات: ${Math.round(avg)}%`
  };
}

// تقييم التقدير العام للدرجة
function getGradeBadge(percentage) {
  if (percentage >= 90) return { text: 'ممتاز 🌟', color: '#15803d', bg: '#dcfce7' };
  if (percentage >= 80) return { text: 'جيد جداً ✨', color: '#0369a1', bg: '#e0f2fe' };
  if (percentage >= 65) return { text: 'جيد 👍', color: '#b45309', bg: '#fef3c7' };
  return { text: 'يحتاج تحسين ⚠️', color: '#b91c1c', bg: '#fee2e2' };
}

function render(selectedMonth) {
  const months = monthsFrom(active.student.start_month);
  const current = evaluation(selectedMonth);
  const cumulative = Math.round(months.reduce((sum, m) => sum + evaluation(m).score, 0) / (months.length || 1));
  const exams = active.exams
    .filter(x => x.month_key === selectedMonth)
    .sort((a, b) => new Date(b.exam_date) - new Date(a.exam_date));

  const examCountInfo = formatExamCount(current.count, current.avg);

  // حالة الدفع للشهر المحدد
  const currentMonthPayment = active.payments.find(p => p.payment_month === selectedMonth);
  const isPaidThisMonth = currentMonthPayment && currentMonthPayment.status === 'مدفوع';

  // ملفات الـ PDF للامتحان (النسخة غير المحلولة والنسخة المحلولة) للشهر المحدد
  const monthMaterials = active.examMaterials.find(m => m.month_key === selectedMonth) || null;

  content.className = 'spaced';
  content.innerHTML = `
    <!-- رأس الداشبورد الطلابي الفخم (Hero Header) -->
    <div class="student-dashboard-hero">
      <div class="student-hero-content">
        <div class="student-profile-info">
          <div class="student-large-avatar">👨‍🎓</div>
          <div class="student-details">
            <span class="eyebrow" style="color:#d8d6ff">لوحة متابعة الطالب</span>
            <h1>${safe(active.student.student_name)}</h1>
            <div class="student-badges">
              <span class="pill-badge id">كود الطالب: ${safe(active.student.student_id)}</span>
              <span class="pill-badge group">المجموعة: ${safe(active.student.student_group)}</span>
              ${active.topRank ? `<span class="pill-badge rank">🏆 المركز ${active.topRank} على السنتر</span>` : ''}
              ${isPaidThisMonth
                ? `<span class="pill-badge" style="background:#10b981;color:#fff;">💳 اشتراك الشهر مدفوع</span>`
                : `<span class="pill-badge" style="background:#ef4444;color:#fff;">⚠️ اشتراك الشهر غير مدفوع</span>`
              }
            </div>
          </div>
        </div>
        <div>
          <button id="switchStudentBtn" class="btn outline tiny" style="background:#ffffff20;color:#fff;border-color:#ffffff50;">
            مسح كارت آخر 📷
          </button>
        </div>
      </div>
    </div>

    <!-- شريط اختيار الشهور (Month Selector Tabs) -->
    <div class="month-selector-bar">
      ${months.map(m => `
        <button class="month-pill-btn ${m === selectedMonth ? 'active' : ''}" data-month="${m}">
          📅 ${label(m)}
          ${m === monthKey(new Date()) ? '<span style="font-size:0.7rem;opacity:0.85;">(الحالي)</span>' : ''}
        </button>
      `).join('')}
    </div>

    <!-- بطاقات مؤشرات الأداء والتقييم الشهري (4 KPI Cards) -->
    <div class="dashboard-kpi-grid">
      <!-- 1. التقييم الشهري 50:50 -->
      <article class="kpi-card purple">
        <div class="kpi-card-header">
          <span>تقييم ${label(selectedMonth)}</span>
          <div class="kpi-icon-wrap">🌟</div>
        </div>
        <div class="kpi-value">${current.score}%</div>
        <div class="kpi-sub">المعادلة: 50% حضور + 50% اختبار</div>
      </article>

      <!-- 2. التقييم التراكمي -->
      <article class="kpi-card teal">
        <div class="kpi-card-header">
          <span>التقييم التراكمي العام</span>
          <div class="kpi-icon-wrap">📈</div>
        </div>
        <div class="kpi-value">${cumulative}%</div>
        <div class="kpi-sub">متوسط الشهور منذ الانضمام</div>
      </article>

      <!-- 3. الحضور والغياب -->
      <article class="kpi-card blue">
        <div class="kpi-card-header">
          <span>الحضور والغياب</span>
          <div class="kpi-icon-wrap">📅</div>
        </div>
        <div class="kpi-value">${Math.round(current.presence)}%</div>
        <div class="kpi-sub">${current.att} من إجمالي ${current.sessions} حصص</div>
      </article>

      <!-- 4. امتحانات الشهر (تلقائي وديناميكي) -->
      <article class="kpi-card amber">
        <div class="kpi-card-header">
          <span>امتحانات الشهر</span>
          <div class="kpi-icon-wrap">📝</div>
        </div>
        <div class="kpi-value">${examCountInfo.title}</div>
        <div class="kpi-sub">${examCountInfo.sub}</div>
      </article>
    </div>

    <!-- قسم تحميل نسختي الـ PDF للامتحان (غير محلول ومحلول) -->
    <section class="exam-materials-card">
      <div class="exam-materials-header">
        <div>
          <h2 style="font-size:1.25rem; margin:0 0 4px;">📄 بنك امتحانات ونماذج إجابة شهر ${label(selectedMonth)}</h2>
          <p class="hint" style="margin:0">ملفات PDF الرسمية متاحة لجميع الطلاب للمراجعة والتطبيق.</p>
        </div>
        ${monthMaterials ? `<span class="badge" style="background:#e0f2fe;color:#0369a1;">متوفر للتحميل الآن</span>` : ''}
      </div>

      ${monthMaterials && (monthMaterials.unsolved_url || monthMaterials.solved_url) ? `
        <div class="exam-materials-grid">
          <!-- 1. نسخة الامتحان غير محلولة -->
          <div class="pdf-download-box">
            <div class="pdf-box-info">
              <div class="pdf-icon-badge unsolved">📄</div>
              <div class="pdf-box-text">
                <strong>نسخة الامتحان (غير محلولة)</strong>
                <small>${safe(monthMaterials.title || 'امتحان الشهر')}</small>
              </div>
            </div>
            ${monthMaterials.unsolved_url ? `
              <a href="${encodeURI(monthMaterials.unsolved_url)}" target="_blank" class="btn primary tiny" download>
                📥 فتح / تحميل PDF
              </a>
            ` : '<span class="muted" style="font-size:0.8rem">غير مرفقة</span>'}
          </div>

          <!-- 2. نموذج الإجابة نسخة محلولة -->
          <div class="pdf-download-box">
            <div class="pdf-box-info">
              <div class="pdf-icon-badge solved">📝</div>
              <div class="pdf-box-text">
                <strong>نموذج الإجابة النموذجي (نسخة محلولة)</strong>
                <small>الحلول الكاملة مع الشرح والتوزيع</small>
              </div>
            </div>
            ${monthMaterials.solved_url ? `
              <a href="${encodeURI(monthMaterials.solved_url)}" target="_blank" class="btn success tiny" download>
                📥 فتح / تحميل PDF
              </a>
            ` : '<span class="muted" style="font-size:0.8rem">غير مرفقة</span>'}
          </div>
        </div>
      ` : `
        <div class="empty" style="padding:18px;background:#fff;border-radius:12px;border:1px dashed #cbd5e1;">
          📌 لم يتم رفع ملفات امتحان هذا الشهر حتى الآن. ستظهر هنا فور اعتمادها من مستر حسين.
        </div>
      `}
    </section>

    <!-- قسم حالة الدفع والاشتراك الشهري لكل شهر -->
    <section class="payment-status-card">
      <div class="section-title">
        <div>
          <h2>💳 الموقف المالي وحالة الاشتراكات</h2>
          <p class="hint">متابعة دقيقة لحالة سداد اشتراك كل شهر دراسي.</p>
        </div>
      </div>

      <!-- بانر حالة الشهر الحالي المحدد -->
      <div class="payment-banner ${isPaidThisMonth ? 'paid' : 'unpaid'}">
        <div class="payment-banner-info">
          <div class="payment-banner-icon">${isPaidThisMonth ? '✅' : '⏳'}</div>
          <div class="payment-banner-text">
            <strong>
              ${isPaidThisMonth ? `تم سداد اشتراك شهر ${label(selectedMonth)} بنجاح` : `اشتراك شهر ${label(selectedMonth)} غير مسدد حالياً`}
            </strong>
            <small>
              ${isPaidThisMonth && currentMonthPayment.paid_at ? `تاريخ التسديد: ${new Date(currentMonthPayment.paid_at).toLocaleDateString('ar-EG')}` : 'يرجى مراجعة إدارة السنتر لتأكيد السداد.'}
            </small>
          </div>
        </div>
        <span class="payment-tag ${isPaidThisMonth ? 'paid' : 'unpaid'}">
          ${isPaidThisMonth ? 'مدفوع بالكامل' : 'مستحق السداد'}
        </span>
      </div>

      <!-- جدول تفاصيل الدفع لجميع الشهور -->
      <div class="table-wrap">
        <table class="payment-history-table">
          <thead>
            <tr>
              <th>الشهر الدراسي</th>
              <th>حالة الدفع</th>
              <th>تاريخ السداد</th>
              <th>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${months.map(m => {
              const p = active.payments.find(pay => pay.payment_month === m);
              const paid = p && p.status === 'مدفوع';
              return `
                <tr>
                  <td><b>${label(m)}</b></td>
                  <td>
                    <span class="payment-tag ${paid ? 'paid' : 'unpaid'}">
                      ${paid ? 'مدفوع ✅' : 'غير مدفوع ❌'}
                    </span>
                  </td>
                  <td>${paid && p.paid_at ? new Date(p.paid_at).toLocaleDateString('ar-EG') : '—'}</td>
                  <td>${paid ? 'تم التسجيل في السنتر' : '<small class="muted">يرجى السداد</small>'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <!-- شبكة النتائج وتفاصيل الحصص والاختبارات -->
    <div class="portal-grid">
      <!-- نتائج اختبارات الشهر -->
      <section class="card">
        <div class="section-title">
          <div>
            <h2>📝 اختبارات ${label(selectedMonth)}</h2>
            <p class="hint">${examCountInfo.sub}</p>
          </div>
        </div>
        ${exams.length ? `
          <div class="table-wrap student-results-table-wrap">
            <table class="student-results-table">
              <thead>
                <tr>
                  <th>الاختبار</th>
                  <th>التاريخ</th>
                  <th>الدرجة</th>
                  <th>النسبة</th>
                  <th>التقدير</th>
                </tr>
              </thead>
              <tbody>
                ${exams.map(x => {
                  const perc = Math.round((Number(x.score) / Number(x.max_score)) * 100);
                  const badge = getGradeBadge(perc);
                  return `
                    <tr>
                      <td data-label="الاختبار">
                        <strong>${safe(x.title)}</strong><br>
                        <small class="muted">${x.exam_type === 'monthly' ? 'امتحان شهري رئيسي' : 'اختبار أسبوعي / كويز'}</small>
                      </td>
                      <td data-label="التاريخ">${new Date(x.exam_date).toLocaleDateString('ar-EG')}</td>
                      <td data-label="الدرجة"><b>${x.score} / ${x.max_score}</b></td>
                      <td data-label="النسبة"><b>${perc}%</b></td>
                      <td data-label="التقدير">
                        <span class="badge" style="background:${badge.bg};color:${badge.color};font-weight:700">
                          ${badge.text}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty">
            لم تسجل درجات اختبارات لهذا الشهر حتى الآن.
          </div>
        `}
      </section>

      <!-- تفاصيل معادلة التقييم (50:50) -->
      <section class="card">
        <div class="section-title">
          <div>
            <h2>⚖️ تفاصيل التقييم (50:50)</h2>
            <p class="hint">50% الحضور + 50% متوسط الامتحانات</p>
          </div>
        </div>

        <div class="payment-row evaluation-row">
          <span>حضور الحصص (50%)</span>
          <b>${Math.round(current.presence)}% (${current.att}/${current.sessions} حصص)</b>
        </div>
        <div class="payment-row evaluation-row">
          <span>متوسط الاختبارات (50%)</span>
          <b>${Math.round(current.avg)}% (${current.count} اختبار)</b>
        </div>
        <div class="payment-row evaluation-row evaluation-total-row" style="border-top:2px solid var(--line);margin-top:10px;padding-top:14px;">
          <span style="font-weight:800">التقييم النهائي للشهر</span>
          <b class="payment-paid" style="font-size:1.35rem;font-weight:800">${current.score}%</b>
        </div>

        <!-- شريط التوزيع البصري 50 : 50 -->
        <div style="margin-top:16px;">
          <small class="muted" style="display:block;margin-bottom:4px;font-weight:700">مكونات التقييم الشهري:</small>
          <div class="evaluation-breakdown-bar">
            <div class="breakdown-segment attendance" style="width:${Math.round(current.presence * 0.5)}%" title="نسبة الحضور 50%"></div>
            <div class="breakdown-segment exam" style="width:${Math.round(current.avg * 0.5)}%" title="نسبة الامتحان 50%"></div>
          </div>
          <div class="breakdown-legend">
            <span><i class="legend-dot teal"></i> الحضور: ${Math.round(current.presence * 0.5)} نقطة</span>
            <span><i class="legend-dot purple"></i> الامتحان: ${Math.round(current.avg * 0.5)} نقطة</span>
          </div>
        </div>
      </section>
    </div>
  `;

  // تفعيل أزرار الشهور
  content.querySelectorAll('.month-pill-btn').forEach(b => {
    b.onclick = () => render(b.dataset.month);
  });

  // زر مسح كارت آخر
  const switchBtn = document.querySelector('#switchStudentBtn');
  if (switchBtn) {
    switchBtn.onclick = () => {
      localStorage.removeItem('remembered_student_code');
      content.classList.add('hidden');
      scannerSection.classList.remove('hidden');
      startCamera();
    };
  }
}

async function loadStudent(code) {
  if (!code) return;

  // استخراج الكود في حال كان رابطاً أو كود مباشر
  try {
    const url = new URL(code);
    code = url.searchParams.get('code') || code;
  } catch {}
  code = code.trim();

  hideError();
  content.className = 'card spaced';
  content.innerHTML = '<p class="hint text-center" style="padding:30px">جارٍ تحميل بيانات الطالب والداشبورد وحالة الاشتراكات...</p>';
  content.classList.remove('hidden');

  // جلب بيانات الطالب
  const { data: student, error } = await db.from('students').select('*').eq('student_id', code).maybeSingle();
  if (error || !student) {
    content.classList.add('hidden');
    showError('لم يتم العثور على طالب بهذا الكود. تأكد من وضوح كارت الـ QR.');
    scannerSection.classList.remove('hidden');
    return;
  }

  // حفظ الكود ليتذكره المتصفح
  localStorage.setItem('remembered_student_code', code);
  scannerSection.classList.add('hidden');

  // جلب كافة بيانات الطالب: الامتحانات، الحضور، إعدادات الحصص، المدفوعات، وملفات الـ PDF
  const currentMKey = monthKey(new Date());

  const [
    { data: exams },
    { data: attendance },
    { data: sessions },
    { data: payments },
    materialsList,
    allStudentsTop
  ] = await Promise.all([
    db.from('exam_results').select('*').eq('student_id', student.id).order('exam_date'),
    db.from('attendance').select('*').eq('student_id', student.id).order('created_at'),
    db.from('monthly_settings').select('*'),
    db.from('payments').select('*').eq('student_id', student.id).order('payment_month', { ascending: false }),
    window.ExamStore ? window.ExamStore.getAllExamMaterials(db) : Promise.resolve([]),
    db.from('exam_results').select('student_id, score, max_score').eq('month_key', currentMKey)
  ]);

  // حساب ترتيب الطالب إذا كان من العشرة الأوائل
  let topRank = null;
  if (allStudentsTop && allStudentsTop.length) {
    const scoreMap = {};
    allStudentsTop.forEach(x => {
      if (!scoreMap[x.student_id]) scoreMap[x.student_id] = [];
      scoreMap[x.student_id].push((Number(x.score) / Number(x.max_score)) * 100);
    });
    const sortedStudents = Object.entries(scoreMap)
      .map(([sId, arr]) => ({ sId, avg: arr.reduce((a, b) => a + b, 0) / arr.length }))
      .sort((a, b) => b.avg - a.avg);
    const rankIndex = sortedStudents.findIndex(s => s.sId === student.id);
    if (rankIndex >= 0 && rankIndex < 10) {
      topRank = rankIndex + 1;
    }
  }

  active = {
    student,
    exams: exams || [],
    attendance: attendance || [],
    sessions: sessions || [],
    payments: payments || [],
    examMaterials: materialsList || [],
    topRank
  };

  render(currentMKey);
}

async function startCamera() {
  hideError();
  scannerContainer.classList.remove('hidden');
  startScanBtn.classList.add('hidden');

  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode('reader');
  }

  try {
    await html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 230, height: 230 } },
      (decodedText) => {
        beep();
        stopCamera();
        loadStudent(decodedText);
      },
      () => {}
    );
  } catch (err) {
    showError('يرجى السماح للمتصفح باستخدام الكاميرا لمسح كارت الطالب.');
    stopCamera();
  }
}

async function stopCamera() {
  if (html5QrCode) {
    try {
      await html5QrCode.stop();
    } catch {}
  }
  scannerContainer.classList.add('hidden');
  startScanBtn.classList.remove('hidden');
}

window.addEventListener('DOMContentLoaded', () => {
  const codeParam = new URLSearchParams(location.search).get('code');
  const savedCode = localStorage.getItem('remembered_student_code');

  if (codeParam && sessionStorage.getItem('student_profile_access_granted') === '1') {
    sessionStorage.removeItem('student_profile_access_granted');
    loadStudent(codeParam);
  } else if (codeParam) {
    showError('لأمان بيانات الطلاب، يلزم إدخال الرقم السري للمشرف من لوحة الشرف أولاً.');
  } else if (savedCode) {
    loadStudent(savedCode);
  }

  startScanBtn.onclick = startCamera;
  stopScanBtn.onclick = stopCamera;
});
