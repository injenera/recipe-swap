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
  const id = new URLSearchParams(window.location.search).get('id');
  renderPlaceholder(
    document.getElementById('app'),
    id ? 'Edit Recipe' : 'New Recipe',
    'The recipe editor with photo upload, ingredients, and steps will live here.',
    'bi-pencil-square'
  );
}

init();
