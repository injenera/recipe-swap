import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { Modal } from 'bootstrap';
import '../styles/main.css';
import { renderNavbar } from '../components/navbar.js';
import { confirmDialog } from '../components/confirmModal.js';
import { renderStars } from '../components/stars.js';
import { getCurrentUser, isAdmin } from '../services/auth.js';
import {
  addComment,
  addFavorite,
  addMealPlanEntry,
  deleteComment,
  deleteRating,
  getFavoriteIds,
  getMyRating,
  listComments,
  removeFavorite,
  setRating,
  updateComment,
} from '../services/engagement.js';
import { deleteRecipe, getRecipe, getRecipeStats } from '../services/recipes.js';
import { downloadFile, getPublicUrl } from '../services/storage.js';
import { formatCommentDate, todayISO } from '../utils/date.js';
import { escapeHtml, setLoading, showAlert } from '../utils/dom.js';

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', icon: 'bi-sunrise' },
  { value: 'lunch', label: 'Lunch', icon: 'bi-sun' },
  { value: 'dinner', label: 'Dinner', icon: 'bi-moon' },
  { value: 'snack', label: 'Snack', icon: 'bi-cookie' },
];

let activePhotoIndex = 0;
let photos = [];
let recipeTitle = '';
let recipe = null;
let currentUser = null;
let isAdminUser = false;
let statsMap = new Map();
let isFavorite = false;
let myRating = null;
let comments = [];
let editingCommentId = null;

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

