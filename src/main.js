/**
 * main.js — app bootstrap, routing, and lifecycle wiring.
 *
 * Responsibilities:
 *  - Start a fresh session on open, restore any in-progress game.
 *  - Route between the menu and the active game.
 *  - On every move: update logic state -> persist to session -> re-render.
 *  - On app pause/close: archive the session (new session next open).
 */

import { initErrorHandling, showError, guard } from './lib/errors.js';
import { isStorageAvailable, readJSON } from './lib/storage.js';
import {
  loadOrStartSession,
  startNewSession,
  saveSession,
  archiveCurrentSession,
  addPlayer,
  editPlayer,
  removePlayer,
  canContinue,
  MAX_NAME_LENGTH,
  MIN_PLAYERS,
  MAX_PLAYERS,
  __keys__,
} from './lib/session.js';
import { containsBlockedWord } from './lib/profanity.js';
import { shuffleTurnOrder } from './lib/turn-order.js';
import { GAMES, getGame } from './games/index.js';
import { renderMenu, renderPlayers, mount } from './ui/render.js';
import {
  renderTarget,
  renderWatl,
  renderIatf,
  renderDartboard,
  renderTicTacToe,
  renderConnect4,
  renderPairs,
} from './ui/screens.js';
import { confirmDialog } from './ui/confirm.js';

// --- module-level app state ---
let session = null;
let screenEl = null;
// Id of the player row currently in edit mode (null = none). Transient UI
// state, not persisted with the session.
let editingPlayerId = null;
// Target game: id of a player the referee tapped to score out of turn (null =
// follow normal turn order). Transient UI state, cleared once the throw lands.
let activeOverrideId = null;

// Timestamp captured as this module starts, used to hold the loading screen
// for a minimum duration so it never flickers on a fast boot.
const bootStart = Date.now();
const MIN_LOADING_MS = 1000;

/**
 * Fade out and remove the loading overlay. Keeps it visible for at least
 * MIN_LOADING_MS after module start so setup always gets a moment to settle
 * and the splash doesn't flash by.
 */
function hideLoadingScreen() {
  const el = document.getElementById('loading');
  if (!el) return;
  const remaining = Math.max(0, MIN_LOADING_MS - (Date.now() - bootStart));
  setTimeout(() => {
    el.classList.add('loading--hidden');
    // Remove from the DOM after the fade so it can't trap taps.
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    // Fallback removal in case transitionend doesn't fire (reduced motion).
    setTimeout(() => el.remove(), 500);
  }, remaining);
}

/** Map a game key to its screen renderer. */
const SCREENS = {
  target: renderTarget,
  watl: renderWatl,
  iatf: renderIatf,
  dartboard: renderDartboard,
  tictactoe: renderTicTacToe,
  connect4: renderConnect4,
  pairs: renderPairs,
};

/**
 * A restored session is untrusted: it may predate a schema change or be
 * partially corrupted. If it points at a game we can't render, drop it back to
 * the menu (keeping the session id) so the app never boots into a broken game
 * screen. Mutates and re-persists the session when it repairs it.
 * @param {import('./lib/session.js').Session} s
 * @returns {import('./lib/session.js').Session}
 */
function sanitizeRestoredSession(s) {
  if (!s.game) return s;
  const game = getGame(s.game);
  const validator = game?.module.isValidState;
  const ok = game && (!validator || validator(s.state));
  if (!ok) {
    console.error('[session] discarding unusable restored game state:', s.game);
    s.game = null;
    s.state = null;
    saveSession(s);
  }
  return s;
}

function updateSessionBadge() {
  const badge = document.getElementById('session-badge');
  if (badge && session) {
    const shortId = session.id.slice(0, 8);
    badge.textContent = `Session ${shortId}`;
  }
}

/**
 * Show the app header only on the menu. In a game the title bar is just noise
 * on the projected display, so hide it while a game is active.
 */
function updateHeaderVisibility() {
  const header = document.querySelector('.app__header');
  if (header) header.hidden = Boolean(session.game);
}

/** Render whatever the current session points at. */
function render() {
  updateHeaderVisibility();
  // Player entry comes before the menu on a fresh session.
  if (!session.game && session.stage === 'players') {
    mount(
      screenEl,
      renderPlayers(session.players, {
        onAdd: addPlayerAndRender,
        onEdit: editPlayerAndRender,
        onDelete: deletePlayerAndRender,
        onContinue: goToMenuStage,
        editingId: editingPlayerId,
        onBeginEdit: beginEditPlayer,
      })
    );
    return;
  }
  if (!session.game) {
    mount(screenEl, renderMenu(GAMES, selectGame, goToPlayers));
    return;
  }
  const renderer = SCREENS[session.game];
  if (!renderer) {
    showError('Unknown game — returning to menu.');
    goToMenu();
    return;
  }
  mount(
    screenEl,
    renderer(session.state, {
      onBack: goToMenu,
      onThrow: recordThrow,
      onUndo: undoThrow,
      onPickPlayer: pickActivePlayer,
      onMove: recordMove,
      onReset: resetGame,
      activeOverrideId,
    })
  );
}

