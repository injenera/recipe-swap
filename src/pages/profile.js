import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap';
import '../styles/main.css';
import { renderNavbar } from '../components/navbar.js';
import { renderRecipeCard } from '../components/recipeCard.js';
import { getCurrentUser, getProfile, updateProfile } from '../services/auth.js';
import { listFavorites } from '../services/engagement.js';
import { getRecipeStats, listRecipesByAuthor } from '../services/recipes.js';
import { getPublicUrl, removeFiles, uploadAvatar } from '../services/storage.js';
import { escapeHtml, setLoading, showAlert } from '../utils/dom.js';
import { requireAuth } from '../utils/guard.js';

let profile = null;
let myRecipes = [];
let favoriteRecipes = [];
let recipeStats = new Map();

function avatarHtml() {
  const url = profile?.avatar_path ? getPublicUrl('avatars', profile.avatar_path) : '';
  if (url) {
    return `<img src="${escapeHtml(url)}" id="profile-avatar-img" class="profile-avatar" alt="Your avatar" />`;
  }
  return '<i class="bi bi-person-circle profile-avatar-icon" id="profile-avatar-img"></i>';
}

function renderProfile(app) {
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  app.innerHTML = `
    <div class="row g-4">
      <div class="col-lg-4">
        <div class="card">
          <div class="card-body p-4 text-center">
            <div class="profile-avatar-wrap mx-auto mb-3" role="button" id="avatar-change" title="Change avatar">
              ${avatarHtml()}
              <span class="profile-avatar-edit"><i class="bi bi-camera"></i></span>
            </div>
            <input type="file" id="avatar-input" accept="image/jpeg,image/png,image/webp" class="d-none" />
            <div id="name-view" class="d-flex align-items-center justify-content-center gap-2">
              <h1 class="h4 mb-0">${escapeHtml(profile?.display_name || 'Cook')}</h1>
              <button type="button" id="edit-name-btn" class="btn btn-link btn-sm p-0" title="Edit display name">
                <i class="bi bi-pencil"></i>
              </button>
            </div>
            <div id="name-edit" class="d-none">
              <div class="input-group input-group-sm">
                <input type="text" class="form-control" id="display-name-input" maxlength="60"
                  value="${escapeHtml(profile?.display_name || '')}" />
                <button type="button" class="btn btn-recipe" id="save-name-btn">Save</button>
              </div>
            </div>
            <p class="text-muted small mt-1 mb-0">Member since ${escapeHtml(memberSince)}</p>
          </div>
        </div>
        <div class="card mt-3">
          <div class="card-body p-4">
            <h2 class="h6 mb-2">About me</h2>
            <div id="bio-view">
              <p class="text-muted small mb-2" id="bio-text">${escapeHtml(profile?.bio || 'No bio yet.')}</p>
              <button type="button" id="edit-bio-btn" class="btn btn-link btn-sm p-0">Edit bio</button>
            </div>
            <div id="bio-edit" class="d-none">
              <textarea class="form-control form-control-sm" id="bio-input" rows="4" maxlength="500"
                placeholder="Tell the community about yourself">${escapeHtml(profile?.bio || '')}</textarea>
              <div class="d-flex gap-2 mt-2">
                <button type="button" class="btn btn-recipe btn-sm" id="save-bio-btn">Save</button>
                <button type="button" class="btn btn-outline-secondary btn-sm" id="cancel-bio-btn">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-8">
        <div id="alert-area"></div>
        <ul class="nav nav-tabs mb-3" id="profile-tabs" role="tablist">
          <li class="nav-item" role="presentation">
            <button class="nav-link active" id="tab-recipes" data-bs-toggle="tab" data-bs-target="#pane-recipes" type="button" role="tab">
              My recipes <span class="badge text-bg-secondary ms-1" id="count-recipes">${myRecipes.length}</span>
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link" id="tab-favorites" data-bs-toggle="tab" data-bs-target="#pane-favorites" type="button" role="tab">
              My favorites <span class="badge text-bg-secondary ms-1" id="count-favorites">${favoriteRecipes.length}</span>
            </button>
          </li>
        </ul>
        <div class="tab-content">
          <div class="tab-pane fade show active" id="pane-recipes" role="tabpanel">
            <div id="my-recipes-grid" class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4"></div>
            <div id="my-recipes-empty"></div>
          </div>
          <div class="tab-pane fade" id="pane-favorites" role="tabpanel">
            <div id="favorites-grid" class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4"></div>
            <div id="favorites-empty"></div>
          </div>
        </div>
      </div>
    </div>`;
}

