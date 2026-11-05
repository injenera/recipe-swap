import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap';
import '../styles/main.css';
import { renderNavbar } from '../components/navbar.js';
import { renderPlaceholder } from '../utils/dom.js';
import { requireAuth } from '../utils/guard.js';

async function init() {
  await renderNavbar();
  const user = await requireAuth();
  if (!user) return;
  const name = user.user_metadata?.display_name || user.email;
  renderPlaceholder(
    document.getElementById('app'),
    'My Profile',
    `Signed in as ${name}. Your recipes, favorites, and profile settings will appear here.`,
    'bi-person-circle'
  );
}

init();