/**
 * Referee tapped a player's scoreboard row: make them the active thrower for
 * the next throw (override turn order). Tapping the already-selected player
 * clears the override, returning to normal turn order.
 * @param {string} playerId
 */
function pickActivePlayer(playerId) {
  activeOverrideId = activeOverrideId === playerId ? null : playerId;
  render();
}

/**
 * Record a throw for the active game and re-render. Uses the referee's override
 * player when one is set (Target only), otherwise normal turn order. Clears any
 * override once the throw lands. Persists on success.
 * @param {number} value one of the game's throw values
 */
function recordThrow(value) {
  const game = getGame(session.game);
  const apply = game?.module.applyThrow;
  if (!apply) return;
  guard(
    () => {
      const next = apply(session.state, value, activeOverrideId ?? undefined);
      if (next === session.state) return; // no-op (game complete / bad value)
      session.state = next;
      activeOverrideId = null; // one override per throw
      saveSession(session);
      render();
    },
    undefined,
    'Could not record that throw.'
  );
}

/** Undo the most recent throw for the active game and re-render. */
function undoThrow() {
  const game = getGame(session.game);
  const undo = game?.module.undoLastThrow;
  if (!undo) return;
  guard(
    () => {
      const next = undo(session.state);
      if (next === session.state) return; // nothing to undo
      session.state = next;
      activeOverrideId = null;
      saveSession(session);
      render();
    },
    undefined,
    'Could not undo the last throw.'
  );
}

/**
 * Record a move for a grid game (Tic-Tac-Toe) and re-render. Mirrors
 * recordThrow: apply to logic state, persist, re-render; a same-ref return
 * means the move was illegal (cell taken / game over) and is ignored.
 * @param {number} cell the tapped cell/column index
 */
function recordMove(cell) {
  const game = getGame(session.game);
  const apply = game?.module.applyMove;
  if (!apply) return;
  guard(
    () => {
      const next = apply(session.state, cell);
      if (next === session.state) return; // no-op (illegal move / game over)
      session.state = next;
      saveSession(session);
      render();
    },
    undefined,
    'Could not make that move.'
  );
}

/** Start a fresh round of the active grid game (rematch), keeping players. */
function resetGame() {
  const game = getGame(session.game);
  // `reset` marks a game as replayable (grid games / Pairs). Rather than reuse
  // the previous order via reset(state), rebuild fresh state from a newly
  // shuffled roster so the replay button also re-randomizes who goes first.
  if (!game?.module.reset) return;
  guard(
    () => {
      session.state = game.module.createState(
        shuffleTurnOrder(session.players, game.module.SEATS)
      );
      saveSession(session);
      render();
    },
    undefined,
    'Could not start a new game.'
  );
}

/**
 * Pick the banner message for a rejected name. Rejections collapse to a falsy
 * return from add/editPlayer, so we re-derive the reason here to show the right
 * message. Length is normally prevented by the input's maxlength, so the two
 * cases users actually hit are "blocked" and "duplicate".
 * @param {string} trimmed  already-trimmed name
 * @returns {string}
 */
function rejectionMessage(trimmed) {
  if (session.players.length >= MAX_PLAYERS) {
    return `You can have at most ${MAX_PLAYERS} players.`;
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return `Keep names to ${MAX_NAME_LENGTH} characters or fewer.`;
  }
  if (containsBlockedWord(trimmed)) return "That name isn't allowed.";
  return 'That name is already in the list.';
}

/** Add a player from the form, then re-render (clearing the input). */
function addPlayerAndRender(name) {
  const added = addPlayer(session, name);
  const trimmed = String(name ?? '').trim();
  if (!added && trimmed) {
    showError(rejectionMessage(trimmed), 3000);
  }
  render();
}

/** Save an edited player name, then leave edit mode and re-render. */
function editPlayerAndRender(id, name) {
  const ok = editPlayer(session, id, name);
  if (!ok) {
    const trimmed = String(name ?? '').trim();
    showError(trimmed ? rejectionMessage(trimmed) : 'Enter a name.', 3000);
    return; // stay in edit mode so the name isn't lost
  }
  editingPlayerId = null;
  render();
}

/** Remove a player, then re-render. */
function deletePlayerAndRender(id) {
  removePlayer(session, id);
  if (editingPlayerId === id) editingPlayerId = null;
  render();
}

/** Toggle which player row is in edit mode (null = none). */
function beginEditPlayer(id) {
  editingPlayerId = id;
  render();
}

/** Advance from the players screen to the game menu — only with enough players. */
function goToMenuStage() {
  if (!canContinue(session)) {
    showError(`Add at least ${MIN_PLAYERS} players to continue.`, 3000);
    return;
  }
  session.stage = 'menu';
  editingPlayerId = null;
  saveSession(session);
  render();
}

