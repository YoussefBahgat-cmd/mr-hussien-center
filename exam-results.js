// حماية الصفحة للمشرف فقط
if (window.AuthGuard) {
  window.AuthGuard.protectAdminPage();
}

const db = supabase.createClient('https://aknhxrhlahusgfpiknau.supabase.co', 'sb_publishable_BFsu6iC-nWsKfdKQgoXimQ_dNmbgxTj');
const GROUPS = ['س ث 1:30','س ث 5','ح ع 12','ح ع 3','ث خ 1:30','ث خ 3','ث خ 5','ث خ 6:30'];

// عناصر قسم رفع ملفات الـ PDF
const pdfForm = document.querySelector('#uploadExamFilesForm');
const pdfMsg = document.querySelector('#pdfMessage');
const materialsTableBody = document.querySelector('#materialsTableBody');

// عناصر الربط بالامتحان
const linkedExamSelect = document.querySelector('#linkedExamSelect');
const linkedBadgeContainer = document.querySelector('#linkedBadgeContainer');
const linkedBadgeText = document.querySelector('#linkedBadgeText');

// عناصر التبديل بين الرصد الفردي والمجموعة
const tabSingleBtn = document.querySelector('#tabSingleModeBtn');
const tabGroupBtn = document.querySelector('#tabGroupModeBtn');
const singleContainer = document.querySelector('#singleGradingContainer');
const groupContainer = document.querySelector('#groupGradingContainer');

// عناصر الرصد الفردي
const gradeForm = document.querySelector('#studentGradeForm');
const studentSearch = document.querySelector('#studentSearch');
const studentsList = document.querySelector('#studentsList');
const selectedStudentId = document.querySelector('#selectedStudentId');
const gradeMsg = document.querySelector('#gradeMessage');

// عناصر رصد كشف المجموعة
const rosterGroupSelect = document.querySelector('#rosterGroupSelect');
const loadRosterBtn = document.querySelector('#loadRosterBtn');
const rosterTableWrapper = document.querySelector('#rosterTableWrapper');
const rosterTableBody = document.querySelector('#rosterTableBody');
const rosterMaxScoreLabel = document.querySelector('#rosterMaxScoreLabel');
const saveRosterBtn = document.querySelector('#saveRosterBtn');
const rosterMsg = document.querySelector('#rosterMessage');

// جدول أحدث الدرجات
const recentGradesTableBody = document.querySelector('#recentGradesTableBody');

let allStudents = [];
let allExamMaterials = [];

const monthKeyFromDate = (d) => `${d.slice(0, 7)}-01`;
const label = (m) => new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(new Date(`${m}T00:00:00`));

const showMsg = (el, text, isOk = false) => {
  el.textContent = text;
  el.className = `message ${isOk ? 'ok' : 'error'}`;
  el.classList.remove('hidden');
};

// ==========================================
// 1. إدارة ملفات الامتحانات (PDF غير محلول ومحلول)
// ==========================================

