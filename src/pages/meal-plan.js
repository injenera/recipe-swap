import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { Modal } from 'bootstrap';
import '../styles/main.css';
import { renderNavbar } from '../components/navbar.js';
import { confirmDialog } from '../components/confirmModal.js';
import { recipeCoverUrl } from '../components/recipeCard.js';
import {
  addMealPlanEntry,
  listFavorites,
  listMealPlan,
  removeMealPlanEntry,
} from '../services/engagement.js';
import { listRecipes } from '../services/recipes.js';
import {
  addDays,
  formatShortDate,
  parseDateISO,
  startOfWeek,
  toDateISO,
  todayISO,
  weekDates,
} from '../utils/date.js';
import { escapeHtml, showAlert } from '../utils/dom.js';
import { requireAuth } from '../utils/guard.js';

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', icon: 'bi-sunrise' },
  { value: 'lunch', label: 'Lunch', icon: 'bi-sun' },
  { value: 'dinner', label: 'Dinner', icon: 'bi-moon' },
  { value: 'snack', label: 'Snack', icon: 'bi-cookie' },
];

let weekStart = null;
let entries = [];
let pickerRecipes = [];
let pickerTarget = null;

function mealTypeMeta(value) {
  return MEAL_TYPES.find((m) => m.value === value) || MEAL_TYPES[0];
}

function slotEntries(dateISO, mealType) {
  return entries.filter((e) => e.plan_date === dateISO && e.meal_type === mealType);
}

function renderEntry(entry) {
  const recipe = entry.recipe;
  if (!recipe) return '';
  const cover = recipeCoverUrl(recipe);
  return `
    <div class="meal-plan-entry" data-entry-id="${entry.id}" data-recipe-id="${recipe.id}">
      <a href="/recipe.html?id=${encodeURIComponent(recipe.id)}" class="meal-plan-entry-link">
        ${
          cover
            ? `<img src="${escapeHtml(cover)}" class="meal-plan-thumb" alt="" loading="lazy" />`
            : '<span class="meal-plan-thumb meal-plan-thumb-empty"><i class="bi bi-image"></i></span>'
        }
        <span class="meal-plan-entry-title">${escapeHtml(recipe.title)}</span>
      </a>
      <button type="button" class="meal-plan-remove" data-remove-entry="${entry.id}" title="Remove" aria-label="Remove ${escapeHtml(recipe.title)}">
        <i class="bi bi-x-lg"></i>
      </button>
    </div>`;
}

function renderDayColumn(date, isToday) {
  const dateISO = toDateISO(date);
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' });
  const dayNum = date.getDate();
  const slots = MEAL_TYPES.map((meal) => {
    const items = slotEntries(dateISO, meal.value);
    return `
      <div class="meal-plan-slot">
        <div class="meal-plan-slot-label"><i class="bi ${meal.icon} me-1"></i>${meal.label}</div>
        <div class="meal-plan-slot-body">
          ${items.map(renderEntry).join('')}
          <button type="button" class="meal-plan-add" data-add-slot="${dateISO}|${meal.value}" title="Add ${meal.label}">
            <i class="bi bi-plus-lg"></i>
          </button>
        </div>
      </div>`;
  }).join('');
  return `
    <div class="meal-plan-day${isToday ? ' today' : ''}">
      <div class="meal-plan-day-head">
        <span class="meal-plan-weekday">${escapeHtml(weekday)}</span>
        <span class="meal-plan-daynum">${dayNum}</span>
        ${isToday ? '<span class="badge meal-plan-today-badge">Today</span>' : ''}
      </div>
      ${slots}
    </div>`;
}

