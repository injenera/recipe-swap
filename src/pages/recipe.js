import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap';
import '../styles/main.css';
import { renderNavbar } from '../components/navbar.js';
import { confirmDialog } from '../components/confirmModal.js';
import { renderStars } from '../components/stars.js';
import { getCurrentUser, isAdmin } from '../services/auth.js';
import { deleteRecipe, getRecipe, getRecipeStats } from '../services/recipes.js';
import { downloadFile, getPublicUrl } from '../services/storage.js';
import { escapeHtml, showAlert } from '../utils/dom.js';

let activePhotoIndex = 0;
let photos = [];
let recipeTitle = '';

function renderMessage(app, icon, message, showBack = true) {
  app.innerHTML = `
    <div class="row justify-content-center">
      <div class="col-md-8 col-lg-6">
        <div class="card">
          <div class="card-body text-center py-5">
            <i class="bi ${icon} display-4 text-accent"></i>
            <p class="mt-3 mb-3">${escapeHtml(message)}</p>
            ${showBack ? '<a href="/index.html" class="btn btn-recipe">Back to the feed</a>' : ''}
          </div>
        </div>
      </div>
    </div>`;
}

function renderCarousel() {
  if (!photos.length) {
    return '<div class="recipe-detail-placeholder"><i class="bi bi-image"></i><span>No photo yet</span></div>';
  }
  const multiple = photos.length > 1;
  return `
    <div id="photo-carousel" class="carousel slide" data-bs-ride="false">
      ${
        multiple
          ? `<div class="carousel-indicators">${photos
              .map(
                (_, i) =>
                  `<button type="button" data-bs-target="#photo-carousel" data-bs-slide-to="${i}"${
                    i === 0 ? ' class="active" aria-current="true"' : ''
                  } aria-label="Photo ${i + 1}"></button>`
              )
              .join('')}</div>`
          : ''
      }
      <div class="carousel-inner rounded">
        ${photos
          .map(
            (p, i) => `
            <div class="carousel-item${i === 0 ? ' active' : ''}">
              <img src="${escapeHtml(getPublicUrl('recipe-photos', p.storage_path))}"
                class="d-block w-100 recipe-detail-img" alt="${escapeHtml(recipeTitle)} photo ${i + 1}" />
            </div>`
          )
          .join('')}
      </div>
      ${
        multiple
          ? `<button class="carousel-control-prev" type="button" data-bs-target="#photo-carousel" data-bs-slide="prev">
              <span class="carousel-control-prev-icon" aria-hidden="true"></span>
              <span class="visually-hidden">Previous</span>
            </button>
            <button class="carousel-control-next" type="button" data-bs-target="#photo-carousel" data-bs-slide="next">
              <span class="carousel-control-next-icon" aria-hidden="true"></span>
              <span class="visually-hidden">Next</span>
            </button>`
          : ''
      }
    </div>`;
}

