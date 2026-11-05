import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap';
import '../styles/main.css';
import { renderNavbar } from '../components/navbar.js';
import { renderPlaceholder } from '../utils/dom.js';

async function init() {
  await renderNavbar();
  renderPlaceholder(
    document.getElementById('app'),
    'Recipe Feed',
    'Browse and discover recipes shared by the community.',
    'bi-journal-richtext'
  );
}

init();
