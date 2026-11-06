import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap';
import '../styles/main.css';
import { renderNavbar } from '../components/navbar.js';
import { confirmDialog } from '../components/confirmModal.js';
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../services/categories.js';
import {
  grantRole,
  listAllRecipes,
  listProfiles,
  listUserRoles,
  revokeRole,
  setRecipeFeatured,
} from '../services/admin.js';
import { deleteRecipe } from '../services/recipes.js';
import { escapeHtml, setLoading, showAlert } from '../utils/dom.js';
import { requireAdmin } from '../utils/guard.js';

const ICON_CHOICES = [
  'bi-bookmark',
  'bi-sunrise',
  'bi-cup-hot',
  'bi-flower1',
  'bi-egg-fried',
  'bi-tree',
  'bi-basket',
  'bi-cake2',
  'bi-cup-straw',
  'bi-apple',
  'bi-carrot',
  'bi-cup',
  'bi-egg',
  'bi-fire',
];

let currentUser = null;
let profiles = [];
let roles = [];
let categories = [];
let recipes = [];

function roleBadge(role) {
  return role === 'admin'
    ? '<span class="badge text-bg-danger">admin</span>'
    : '<span class="badge text-bg-secondary">user</span>';
}

function renderUsersTable() {
  const holder = document.getElementById('users-table-body');
  if (!holder) return;
  if (!profiles.length) {
    holder.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No users yet.</td></tr>';
    return;
  }
  holder.innerHTML = profiles
    .map((p) => {
      const userRoles = roles.filter((r) => r.user_id === p.id).map((r) => r.role);
      const isAdmin = userRoles.includes('admin');
      const isSelf = p.id === currentUser.id;
      const memberSince = new Date(p.created_at).toLocaleDateString();
      return `
      <tr>
        <td>${escapeHtml(p.display_name || 'Unknown')}</td>
        <td>${userRoles.map(roleBadge).join(' ') || roleBadge('user')}</td>
        <td class="text-muted small">${escapeHtml(memberSince)}</td>
        <td class="text-end">
          <button type="button" class="btn btn-sm ${isAdmin ? 'btn-outline-danger' : 'btn-outline-success'}"
            data-toggle-admin="${p.id}" ${isSelf && isAdmin ? 'disabled title="You cannot remove your own admin role"' : ''}>
            ${isAdmin ? 'Remove admin' : 'Make admin'}
          </button>
        </td>
      </tr>`;
    })
    .join('');
  holder.querySelectorAll('[data-toggle-admin]').forEach((btn) => {
    btn.addEventListener('click', () => handleToggleAdmin(btn));
  });
}

async function handleToggleAdmin(btn) {
  const userId = btn.dataset.toggleAdmin;
  const profile = profiles.find((p) => p.id === userId);
  const isAdmin = roles.some((r) => r.user_id === userId && r.role === 'admin');
  const ok = await confirmDialog({
    title: isAdmin ? 'Remove admin role' : 'Grant admin role',
    body: isAdmin
      ? `Remove admin rights from "${profile?.display_name || 'this user'}"?`
      : `Give admin rights to "${profile?.display_name || 'this user'}"? They will be able to manage users, categories and recipes.`,
    confirmLabel: isAdmin ? 'Remove admin' : 'Make admin',
    confirmClass: isAdmin ? 'btn-danger' : 'btn-success',
  });
  if (!ok) return;
  btn.disabled = true;
  const { error } = isAdmin
    ? await revokeRole(userId, 'admin')
    : await grantRole(userId, 'admin');
  if (error) {
    btn.disabled = false;
    showAlert('#admin-alert-area', `Could not update role: ${error.message}`);
    return;
  }
  await loadUsers();
}

async function loadUsers() {
  const [profilesResult, rolesResult] = await Promise.all([listProfiles(), listUserRoles()]);
  if (profilesResult.error) {
    showAlert('#admin-alert-area', `Could not load users: ${profilesResult.error.message}`);
    return;
  }
  profiles = profilesResult.data;
  roles = rolesResult.data || [];
  renderUsersTable();
}

function renderCategories() {
  const holder = document.getElementById('categories-list');
  if (!holder) return;
  if (!categories.length) {
    holder.innerHTML = '<p class="text-muted mb-0">No categories yet.</p>';
    return;
  }
  holder.innerHTML = categories
    .map(
      (c) => `
      <div class="d-flex align-items-center gap-2 py-2 border-bottom" data-category-row="${c.id}">
        <i class="bi ${escapeHtml(c.icon || 'bi-bookmark')} fs-5 text-accent" style="width: 1.5rem"></i>
        <span class="flex-grow-1 category-name">${escapeHtml(c.name)}</span>
        <button type="button" class="btn btn-link btn-sm p-0" data-edit-category="${c.id}" title="Rename">
          <i class="bi bi-pencil"></i>
        </button>
        <button type="button" class="btn btn-link btn-sm p-0 text-danger" data-delete-category="${c.id}" title="Delete">
          <i class="bi bi-trash"></i>
        </button>
      </div>`
    )
    .join('');
  holder.querySelectorAll('[data-edit-category]').forEach((btn) => {
    btn.addEventListener('click', () => startEditCategory(btn));
  });
  holder.querySelectorAll('[data-delete-category]').forEach((btn) => {
    btn.addEventListener('click', () => handleDeleteCategory(btn));
  });
}