function renderAvgRating() {
  const stat = statsMap.get(recipe.id) || { avg_rating: 0, rating_count: 0, comment_count: 0 };
  return `
    ${renderStars(stat.avg_rating, { showValue: true })}
    <span class="text-muted small ms-1">(${stat.rating_count} rating${stat.rating_count === 1 ? '' : 's'})</span>`;
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
            <div class="mb-3" id="avg-rating">${renderAvgRating()}</div>
            <div class="d-flex flex-wrap gap-3 mb-3 text-muted small">
              ${recipe.prep_minutes != null ? `<span><i class="bi bi-hourglass-split me-1"></i>Prep ${recipe.prep_minutes} min</span>` : ''}
              ${recipe.cook_minutes != null ? `<span><i class="bi bi-fire me-1"></i>Cook ${recipe.cook_minutes} min</span>` : ''}
              ${totalMinutes > 0 ? `<span><i class="bi bi-clock me-1"></i>Total ${totalMinutes} min</span>` : ''}
              ${recipe.servings != null ? `<span><i class="bi bi-people me-1"></i>${recipe.servings} serving${recipe.servings === 1 ? '' : 's'}</span>` : ''}
            </div>
            ${recipe.description ? `<p class="text-muted">${escapeHtml(recipe.description)}</p>` : ''}
            <div class="d-flex flex-wrap gap-2 mt-4">
              <button type="button" id="favorite-btn" class="btn btn-outline-danger btn-sm">
                <i class="bi ${isFavorite ? 'bi-heart-fill' : 'bi-heart'} me-1"></i>${isFavorite ? 'Saved' : 'Save'}
              </button>
              <button type="button" id="plan-meal-btn" class="btn btn-outline-secondary btn-sm">
                <i class="bi bi-calendar-plus me-1"></i>Plan this meal
              </button>
              ${
                canManage
                  ? `<a href="/recipe-edit.html?id=${encodeURIComponent(recipe.id)}" class="btn btn-recipe btn-sm">
                      <i class="bi bi-pencil me-1"></i>Edit
                    </a>
                    <button type="button" id="delete-recipe-btn" class="btn btn-outline-danger btn-sm">
                      <i class="bi bi-trash me-1"></i>Delete
                    </button>`
                  : ''
              }
            </div>
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
      <div class="card mb-4">
        <div class="card-body p-4">
          <h3 class="h6 mb-3"><i class="bi bi-star me-2 text-accent"></i>Rate this recipe</h3>
          <div class="d-flex flex-wrap align-items-center gap-3">
            <div id="rating-stars" class="stars rating-stars" role="group" aria-label="Your rating"></div>
            <div id="rating-meta" class="small">
              <span id="your-rating" class="text-muted">${myRating ? `Your rating: ${myRating}` : 'Tap a star to rate'}</span>
              ${
                myRating
                  ? '<button type="button" id="remove-rating-btn" class="btn btn-link btn-sm p-0 ms-2">Remove rating</button>'
                  : ''
              }
            </div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-body p-4">
          <h3 class="h6 mb-3">
            <i class="bi bi-chat-left-text me-2 text-accent"></i>Comments
            <span class="text-muted small" id="comment-count">(${stat.comment_count})</span>
          </h3>
          <div id="alert-area"></div>
          <div id="comments-list" class="mb-4"></div>
          ${
            currentUser
              ? `<form id="comment-form" class="mb-1">
                  <div class="mb-2">
                    <textarea class="form-control" id="comment-body" rows="3" maxlength="1000" required
                      placeholder="Share your thoughts on this recipe..."></textarea>
                    <div class="invalid-feedback">Comment must be 1-1000 characters.</div>
                  </div>
                  <button type="submit" id="comment-submit" class="btn btn-recipe btn-sm">
                    <i class="bi bi-send me-1"></i>Post comment
                  </button>
                </form>`
              : `<p class="text-muted mb-0"><a href="/login.html?redirect=${encodeURIComponent(
                  window.location.pathname + window.location.search
                )}">Log in</a> to join the conversation.</p>`
          }
        </div>
      </div>
    </section>`;
}

function starIcon(filled, half = false) {
  if (half) return 'bi-star-half';
  return filled ? 'bi-star-fill' : 'bi-star';
}

function renderRatingStars(hover = 0) {
  const holder = document.getElementById('rating-stars');
  if (!holder) return;
  const shown = hover || myRating || 0;
  holder.innerHTML = [1, 2, 3, 4, 5]
    .map(
      (n) => `
      <button type="button" class="rating-star" data-star="${n}" aria-label="Rate ${n} star${n === 1 ? '' : 's'}">
        <i class="bi ${starIcon(n <= shown)}"></i>
      </button>`
    )
    .join('');
  holder.querySelectorAll('.rating-star').forEach((btn) => {
    const n = Number(btn.dataset.star);
    btn.addEventListener('mouseenter', () => {
      holder.querySelectorAll('.rating-star i').forEach((icon, i) => {
        icon.className = `bi ${starIcon(i + 1 <= n)}`;
      });
    });
    btn.addEventListener('mouseleave', () => renderRatingStars());
    btn.addEventListener('click', () => handleRate(n));
  });
  const removeBtn = document.getElementById('remove-rating-btn');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => handleRemoveRating());
  }
}

function renderYourRating() {
  const el = document.getElementById('your-rating');
  if (el) {
    el.textContent = myRating ? `Your rating: ${myRating}` : 'Tap a star to rate';
  }
  const holder = document.getElementById('rating-meta');
  if (holder) {
    const existing = document.getElementById('remove-rating-btn');
    if (myRating && !existing) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'remove-rating-btn';
      btn.className = 'btn btn-link btn-sm p-0 ms-2';
      btn.textContent = 'Remove rating';
      btn.addEventListener('click', () => handleRemoveRating());
      holder.appendChild(btn);
    } else if (!myRating && existing) {
      existing.remove();
    }
  }
}

async function refreshStats() {
  const { data } = await getRecipeStats([recipe.id]);
  if (data) statsMap = data;
  const avgEl = document.getElementById('avg-rating');
  if (avgEl) avgEl.innerHTML = renderAvgRating();
}

async function handleRate(stars) {
  if (!currentUser) {
    window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    return;
  }
  if (myRating === stars) {
    await handleRemoveRating();
    return;
  }
  const prev = myRating;
  myRating = stars;
  renderRatingStars();
  renderYourRating();
  const { error } = await setRating(recipe.id, stars);
  if (error) {
    myRating = prev;
    renderRatingStars();
    renderYourRating();
    showAlert('#alert-area', `Could not save your rating: ${error.message}`);
    return;
  }
  await refreshStats();
}

async function handleRemoveRating() {
  if (!currentUser || !myRating) return;
  const prev = myRating;
  myRating = null;
  renderRatingStars();
  renderYourRating();
  const { error } = await deleteRating(recipe.id);
  if (error) {
    myRating = prev;
    renderRatingStars();
    renderYourRating();
    showAlert('#alert-area', `Could not remove your rating: ${error.message}`);
    return;
  }
  await refreshStats();
}

function updateFavoriteButton() {
  const btn = document.getElementById('favorite-btn');
  if (!btn) return;
  btn.innerHTML = `<i class="bi ${isFavorite ? 'bi-heart-fill' : 'bi-heart'} me-1"></i>${isFavorite ? 'Saved' : 'Save'}`;
  btn.classList.toggle('btn-outline-danger', !isFavorite);
  btn.classList.toggle('btn-danger', isFavorite);
}

async function handleFavorite() {
  if (!currentUser) {
    window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    return;
  }
  const btn = document.getElementById('favorite-btn');
  const prev = isFavorite;
  isFavorite = !isFavorite;
  updateFavoriteButton();
  if (btn) btn.disabled = true;
  const { error } = prev ? await removeFavorite(recipe.id) : await addFavorite(recipe.id);
  if (btn) btn.disabled = false;
  if (error) {
    isFavorite = prev;
    updateFavoriteButton();
    showAlert('#alert-area', `Could not update favorites: ${error.message}`);
    return;
  }
}

function buildPlanModal() {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="modal fade" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title h5">Plan this meal</h2>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <form id="plan-meal-form">
            <div class="modal-body">
              <div class="mb-3">
                <label for="plan-meal-type" class="form-label">Meal</label>
                <select class="form-select" id="plan-meal-type">
                  ${MEAL_TYPES.map((m) => `<option value="${m.value}">${m.label}</option>`).join('')}
                </select>
              </div>
              <div class="mb-3">
                <label for="plan-meal-date" class="form-label">Date</label>
                <input type="date" class="form-control" id="plan-meal-date" value="${todayISO()}" required />
                <div class="invalid-feedback">Pick a date.</div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-recipe" id="plan-meal-submit">Add to plan</button>
            </div>
          </form>
        </div>
      </div>
    </div>`;
  const modalEl = wrap.firstElementChild;
  document.body.appendChild(modalEl);
  const modal = new Modal(modalEl);
  const form = modalEl.querySelector('#plan-meal-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }
    const submit = modalEl.querySelector('#plan-meal-submit');
    setLoading(submit, true, 'Adding...');
    const { error } = await addMealPlanEntry(
      recipe.id,
      modalEl.querySelector('#plan-meal-date').value,
      modalEl.querySelector('#plan-meal-type').value
    );
    setLoading(submit, false);
    if (error) {
      showAlert('#alert-area', `Could not add to meal plan: ${error.message}`);
      modal.hide();
      return;
    }
    modal.hide();
    const alertArea = document.getElementById('alert-area');
    if (alertArea) {
      alertArea.innerHTML = `
        <div class="alert alert-success alert-dismissible fade show" role="alert">
          "${escapeHtml(recipe.title)}" was added to your meal plan.
          <a href="/meal-plan.html" class="alert-link">View meal plan</a>
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>`;
      alertArea.scrollIntoView({ behavior: 'smooth' });
    }
  });
  modalEl.addEventListener('hidden.bs.modal', () => {
    modal.dispose();
    modalEl.remove();
  });
  return modal;
}