function renderGrid() {
  const holder = document.getElementById('meal-plan-grid');
  if (!holder) return;
  const today = todayISO();
  const dates = weekDates(weekStart);
  holder.innerHTML = dates.map((d) => renderDayColumn(d, toDateISO(d) === today)).join('');
  holder.querySelectorAll('[data-add-slot]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [dateISO, mealType] = btn.dataset.addSlot.split('|');
      openPicker(dateISO, mealType);
    });
  });
  holder.querySelectorAll('[data-remove-entry]').forEach((btn) => {
    btn.addEventListener('click', () => handleRemove(btn.dataset.removeEntry));
  });
}

function updateWeekLabel() {
  const el = document.getElementById('week-label');
  if (!el) return;
  const dates = weekDates(weekStart);
  const first = dates[0];
  const last = dates[6];
  const sameMonth = first.getMonth() === last.getMonth();
  const fmt = { day: 'numeric', month: 'short' };
  el.textContent = sameMonth
    ? `${first.toLocaleDateString(undefined, fmt)} - ${last.getDate()}, ${last.toLocaleDateString(undefined, { month: 'short' })}`
    : `${first.toLocaleDateString(undefined, fmt)} - ${last.toLocaleDateString(undefined, fmt)}`;
}

async function loadWeek() {
  const dates = weekDates(weekStart);
  const { data, error } = await listMealPlan(toDateISO(dates[0]), toDateISO(dates[6]));
  const holder = document.getElementById('meal-plan-grid');
  if (error) {
    if (holder) {
      holder.innerHTML = `<div class="meal-plan-empty text-muted">Could not load your meal plan: ${escapeHtml(error.message)}</div>`;
    }
    return;
  }
  entries = data || [];
  renderGrid();
  const emptyEl = document.getElementById('meal-plan-empty-note');
  if (emptyEl) {
    emptyEl.classList.toggle('d-none', entries.length > 0);
  }
}

async function handleRemove(entryId) {
  const entry = entries.find((e) => e.id === entryId);
  const title = entry?.recipe?.title || 'this recipe';
  const ok = await confirmDialog({
    title: 'Remove from meal plan',
    body: `Remove "${title}" from your meal plan?`,
    confirmLabel: 'Remove',
  });
  if (!ok) return;
  const { error } = await removeMealPlanEntry(entryId);
  if (error) {
    showAlert('#alert-area', `Could not remove the entry: ${error.message}`);
    return;
  }
  entries = entries.filter((e) => e.id !== entryId);
  renderGrid();
}

function renderPickerList(filter) {
  const holder = document.getElementById('picker-list');
  if (!holder) return;
  const term = (filter || '').trim().toLowerCase();
  const filtered = pickerRecipes.filter((r) => !term || r.title.toLowerCase().includes(term));
  if (!filtered.length) {
    holder.innerHTML = '<p class="text-muted small mb-0 p-2">No recipes match.</p>';
    return;
  }
  holder.innerHTML = filtered
    .map((r) => {
      const cover = recipeCoverUrl(r);
      return `
      <button type="button" class="picker-item" data-pick-recipe="${r.id}">
        ${
          cover
            ? `<img src="${escapeHtml(cover)}" class="picker-thumb" alt="" loading="lazy" />`
            : '<span class="picker-thumb picker-thumb-empty"><i class="bi bi-image"></i></span>'
        }
        <span class="picker-title">${escapeHtml(r.title)}</span>
        ${r.is_featured ? '<i class="bi bi-award-fill text-accent" title="Featured"></i>' : ''}
      </button>`;
    })
    .join('');
  holder.querySelectorAll('[data-pick-recipe]').forEach((btn) => {
    btn.addEventListener('click', () => handlePick(btn.dataset.pickRecipe, btn));
  });
}