async function loadExamMaterials() {
  if (!window.ExamStore) return;
  try {
    allExamMaterials = await window.ExamStore.getAllExamMaterials(db);

    // تحديث جدول الملفات المعتمدة
    if (!allExamMaterials.length) {
      materialsTableBody.innerHTML = '<tr><td colspan="7" class="empty">لم يتم رفع أي امتحانات حتى الآن.</td></tr>';
    } else {
      materialsTableBody.innerHTML = allExamMaterials.map(item => `
        <tr>
          <td><b>${label(item.month_key)}</b></td>
          <td><b>${item.title || 'امتحان شامل'}</b></td>
          <td>${new Date(item.exam_date || item.updated_at).toLocaleDateString('ar-EG')}</td>
          <td>
            ${item.unsolved_url ? `
              <a href="${encodeURI(item.unsolved_url)}" target="_blank" class="btn outline tiny" download>
                📄 غير محلول PDF
              </a>
            ` : '<span class="muted">—</span>'}
          </td>
          <td>
            ${item.solved_url ? `
              <a href="${encodeURI(item.solved_url)}" target="_blank" class="btn success tiny" download>
                📝 محلول PDF
              </a>
            ` : '<span class="muted">—</span>'}
          </td>
          <td>
            <button class="btn primary tiny link-to-grade-btn" data-month="${item.month_key}" data-title="${item.title}">
              📝 رصد درجات هذا الامتحان
            </button>
          </td>
          <td>
            <button class="btn danger tiny delete-material-btn" data-month="${item.month_key}" data-title="${item.title}">
              🗑️
            </button>
          </td>
        </tr>
      `).join('');

      materialsTableBody.querySelectorAll('.delete-material-btn').forEach(btn => {
        btn.onclick = async () => {
          if (!confirm(`هل أنت متأكد من حذف ملفات "${btn.dataset.title}"؟`)) return;
          await window.ExamStore.deleteExamMaterials(db, btn.dataset.month, btn.dataset.title);
          await loadExamMaterials();
          showMsg(pdfMsg, 'تم حذف ملفات الامتحان بنجاح ✅', true);
        };
      });

      materialsTableBody.querySelectorAll('.link-to-grade-btn').forEach(btn => {
        btn.onclick = () => {
          selectExamForGrading(btn.dataset.month, btn.dataset.title);
          document.querySelector('#gradingSection').scrollIntoView({ behavior: 'smooth' });
        };
      });
    }

    // تحديث قائمة اختيار الامتحان للرصد
    updateLinkedExamDropdown();
  } catch (err) {
    console.error(err);
    materialsTableBody.innerHTML = `<tr><td colspan="7" class="empty">خطأ في جلب الملفات: ${err.message}</td></tr>`;
  }
}

function updateLinkedExamDropdown() {
  const options = allExamMaterials.map(item => `
    <option value="${item.month_key}:::${item.title}">
      ${item.title} — شهر (${label(item.month_key)}) — العظمى: ${item.max_score || 100} درجة
    </option>
  `).join('');

  linkedExamSelect.innerHTML = '<option value="">-- اختر من الامتحانات المرفوعة أعلاه (لتعبئة البيانات تلقائياً) --</option>' + options;
}

function selectExamForGrading(mKey, title) {
  const found = allExamMaterials.find(x => x.month_key === mKey && x.title === title);
  if (!found) return;

  linkedExamSelect.value = `${found.month_key}:::${found.title}`;
  applyLinkedExam(found);
}

function applyLinkedExam(exam) {
  if (!exam) {
    linkedBadgeContainer.classList.add('hidden');
    return;
  }

  // تعبئة نموذج الرصد الفردي
  document.querySelector('#examTitle').value = exam.title || '';
  document.querySelector('#examDate').value = exam.exam_date || new Date().toISOString().slice(0, 10);
  document.querySelector('#examMaxScore').value = exam.max_score || 100;
  document.querySelector('#examType').value = 'monthly';

  // تحديث كشف المجموعة
  rosterMaxScoreLabel.textContent = exam.max_score || 100;

  // إظهار الشارة
  linkedBadgeText.textContent = `${exam.title} (${label(exam.month_key)})`;
  linkedBadgeContainer.classList.remove('hidden');
}

linkedExamSelect.addEventListener('change', () => {
  const val = linkedExamSelect.value;
  if (!val) {
    applyLinkedExam(null);
    return;
  }
  const [mKey, title] = val.split(':::');
  const found = allExamMaterials.find(x => x.month_key === mKey && x.title === title);
  applyLinkedExam(found);
});

pdfForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const monthVal = document.querySelector('#examMonthInput').value;
  const title = document.querySelector('#examGeneralTitle').value.trim();
  const examDate = document.querySelector('#examGeneralDate').value;
  const maxScore = Number(document.querySelector('#examGeneralMaxScore').value) || 100;
  const unsolvedFile = document.querySelector('#unsolvedPdfFile').files[0];
  const solvedFile = document.querySelector('#solvedPdfFile').files[0];

  if (!monthVal) return showMsg(pdfMsg, 'يرجى تحديد شهر الامتحان.');
  if (!unsolvedFile || !solvedFile) return showMsg(pdfMsg, 'يرجى اختيار نسختي الـ PDF (غير المحلولة والمحلولة).');

  const formattedMonthKey = `${monthVal}-01`;
  const submitBtn = document.querySelector('#savePdfBtn');

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = 'جارٍ رفع ملفات الـ PDF واعتمادها...';

    // 1. رفع نسخة الامتحان غير محلولة
    const unsolvedUrl = await window.ExamStore.uploadPdfFile(db, unsolvedFile, `${formattedMonthKey}/unsolved`);

    // 2. رفع نموذج الإجابة نسخة محلولة
    const solvedUrl = await window.ExamStore.uploadPdfFile(db, solvedFile, `${formattedMonthKey}/solved`);

    // 3. حفظ السجل المعتمد في السحابة
    await window.ExamStore.saveExamMaterials(db, {
      month_key: formattedMonthKey,
      title,
      exam_date: examDate,
      max_score: maxScore,
      unsolved_url: unsolvedUrl,
      solved_url: solvedUrl
    });

    pdfForm.reset();
    setDefaultDates();
    showMsg(pdfMsg, 'تم رفع نسختي الـ PDF بنجاح واعتمادها لجميع الطلاب! ✅ يمكنك الآن رصد درجات الطلاب أدناه.', true);
    await loadExamMaterials();

    // اختيار الامتحان تلقائياً للرصد
    selectExamForGrading(formattedMonthKey, title);
  } catch (err) {
    console.error(err);
    showMsg(pdfMsg, 'فشل رفع الملفات: ' + (err.message || 'يرجى التأكد من اتصال الإنترنت وحجم الملفات.'));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '📤 رفع واعتماد ملفات الامتحان لجميع الطلاب';
  }
});

// ==========================================
// 2. رصد درجات الطلاب (فردي أو كشف مجموعة)
// ==========================================

async function loadStudentsAndGrades() {
  try {
    const [{ data: stData }, { data: grData }] = await Promise.all([
      db.from('students').select('id, student_id, student_name, student_group').order('student_name'),
      db.from('exam_results').select('id, student_id, title, exam_date, score, max_score, students(student_id, student_name, student_group)').order('created_at', { ascending: false }).limit(30)
    ]);

    allStudents = stData || [];
    studentsList.innerHTML = allStudents.map(s => `<option value="${s.student_name} — ${s.student_id} (${s.student_group})"></option>`).join('');

    renderRecentGrades(grData || []);
  } catch (err) {
    console.error(err);
  }
}

function renderRecentGrades(grades) {
  if (!grades.length) {
    recentGradesTableBody.innerHTML = '<tr><td colspan="8" class="empty">لا توجد درجات مرصودة مؤخراً.</td></tr>';
    return;
  }

  recentGradesTableBody.innerHTML = grades.map(g => {
    const perc = Math.round((Number(g.score) / Number(g.max_score)) * 100);
    return `
      <tr>
        <td><b>${g.students?.student_id || '—'}</b></td>
        <td>${g.students?.student_name || '—'}</td>
        <td>${g.students?.student_group || '—'}</td>
        <td><b>${g.title}</b></td>
        <td>${new Date(g.exam_date).toLocaleDateString('ar-EG')}</td>
        <td><b>${g.score} / ${g.max_score}</b></td>
        <td><b>${perc}%</b></td>
        <td>
          <button class="btn danger tiny delete-grade-btn" data-id="${g.id}">
            حذف 🗑️
          </button>
        </td>
      </tr>
    `;
  }).join('');

  recentGradesTableBody.querySelectorAll('.delete-grade-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('هل تريد حذف هذه النتيجة؟')) return;
      const { error } = await db.from('exam_results').delete().eq('id', btn.dataset.id);
      if (error) return alert(error.message);
      showMsg(gradeMsg, 'تم حذف النتيجة بنجاح ✅', true);
      loadStudentsAndGrades();
    };
  });
}