function commentAvatar(comment) {
  const path = comment.author?.avatar_path;
  if (path) {
    return `<img src="${escapeHtml(getPublicUrl('avatars', path))}" class="comment-avatar" alt="" />`;
  }
  return '<i class="bi bi-person-circle comment-avatar-icon"></i>';
}

function renderComment(comment) {
  const mine = currentUser && comment.author_id === currentUser.id;
  const canDelete = mine || isAdminUser;
  const editing = editingCommentId === comment.id;
  const authorName = comment.author?.display_name || 'Unknown cook';
  return `
    <div class="comment-item mb-3" data-comment-id="${comment.id}">
      <div class="d-flex gap-2">
        ${commentAvatar(comment)}
        <div class="flex-grow-1">
          <div class="d-flex flex-wrap align-items-center gap-2">
            <span class="fw-semibold small">${escapeHtml(authorName)}</span>
            <span class="text-muted small">${escapeHtml(formatCommentDate(comment.created_at))}</span>
            ${
              comment.updated_at !== comment.created_at
                ? '<span class="text-muted small fst-italic">(edited)</span>'
                : ''
            }
          </div>
          ${
            editing
              ? `<div class="mt-1">
                  <textarea class="form-control form-control-sm" id="edit-comment-body" rows="2" maxlength="1000">${escapeHtml(
                    comment.body
                  )}</textarea>
                  <div class="d-flex gap-2 mt-1">
                    <button type="button" class="btn btn-recipe btn-sm" data-save-edit>Save</button>
                    <button type="button" class="btn btn-outline-secondary btn-sm" data-cancel-edit>Cancel</button>
                  </div>
                </div>`
              : `<p class="mb-1 small">${escapeHtml(comment.body)}</p>
                ${
                  mine || canDelete
                    ? `<div class="d-flex gap-3">
                        ${
                          mine
                            ? '<button type="button" class="btn btn-link btn-sm p-0" data-edit-comment>Edit</button>'
                            : ''
                        }
                        <button type="button" class="btn btn-link btn-sm p-0 text-danger" data-delete-comment>Delete</button>
                      </div>`
                    : ''
                }`
          }
        </div>
      </div>
    </div>`;
}