/**
 * Return from the menu to the player-entry screen so the roster can be
 * changed between games. Unlike "End session", this KEEPS the current session
 * and its players — add/edit/remove there persist onto the existing roster via
 * the session helpers — it just switches which pre-game screen is shown.
 */
function goToPlayers() {
  session.stage = 'players';
  editingPlayerId = null;
  saveSession(session);
  render();
}

/** Start a chosen game and persist. */
function selectGame(key) {
  const game = getGame(key);
  if (!game) {
    showError('That game is not available.');
    return;
  }
  guard(
    () => {
      session.game = key;
      // Randomize turn order per game so it isn't always the first-entered
      // player who starts (see lib/turn-order.js). Two-player games declare
      // SEATS so only the first two players are seated — the shuffle just swaps
      // who goes first between them. The roster itself is left untouched.
      session.state = game.module.createState(
        shuffleTurnOrder(session.players, game.module.SEATS)
      );
      saveSession(session);
      render();
    },
    undefined,
    'Could not start the game.'
  );
}

/** Return to the menu, keeping the session but clearing the active game. */
function goToMenu() {
  session.game = null;
  session.state = null;
  saveSession(session);
  render();
}

/**
 * End the current session ("close the lane"). Archives the current session
 * (preserving history, same as an app close) and starts a fresh one, which
 * lands back on the register-players screen with an empty roster.
 *
 * A game may be mid-play, so confirm before discarding it.
 */
async function endSession() {
  const inGame = Boolean(session.game);
  const message = inGame
    ? 'End this session and clear the current game? Players will need to be re-entered.'
    : 'End this session and clear the players?';
  const ok = await confirmDialog({
    title: 'End session',
    message,
    confirmText: 'End session',
    cancelText: 'Keep playing',
    danger: true,
  });
  if (!ok) return;

  // Archive so the finished session goes to history, then mint a fresh one.
  // archiveCurrentSession clears the current slot; startNewSession writes a new
  // session in the 'players' stage with no players.
  archiveCurrentSession();
  session = startNewSession();
  editingPlayerId = null;
  updateSessionBadge();
  render();
}

/**
 * Archive on close/background. If the archive write fails (e.g. quota), the
 * session is preserved rather than lost — warn so it's visible before backgrounding.
 */
function archiveOnClose() {
  const current = readJSON(__keys__.CURRENT_KEY, null);
  if (current && !archiveCurrentSession()) {
    showError('Could not save this session — storage may be full.');
  }
}

/** Wire Capacitor app lifecycle so close/background archives the session. */
async function wireLifecycle() {
  try {
    // Dynamic import so the web dev build works without the native plugin.
    const { App } = await import('@capacitor/app');
    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        // App backgrounded/closed: archive so a fresh session starts next open.
        archiveOnClose();
      }
    });
  } catch {
    // Not running under Capacitor (e.g. plain browser dev) — fall back to the
    // web visibility + pagehide events.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') archiveOnClose();
    });
    window.addEventListener('pagehide', () => archiveOnClose());
  }
}

/** App entry point. */
function boot() {
  screenEl = document.getElementById('screen');
  initErrorHandling(document.getElementById('error-banner'));

  if (!isStorageAvailable()) {
    showError(
      'Local storage is unavailable — scores will not be saved.',
      10000
    );
  }

  // Restore an in-progress session if the WebView reloaded; otherwise start
  // fresh. A brand-new open (after a prior archive) yields a new session here.
  session = loadOrStartSession();
  if (!session || !session.id) session = startNewSession();
  session = sanitizeRestoredSession(session);

  updateSessionBadge();
  // Wire the header "End session" button (close the lane).
  const endBtn = document.getElementById('end-session');
  if (endBtn) endBtn.addEventListener('click', endSession);
  // Guard the first render: even after sanitizing, a renderer must never be
  // able to white-screen the projected display. On failure, fall back to the
  // menu rather than letting the exception reach boot()'s fatal handler.
  guard(
    render,
    undefined,
    'Could not restore the last game — returning to the menu.'
  );
  if (!screenEl.hasChildNodes()) {
    session.game = null;
    session.state = null;
    saveSession(session);
    guard(render);
  }
  wireLifecycle();

  // App is set up — take down the loading screen (after the minimum hold).
  hideLoadingScreen();
}

// Guard the whole boot so a startup error still shows a banner, not a blank
// projected screen.
try {
  boot();
} catch (err) {
  console.error('[boot] fatal:', err);
  // Take down the loading screen so the error banner is visible instead of a
  // blank blue splash the user can't get past.
  hideLoadingScreen();
  const banner = document.getElementById('error-banner');
  if (banner) {
    banner.hidden = false;
    banner.textContent = 'The app failed to start. Please reopen it.';
  }
}
