import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap';
import '../styles/main.css';
import { renderNavbar } from '../components/navbar.js';
import { confirmDialog } from '../components/confirmModal.js';
import { isAdmin } from '../services/auth.js';
import { listCategories } from '../services/categories.js';
import {
  addRecipePhoto,
  createRecipe,
  deleteRecipe,
  deleteRecipePhoto,
  getRecipe,
  setCoverPhoto,
  updateRecipe,
} from '../services/recipes.js';
import { getPublicUrl, uploadRecipePhoto } from '../services/storage.js';
import { escapeHtml, setLoading, showAlert } from '../utils/dom.js';
import { requireAuth } from '../utils/guard.js';

let currentRecipe = null;
let isAdminUser = false;
let categories = [];
let pendingFiles = [];

const getRecipeId = () => new URLSearchParams(window.location.search).get('id');

function renderBlocked(app, message) {
  app.innerHTML = `
    <div class="row justify-content-center">
      <div class="col-md-8 col-lg-6">
        <div class="card">
          <div class="card-body text-center py-5">
            <i class="bi bi-lock display-4 text-accent"></i>
            <p class="mt-3 mb-3">${escapeHtml(message)}</p>
            <a href="/index.html" class="btn btn-recipe">Back to the feed</a>
          </div>
        </div>
      </div>
    </div>`;
}

function renderForm(app) {
  const r = currentRecipe;
  const editing = Boolean(r);
  app.innerHTML = `
    <div class="row justify-content-center">
      <div class="col-lg-9">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h1 class="h3 mb-0">${editing ? 'Edit recipe' : 'New recipe'}</h1>
          ${editing ? '<button type="button" id="delete-recipe-btn" class="btn btn-outline-danger btn-sm"><i class="bi bi-trash me-1"></i>Delete recipe</button>' : ''}
        </div>
        <div id="alert-area"></div>
        <div class="card">
          <div class="card-body p-4">
            <form id="recipe-form" novalidate>
              <div class="mb-3">
                <label for="title" class="form-label">Title</label>
                <input type="text" class="form-control" id="title" required minlength="3" maxlength="120"
                  value="${escapeHtml(r?.title || '')}" placeholder="Grandma's apple pie" />
                <div class="invalid-feedback">Title must be 3-120 characters.</div>
              </div>
              <div class="mb-3">
                <label for="category" class="form-label">Category</label>
                <select class="form-select" id="category">
                  <option value="">No category</option>
                  ${categories
                    .map(
                      (c) =>
                        `<option value="${c.id}"${r?.category_id === c.id ? ' selected' : ''}>${escapeHtml(c.name)}</option>`
                    )
                    .join('')}
                </select>
              </div>
              <div class="mb-3">
                <label for="description" class="form-label">Description</label>
                <textarea class="form-control" id="description" rows="2" maxlength="1000"
                  placeholder="A short summary of the dish">${escapeHtml(r?.description || '')}</textarea>
                <div class="invalid-feedback">Description can be at most 1000 characters.</div>
              </div>
              <div class="mb-3">
                <label for="ingredients" class="form-label">Ingredients <span class="text-muted small">(one per line)</span></label>
                <textarea class="form-control" id="ingredients" rows="6" required maxlength="5000"
                  placeholder="200 g flour&#10;2 eggs&#10;100 ml milk">${escapeHtml(r?.ingredients || '')}</textarea>
                <div class="invalid-feedback">Ingredients are required (max 5000 characters).</div>
              </div>
              <div class="mb-3">
                <label for="instructions" class="form-label">Instructions <span class="text-muted small">(one step per line)</span></label>
                <textarea class="form-control" id="instructions" rows="7" required maxlength="10000"
                  placeholder="Mix the dry ingredients.&#10;Fold in the eggs.&#10;Bake at 180 C for 35 minutes.">${escapeHtml(r?.instructions || '')}</textarea>
                <div class="invalid-feedback">Instructions are required (max 10000 characters).</div>
              </div>
              <div class="row g-3 mb-4">
                <div class="col-sm-4">
                  <label for="prep-minutes" class="form-label">Prep time (min)</label>
                  <input type="number" class="form-control" id="prep-minutes" min="0" max="1440" step="1"
                    value="${r?.prep_minutes ?? ''}" placeholder="15" />
                  <div class="invalid-feedback">0-1440 minutes.</div>
                </div>
                <div class="col-sm-4">
                  <label for="cook-minutes" class="form-label">Cook time (min)</label>
                  <input type="number" class="form-control" id="cook-minutes" min="0" max="1440" step="1"
                    value="${r?.cook_minutes ?? ''}" placeholder="30" />
                  <div class="invalid-feedback">0-1440 minutes.</div>
                </div>
                <div class="col-sm-4">
                  <label for="servings" class="form-label">Servings</label>
                  <input type="number" class="form-control" id="servings" min="1" max="100" step="1"
                    value="${r?.servings ?? ''}" placeholder="4" />
                  <div class="invalid-feedback">1-100 servings.</div>
                </div>
              </div>
              <div class="mb-4">
                <label class="form-label">Photos <span class="text-muted small">(JPG, PNG or WebP, up to 5 MB each)</span></label>
                <input type="file" class="form-control" id="photo-input" accept="image/jpeg,image/png,image/webp" multiple />
                <div id="existing-photos" class="row g-3 mt-1"></div>
                <div id="pending-photos" class="row g-3 mt-1"></div>
              </div>
              <div class="d-flex gap-2">
                <button type="submit" id="save-btn" class="btn btn-recipe">
                  <i class="bi bi-check2 me-1"></i>${editing ? 'Save changes' : 'Create recipe'}
                </button>
                <a href="${editing ? `/recipe.html?id=${encodeURIComponent(r.id)}` : '/index.html'}" class="btn btn-outline-secondary">Cancel</a>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>`;
}