function renderComments() {
  const holder = document.getElementById('comments-list');
  if (!holder) return;
  if (!comments.length) {
    holder.innerHTML = '<p class="text-muted mb-0">No comments yet. Be the first to share your thoughts.</p>';
    return;
  }
  holder.innerHTML = comments.map(renderComment).join('');
  holder.querySelectorAll('[data-edit-comment]').forEach((btn) => {
    btn.addEventListener('click', () => {
      editingCommentId = btn.closest('[data-comment-id]').dataset.commentId;
      renderComments();
    });
  });
  holder.querySelectorAll('[data-cancel-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      editingCommentId = null;
      renderComments();
    });
  });
  holder.querySelectorAll('[data-save-edit]').forEach((btn) => {
    btn.addEventListener('click', () => handleUpdateComment(btn.closest('[data-comment-id]').dataset.commentId));
  });
  holder.querySelectorAll('[data-delete-comment]').forEach((btn) => {
    btn.addEventListener('click', () => handleDeleteComment(btn.closest('[data-comment-id]').dataset.commentId));
  });
}

async function refreshCommentCount() {
  await refreshStats();
  const countEl = document.getElementById('comment-count');
  const stat = statsMap.get(recipe.id) || { comment_count: 0 };
  if (countEl) countEl.textContent = `(${stat.comment_count})`;
}

async function loadComments() {
  const holder = document.getElementById('comments-list');
  if (!holder) return;
  holder.innerHTML = '<div class="text-muted small"><span class="spinner-border spinner-border-sm me-2"></span>Loading comments...</div>';
  const { data, error } = await listComments(recipe.id);
  if (error) {
    holder.innerHTML = '';
    showAlert('#alert-area', `Could not load comments: ${error.message}`);
    return;
  }
  comments = data;
  renderComments();
}

