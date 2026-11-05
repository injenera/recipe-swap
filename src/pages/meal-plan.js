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
  renderPlaceholder(
    document.getElementById('app'),
    'Meal Plan',
    'Plan your week by adding saved recipes to each day.',
    'bi-calendar-week'
  );
}

init();
