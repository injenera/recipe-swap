import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap';
import '../styles/main.css';
import { renderNavbar } from '../components/navbar.js';
import { getCurrentUser, login } from '../services/auth.js';
import { clearAlerts, setLoading, showAlert } from '../utils/dom.js';

const params = new URLSearchParams(window.location.search);
const requested = params.get('redirect');
const redirectTarget = requested && requested.startsWith('/') && !requested.startsWith('//') ? requested : '/index.html';

function friendlyError(error) {
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
    return 'Incorrect email or password.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Please confirm your email address before logging in.';
  }
  return error?.message || 'Something went wrong. Please try again.';
}

async function init() {
  await renderNavbar();

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="row justify-content-center">
      <div class="col-md-7 col-lg-5">
        <div class="card">
          <div class="card-body p-4">
            <h1 class="h4 mb-1">Welcome back</h1>
            <p class="text-muted mb-4">Log in to share recipes and plan your meals.</p>
            <div id="alert-area"></div>
            <form id="login-form" novalidate>
              <div class="mb-3">
                <label for="email" class="form-label">Email</label>
                <input type="email" class="form-control" id="email" autocomplete="email" required />
                <div class="invalid-feedback">Enter a valid email address.</div>
              </div>
              <div class="mb-4">
                <label for="password" class="form-label">Password</label>
                <input type="password" class="form-control" id="password" autocomplete="current-password" required minlength="6" />
                <div class="invalid-feedback">Enter your password (at least 6 characters).</div>
              </div>
              <button type="submit" id="submit-btn" class="btn btn-recipe w-100">Log in</button>
            </form>
            <p class="text-center text-muted mt-3 mb-0">
              New here? <a href="/register.html">Create an account</a>
            </p>
          </div>
        </div>
      </div>
    </div>`;

  // Already logged in? Skip the form.
  const existing = await getCurrentUser();
  if (existing) {
    window.location.replace(redirectTarget);
    return;
  }

  const form = document.getElementById('login-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlerts('#alert-area');
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }
    const btn = document.getElementById('submit-btn');
    setLoading(btn, true, 'Logging in...');
    const { error } = await login(
      document.getElementById('email').value.trim(),
      document.getElementById('password').value
    );
    setLoading(btn, false);
    if (error) {
      showAlert('#alert-area', friendlyError(error));
      return;
    }
    window.location.replace(redirectTarget);
  });
}

init();
