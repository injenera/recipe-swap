import { getPublicUrl } from '../services/storage.js';
import { escapeHtml } from '../utils/dom.js';
import { renderStars } from './stars.js';

export function recipeCoverUrl(recipe) {
  const photos = [...(recipe.photos || [])].sort((a, b) => a.position - b.position);
  const cover = photos.find((p) => p.is_cover) || photos[0];
  return cover ? getPublicUrl('recipe-photos', cover.storage_path) : '';
}

export function renderRecipeCard(recipe, stats, extraHtml = '') {
  const cover = recipeCoverUrl(recipe);
  const totalMinutes = (recipe.prep_minutes || 0) + (recipe.cook_minutes || 0);
  const authorName = recipe.author?.display_name || 'Unknown cook';
  const category = recipe.category;
  const stat = stats?.get(recipe.id);
  const avg = stat?.avg_rating || 0;
  const count = stat?.rating_count || 0;

  return `
    <div class="col">
      <a href="/recipe.html?id=${encodeURIComponent(recipe.id)}" class="recipe-card-link text-decoration-none">
        <div class="card recipe-card card-lift h-100">
          <div class="recipe-card-media">
            ${
              cover
                ? `<img src="${escapeHtml(cover)}" class="card-img-top" alt="${escapeHtml(recipe.title)}" loading="lazy" />`
                : '<div class="recipe-card-placeholder"><i class="bi bi-image"></i></div>'
            }
            ${
              recipe.is_featured
                ? '<span class="badge featured-badge"><i class="bi bi-award-fill me-1"></i>Featured</span>'
                : ''
            }
          </div>
          <div class="card-body">
            ${
              category
                ? `<span class="badge category-badge mb-2"><i class="bi ${escapeHtml(
                    category.icon || 'bi-bookmark'
                  )} me-1"></i>${escapeHtml(category.name)}</span>`
                : ''
            }
            <h3 class="h6 card-title text-dark">${escapeHtml(recipe.title)}</h3>
            <p class="card-text text-muted small mb-2">
              <i class="bi bi-person me-1"></i>${escapeHtml(authorName)}
            </p>
            <div class="d-flex justify-content-between align-items-center small">
              ${
                totalMinutes > 0
                  ? `<span class="text-muted"><i class="bi bi-clock me-1"></i>${totalMinutes} min</span>`
                  : '<span></span>'
              }
              <span class="text-nowrap">${renderStars(avg)} <span class="text-muted ms-1">(${count})</span></span>
            </div>
          </div>
        </div>
      </a>
      ${extraHtml}
    </div>`;
}
