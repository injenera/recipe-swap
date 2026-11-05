export function renderStars(avg, { showValue = false } = {}) {
  const rounded = Math.round((Number(avg) || 0) * 2) / 2;
  let html = `<span class="stars" role="img" aria-label="Rated ${rounded} out of 5 stars">`;
  for (let i = 1; i <= 5; i++) {
    let icon = 'bi-star';
    if (rounded >= i) icon = 'bi-star-fill';
    else if (rounded >= i - 0.5) icon = 'bi-star-half';
    html += `<i class="bi ${icon}"></i>`;
  }
  html += '</span>';
  if (showValue) {
    html += `<span class="ms-1 text-muted small">${rounded.toFixed(1)}</span>`;
  }
  return html;
}
