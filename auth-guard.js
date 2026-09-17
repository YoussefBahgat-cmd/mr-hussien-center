/**
 * نظام حماية وأمان الصلاحيات - سنتر مستر حسين
 * يتحقق من صلاحيات الدخول لصفحات الإدارة ويمنع الطلاب تماماً من الوصول لها
 */

const AUTH_STORAGE_KEY = 'mrhussien_admin_token';
const AUTH_ROLE_KEY = 'mrhussien_user_role'; // 'admin' | 'student'
const DEFAULT_ADMIN_PIN = 'mac-ai-86'; // رمز أمان الإدارة السري

const AuthGuard = {
  // التحقق هل المشرف مسجل دخوله مسبقاً ومحفوظ في المتصفح
  isAdmin() {
    return localStorage.getItem(AUTH_STORAGE_KEY) === 'authenticated' ||
           sessionStorage.getItem(AUTH_STORAGE_KEY) === 'authenticated';
  },

  // حفظ جلسة الأدمن بشكل دائم في المتصفح حتى لا يطلب الرمز كل مرة
  loginAdmin(remember = true) {
    localStorage.setItem(AUTH_STORAGE_KEY, 'authenticated');
    localStorage.setItem(AUTH_ROLE_KEY, 'admin');
    sessionStorage.setItem(AUTH_STORAGE_KEY, 'authenticated');
    sessionStorage.setItem(AUTH_ROLE_KEY, 'admin');
  },

  // تسجيل خروج الأدمن وقفل صفحات الإدارة
  logoutAdmin() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.setItem(AUTH_ROLE_KEY, 'student');
    sessionStorage.setItem(AUTH_ROLE_KEY, 'student');
    location.href = 'student-portal.html';
  },

  // التحقق من رمز PIN السري
  checkPin(enteredPin) {
    const clean = String(enteredPin || '').trim();
    const savedPin = localStorage.getItem('mrhussien_admin_pin') || DEFAULT_ADMIN_PIN;
    return clean === savedPin.trim() || clean === DEFAULT_ADMIN_PIN;
  },

  // تغيير رمز PIN
  changePin(newPin) {
    if (!newPin || newPin.trim().length < 4) return false;
    localStorage.setItem('mrhussien_admin_pin', newPin.trim());
    return true;
  },

  // حماية صفحات الإدارة فوراً
  protectAdminPage() {
    if (this.isAdmin()) {
      return true; // المشرف مسجل دخوله ومحفوظ
    }

    // إيقاف عرض المحتوى فوراً لمنع تسريب أي بيانات
    document.documentElement.style.visibility = 'hidden';

    window.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.visibility = 'visible';
      this.showPinModal();
    });

    return false;
  },

  // عرض نافذة إدخال رمز الأمان السري (بدون إظهار الرمز في أي مكان)
  showPinModal() {
    const shell = document.querySelector('.shell');
    if (shell) shell.style.display = 'none';

    let modal = document.querySelector('#adminAuthModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'adminAuthModal';
      modal.className = 'auth-modal-backdrop';
      modal.innerHTML = `
        <div class="auth-card">
          <div class="auth-icon">🔒</div>
          <h2>منطقة المشرف - الإدارة فقط</h2>
          <p>هذه الشاشة مخصصة لإدارة السنتر فقط. يرجى إدخال رمز الأمان السري للمتابعة.</p>
          <form id="adminAuthForm" class="auth-form" onsubmit="return false;">
            <input type="password" id="adminPinInput" placeholder="أدخل رمز المشرف PIN" maxlength="20" autofocus autocomplete="current-password">
            <p id="authErrorMsg" class="auth-error hidden">رمز المشرف غير صحيح، يرجى المحاولة مرة أخرى.</p>
            <div class="auth-actions">
              <button type="submit" id="submitPinBtn" class="btn primary">🔓 دخول الإدارة وحفظ الجلسة</button>
              <a href="student-portal.html" class="btn outline">🎒 منصة الطالب</a>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);

      const form = modal.querySelector('#adminAuthForm');
      const input = modal.querySelector('#adminPinInput');
      const err = modal.querySelector('#authErrorMsg');

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (this.checkPin(input.value)) {
          this.loginAdmin(true);
          modal.remove();
          if (shell) shell.style.display = '';
          location.reload();
        } else {
          err.classList.remove('hidden');
          input.value = '';
          input.focus();
        }
      });
    }
  }
};

window.AuthGuard = AuthGuard;
