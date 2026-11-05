import { Modal } from 'bootstrap';
import { escapeHtml } from '../utils/dom.js';

export function confirmDialog({
  title = 'Are you sure?',
  body = '',
  confirmLabel = 'Confirm',
  confirmClass = 'btn-danger',
} = {}) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="modal fade" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h2 class="modal-title h5">${escapeHtml(title)}</h2>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body"><p class="mb-0">${escapeHtml(body)}</p></div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn ${confirmClass}" data-confirm="yes">${escapeHtml(confirmLabel)}</button>
            </div>
          </div>
        </div>
      </div>`;
    const modalEl = wrap.firstElementChild;
    document.body.appendChild(modalEl);
    const modal = new Modal(modalEl);
    let confirmed = false;
    modalEl.querySelector('[data-confirm="yes"]').addEventListener('click', () => {
      confirmed = true;
      modal.hide();
    });
    modalEl.addEventListener('hidden.bs.modal', () => {
      modal.dispose();
      modalEl.remove();
      resolve(confirmed);
    });
    modal.show();
  });
}