function renderExistingPhotos() {
  const holder = document.getElementById('existing-photos');
  const photos = [...(currentRecipe?.photos || [])].sort((a, b) => a.position - b.position);
  if (!photos.length) {
    holder.innerHTML = '';
    return;
  }
  holder.innerHTML = photos
    .map(
      (p) => `
      <div class="col-6 col-sm-4 col-md-3">
        <div class="photo-thumb-wrap">
          <img src="${escapeHtml(getPublicUrl('recipe-photos', p.storage_path))}" class="photo-thumb" alt="Recipe photo" />
          ${p.is_cover ? '<span class="badge cover-badge"><i class="bi bi-star-fill me-1"></i>Cover</span>' : ''}
          <div class="photo-actions">
            ${
              p.is_cover
                ? ''
                : `<button type="button" class="btn btn-light btn-sm" data-set-cover="${p.id}" title="Set as cover"><i class="bi bi-star"></i></button>`
            }
            <button type="button" class="btn btn-light btn-sm text-danger" data-del-photo="${p.id}" title="Delete photo"><i class="bi bi-trash"></i></button>
          </div>
        </div>
      </div>`
    )
    .join('');

  holder.querySelectorAll('[data-set-cover]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const { error } = await setCoverPhoto(currentRecipe.id, btn.dataset.setCover);
      if (error) {
        showAlert('#alert-area', `Could not set cover photo: ${error.message}`);
        btn.disabled = false;
        return;
      }
      const photo = currentRecipe.photos.find((p) => p.id === btn.dataset.setCover);
      currentRecipe.photos.forEach((p) => {
        p.is_cover = p === photo;
      });
      renderExistingPhotos();
    });
  });

  holder.querySelectorAll('[data-del-photo]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const photo = currentRecipe.photos.find((p) => p.id === btn.dataset.delPhoto);
      if (!photo) return;
      const ok = await confirmDialog({
        title: 'Delete photo',
        body: 'Remove this photo from the recipe?',
        confirmLabel: 'Delete',
      });
      if (!ok) return;
      btn.disabled = true;
      const { error } = await deleteRecipePhoto(photo);
      if (error) {
        showAlert('#alert-area', `Could not delete photo: ${error.message}`);
        btn.disabled = false;
        return;
      }
      currentRecipe.photos = currentRecipe.photos.filter((p) => p.id !== photo.id);
      renderExistingPhotos();
    });
  });
}

function renderPendingPhotos() {
  const holder = document.getElementById('pending-photos');
  holder.innerHTML = pendingFiles
    .map(
      (item, i) => `
      <div class="col-6 col-sm-4 col-md-3">
        <div class="photo-thumb-wrap">
          <img src="${item.url}" class="photo-thumb" alt="New photo preview" />
          <span class="badge pending-badge">New</span>
          <div class="photo-actions">
            <button type="button" class="btn btn-light btn-sm text-danger" data-del-pending="${i}" title="Remove"><i class="bi bi-x-lg"></i></button>
          </div>
        </div>
      </div>`
    )
    .join('');
  holder.querySelectorAll('[data-del-pending]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.delPending);
      URL.revokeObjectURL(pendingFiles[i].url);
      pendingFiles.splice(i, 1);
      renderPendingPhotos();
    });
  });
}

function readFields() {
  const num = (id) => {
    const raw = document.getElementById(id).value.trim();
    return raw === '' ? null : Number(raw);
  };
  return {
    title: document.getElementById('title').value.trim(),
    category_id: document.getElementById('category').value || null,
    description: document.getElementById('description').value.trim() || null,
    ingredients: document.getElementById('ingredients').value.trim(),
    instructions: document.getElementById('instructions').value.trim(),
    prep_minutes: num('prep-minutes'),
    cook_minutes: num('cook-minutes'),
    servings: num('servings'),
  };
}

