import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap';
import '../styles/main.css';
import { renderNavbar } from '../components/navbar.js';
import { renderPlaceholder } from '../utils/dom.js';

async function init() {
  await renderNavbar();
  const id = new URLSearchParams(window.location.search).get('id');
  renderPlaceholder(
    document.getElementById('app'),
    'Recipe Details',
    id ? `Full details for this recipe will be shown here.` : 'Select a recipe from the feed to see its details.',
    'bi-receipt'
  );
}

init();