function startEditCategory(btn) {
  const row = btn.closest('[data-category-row]');
  const id = Number(row.dataset.categoryRow);
  const category = categories.find((c) => c.id === id);
  if (!category) return;
  row.innerHTML = `
    <i class="bi ${escapeHtml(category.icon || 'bi-bookmark')} fs-5 text-accent" style="width: 1.5rem"></i>
    <input type="text" class="form-control form-control-sm flex-grow-1" id="cat-name-${id}" maxlength="40" value="${escapeHtml(category.name)}" />
    <button type="button" class="btn btn-recipe btn-sm" data-save-category="${id}">Save</button>
    <button type="button" class="btn btn-outline-secondary btn-sm" data-cancel-category="${id}">Cancel</button>`;
  row.querySelector(`[data-save-category]`).addEventListener('click', async () => {
    const name = row.querySelector(`#cat-name-${id}`).value.trim();
    if (!name) return;
    const { error } = await updateCategory(id, { name });
    if (error) {
      showAlert('#admin-alert-area', `Could not rename category: ${error.message}`);
      renderCategories();
      return;
    }
    await loadCategories();
  });
  row.querySelector(`[data-cancel-category]`).addEventListener('click', () => renderCategories());
}

async function handleDeleteCategory(btn) {
  const id = Number(btn.dataset.deleteCategory);
  const category = categories.find((c) => c.id === id);
  const ok = await confirmDialog({
    title: 'Delete category',
    body: `Delete the "${category?.name || ''}" category? Recipes in it will keep their content but lose the category.`,
    confirmLabel: 'Delete',
  });
  if (!ok) return;
  const { error } = await deleteCategory(id);
  if (error) {
    showAlert('#admin-alert-area', `Could not delete category: ${error.message}`);
    return;
  }
  await loadCategories();
}

async function loadCategories() {
  const { data, error } = await listCategories();
  if (error) {
    showAlert('#admin-alert-area', `Could not load categories: ${error.message}`);
    return;
  }
  categories = data;
  renderCategories();
}

function renderRecipes() {
  const holder = document.getElementById('recipes-table-body');
  if (!holder) return;
  if (!recipes.length) {
    holder.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No recipes found.</td></tr>';
    return;
  }
  holder.innerHTML = recipes
    .map((r) => {
      const author = r.author?.display_name || 'Unknown';
      const category = r.category?.name || '-';
      return `
      <tr>
        <td>
          <a href="/recipe.html?id=${encodeURIComponent(r.id)}" class="text-decoration-none">${escapeHtml(r.title)}</a>
          ${r.is_featured ? '<span class="badge featured-badge-inline ms-1"><i class="bi bi-award-fill me-1"></i>Featured</span>' : ''}
        </td>
        <td class="text-muted small">${escapeHtml(author)}</td>
        <td class="text-muted small">${escapeHtml(category)}</td>
        <td class="text-center">
          <button type="button" class="btn btn-sm ${r.is_featured ? 'btn-warning' : 'btn-outline-secondary'}"
            data-toggle-featured="${r.id}" data-featured="${r.is_featured ? '1' : '0'}"
            title="${r.is_featured ? 'Unfeature' : 'Feature'}">
            <i class="bi ${r.is_featured ? 'bi-star-fill' : 'bi-star'}"></i>
          </button>
        </td>
        <td class="text-end">
          <a href="/recipe-edit.html?id=${encodeURIComponent(r.id)}" class="btn btn-outline-secondary btn-sm" title="Edit">
            <i class="bi bi-pencil"></i>
          </a>
          <button type="button" class="btn btn-outline-danger btn-sm" data-delete-recipe="${r.id}" title="Delete">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>`;
    })
    .join('');
  holder.querySelectorAll('[data-toggle-featured]').forEach((btn) => {
    btn.addEventListener('click', () => handleToggleFeatured(btn));
  });
  holder.querySelectorAll('[data-delete-recipe]').forEach((btn) => {
    btn.addEventListener('click', () => handleDeleteRecipe(btn));
  });
}

async function handleToggleFeatured(btn) {
  const id = btn.dataset.toggleFeatured;
  const next = btn.dataset.featured !== '1';
  btn.disabled = true;
  const { data, error } = await setRecipeFeatured(id, next);
  if (error) {
    btn.disabled = false;
    showAlert('#admin-alert-area', `Could not update featured status: ${error.message}`);
    return;
  }
  const recipe = recipes.find((r) => r.id === id);
  if (recipe && data) recipe.is_featured = data.is_featured;
  renderRecipes();
}