async function openPicker(dateISO, mealType) {
  pickerTarget = { dateISO, mealType };
  const modalEl = document.getElementById('picker-modal');
  const meal = mealTypeMeta(mealType);
  const titleEl = document.getElementById('picker-title');
  if (titleEl) {
    titleEl.innerHTML = `<i class="bi ${meal.icon} me-1"></i>Add to ${escapeHtml(formatShortDate(dateISO))} - ${meal.label}`;
  }
  const list = document.getElementById('picker-list');
  if (list) list.innerHTML = '<p class="text-muted small mb-0 p-2"><span class="spinner-border spinner-border-sm me-2"></span>Loading recipes...</p>';
  const search = document.getElementById('picker-search');
  if (search) search.value = '';

  const [favResult, allResult] = await Promise.all([
    listFavorites(),
    listRecipes({ limit: 50 }),
  ]);
  const favIds = new Set((favResult.data || []).map((r) => r.id));
  const favs = favResult.data || [];
  const rest = (allResult.data || []).filter((r) => !favIds.has(r.id));
  pickerRecipes = [...favs, ...rest];
  renderPickerList('');

  const modal = Modal.getOrCreateInstance(modalEl);
  modal.show();
}

async function handlePick(recipeId, btn) {
  if (!pickerTarget) return;
  btn.disabled = true;
  const { error } = await addMealPlanEntry(recipeId, pickerTarget.dateISO, pickerTarget.mealType);
  if (error) {
    btn.disabled = false;
    const list = document.getElementById('picker-list');
    if (list) {
      list.insertAdjacentHTML('afterbegin', `<div class="alert alert-danger alert-sm py-2 px-3 mb-2">${escapeHtml(error.message)}</div>`);
    }
    return;
  }
  Modal.getInstance(document.getElementById('picker-modal'))?.hide();
  await loadWeek();
}

function renderSkeleton(app) {
  app.innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h1 class="h3 mb-0">Meal plan</h1>
      <div class="d-flex align-items-center gap-2">
        <button type="button" id="prev-week-btn" class="btn btn-outline-secondary btn-sm"><i class="bi bi-chevron-left"></i> Week</button>
        <span id="week-label" class="fw-semibold"></span>
        <button type="button" id="next-week-btn" class="btn btn-outline-secondary btn-sm">Week <i class="bi bi-chevron-right"></i></button>
        <button type="button" id="this-week-btn" class="btn btn-recipe btn-sm">This week</button>
      </div>
    </div>
    <div id="alert-area"></div>
    <p class="text-muted small" id="meal-plan-empty-note">Nothing planned yet. Tap + on any slot to add a recipe.</p>
    <div class="meal-plan-scroll">
      <div id="meal-plan-grid" class="meal-plan-grid"></div>
    </div>
    <div class="modal fade" id="picker-modal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title h5" id="picker-title">Add to meal plan</h2>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <input type="search" id="picker-search" class="form-control mb-3" placeholder="Search recipes..." />
            <div class="d-flex flex-column gap-1" id="picker-list" style="max-height: 50vh; overflow-y: auto;"></div>
            <p class="text-muted small mt-3 mb-0">Looking for more? <a href="/index.html">Browse the feed</a> and use "Plan this meal" on any recipe.</p>
          </div>
        </div>
      </div>
    </div>`;
}

async function init() {
  await renderNavbar();
  const user = await requireAuth();
  if (!user) return;
  const app = document.getElementById('app');

  const dateParam = new URLSearchParams(window.location.search).get('date');
  const parsed = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? parseDateISO(dateParam) : new Date();
  weekStart = startOfWeek(parsed);

  renderSkeleton(app);
  updateWeekLabel();

  document.getElementById('prev-week-btn').addEventListener('click', () => {
    weekStart = addDays(weekStart, -7);
    updateWeekLabel();
    loadWeek();
  });
  document.getElementById('next-week-btn').addEventListener('click', () => {
    weekStart = addDays(weekStart, 7);
    updateWeekLabel();
    loadWeek();
  });
  document.getElementById('this-week-btn').addEventListener('click', () => {
    weekStart = startOfWeek(new Date());
    updateWeekLabel();
    loadWeek();
  });

  const search = document.getElementById('picker-search');
  search?.addEventListener('input', () => renderPickerList(search.value));

  await loadWeek();
}

init();
