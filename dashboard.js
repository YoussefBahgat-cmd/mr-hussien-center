if (window.AuthGuard) {
  window.AuthGuard.protectAdminPage();
}

const db = supabase.createClient('https://aknhxrhlahusgfpiknau.supabase.co', 'sb_publishable_BFsu6iC-nWsKfdKQgoXimQ_dNmbgxTj');
const paymentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const download = (rows, name, sheet) => {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  XLSX.writeFile(wb, name);
};

async function loadStats() {
  try {
    const [{ count: students }, { count: attendance }, { count: payments }] = await Promise.all([
      db.from('students').select('*', { count: 'exact', head: true }),
      db.from('attendance').select('*', { count: 'exact', head: true }),
      db.from('payments').select('*', { count: 'exact', head: true }).eq('payment_month', paymentMonth()).eq('status', 'مدفوع')
    ]);

    document.querySelector('#totalStudentsCount').textContent = students || 0;
    document.querySelector('#todayAttendanceCount').textContent = attendance || 0;
    document.querySelector('#paidStudentsCount').textContent = payments || 0;
  } catch (e) {
    console.error(e);
  }
}

async function attendance() {
  const { data, error } = await db.from('attendance').select('created_at,payment_status,students(student_id,student_name,student_group)');
  if (error) return alert(error.message);
  download(
    data.map(x => ({
      'كود الطالب': x.students?.student_id || '-',
      'الاسم': x.students?.student_name || '-',
      'المجموعة': x.students?.student_group || '-',
      'حالة الدفع': x.payment_status,
      'وقت الحضور': new Date(x.created_at).toLocaleTimeString('ar-EG')
    })),
    `حضور_اليوم_${new Date().toISOString().slice(0, 10)}.xlsx`,
    'حضور اليوم'
  );
}

async function payments() {
  const { data, error } = await db.from('payments').select('payment_month,status,paid_at,students(student_id,student_name,student_group)').eq('payment_month', paymentMonth());
  if (error) return alert(error.message);
  download(
    data.map(x => ({
      'كود الطالب': x.students?.student_id || '-',
      'الاسم': x.students?.student_name || '-',
      'المجموعة': x.students?.student_group || '-',
      'حالة الدفع': x.status,
      'تاريخ التسديد': x.paid_at ? new Date(x.paid_at).toLocaleDateString('ar-EG') : '-'
    })),
    `مدفوعات_الشهر_${paymentMonth()}.xlsx`,
    'المدفوعات'
  );
}

window.addEventListener('DOMContentLoaded', () => {
  loadStats();
  document.querySelector('#exportAttendanceBtn').onclick = attendance;
  document.querySelector('#exportPaymentsBtn').onclick = payments;
});

window.addEventListener('DOMContentLoaded', () => {
  const a = document.createElement('a');
  a.href = 'exam-results.html';
  a.className = 'btn outline';
  a.textContent = '📝 امتحانات الشهر ورصد الدرجات';
  const actionsEl = document.querySelector('.actions');
  if (actionsEl) actionsEl.append(a);
});
