/**
 * ui/confirm.js — in-app confirmation dialog.
 *
 * Replaces window.confirm(), which renders as a jarring native system dialog in
 * a WebView kiosk. This is a styled overlay card that matches the app, and it's
 * promise-based so callers can `await` the user's choice.
 */

import { el } from './render.js';

/**
 * Show a modal confirm card and resolve with the user's choice.
 *
 * Only one confirm is shown at a time by construction (callers await it). The
 * overlay traps taps: the backdrop and Cancel resolve false; Confirm resolves
 * true. The overlay is removed from the DOM before the promise resolves.
 *
 * @param {Object} opts
 * @param {string} opts.title    short heading
 * @param {string} opts.message  body text
 * @param {string} [opts.confirmText='Confirm']
 * @param {string} [opts.cancelText='Cancel']
 * @param {boolean} [opts.danger=false] style the confirm button as destructive
 * @returns {Promise<boolean>} true if confirmed, false if cancelled/dismissed
 */
export function confirmDialog({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      overlay.remove();
      resolve(result);
    };

    const cancelBtn = el('button', {
      class: 'btn btn--ghost confirm-card__btn',
      text: cancelText,
      onClick: () => finish(false),
    });
    const confirmBtn = el('button', {
      class: `btn ${danger ? 'btn--danger' : 'btn--primary'} confirm-card__btn`,
      text: confirmText,
      onClick: () => finish(true),
    });

    const card = el('div', { class: 'confirm-card', role: 'document' }, [
      el('h2', { class: 'confirm-card__title', text: title }),
      el('p', { class: 'confirm-card__message', text: message }),
      el('div', { class: 'confirm-card__actions' }, [cancelBtn, confirmBtn]),
    ]);

    const overlay = el(
      'div',
      {
        class: 'confirm-overlay',
        role: 'alertdialog',
        'aria-modal': 'true',
        'aria-label': title,
        // Tap the dimmed backdrop (but not the card) to cancel.
        onClick: (e) => {
          if (e.target === overlay) finish(false);
        },
      },
      [card]
    );

    document.body.appendChild(overlay);
  });
}
