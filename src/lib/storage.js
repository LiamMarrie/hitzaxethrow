/**
 * storage.js
 *
 * A defensive wrapper around localStorage.
 *
 * Why this exists:
 *  - The app is local-only (no server, no DB). localStorage is the single
 *    source of truth, so every read/write must fail loudly-but-safely rather
 *    than throwing and crashing the game mid-session.
 *  - We NEVER call localStorage.clear() anywhere in the app. Data is only ever
 *    removed by an explicit, namespaced remove of a known key. This protects
 *    against accidentally wiping other keys and satisfies the "the game must
 *    not wipe its memory" requirement.
 *  - All values are namespaced under a prefix so a stray key from elsewhere
 *    can never collide with ours.
 */

const PREFIX = 'axethrow:';

/**
 * Returns true if a working localStorage is available. In a WebView, storage
 * can be disabled or full; we probe once and cache nothing so a later grant
 * still works.
 * @returns {boolean}
 */
export function isStorageAvailable() {
  try {
    const probe = `${PREFIX}__probe__`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read and JSON-parse a namespaced value.
 * @template T
 * @param {string} key
 * @param {T} [fallback] value returned if missing or unreadable
 * @returns {T|null}
 */
export function readJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    // Corrupt/unparseable data must not crash the app. Return the fallback and
    // let the caller decide whether to re-seed.
    console.error(`[storage] failed to read "${key}":`, err);
    return fallback;
  }
}

/**
 * JSON-serialize and write a namespaced value.
 * @param {string} key
 * @param {unknown} value
 * @returns {boolean} true on success, false if the write failed (e.g. quota)
 */
export function writeJSON(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`[storage] failed to write "${key}":`, err);
    return false;
  }
}

/**
 * Remove a single namespaced key. Never clears the whole store.
 * @param {string} key
 * @returns {boolean}
 */
export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
    return true;
  } catch (err) {
    console.error(`[storage] failed to remove "${key}":`, err);
    return false;
  }
}

export const __PREFIX__ = PREFIX;