function enterEditMode(recipe) {
  currentRecipe = recipe;
  window.history.replaceState(null, '', `/recipe-edit.html?id=${encodeURIComponent(recipe.id)}`);
  const heading = document.querySelector('h1');
  if (heading) heading.textContent = 'Edit recipe';
  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) {
    saveBtn.innerHTML = '<i class="bi bi-check2 me-1"></i>Save changes';
    delete saveBtn.dataset.originalContent;
  }
}

async function uploadPendingPhotos(recipeId) {
  const existing = currentRecipe?.photos || [];
  let hasCover = existing.some((p) => p.is_cover);
  let position = existing.reduce((max, p) => Math.max(max, p.position), -1) + 1;
  const uploaded = [];
  const failures = [];
  for (const item of pendingFiles) {
    const { data: path, error: upError } = await uploadRecipePhoto(item.file, recipeId);
    if (upError) {
      failures.push(upError.message);
      continue;
    }
    const { data: row, error: rowError } = await addRecipePhoto(recipeId, path, !hasCover, position);
    if (rowError) {
      failures.push(`"${item.file.name}" could not be saved: ${rowError.message}`);
      continue;
    }
    hasCover = hasCover || row.is_cover;
    position += 1;
    uploaded.push(row);
  }
  return { uploaded, failures };
}

async function init() {
  await renderNavbar();
  const user = await requireAuth();
  if (!user) return;

  const app = document.getElementById('app');
  const id = getRecipeId();

  if (id) {
    isAdminUser = await isAdmin();
    const { data: recipe, error } = await getRecipe(id);
    if (error) {
      renderBlocked(app, `Could not load the recipe: ${error.message}`);
      return;
    }
    if (!recipe) {
      renderBlocked(app, 'This recipe does not exist or was deleted.');
      return;
    }
    if (recipe.author_id !== user.id && !isAdminUser) {
      renderBlocked(app, "You can't edit this recipe. Only its author can make changes.");
      return;
    }
    currentRecipe = recipe;
  }

  const { data: cats } = await listCategories();
  categories = cats;

  renderForm(app);
  renderExistingPhotos();

  const photoInput = document.getElementById('photo-input');
  photoInput.addEventListener('change', () => {
    for (const file of photoInput.files) {
      pendingFiles.push({ file, url: URL.createObjectURL(file) });
    }
    photoInput.value = '';
    renderPendingPhotos();
  });

  const deleteBtn = document.getElementById('delete-recipe-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Delete recipe',
        body: `Permanently delete "${currentRecipe.title}" and all its photos?`,
        confirmLabel: 'Delete recipe',
      });
      if (!ok) return;
      deleteBtn.disabled = true;
      const { error } = await deleteRecipe(currentRecipe.id);
      if (error) {
        showAlert('#alert-area', `Could not delete the recipe: ${error.message}`);
        deleteBtn.disabled = false;
        return;
      }
      window.location.href = '/index.html';
    });
  }

  const form = document.getElementById('recipe-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }
    const saveBtn = document.getElementById('save-btn');
    setLoading(saveBtn, true, 'Saving...');

    const fields = readFields();
    const wasEdit = Boolean(currentRecipe);
    const { data: saved, error } = wasEdit
      ? await updateRecipe(currentRecipe.id, fields)
      : await createRecipe(fields);

    if (error) {
      setLoading(saveBtn, false);
      showAlert('#alert-area', `Could not save the recipe: ${error.message}`);
      return;
    }

    // Switch from create to edit so a later photo failure does not lose the recipe.
    if (!wasEdit) {
      const { data: fresh } = await getRecipe(saved.id);
      enterEditMode(fresh || saved);
    } else {
      currentRecipe = { ...currentRecipe, ...saved };
    }

    if (pendingFiles.length) {
      const { uploaded, failures } = await uploadPendingPhotos(saved.id);
      currentRecipe.photos = [...(currentRecipe.photos || []), ...uploaded];
      pendingFiles.forEach((p) => URL.revokeObjectURL(p.url));
      pendingFiles = [];
      renderPendingPhotos();
      renderExistingPhotos();
      if (failures.length) {
        setLoading(saveBtn, false);
        showAlert(
          '#alert-area',
          `The recipe was saved, but some photos failed to upload: ${failures.join(' ')}`,
          'warning'
        );
        return;
      }
    }

    window.location.href = `/recipe.html?id=${encodeURIComponent(saved.id)}`;
  });
}

init();