async function handleDeleteRecipe(btn) {
  const id = btn.dataset.deleteRecipe;
  const recipe = recipes.find((r) => r.id === id);
  const ok = await confirmDialog({
    title: 'Delete recipe',
    body: `Permanently delete "${recipe?.title || 'this recipe'}" and all its photos?`,
    confirmLabel: 'Delete recipe',
  });
  if (!ok) return;
  btn.disabled = true;
  const { error } = await deleteRecipe(id);
  if (error) {
    btn.disabled = false;
    showAlert('#admin-alert-area', `Could not delete the recipe: ${error.message}`);
    return;
  }
  recipes = recipes.filter((r) => r.id !== id);
  renderRecipes();
}

async function loadRecipes(search = '') {
  const holder = document.getElementById('recipes-table-body');
  if (holder) {
    holder.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4"><span class="spinner-border spinner-border-sm me-2"></span>Loading...</td></tr>';
  }
  const { data, error } = await listAllRecipes({ search });
  if (error) {
    showAlert('#admin-alert-area', `Could not load recipes: ${error.message}`);
    return;
  }
  recipes = data;
  renderRecipes();
}

function renderShell(app) {
  app.innerHTML = `
    <h1 class="h3 mb-3"><i class="bi bi-shield-lock me-2 text-accent"></i>Admin dashboard</h1>
    <div id="admin-alert-area"></div>
    <ul class="nav nav-tabs mb-3" id="admin-tabs" role="tablist">
      <li class="nav-item" role="presentation">
        <button class="nav-link active" id="tab-users" data-bs-toggle="tab" data-bs-target="#pane-users" type="button" role="tab">
          <i class="bi bi-people me-1"></i>Users
        </button>
      </li>
      <li class="nav-item" role="presentation">
        <button class="nav-link" id="tab-categories" data-bs-toggle="tab" data-bs-target="#pane-categories" type="button" role="tab">
          <i class="bi bi-tags me-1"></i>Categories
        </button>
      </li>
      <li class="nav-item" role="presentation">
        <button class="nav-link" id="tab-recipes" data-bs-toggle="tab" data-bs-target="#pane-recipes" type="button" role="tab">
          <i class="bi bi-journal-text me-1"></i>Recipes
        </button>
      </li>
    </ul>
    <div class="tab-content">
      <div class="tab-pane fade show active" id="pane-users" role="tabpanel">
        <div class="card">
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead><tr><th>User</th><th>Role</th><th>Member since</th><th class="text-end">Actions</th></tr></thead>
              <tbody id="users-table-body"></tbody>
            </table>
          </div>
        </div>
        <p class="text-muted small mt-2 mb-0">Deleting user accounts is not possible from the app; manage them in the Supabase dashboard.</p>
      </div>
      <div class="tab-pane fade" id="pane-categories" role="tabpanel">
        <div class="card mb-3">
          <div class="card-body">
            <form id="category-form" class="row g-2 align-items-end">
              <div class="col-sm-6">
                <label for="category-name" class="form-label">New category</label>
                <input type="text" class="form-control" id="category-name" maxlength="40" placeholder="e.g. Grill" required />
              </div>
              <div class="col-sm-4">
                <label for="category-icon" class="form-label">Icon</label>
                <select class="form-select" id="category-icon">
                  ${ICON_CHOICES.map((icon) => `<option value="${icon}">${icon.replace('bi-', '')}</option>`).join('')}
                </select>
              </div>
              <div class="col-sm-2">
                <button type="submit" class="btn btn-recipe w-100" id="add-category-btn">Add</button>
              </div>
            </form>
          </div>
        </div>
        <div class="card">
          <div class="card-body" id="categories-list"></div>
        </div>
      </div>
      <div class="tab-pane fade" id="pane-recipes" role="tabpanel">
        <div class="card">
          <div class="card-body">
            <div class="input-group mb-3">
              <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
              <input type="search" id="recipe-search" class="form-control" placeholder="Search recipes..." />
            </div>
            <div class="table-responsive">
              <table class="table table-hover align-middle mb-0">
                <thead><tr><th>Recipe</th><th>Author</th><th>Category</th><th class="text-center">Featured</th><th class="text-end">Actions</th></tr></thead>
                <tbody id="recipes-table-body"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

async function init() {
  await renderNavbar();
  currentUser = await requireAdmin();
  if (!currentUser) return;
  const app = document.getElementById('app');
  renderShell(app);

  await Promise.all([loadUsers(), loadCategories(), loadRecipes()]);

  document.getElementById('category-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = document.getElementById('category-name').value.trim();
    const icon = document.getElementById('category-icon').value;
    if (!name) return;
    const btn = document.getElementById('add-category-btn');
    setLoading(btn, true, 'Adding...');
    const { error } = await createCategory(name, icon);
    setLoading(btn, false);
    if (error) {
      showAlert('#admin-alert-area', `Could not add category: ${error.message}`);
      return;
    }
    document.getElementById('category-name').value = '';
    await loadCategories();
  });

  let searchTimer;
  document.getElementById('recipe-search').addEventListener('input', (event) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadRecipes(event.target.value.trim()), 300);
  });
}

init();
