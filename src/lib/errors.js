/**
 * errors.js
 *
 * Centralized, non-blocking error surface + global handlers.
 *
 * The app runs on a projected/screen-recorded tablet. A blocking alert() or an
 * uncaught exception that white-screens the WebView would ruin a live game, so
 * every error is funneled here and shown as a dismissible banner instead.
 */

let bannerEl = null;
let hideTimer = null;

/**
 * Wire up the banner element and global error listeners. Call once at startup.
 * @param {HTMLElement} el the #error-banner element
 */
export function initErrorHandling(el) {
  bannerEl = el;

  window.addEventListener('error', (event) => {
    console.error('[global error]', event.error || event.message);
    showError('Something went wrong, but the game is still running.');
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[unhandled rejection]', event.reason);
    showError('A background task failed, but the game is still running.');
  });
}

/**
 * Display a transient error banner. Safe to call before init (no-op with log).
 * @param {string} message user-facing text (keep it non-technical)
 * @param {number} [timeoutMs=5000]
 */
export function showError(message, timeoutMs = 5000) {
  if (!bannerEl) {
    console.error('[showError, no banner]', message);
    return;
  }
  bannerEl.textContent = message;
  bannerEl.hidden = false;
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (bannerEl) bannerEl.hidden = true;
  }, timeoutMs);
}

/**
 * Run a function, catching and surfacing any error without rethrowing.
 * Returns the function's result, or `fallback` if it threw.
 * @template T
 * @param {() => T} fn
 * @param {T} [fallback]
 * @param {string} [userMessage]
 * @returns {T}
 */
export function guard(fn, fallback = undefined, userMessage) {
  try {
    return fn();
  } catch (err) {
    console.error('[guard] caught:', err);
    if (userMessage) showError(userMessage);
    return fallback;
  }
}