// التبديل بين الرصد الفردي ورصد كشف المجموعة
tabSingleBtn.addEventListener('click', () => {
  tabSingleBtn.className = 'btn primary tiny';
  tabGroupBtn.className = 'btn outline tiny';
  singleContainer.classList.remove('hidden');
  groupContainer.classList.add('hidden');
});

tabGroupBtn.addEventListener('click', () => {
  tabGroupBtn.className = 'btn primary tiny';
  tabSingleBtn.className = 'btn outline tiny';
  groupContainer.classList.remove('hidden');
  singleContainer.classList.add('hidden');
});

// البحث عن الطالب في الرصد الفردي
function resolveSelectedStudent() {
  const value = studentSearch.value.trim();
  const s = allStudents.find(x =>
    value === x.student_id ||
    value.includes(x.student_id) ||
    value === x.student_name ||
    value.startsWith(x.student_name)
  );
  selectedStudentId.value = s?.id || '';
  return s;
}

gradeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const student = resolveSelectedStudent();
  if (!student) {
    return showMsg(gradeMsg, 'يرجى اختيار طالب صحيح من القائمة.');
  }

  const title = document.querySelector('#examTitle').value.trim();
  const date = document.querySelector('#examDate').value;
  const score = Number(document.querySelector('#examScore').value);
  const maxScore = Number(document.querySelector('#examMaxScore').value) || 100;
  const examType = document.querySelector('#examType').value;
  const mKey = monthKeyFromDate(date);

  const saveBtn = document.querySelector('#saveGradeBtn');

  try {
    saveBtn.disabled = true;
    saveBtn.textContent = 'جارٍ الحفظ...';

    const { error } = await db.from('exam_results').insert({
      student_id: student.id,
      exam_date: date,
      month_key: mKey,
      exam_type: examType,
      title,
      score,
      max_score: maxScore
    });

    if (error) throw error;

    document.querySelector('#examScore').value = '';
    studentSearch.value = '';
    selectedStudentId.value = '';
    studentSearch.focus();

    showMsg(gradeMsg, `تم رصد وحفظ درجة الطالب (${student.student_name}) بنجاح في امتحان (${title})! ✅`, true);
    await loadStudentsAndGrades();
  } catch (err) {
    showMsg(gradeMsg, 'فشل حفظ الدرجة: ' + (err.message || 'حدث خطأ'));
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 حفظ درجة الطالب';
  }
});

studentSearch.addEventListener('input', resolveSelectedStudent);
studentSearch.addEventListener('change', resolveSelectedStudent);

// ==========================================
// 3. رصد كشف المجموعة كاملة (دفعة واحدة)
// ==========================================

