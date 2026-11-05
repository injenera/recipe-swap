import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap';
import '../styles/main.css';
import { renderNavbar } from '../components/navbar.js';
import { renderRecipeCard } from '../components/recipeCard.js';
import { getCurrentUser } from '../services/auth.js';
import { listCategories } from '../services/categories.js';
import { getRecipeStats, listRecipes } from '../services/recipes.js';
import { escapeHtml, showAlert } from '../utils/dom.js';

const state = {
  search: '',
  categoryId: '',
  categories: [],
};

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  state.search = params.get('q') || '';
  state.categoryId = params.get('category') || '';
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.search) params.set('q', state.search);
  if (state.categoryId) params.set('category', state.categoryId);
  const qs = params.toString();
  window.history.replaceState(null, '', qs ? `/?${qs}` : '/');
}

const isFiltering = () => Boolean(state.search || state.categoryId);

function renderSkeleton(user) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <section class="feed-hero text-center">
      <h1 class="display-6 fw-bold mb-2">Find your next favorite dish</h1>
      <p class="lead text-muted mb-4">Share recipes, discover new flavors and plan your week with the community.</p>
      <a href="${user ? '/recipe-edit.html' : '/register.html'}" class="btn btn-recipe btn-lg">
        <i class="bi bi-plus-circle me-2"></i>Share a recipe
      </a>
    </section>
    <div class="row justify-content-center my-4">
      <div class="col-md-8 col-lg-6">
        <div class="input-group">
          <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
          <input type="search" id="search-input" class="form-control" placeholder="Search recipes..." value="${escapeHtml(state.search)}" />
        </div>
      </div>
    </div>
    <div id="category-pills" class="d-flex flex-wrap justify-content-center gap-2 mb-4"></div>
    <div id="alert-area"></div>
    <section id="featured-section" class="mb-5 d-none">
      <h2 class="h4 mb-3"><i class="bi bi-award-fill me-2 text-accent"></i>Featured recipes</h2>
      <div id="featured-row" class="row row-cols-1 row-cols-md-2 row-cols-lg-4 g-3"></div>
    </section>
    <section>
      <h2 class="h4 mb-3" id="feed-title">All recipes</h2>
      <div id="grid" class="row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 g-4"></div>
      <div id="feed-status" class="text-center py-5"></div>
    </section>`;
}

function renderCategoryPills() {
  const holder = document.getElementById('category-pills');
  const pill = (id, icon, label) => `
    <button type="button" class="btn btn-sm filter-pill ${id === state.categoryId ? 'active' : ''}" data-category="${escapeHtml(id)}">
      ${icon ? `<i class="bi ${escapeHtml(icon)} me-1"></i>` : ''}${escapeHtml(label)}
    </button>`;
  holder.innerHTML =
    pill('', '', 'All') +
    state.categories.map((c) => pill(String(c.id), c.icon, c.name)).join('');
  holder.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.categoryId = btn.dataset.category;
      syncUrl();
      renderCategoryPills();
      loadFeed();
    });
  });
}

function setFeedLoading() {
  document.getElementById('feed-status').innerHTML =
    '<div class="spinner-border text-accent" role="status"><span class="visually-hidden">Loading...</span></div>';
  document.getElementById('grid').innerHTML = '';
}

async function loadFeatured() {
  const section = document.getElementById('featured-section');
  if (isFiltering()) {
    section.classList.add('d-none');
    return;
  }
  const { data, error } = await listRecipes({ featuredOnly: true, limit: 8 });
  if (error || !data.length) {
    section.classList.add('d-none');
    return;
  }
  const { data: stats } = await getRecipeStats(data.map((r) => r.id));
  document.getElementById('featured-row').innerHTML = data
    .map((r) => renderRecipeCard(r, stats))
    .join('');
  section.classList.remove('d-none');
}

async function loadFeed() {
  setFeedLoading();
  const { data, error } = await listRecipes({
    search: state.search,
    categoryId: state.categoryId || undefined,
  });
  const grid = document.getElementById('grid');
  const status = document.getElementById('feed-status');
  const title = document.getElementById('feed-title');

  if (error) {
    status.innerHTML = '';
    showAlert('#alert-area', `Could not load recipes: ${error.message}`);
    return;
  }

  title.textContent = isFiltering() ? 'Search results' : 'All recipes';
  if (!data.length) {
    grid.innerHTML = '';
    status.innerHTML = `
      <div class="py-5">
        <i class="bi ${isFiltering() ? 'bi-search' : 'bi-journal-plus'} display-4 text-accent"></i>
        <p class="mt-3 mb-0 text-muted">${isFiltering() ? 'No recipes match your search.' : 'No recipes yet. Be the first to share one!'}</p>
      </div>`;
    return;
  }

  const { data: stats } = await getRecipeStats(data.map((r) => r.id));
  grid.innerHTML = data.map((r) => renderRecipeCard(r, stats)).join('');
  status.innerHTML = '';
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

async function init() {
  readUrlState();
  const nav = renderNavbar();
  const user = await getCurrentUser();
  await nav;

  renderSkeleton(user);

  const searchInput = document.getElementById('search-input');
  const onSearch = debounce(() => {
    state.search = searchInput.value.trim();
    syncUrl();
    loadFeatured();
    loadFeed();
  }, 300);
  searchInput.addEventListener('input', onSearch);

  const { data: categories } = await listCategories();
  state.categories = categories;
  renderCategoryPills();

  await Promise.all([loadFeatured(), loadFeed()]);
}

init();
