import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap';
import '../styles/main.css';
import { renderNavbar } from '../components/navbar.js';
import { register } from '../services/auth.js';
import { clearAlerts, setLoading, showAlert } from '../utils/dom.js';

function friendlyError(error) {
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('already registered') || msg.includes('already been registered')) {
    return 'An account with this email already exists. Try logging in instead.';
  }
  if (msg.includes('password')) {
    return 'Password is too weak. Use at least 6 characters.';
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
            <h1 class="h4 mb-1">Create your account</h1>
            <p class="text-muted mb-4">Join Recipe Swap to share and save recipes.</p>
            <div id="alert-area"></div>
            <form id="register-form" novalidate>
              <div class="mb-3">
                <label for="display-name" class="form-label">Display name</label>
                <input type="text" class="form-control" id="display-name" autocomplete="nickname" required maxlength="60" />
                <div class="invalid-feedback">Choose a display name.</div>
              </div>
              <div class="mb-3">
                <label for="email" class="form-label">Email</label>
                <input type="email" class="form-control" id="email" autocomplete="email" required />
                <div class="invalid-feedback">Enter a valid email address.</div>
              </div>
              <div class="mb-3">
                <label for="password" class="form-label">Password</label>
                <input type="password" class="form-control" id="password" autocomplete="new-password" required minlength="6" />
                <div class="invalid-feedback">Password must be at least 6 characters.</div>
              </div>
              <div class="mb-4">
                <label for="confirm-password" class="form-label">Confirm password</label>
                <input type="password" class="form-control" id="confirm-password" autocomplete="new-password" required />
                <div class="invalid-feedback">Passwords do not match.</div>
              </div>
              <button type="submit" id="submit-btn" class="btn btn-recipe w-100">Create account</button>
            </form>
            <p class="text-center text-muted mt-3 mb-0">
              Already have an account? <a href="/login.html">Log in</a>
            </p>
          </div>
        </div>
      </div>
    </div>`;

  const form = document.getElementById('register-form');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirm-password');
  confirmInput.addEventListener('input', () => confirmInput.setCustomValidity(''));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlerts('#alert-area');

    if (passwordInput.value !== confirmInput.value) {
      confirmInput.setCustomValidity('Passwords do not match.');
    } else {
      confirmInput.setCustomValidity('');
    }
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }

    const btn = document.getElementById('submit-btn');
    setLoading(btn, true, 'Creating account...');
    const { data, error } = await register(
      document.getElementById('email').value.trim(),
      passwordInput.value,
      document.getElementById('display-name').value.trim()
    );
    setLoading(btn, false);

    if (error) {
      showAlert('#alert-area', friendlyError(error));
      return;
    }
    if (data?.session) {
      // Email confirmation disabled: the user is signed in already.
      window.location.replace('/index.html');
      return;
    }
    // Email confirmation enabled: no session is returned until confirmed.
    showAlert(
      '#alert-area',
      'Almost done! Check your email to confirm your account, then log in.',
      'success'
    );
    form.reset();
    form.classList.remove('was-validated');
  });
}

init();
