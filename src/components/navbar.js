import { getCurrentUser, isAdmin, logout } from '../services/auth.js';
import { escapeHtml } from '../utils/dom.js';

function currentPage() {
  const file = window.location.pathname.split('/').pop() || 'index.html';
  return file.replace(/\.html$/, '');
}

function navLink(href, label, page, active, icon) {
  const isActive = page === active;
  return `<li class="nav-item"><a class="nav-link${isActive ? ' active' : ''}"${
    isActive ? ' aria-current="page"' : ''
  } href="${href}"><i class="bi ${icon} me-1"></i>${escapeHtml(label)}</a></li>`;
}

export async function renderNavbar() {
  const container = document.getElementById('navbar');
  if (!container) return;

  const active = currentPage();

  let user = null;
  let admin = false;
  try {
    user = await getCurrentUser();
    admin = user ? await isAdmin() : false;
  } catch {
    user = null;
    admin = false;
  }

  let rightLinks = '';
  if (user) {
    rightLinks += navLink('/recipe-edit.html', 'New recipe', 'recipe-edit', active, 'bi-plus-circle');
    rightLinks += navLink('/profile.html', 'Profile', 'profile', active, 'bi-person');
    if (admin) {
      rightLinks += navLink('/admin.html', 'Admin', 'admin', active, 'bi-shield-lock');
    }
    rightLinks +=
      '<li class="nav-item"><button type="button" id="logout-btn" class="btn btn-outline-light btn-sm ms-lg-2 my-2 my-lg-0">' +
      '<i class="bi bi-box-arrow-right me-1"></i>Log out</button></li>';
  } else {
    rightLinks += navLink('/login.html', 'Login', 'login', active, 'bi-box-arrow-in-right');
    rightLinks += navLink('/register.html', 'Register', 'register', active, 'bi-person-plus');
  }

  container.innerHTML = `
    <nav class="navbar navbar-expand-lg navbar-recipe" data-bs-theme="dark">
      <div class="container">
        <a class="navbar-brand fw-semibold" href="/index.html"><i class="bi bi-egg-fried me-2"></i>Recipe Swap</a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNavbar"
          aria-controls="mainNavbar" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="mainNavbar">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0">
            ${navLink('/index.html', 'Home', 'index', active, 'bi-house')}
            ${navLink('/meal-plan.html', 'Meal Plan', 'meal-plan', active, 'bi-calendar-week')}
          </ul>
          <ul class="navbar-nav mb-2 mb-lg-0 align-items-lg-center">
            ${rightLinks}
          </ul>
        </div>
      </div>
    </nav>`;

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      logoutBtn.disabled = true;
      await logout();
      window.location.href = '/index.html';
    });
  }
}