function cardWithEditLink(recipe, stats) {
  const editBtn = `<a href="/recipe-edit.html?id=${encodeURIComponent(recipe.id)}" class="btn btn-outline-secondary btn-sm mt-2">
      <i class="bi bi-pencil me-1"></i>Edit</a>`;
  return renderRecipeCard(recipe, stats, editBtn);
}

function renderGrids() {
  const recipesGrid = document.getElementById('my-recipes-grid');
  const favGrid = document.getElementById('favorites-grid');
  if (recipesGrid) {
    recipesGrid.innerHTML = myRecipes.map((r) => cardWithEditLink(r, recipeStats)).join('');
    const empty = document.getElementById('my-recipes-empty');
    if (empty) {
      empty.innerHTML = myRecipes.length
        ? ''
        : `<div class="text-center py-5 text-muted">
            <i class="bi bi-journal-plus display-4 text-accent"></i>
            <p class="mt-3 mb-2">You have not shared any recipes yet.</p>
            <a href="/recipe-edit.html" class="btn btn-recipe btn-sm">Share your first recipe</a>
          </div>`;
    }
  }
  if (favGrid) {
    favGrid.innerHTML = favoriteRecipes.map((r) => renderRecipeCard(r, recipeStats)).join('');
    const empty = document.getElementById('favorites-empty');
    if (empty) {
      empty.innerHTML = favoriteRecipes.length
        ? ''
        : `<div class="text-center py-5 text-muted">
            <i class="bi bi-heart display-4 text-accent"></i>
            <p class="mt-3 mb-2">No favorites yet. Tap the heart on any recipe to save it here.</p>
            <a href="/index.html" class="btn btn-recipe btn-sm">Browse the feed</a>
          </div>`;
    }
  }
}

async function refreshAvatarView() {
  const wrap = document.getElementById('avatar-change');
  if (!wrap) return;
  const url = profile?.avatar_path ? getPublicUrl('avatars', profile.avatar_path) : '';
  if (url) {
    wrap.innerHTML = `<img src="${escapeHtml(url)}" id="profile-avatar-img" class="profile-avatar" alt="Your avatar" /><span class="profile-avatar-edit"><i class="bi bi-camera"></i></span>`;
  } else {
    wrap.innerHTML = '<i class="bi bi-person-circle profile-avatar-icon" id="profile-avatar-img"></i><span class="profile-avatar-edit"><i class="bi bi-camera"></i></span>';
  }
}

async function saveProfile(fields, successMessage) {
  const { data, error } = await updateProfile(profile.id, fields);
  if (error) {
    showAlert('#alert-area', `Could not save your profile: ${error.message}`);
    return null;
  }
  profile = { ...profile, ...data };
  if (successMessage) showAlert('#alert-area', successMessage, 'success');
  return data;
}