function renderRecipe(app, recipe, stats, canManage) {
  recipeTitle = recipe.title;
  const category = recipe.category;
  const author = recipe.author;
  const avatarUrl = author?.avatar_path ? getPublicUrl('avatars', author.avatar_path) : '';
  const totalMinutes = (recipe.prep_minutes || 0) + (recipe.cook_minutes || 0);
  const stat = stats.get(recipe.id) || { avg_rating: 0, rating_count: 0, comment_count: 0 };
  const ingredients = (recipe.ingredients || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const steps = (recipe.instructions || '').split('\n').map((s) => s.trim()).filter(Boolean);

  app.innerHTML = `
    <nav aria-label="breadcrumb" class="mb-3">
      <ol class="breadcrumb">
        <li class="breadcrumb-item"><a href="/index.html">Feed</a></li>
        <li class="breadcrumb-item active" aria-current="page">${escapeHtml(recipe.title)}</li>
      </ol>
    </nav>
    <div class="row g-4">
      <div class="col-lg-7">
        ${renderCarousel()}
        ${
          photos.length
            ? `<button type="button" id="download-photo-btn" class="btn btn-outline-secondary btn-sm mt-3">
                <i class="bi bi-download me-1"></i>Download photo
              </button>`
            : ''
        }
      </div>
      <div class="col-lg-5">
        <div class="card h-100">
          <div class="card-body p-4">
            <div class="d-flex flex-wrap gap-2 mb-3">
              ${
                category
                  ? `<span class="badge category-badge"><i class="bi ${escapeHtml(
                      category.icon || 'bi-bookmark'
                    )} me-1"></i>${escapeHtml(category.name)}</span>`
                  : ''
              }
              ${recipe.is_featured ? '<span class="badge featured-badge-inline"><i class="bi bi-award-fill me-1"></i>Featured</span>' : ''}
            </div>
            <h1 class="h3 mb-3">${escapeHtml(recipe.title)}</h1>
            <div class="d-flex align-items-center gap-2 mb-3">
              ${
                avatarUrl
                  ? `<img src="${escapeHtml(avatarUrl)}" class="author-avatar" alt="${escapeHtml(author?.display_name || 'Author')}" />`
                  : '<i class="bi bi-person-circle fs-3 text-accent"></i>'
              }
              <div>
                <div class="fw-semibold">${escapeHtml(author?.display_name || 'Unknown cook')}</div>
                <div class="text-muted small">${new Date(recipe.created_at).toLocaleDateString()}</div>
              </div>
            </div>
            <div class="mb-3">
              ${renderStars(stat.avg_rating, { showValue: true })}
              <span class="text-muted small ms-1">(${stat.rating_count} rating${stat.rating_count === 1 ? '' : 's'})</span>
            </div>
            <div class="d-flex flex-wrap gap-3 mb-3 text-muted small">
              ${recipe.prep_minutes != null ? `<span><i class="bi bi-hourglass-split me-1"></i>Prep ${recipe.prep_minutes} min</span>` : ''}
              ${recipe.cook_minutes != null ? `<span><i class="bi bi-fire me-1"></i>Cook ${recipe.cook_minutes} min</span>` : ''}
              ${totalMinutes > 0 ? `<span><i class="bi bi-clock me-1"></i>Total ${totalMinutes} min</span>` : ''}
              ${recipe.servings != null ? `<span><i class="bi bi-people me-1"></i>${recipe.servings} serving${recipe.servings === 1 ? '' : 's'}</span>` : ''}
            </div>
            ${recipe.description ? `<p class="text-muted">${escapeHtml(recipe.description)}</p>` : ''}
            ${
              canManage
                ? `<div class="d-flex gap-2 mt-4">
                    <a href="/recipe-edit.html?id=${encodeURIComponent(recipe.id)}" class="btn btn-recipe btn-sm">
                      <i class="bi bi-pencil me-1"></i>Edit
                    </a>
                    <button type="button" id="delete-recipe-btn" class="btn btn-outline-danger btn-sm">
                      <i class="bi bi-trash me-1"></i>Delete
                    </button>
                  </div>`
                : ''
            }
          </div>
        </div>
      </div>
    </div>
    <div class="row g-4 mt-1">
      <div class="col-lg-5">
        <div class="card h-100">
          <div class="card-body p-4">
            <h2 class="h5 mb-3"><i class="bi bi-basket me-2 text-accent"></i>Ingredients</h2>
            <ul class="list-unstyled ingredient-list mb-0">
              ${ingredients
                .map(
                  (ing, i) => `
                  <li class="form-check ingredient-item">
                    <input class="form-check-input" type="checkbox" id="ing-${i}" />
                    <label class="form-check-label" for="ing-${i}">${escapeHtml(ing)}</label>
                  </li>`
                )
                .join('')}
            </ul>
          </div>
        </div>
      </div>
      <div class="col-lg-7">
        <div class="card h-100">
          <div class="card-body p-4">
            <h2 class="h5 mb-3"><i class="bi bi-list-ol me-2 text-accent"></i>Instructions</h2>
            <ol class="instruction-list mb-0">
              ${steps.map((step) => `<li class="mb-2">${escapeHtml(step)}</li>`).join('')}
            </ol>
          </div>
        </div>
      </div>
    </div>
    <section id="community" class="mt-5">
      <h2 class="h5 mb-3"><i class="bi bi-chat-dots me-2 text-accent"></i>Community</h2>
      <div class="card">
        <div class="card-body text-center py-4 text-muted">
          Ratings, comments and favorites are coming soon.
        </div>
      </div>
    </section>`;
}

async function init() {
  await renderNavbar();
  const app = document.getElementById('app');
  const id = new URLSearchParams(window.location.search).get('id');

  if (!id) {
    renderMessage(app, 'bi-question-circle', 'No recipe was selected. Pick one from the feed.');
    return;
  }

  const { data: recipe, error } = await getRecipe(id);
  if (error) {
    renderMessage(app, 'bi-exclamation-triangle', `Could not load the recipe: ${error.message}`);
    return;
  }
  if (!recipe) {
    renderMessage(app, 'bi-question-circle', 'This recipe does not exist or was deleted.');
    return;
  }

  photos = [...(recipe.photos || [])].sort((a, b) => a.position - b.position);

  const [user, admin, statsResult] = await Promise.all([
    getCurrentUser(),
    isAdmin(),
    getRecipeStats([recipe.id]),
  ]);
  const canManage = Boolean(user && (recipe.author_id === user.id || admin));

  renderRecipe(app, recipe, statsResult.data, canManage);

  const carouselEl = document.getElementById('photo-carousel');
  if (carouselEl) {
    carouselEl.addEventListener('slid.bs.carousel', (event) => {
      activePhotoIndex = event.to;
    });
  }

  const downloadBtn = document.getElementById('download-photo-btn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', async () => {
      const photo = photos[activePhotoIndex];
      if (!photo) return;
      downloadBtn.disabled = true;
      const filename = photo.storage_path.split('/').pop();
      const { error: dlError } = await downloadFile('recipe-photos', photo.storage_path, filename);
      downloadBtn.disabled = false;
      if (dlError) {
        showAlert(app, `Could not download the photo: ${dlError.message}`);
        app.firstElementChild?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  const deleteBtn = document.getElementById('delete-recipe-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Delete recipe',
        body: `Permanently delete "${recipe.title}" and all its photos?`,
        confirmLabel: 'Delete recipe',
      });
      if (!ok) return;
      deleteBtn.disabled = true;
      const { error: delError } = await deleteRecipe(recipe.id);
      if (delError) {
        showAlert(app, `Could not delete the recipe: ${delError.message}`);
        deleteBtn.disabled = false;
        return;
      }
      window.location.href = '/index.html';
    });
  }
}

init();
