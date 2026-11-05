export function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}

export function showAlert(container, message, type = 'danger') {
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  if (!el) return;
  el.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${escapeHtml(message)}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>`;
}

export function clearAlerts(container) {
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  if (el) el.innerHTML = '';
}

export function setLoading(button, isLoading, loadingText = 'Please wait...') {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalContent = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${escapeHtml(
      loadingText
    )}`;
  } else {
    button.disabled = false;
    if (button.dataset.originalContent != null) {
      button.innerHTML = button.dataset.originalContent;
      delete button.dataset.originalContent;
    }
  }
}

export function renderPlaceholder(app, title, description, icon = 'bi-hourglass-split') {
  if (!app) return;
  app.innerHTML = `
    <h1 class="h3 mb-4">${escapeHtml(title)}</h1>
    <div class="card card-lift">
      <div class="card-body text-center py-5">
        <i class="bi ${icon} display-4 text-accent"></i>
        <h2 class="h5 mt-3">Coming soon</h2>
        <p class="text-muted mb-0">${escapeHtml(description)}</p>
      </div>
    </div>`;
}
