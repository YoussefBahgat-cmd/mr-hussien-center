/**
 * شريط التنقل الموحد والقائمة الجانبية (Header Bar & Sidebar Navigation)
 * سنتر مستر حسين
 */

(function () {
  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';

  const ALL_PAGES = [
    { title: 'لوحة التحكم', href: 'dashboard.html', icon: '📊', adminOnly: true },
    { title: 'تسجيل الحضور', href: 'index.html', icon: '📷', adminOnly: true },
    { title: 'الطلاب', href: 'students.html', icon: '👥', adminOnly: true },
    { title: 'تعديل طالب', href: 'edit_student.html', icon: '✏️', adminOnly: true },
    { title: 'امتحانات الشهر ورصد الدرجات', href: 'exam-results.html', icon: '📝', adminOnly: true },
    { title: 'منصة الطالب', href: 'student-portal.html', icon: '🎒', adminOnly: false },
    { title: 'لوحة الشرف', href: 'top-students.html', icon: '🏆', adminOnly: false }
  ];

  function renderNavigation() {
    const headerEl = document.querySelector('header.topbar');
    if (!headerEl) return;

    const isAdmin = window.AuthGuard ? window.AuthGuard.isAdmin() : false;

    // Head bar links (حسب طلب المستخدم: لوحة التحكم , تسجيل الحضور , تعديل الطلاب , الطلاب)
    // وفي حال كان طالباً تقتصر على منصة الطالب ولوحة الشرف لحمايته
    let headbarLinks = '';
    if (isAdmin) {
      headbarLinks = `
        <a href="dashboard.html" class="${currentPage === 'dashboard.html' ? 'active' : ''}">لوحة التحكم</a>
        <a href="index.html" class="${currentPage === 'index.html' ? 'active' : ''}">تسجيل الحضور</a>
        <a href="edit_student.html" class="${currentPage === 'edit_student.html' ? 'active' : ''}">تعديل الطلاب</a>
        <a href="students.html" class="${currentPage === 'students.html' ? 'active' : ''}">الطلاب</a>
      `;
    } else {
      headbarLinks = `
        <a href="student-portal.html" class="${currentPage === 'student-portal.html' ? 'active' : ''}">🎒 منصة الطالب</a>
        <a href="top-students.html" class="${currentPage === 'top-students.html' ? 'active' : ''}">🏆 لوحة الشرف</a>
      `;
    }

    headerEl.innerHTML = `
      <div class="wrap brand-row">
        <div class="brand-group">
          <button id="sidebarToggleBtn" class="sidebar-toggle-btn" aria-label="فتح القائمة الجانبية" title="كل الصفحات">
            <span class="hamburger-bar"></span>
            <span class="hamburger-bar"></span>
            <span class="hamburger-bar"></span>
          </button>
          <a class="brand" href="${isAdmin ? 'dashboard.html' : 'student-portal.html'}">
            <span class="brand-mark">⚛️</span>
            <div>
              <span class="brand-text">سنتر مستر حسين</span>
              <small style="display:block;font-size:0.7rem;color:#64748b;font-weight:600;margin-top:-3px;">فيزياء الثانوية العامة</small>
            </div>
          </a>
        </div>
        <nav class="nav headbar-nav">
          ${headbarLinks}
        </nav>
        <div class="header-tools">
          ${isAdmin ? `
            <button id="logoutAdminBtn" class="btn danger tiny" title="قفل الإدارة">
              🔒 خروج المشرف
            </button>
          ` : `
            <button id="adminLoginBtn" class="btn outline tiny" title="دخول المشرف">
              🔑 دخول المشرف
            </button>
          `}
        </div>
      </div>
    `;

    // بناء القائمة الجانبية (Sidebar Drawer) وخلفيتها (Backdrop)
    let sidebar = document.querySelector('#appSidebar');
    let backdrop = document.querySelector('#sidebarBackdrop');

    if (!sidebar) {
      sidebar = document.createElement('aside');
      sidebar.id = 'appSidebar';
      sidebar.className = 'sidebar-drawer';
      document.body.appendChild(sidebar);
    }

    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'sidebarBackdrop';
      backdrop.className = 'sidebar-backdrop';
      document.body.appendChild(backdrop);
    }

    // بناء روابط السايدبار (جميع الصفحات)
    const visiblePages = isAdmin ? ALL_PAGES : ALL_PAGES.filter(p => !p.adminOnly);

    sidebar.innerHTML = `
      <div class="sidebar-header">
        <div class="sidebar-brand">
          <span class="brand-mark">⚛️</span>
          <div>
            <strong>سنتر مستر حسين</strong>
            <small>فيزياء الثانوية العامة • ${isAdmin ? 'لوحة المشرف والتحكم' : 'بوابة الطلاب والأوائل'}</small>
          </div>
        </div>
        <button id="sidebarCloseBtn" class="sidebar-close-btn" aria-label="إغلاق">✕</button>
      </div>
      <div class="sidebar-section-title">كل الصفحات والأقسام</div>
      <nav class="sidebar-nav">
        ${visiblePages.map(page => `
          <a href="${page.href}" class="sidebar-link ${currentPage === page.href ? 'active' : ''}">
            <span class="sidebar-icon">${page.icon}</span>
            <span class="sidebar-title">${page.title}</span>
            ${currentPage === page.href ? '<span class="sidebar-badge">الحالية</span>' : ''}
          </a>
        `).join('')}
      </nav>
      <div class="sidebar-footer" style="display:flex; flex-direction:column; gap:8px;">
        ${isAdmin ? `
          <button id="sidebarChangePinBtn" class="btn outline tiny w-full" style="justify-content:center;">
            ⚙️ تغيير رمز المشرف PIN
          </button>
          <button id="sidebarLogoutBtn" class="btn danger w-full">
            🔒 قفل وضع الإدارة
          </button>
        ` : `
          <button id="sidebarAdminBtn" class="btn primary w-full">
            🔑 تسجيل دخول المشرف
          </button>
        `}
      </div>
    `;

    // ربط الأحداث
    const openSidebar = () => {
      sidebar.classList.add('open');
      backdrop.classList.add('open');
      document.body.classList.add('sidebar-active');
    };

    const closeSidebar = () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('open');
      document.body.classList.remove('sidebar-active');
    };

    document.querySelectorAll('#sidebarToggleBtn, #sidebarQuickBtn').forEach(btn => {
      btn.addEventListener('click', openSidebar);
    });

    const closeBtn = sidebar.querySelector('#sidebarCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    backdrop.addEventListener('click', closeSidebar);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSidebar();
    });

    // أحداث تسجيل الدخول والخروج للمشرف
    const logoutBtn = document.querySelector('#logoutAdminBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => window.AuthGuard && window.AuthGuard.logoutAdmin());

    const sidebarLogout = sidebar.querySelector('#sidebarLogoutBtn');
    if (sidebarLogout) sidebarLogout.addEventListener('click', () => window.AuthGuard && window.AuthGuard.logoutAdmin());

    const changePinBtn = sidebar.querySelector('#sidebarChangePinBtn');
    if (changePinBtn) {
      changePinBtn.addEventListener('click', () => {
        const newPin = prompt('أدخل رمز المشرف الجديد (PIN):');
        if (newPin && newPin.trim().length >= 4) {
          window.AuthGuard.changePin(newPin);
          alert('تم تغيير رمز المشرف بنجاح ✅ الرمز الجديد: ' + newPin.trim());
        } else if (newPin !== null) {
          alert('يجب أن يتكون رمز المشرف من 4 أرقام أو حروف على الأقل.');
        }
      });
    }

    const adminLoginBtn = document.querySelector('#adminLoginBtn');
    if (adminLoginBtn) adminLoginBtn.addEventListener('click', () => window.AuthGuard && window.AuthGuard.showPinModal());

    const sidebarAdminBtn = sidebar.querySelector('#sidebarAdminBtn');
    if (sidebarAdminBtn) sidebarAdminBtn.addEventListener('click', () => {
      closeSidebar();
      window.AuthGuard && window.AuthGuard.showPinModal();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderNavigation);
  } else {
    renderNavigation();
  }
})();