async function init() {
  await renderNavbar();
  const user = await requireAuth();
  if (!user) return;
  const app = document.getElementById('app');

  const { data: prof, error: profError } = await getProfile(user.id);
  if (profError || !prof) {
    app.innerHTML = `
      <div class="card"><div class="card-body text-center py-5">
        <i class="bi bi-exclamation-triangle display-4 text-accent"></i>
        <p class="mt-3 mb-3">Could not load your profile${profError ? `: ${escapeHtml(profError.message)}` : '.'}</p>
        <a href="/index.html" class="btn btn-recipe">Back to the feed</a>
      </div></div>`;
    return;
  }
  profile = prof;

  const [recipesResult, favResult] = await Promise.all([
    listRecipesByAuthor(user.id),
    listFavorites(),
  ]);
  myRecipes = recipesResult.data;
  favoriteRecipes = favResult.data;
  const allIds = [...myRecipes.map((r) => r.id), ...favoriteRecipes.map((r) => r.id)];
  const { data: stats } = await getRecipeStats(allIds);
  recipeStats = stats || new Map();

  renderProfile(app);
  renderGrids();

  // Avatar change
  const avatarChange = document.getElementById('avatar-change');
  const avatarInput = document.getElementById('avatar-input');
  avatarChange?.addEventListener('click', () => avatarInput.click());
  avatarInput?.addEventListener('change', async () => {
    const file = avatarInput.files?.[0];
    avatarInput.value = '';
    if (!file) return;
    const oldPath = profile.avatar_path;
    const { data: path, error: upError } = await uploadAvatar(file);
    if (upError) {
      showAlert('#alert-area', `Could not upload avatar: ${upError.message}`);
      return;
    }
    const { error } = await updateProfile(profile.id, { avatar_path: path });
    if (error) {
      showAlert('#alert-area', `Could not save avatar: ${error.message}`);
      return;
    }
    profile = { ...profile, avatar_path: path };
    await refreshAvatarView();
    if (oldPath && oldPath !== path) {
      const { error: rmError } = await removeFiles('avatars', [oldPath]);
      if (rmError) console.warn('Could not remove old avatar:', rmError.message);
    }
    showAlert('#alert-area', 'Avatar updated.', 'success');
  });

  // Display name edit
  const editNameBtn = document.getElementById('edit-name-btn');
  const nameView = document.getElementById('name-view');
  const nameEdit = document.getElementById('name-edit');
  editNameBtn?.addEventListener('click', () => {
    nameView.classList.add('d-none');
    nameEdit.classList.remove('d-none');
    document.getElementById('display-name-input')?.focus();
  });
  document.getElementById('save-name-btn')?.addEventListener('click', async () => {
    const name = document.getElementById('display-name-input').value.trim();
    if (!name || name.length > 60) {
      showAlert('#alert-area', 'Display name must be 1-60 characters.');
      return;
    }
    const btn = document.getElementById('save-name-btn');
    setLoading(btn, true, 'Saving...');
    const ok = await saveProfile({ display_name: name }, 'Display name updated.');
    setLoading(btn, false);
    if (!ok) return;
    nameView.querySelector('h1').textContent = name;
    nameView.classList.remove('d-none');
    nameEdit.classList.add('d-none');
  });

  // Bio edit
  const editBioBtn = document.getElementById('edit-bio-btn');
  const bioView = document.getElementById('bio-view');
  const bioEdit = document.getElementById('bio-edit');
  editBioBtn?.addEventListener('click', () => {
    bioView.classList.add('d-none');
    bioEdit.classList.remove('d-none');
    document.getElementById('bio-input')?.focus();
  });
  document.getElementById('cancel-bio-btn')?.addEventListener('click', () => {
    bioView.classList.remove('d-none');
    bioEdit.classList.add('d-none');
  });
  document.getElementById('save-bio-btn')?.addEventListener('click', async () => {
    const bio = document.getElementById('bio-input').value.trim();
    const btn = document.getElementById('save-bio-btn');
    setLoading(btn, true, 'Saving...');
    const ok = await saveProfile({ bio: bio || null }, 'Bio updated.');
    setLoading(btn, false);
    if (!ok) return;
    document.getElementById('bio-text').textContent = bio || 'No bio yet.';
    bioView.classList.remove('d-none');
    bioEdit.classList.add('d-none');
  });
}

init();
