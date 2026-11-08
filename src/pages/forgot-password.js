import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap';
import '../styles/main.css';
import { renderNavbar } from '../components/navbar.js';
import { resetPassword } from '../services/auth.js';
import { clearAlerts, setLoading, showAlert } from '../utils/dom.js';

async function init() {
  await renderNavbar();

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="row justify-content-center">
      <div class="col-md-7 col-lg-5">
        <div class="card">
          <div class="card-body p-4">
            <h1 class="h4 mb-1">Forgot your password?</h1>
            <p class="text-muted mb-4">Enter your email and we will send you a reset link.</p>
            <div id="alert-area"></div>
            <form id="reset-form" novalidate>
              <div class="mb-4">
                <label for="email" class="form-label">Email</label>
                <input type="email" class="form-control" id="email" autocomplete="email" required />
                <div class="invalid-feedback">Enter a valid email address.</div>
              </div>
              <button type="submit" id="submit-btn" class="btn btn-recipe w-100">Send reset link</button>
            </form>
            <p class="text-center text-muted mt-3 mb-0">
              Remembered it? <a href="/login.html">Back to log in</a>
            </p>
          </div>
        </div>
      </div>
    </div>`;

  const form = document.getElementById('reset-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlerts('#alert-area');
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }
    const btn = document.getElementById('submit-btn');
    setLoading(btn, true, 'Sending...');
    const { error } = await resetPassword(document.getElementById('email').value.trim());
    setLoading(btn, false);
    if (error) {
      showAlert('#alert-area', error.message);
      return;
    }
    showAlert('#alert-area', 'If that email is registered, a reset link is on its way. Check your inbox.', 'success');
    form.reset();
    form.classList.remove('was-validated');
  });
}

init();
