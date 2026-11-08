import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap';
import '../styles/main.css';
import { renderNavbar } from '../components/navbar.js';
import { onAuthChange, updatePassword } from '../services/auth.js';
import { supabase } from '../services/supabase.js';
import { clearAlerts, setLoading, showAlert } from '../utils/dom.js';

async function init() {
  await renderNavbar();

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="row justify-content-center">
      <div class="col-md-7 col-lg-5">
        <div class="card">
          <div class="card-body p-4" id="card-body">
            <h1 class="h4 mb-1">Set a new password</h1>
            <p class="text-muted mb-4" id="status-msg"><i class="spinner-border spinner-border-sm me-1"></i>Checking your reset link...</p>
            <div id="alert-area"></div>
            <form id="password-form" class="d-none" novalidate>
              <div class="mb-3">
                <label for="new-password" class="form-label">New password</label>
                <input type="password" class="form-control" id="new-password" autocomplete="new-password" required minlength="6" />
                <div class="invalid-feedback">Password must be at least 6 characters.</div>
              </div>
              <div class="mb-4">
                <label for="confirm-password" class="form-label">Confirm password</label>
                <input type="password" class="form-control" id="confirm-password" autocomplete="new-password" required />
                <div class="invalid-feedback">Passwords do not match.</div>
              </div>
              <button type="submit" id="submit-btn" class="btn btn-recipe w-100">Save password</button>
            </form>
          </div>
        </div>
      </div>
    </div>`;

  const statusMsg = document.getElementById('status-msg');
  const form = document.getElementById('password-form');

  // Supabase delivers a PASSWORD_RECOVERY event (or a session in the URL
  // fragment) when arriving from the reset email link.
  let ready = false;
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) {
    ready = true;
  } else {
    await new Promise((resolve) => {
      const sub = onAuthChange((user, event) => {
        if (event === 'PASSWORD_RECOVERY' || user) {
          ready = true;
          sub.unsubscribe();
          resolve();
        }
      });
      setTimeout(() => {
        sub.unsubscribe();
        resolve();
      }, 5000);
    });
  }

  if (!ready) {
    statusMsg.innerHTML =
      '<i class="bi bi-exclamation-triangle me-1"></i>This reset link is invalid or has expired.';
    const hint = document.createElement('p');
    hint.className = 'text-muted small mb-0';
    hint.innerHTML = 'Request a new one on the <a href="/forgot-password.html">forgot password</a> page.';
    document.getElementById('card-body').appendChild(hint);
    return;
  }

  statusMsg.textContent = 'Choose a new password for your account.';
  form.classList.remove('d-none');

  const newInput = document.getElementById('new-password');
  const confirmInput = document.getElementById('confirm-password');
  confirmInput.addEventListener('input', () => confirmInput.setCustomValidity(''));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlerts('#alert-area');
    if (newInput.value !== confirmInput.value) {
      confirmInput.setCustomValidity('Passwords do not match.');
    } else {
      confirmInput.setCustomValidity('');
    }
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }
    const btn = document.getElementById('submit-btn');
    setLoading(btn, true, 'Saving...');
    const { error } = await updatePassword(newInput.value);
    setLoading(btn, false);
    if (error) {
      showAlert('#alert-area', error.message);
      return;
    }
    statusMsg.innerHTML =
      '<i class="bi bi-check-circle text-success me-1"></i>Password updated! You are signed in.';
    form.classList.add('d-none');
    setTimeout(() => window.location.replace('/index.html'), 1500);
  });
}

init();