loadRosterBtn.addEventListener('click', async () => {
  const selectedGroup = rosterGroupSelect.value;
  if (!selectedGroup) {
    return alert('يرجى اختيار المجموعة أولاً.');
  }

  const groupStudents = allStudents.filter(s => s.student_group === selectedGroup);
  if (!groupStudents.length) {
    return alert(`لا يوجد طلاب مسجلين في مجموعة (${selectedGroup}).`);
  }

  const currentTitle = document.querySelector('#examTitle').value.trim() || 'امتحان شامل';
  const currentDate = document.querySelector('#examDate').value || new Date().toISOString().slice(0, 10);
  const mKey = monthKeyFromDate(currentDate);

  // جلب الدرجات المسجلة مسبقاً لهذا الامتحان لهذه المجموعة إن وجدت
  const { data: existingGrades } = await db.from('exam_results')
    .select('student_id, score')
    .eq('month_key', mKey)
    .eq('title', currentTitle);

  const gradeMap = {};
  if (existingGrades) {
    existingGrades.forEach(g => { gradeMap[g.student_id] = g.score; });
  }

  rosterTableBody.innerHTML = groupStudents.map(s => {
    const existingScore = gradeMap[s.id] !== undefined ? gradeMap[s.id] : '';
    return `
      <tr>
        <td><b>${s.student_id}</b></td>
        <td><strong>${s.student_name}</strong></td>
        <td>
          <input type="number" step="0.25" min="0" class="roster-score-input"
                 data-student-id="${s.id}" data-student-name="${s.student_name}"
                 value="${existingScore}" placeholder="الدرجة">
        </td>
        <td>
          ${existingScore !== '' ? '<span class="badge" style="background:#e0f2fe;color:#0369a1;">مرصود سابقاً</span>' : '<span class="muted">جديد</span>'}
        </td>
      </tr>
    `;
  }).join('');

  rosterTableWrapper.classList.remove('hidden');
  showMsg(rosterMsg, `تم تحميل كشف طلاب مجموعة (${selectedGroup}) - إجمالي: ${groupStudents.length} طالب. أدخل الدرجات ثم اضغط حفظ بالأسفل.`, true);
});

saveRosterBtn.addEventListener('click', async () => {
  const inputs = Array.from(rosterTableBody.querySelectorAll('.roster-score-input'));
  const filledInputs = inputs.filter(inp => inp.value.trim() !== '');

  if (!filledInputs.length) {
    return alert('لم يتم إدخال أي درجات لحفظها.');
  }

  const title = document.querySelector('#examTitle').value.trim() || 'امتحان شامل';
  const date = document.querySelector('#examDate').value || new Date().toISOString().slice(0, 10);
  const maxScore = Number(document.querySelector('#examMaxScore').value) || 100;
  const examType = document.querySelector('#examType').value || 'monthly';
  const mKey = monthKeyFromDate(date);

  saveRosterBtn.disabled = true;
  saveRosterBtn.textContent = `جارٍ حفظ درجات ${filledInputs.length} طالب...`;

  try {
    const records = filledInputs.map(inp => ({
      student_id: inp.dataset.studentId,
      exam_date: date,
      month_key: mKey,
      exam_type: examType,
      title,
      score: Number(inp.value),
      max_score: maxScore
    }));

    const { error } = await db.from('exam_results').insert(records);
    if (error) throw error;

    showMsg(rosterMsg, `تم حفظ درجات كشف المجموعة (${filledInputs.length} طالب) بنجاح في امتحان (${title})! ✅`, true);
    await loadStudentsAndGrades();
  } catch (err) {
    showMsg(rosterMsg, 'فشل حفظ درجات الكشف: ' + err.message);
  } finally {
    saveRosterBtn.disabled = false;
    saveRosterBtn.textContent = '💾 حفظ درجات كشف المجموعة بالكامل';
  }
});

function setDefaultDates() {
  const now = new Date();
  const curIso = now.toISOString().slice(0, 10);
  const curMonth = curIso.slice(0, 7);

  const mInput = document.querySelector('#examMonthInput');
  if (mInput && !mInput.value) mInput.value = curMonth;

  const gDate = document.querySelector('#examGeneralDate');
  if (gDate && !gDate.value) gDate.value = curIso;

  const eDate = document.querySelector('#examDate');
  if (eDate && !eDate.value) eDate.value = curIso;

  // تعبئة مجموعات السنتر في كشف المجموعة
  if (rosterGroupSelect) {
    rosterGroupSelect.innerHTML = '<option value="">-- اختر المجموعة --</option>' +
      GROUPS.map(g => `<option value="${g}">${g}</option>`).join('');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  setDefaultDates();
  loadExamMaterials();
  loadStudentsAndGrades();
});
