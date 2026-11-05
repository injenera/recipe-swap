import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap';
import '../styles/main.css';
import { renderNavbar } from '../components/navbar.js';
import { renderPlaceholder } from '../utils/dom.js';
import { requireAdmin } from '../utils/guard.js';

async function init() {
  await renderNavbar();
  const user = await requireAdmin();
  if (!user) return;
  renderPlaceholder(
    document.getElementById('app'),
    'Admin Dashboard',
    'Manage users, roles, categories, and featured recipes from here.',
    'bi-shield-lock'
  );
}

init();
