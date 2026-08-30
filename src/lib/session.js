/**
 * session.js
 *
 * Session lifecycle.
 *
 * Requirement: "a new session is created every time the app is opened or
 * closed, and everything is stored locally."
 *
 * Model:
 *  - CURRENT_SESSION_KEY holds the live session (game state, players, scores).
 *    It is persisted on every state change so an accidental close/reopen or a
 *    WebView reload does not lose the in-progress game.
 *  - startNewSession() mints a fresh session id and clears the current game
 *    state. It is called on app open.
 *  - archiveCurrentSession() moves the finished/closed session into a bounded
 *    history list (kept small; local-only) and is called on app close/pause.
 *
 * Nothing here ever wipes the whole store — see storage.js.
 */

import { readJSON, writeJSON, remove } from './storage.js';
import { containsBlockedWord } from './profanity.js';

const CURRENT_KEY = 'session:current';
const HISTORY_KEY = 'session:history';
const MAX_HISTORY = 25;

/**
 * Maximum player-name length. Sized to fit short display names like "Jason S".
 * The UI input mirrors this via maxlength; this constant is the source of truth.
 * @type {number}
 */
export const MAX_NAME_LENGTH = 12;

/**
 * Player-count bounds for a session. A game needs at least MIN_PLAYERS to start
 * (enforced on Continue via canContinue), and no more than MAX_PLAYERS may be
 * added (enforced in addPlayer).
 * @type {number}
 */
export const MIN_PLAYERS = 2;
/** @type {number} */
export const MAX_PLAYERS = 6;

/**
 * Generate a reasonably-unique session id. Uses crypto.randomUUID when the
 * WebView supports it, with a timestamp-based fallback.
 * @returns {string}
 */
export function generateSessionId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to fallback
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Generate a reasonably-unique player id, scoped to a session.
 * @returns {string}
 */
export function generatePlayerId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to fallback
  }
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @typedef {Object} Player
 * @property {string} id
 * @property {string} name
 */

/**
 * @typedef {Object} Session
 * @property {string} id
 * @property {number} createdAt  epoch ms
 * @property {'players'|'menu'} stage  which pre-game screen to show
 * @property {Player[]} players  players entered for this session
 * @property {string|null} game  active game key, or null on the menu
 * @property {object|null} state game-specific serialized state
 */

/**
 * Create and persist a brand-new session, replacing any current one.
 * @returns {Session}
 */
export function startNewSession() {
  const session = {
    id: generateSessionId(),
    createdAt: Date.now(),
    stage: 'players',
    players: [],
    game: null,
    state: null,
  };
  writeJSON(CURRENT_KEY, session);
  return session;
}

/**
 * Load the current session if present; otherwise start a new one. Backfills
 * fields added after a session was first persisted (players/stage) so a session
 * saved by an older build restores cleanly.
 * @returns {Session}
 */
export function loadOrStartSession() {
  const existing = readJSON(CURRENT_KEY, null);
  if (existing && typeof existing.id === 'string') {
    if (!Array.isArray(existing.players)) existing.players = [];
    if (existing.stage !== 'players' && existing.stage !== 'menu') {
      existing.stage = 'players';
    }
    return existing;
  }
  return startNewSession();
}

/**
 * Add a player to the session. Names are trimmed; blank, too-long
 * (> MAX_NAME_LENGTH), blocked, and case-insensitive duplicate names are
 * rejected, as is any player beyond MAX_PLAYERS. Persists on success.
 * @param {Session} session
 * @param {string} name
 * @returns {Player|null} the added player, or null if rejected
 */
export function addPlayer(session, name) {
  if (session.players.length >= MAX_PLAYERS) return null;
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_NAME_LENGTH) return null;
  if (containsBlockedWord(trimmed)) return null;
  const exists = session.players.some(
    (p) => p.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (exists) return null;
  const player = { id: generatePlayerId(), name: trimmed };
  session.players.push(player);
  saveSession(session);
  return player;
}

/**
 * Rename an existing player by id. Trims the new name; rejects a blank,
 * too-long (> MAX_NAME_LENGTH), or blocked name, and a collision with a
 * *different* player (case-insensitive). A pure case change of the same player
 * is allowed. Persists on success.
 * @param {Session} session
 * @param {string} id
 * @param {string} name
 * @returns {boolean} true if renamed
 */
export function editPlayer(session, id, name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return false;
  if (trimmed.length > MAX_NAME_LENGTH) return false;
  if (containsBlockedWord(trimmed)) return false;
  const target = session.players.find((p) => p.id === id);
  if (!target) return false;
  const collides = session.players.some(
    (p) => p.id !== id && p.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (collides) return false;
  target.name = trimmed;
  saveSession(session);
  return true;
}

/**
 * Remove a player by id. Persists on success.
 * @param {Session} session
 * @param {string} id
 * @returns {boolean} true if a player was removed
 */
export function removePlayer(session, id) {
  const idx = session.players.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  session.players.splice(idx, 1);
  saveSession(session);
  return true;
}

/**
 * Whether the session has enough players to leave the player-entry screen.
 * The upper bound is enforced in addPlayer, so only the lower bound matters
 * here.
 * @param {Session} session
 * @returns {boolean} true if the player count is at least MIN_PLAYERS
 */
export function canContinue(session) {
  return session.players.length >= MIN_PLAYERS;
}

/**
 * Persist an updated current session.
 * @param {Session} session
 * @returns {boolean}
 */
export function saveSession(session) {
  return writeJSON(CURRENT_KEY, session);
}

/**
 * Read the bounded session history (most recent first).
 * @returns {Session[]}
 */
export function getHistory() {
  const history = readJSON(HISTORY_KEY, []);
  return Array.isArray(history) ? history : [];
}

/**
 * Archive the current session into history and clear the current slot.
 * Called on app close/pause. History is capped at MAX_HISTORY entries.
 *
 * The current slot is only cleared if the history write actually succeeded —
 * otherwise (e.g. quota exceeded) we'd delete the session AND fail to archive
 * it, losing it entirely. On write failure the current session is left intact.
 * @returns {boolean} true if archived, false if there was nothing to archive or
 *   the history write failed (in which case the current session is preserved)
 */
export function archiveCurrentSession() {
  const current = readJSON(CURRENT_KEY, null);
  if (!current || typeof current.id !== 'string') return false;

  const history = getHistory();
  history.unshift({ ...current, archivedAt: Date.now() });
  const wrote = writeJSON(HISTORY_KEY, history.slice(0, MAX_HISTORY));
  if (!wrote) return false;

  remove(CURRENT_KEY);
  return true;
}

export const __keys__ = { CURRENT_KEY, HISTORY_KEY, MAX_HISTORY };