async function handleAddComment(event) {
  event.preventDefault();
  const form = document.getElementById('comment-form');
  const body = document.getElementById('comment-body').value.trim();
  if (!form.checkValidity() || !body) {
    form.classList.add('was-validated');
    return;
  }
  const submit = document.getElementById('comment-submit');
  setLoading(submit, true, 'Posting...');
  const { data, error } = await addComment(recipe.id, body);
  setLoading(submit, false);
  if (error) {
    showAlert('#alert-area', `Could not post the comment: ${error.message}`);
    return;
  }
  document.getElementById('comment-body').value = '';
  form.classList.remove('was-validated');
  comments = [...comments, { ...data, author: { id: currentUser.id, display_name: currentUser.user_metadata?.display_name || currentUser.email, avatar_path: null } }];
  renderComments();
  await refreshCommentCount();
}

async function handleUpdateComment(id) {
  const body = document.getElementById('edit-comment-body')?.value.trim() || '';
  if (!body || body.length > 1000) {
    showAlert('#alert-area', 'Comment must be 1-1000 characters.');
    return;
  }
  const { data, error } = await updateComment(id, body);
  if (error) {
    showAlert('#alert-area', `Could not update the comment: ${error.message}`);
    return;
  }
  editingCommentId = null;
  const index = comments.findIndex((c) => c.id === id);
  if (index !== -1 && data) {
    comments[index] = { ...comments[index], ...data };
  }
  renderComments();
  await refreshCommentCount();
}

async function handleDeleteComment(id) {
  const ok = await confirmDialog({
    title: 'Delete comment',
    body: 'Delete this comment permanently?',
    confirmLabel: 'Delete',
  });
  if (!ok) return;
  const { error } = await deleteComment(id);
  if (error) {
    showAlert('#alert-area', `Could not delete the comment: ${error.message}`);
    return;
  }
  comments = comments.filter((c) => c.id !== id);
  if (editingCommentId === id) editingCommentId = null;
  renderComments();
  await refreshCommentCount();
}

function initCommunity() {
  renderRatingStars();
  updateFavoriteButton();
  loadComments();

  const favoriteBtn = document.getElementById('favorite-btn');
  if (favoriteBtn) favoriteBtn.addEventListener('click', handleFavorite);

  const planBtn = document.getElementById('plan-meal-btn');
  if (planBtn) planBtn.addEventListener('click', () => buildPlanModal().show());

  const commentForm = document.getElementById('comment-form');
  if (commentForm) commentForm.addEventListener('submit', handleAddComment);
}

async function init() {
  await renderNavbar();
  const app = document.getElementById('app');
  const id = new URLSearchParams(window.location.search).get('id');

  if (!id) {
    renderMessage(app, 'bi-question-circle', 'No recipe was selected. Pick one from the feed.');
    return;
  }

  const { data: fetchedRecipe, error } = await getRecipe(id);
  if (error) {
    renderMessage(app, 'bi-exclamation-triangle', `Could not load the recipe: ${error.message}`);
    return;
  }
  if (!fetchedRecipe) {
    renderMessage(app, 'bi-question-circle', 'This recipe does not exist or was deleted.');
    return;
  }
  recipe = fetchedRecipe;

  photos = [...(recipe.photos || [])].sort((a, b) => a.position - b.position);

  const [user, admin, statsResult, favResult, ratingResult] = await Promise.all([
    getCurrentUser(),
    isAdmin(),
    getRecipeStats([recipe.id]),
    getFavoriteIds([recipe.id]),
    getMyRating(recipe.id),
  ]);
  currentUser = user;
  isAdminUser = admin;
  statsMap = statsResult.data || new Map();
  isFavorite = favResult.data ? favResult.data.has(recipe.id) : false;
  myRating = ratingResult.data ?? null;

  const canManage = Boolean(user && (recipe.author_id === user.id || isAdminUser));

  renderRecipe(app, recipe, statsMap, canManage);
  initCommunity();

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
