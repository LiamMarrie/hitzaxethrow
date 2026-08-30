/**
 * dartboard.js — 501 darts game logic (pure, framework-free).
 *
 * State layer only: the router (main.js) drives this and the board UI is a thin
 * projection over the returned state, matching target.js / connect4.js. Every
 * player starts at 501 and subtracts the score of each dart they throw. Play is
 * in VISITS of DARTS_PER_VISIT (3) darts; players take a whole visit, then the
 * turn passes. First player to reach EXACTLY 0 wins ("any out" — no double
 * required). A dart that would take a player below 0 BUSTS: every dart of that
 * visit is voided, the player's remaining returns to what it was at the start of
 * the visit, and the turn passes.
 *
 * Turn order and the "which dart of which visit" position are DERIVED from the
 * ordered `darts` history rather than stored, so undo is just dropping the last
 * dart and recomputing — including undo across a bust, which brings the busted
 * darts back.
 *
 * State shape:
 *   {
 *     players: [{id,name}],
 *     scores:  { [playerId]: number },     // remaining, counts down from 501
 *     darts:   Dart[],                      // every dart, in throw order
 *     winner:  string|null,                 // winning playerId, or null
 *   }
 *
 * Dart shape (one entry per dart actually thrown, busted darts included):
 *   { playerId, value, busted }
 *   - value: the dart's point total (0..60; bull 25, inner bull 50)
 *   - busted: true if this dart was part of a visit that busted (its points do
 *     NOT reduce the running remaining; kept so undo can restore the visit)
 *
 * Every mutating function is immutable: it returns a NEW state, or the SAME
 * reference to signal a no-op (game over / illegal value / no player / nothing
 * to undo), matching the applyThrow/undoLastThrow convention so main.js's guards
 * work unchanged.
 */

export const GAME_KEY = 'dartboard';
export const GAME_NAME = '501';

/** Starting score for every player. */
export const START_SCORE = 501;
/** Darts thrown per visit before the turn passes. */
export const DARTS_PER_VISIT = 3;

/**
 * @typedef {{id:string,name:string}} Player
 * @typedef {{playerId:string,value:number,busted:boolean}} Dart
 * @typedef {Object} GameState
 * @property {Player[]} players
 * @property {Object<string,number>} scores  playerId -> remaining
 * @property {Dart[]} darts
 * @property {string|null} winner
 */

/**
 * The set of point totals a single dart can score: 0 (miss), 1..20 singles,
 * 2..40 even doubles, 3..60 multiples-of-3 triples, plus 25 and 50 for the
 * bull. Precomputed so applyThrow can reject impossible values (e.g. 23, 61).
 * @type {Set<number>}
 */
const LEGAL_DART_VALUES = (() => {
  const set = new Set([0, 25, 50]);
  for (let n = 1; n <= 20; n++) {
    set.add(n); // single
    set.add(n * 2); // double
    set.add(n * 3); // triple
  }
  return set;
})();

/**
 * Whether a value is a score a single dart can actually produce.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isLegalDartValue(value) {
  return typeof value === 'number' && LEGAL_DART_VALUES.has(value);
}

/**
 * Build a fresh game state for the given players. Every player starts at
 * START_SCORE with no darts thrown.
 * @param {Player[]} [players]
 * @returns {GameState}
 */
export function createState(players = []) {
  const list = players.map((p) => ({ id: p.id, name: p.name }));
  const scores = {};
  for (const p of list) scores[p.id] = START_SCORE;
  return { players: list, scores, darts: [], winner: null };
}

/**
 * Remaining score for a player (START_SCORE if unknown).
 * @param {GameState} state
 * @param {string} playerId
 * @returns {number}
 */
export function remainingFor(state, playerId) {
  const v = state?.scores?.[playerId];
  return typeof v === 'number' ? v : START_SCORE;
}

/**
 * How many non-busted darts a player has thrown in their CURRENT (in-progress)
 * visit — i.e. darts thrown since their last completed visit. A visit completes
 * at DARTS_PER_VISIT darts or when it busts; either way subsequent darts start a
 * fresh visit. Counts back over this player's trailing darts, stopping at a
 * busted dart (a bust ends a visit) or once a full visit's worth is seen.
 * @param {GameState} state
 * @param {string} playerId
 * @returns {number} 0..DARTS_PER_VISIT-1
 */
function dartsInCurrentVisit(state, playerId) {
  const darts = state.darts;
  let count = 0;
  for (let i = darts.length - 1; i >= 0; i--) {
    const d = darts[i];
    if (d.playerId !== playerId) break; // reached the previous player's visit
    if (d.busted) break; // a bust closed the prior visit
    count++;
    if (count === DARTS_PER_VISIT) break; // a full completed visit
  }
  return count % DARTS_PER_VISIT;
}

/**
 * @typedef {Object} ActivePosition
 * @property {string} playerId  who throws next
 * @property {number} playerIdx index of that player in state.players
 * @property {number} dartInVisit 0-based dart index within the current visit
 */

/**
 * Who throws the next dart, and where in their visit it falls. Turn order:
 * player 0 takes a full visit, then player 1, and so on, wrapping around. The
 * active player is whoever's visit is in progress; when the last dart completed
 * a visit (3 darts or a bust), it's the next player's turn. Null when the game
 * is over or there are no players.
 * @param {GameState} state
 * @returns {ActivePosition|null}
 */
export function activePosition(state) {
  const players = state?.players ?? [];
  if (players.length === 0 || state.winner) return null;

  const last = state.darts[state.darts.length - 1];
  if (!last) {
    return { playerId: players[0].id, playerIdx: 0, dartInVisit: 0 };
  }

  const lastIdx = players.findIndex((p) => p.id === last.playerId);
  const inVisit = dartsInCurrentVisit(state, last.playerId);
  // The last thrower keeps the turn if their visit is still open (some darts
  // thrown, not yet a full visit, and it didn't bust).
  if (inVisit !== 0 && !last.busted) {
    return {
      playerId: last.playerId,
      playerIdx: lastIdx,
      dartInVisit: inVisit,
    };
  }
  const nextIdx = (lastIdx + 1) % players.length;
  return { playerId: players[nextIdx].id, playerIdx: nextIdx, dartInVisit: 0 };
}

/**
 * The next throw slot for a specific player. With visit-based turns this is
 * simply where that player is in their current visit; used by the referee
 * override path and the board's status line. Null if the player isn't in the
 * game or the game is over.
 * @param {GameState} state
 * @param {string} playerId
 * @returns {ActivePosition|null}
 */
export function positionForPlayer(state, playerId) {
  const players = state?.players ?? [];
  if (state.winner) return null;
  const playerIdx = players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return null;
  return {
    playerId,
    playerIdx,
    dartInVisit: dartsInCurrentVisit(state, playerId),
  };
}

/**
 * Whether the game is over (someone has reached 0).
 * @param {GameState} state
 * @returns {boolean}
 */
export function isComplete(state) {
  return Boolean(state?.winner);
}

/**
 * Shallow-clone the mutable parts of state so updates never mutate the input.
 * @param {GameState} state
 * @returns {GameState}
 */
function cloneState(state) {
  return {
    ...state,
    scores: { ...state.scores },
    darts: state.darts.slice(),
  };
}

/**
 * The point value of a busted visit that must be added back to a player's
 * remaining: the sum of the non-busted darts already thrown in the current
 * visit (they were subtracted from remaining as they landed). Walks this
 * player's trailing non-busted darts of the in-progress visit.
 * @param {GameState} state
 * @param {string} playerId
 * @returns {number}
 */
function currentVisitPoints(state, playerId) {
  const darts = state.darts;
  const inVisit = dartsInCurrentVisit(state, playerId);
  let sum = 0;
  let seen = 0;
  for (let i = darts.length - 1; i >= 0 && seen < inVisit; i--) {
    const d = darts[i];
    if (d.playerId !== playerId || d.busted) break;
    sum += d.value;
    seen++;
  }
  return sum;
}

/**
 * Record a dart and return a new state. By default the dart goes to the active
 * thrower; pass `playerId` to score for a specific player instead (referee
 * override / out-of-turn correction).
 *
 * Outcomes:
 *  - exact 0  -> that player wins (any out), game locks.
 *  - below 0  -> BUST: the whole visit is voided (remaining restored to the
 *                visit's start), the busting dart is recorded as busted so undo
 *                can bring it back, and the turn passes.
 *  - otherwise -> remaining reduced by the dart value.
 *
 * No-op (same reference) when the game is over, when `value` isn't a legal
 * single-dart score, or when the chosen player isn't in the game.
 * @param {GameState} state
 * @param {number} value one of the legal dart values
 * @param {string} [playerId] override the active thrower
 * @returns {GameState}
 */
export function applyThrow(state, value, playerId) {
  if (state.winner) return state;
  if (!isLegalDartValue(value)) return state;

  const pos = playerId
    ? positionForPlayer(state, playerId)
    : activePosition(state);
  if (!pos) return state;

  const id = pos.playerId;
  const remaining = remainingFor(state, id);
  const next = cloneState(state);

  if (remaining - value === 0) {
    next.darts.push({ playerId: id, value, busted: false });
    next.scores[id] = 0;
    next.winner = id;
    return next;
  }

  if (remaining - value < 0) {
    // Bust: void the whole visit. Restore the points of the non-busted darts
    // already thrown this visit, mark them and the busting dart as busted.
    const restore = currentVisitPoints(state, id);
    const visitDarts = dartsInCurrentVisit(state, id);
    for (
      let i = next.darts.length - 1, marked = 0;
      i >= 0 && marked < visitDarts;
      i--
    ) {
      if (next.darts[i].playerId === id && !next.darts[i].busted) {
        next.darts[i] = { ...next.darts[i], busted: true };
        marked++;
      } else {
        break;
      }
    }
    next.darts.push({ playerId: id, value, busted: true });
    next.scores[id] = remaining + restore;
    return next;
  }

  next.darts.push({ playerId: id, value, busted: false });
  next.scores[id] = remaining - value;
  return next;
}

/**
 * Revert the most recently thrown dart and return a new state. Removing a dart
 * that had busted also un-busts the rest of that visit (they become live darts
 * again with their points re-subtracted), so undo cleanly walks back across a
 * bust. No-op (same reference) when nothing has been thrown.
 * @param {GameState} state
 * @returns {GameState}
 */
export function undoLastThrow(state) {
  if (!state.darts.length) return state;
  const next = cloneState(state);
  const removed = next.darts.pop();
  const id = removed.playerId;

  // Recompute this player's remaining from scratch over their surviving darts,
  // replaying visits so a previously-busted-and-now-reopened visit is scored
  // correctly.
  next.winner = null; // an undo always steps back out of a completed game
  next.scores[id] = replayRemaining(next.darts, id);
  // Un-bust any darts of the reopened visit: the visit that `removed` closed by
  // busting is now in progress again.
  if (removed.busted) {
    unbustTrailingVisit(next, id);
    next.scores[id] = replayRemaining(next.darts, id);
  }
  return next;
}

/**
 * Recompute a player's remaining by replaying their darts. Busted darts don't
 * reduce remaining (their visit was voided); live darts do.
 * @param {Dart[]} darts
 * @param {string} playerId
 * @returns {number}
 */
function replayRemaining(darts, playerId) {
  let remaining = START_SCORE;
  for (const d of darts) {
    if (d.playerId === playerId && !d.busted) remaining -= d.value;
  }
  return remaining;
}

/**
 * After removing a busting dart, the darts that busted alongside it should
 * become live again (the visit is back in progress). Clears `busted` on this
 * player's trailing run of busted darts.
 * @param {GameState} next
 * @param {string} playerId
 */
function unbustTrailingVisit(next, playerId) {
  for (let i = next.darts.length - 1; i >= 0; i--) {
    const d = next.darts[i];
    if (d.playerId !== playerId) break;
    if (!d.busted) break;
    next.darts[i] = { ...d, busted: false };
  }
}

/**
 * Structural check that a value is a usable state. Used when restoring a
 * persisted session, whose shape is untrusted.
 * @param {unknown} state
 * @returns {boolean}
 */
export function isValidState(state) {
  return (
    !!state &&
    typeof state === 'object' &&
    Array.isArray(state.players) &&
    !!state.scores &&
    typeof state.scores === 'object' &&
    Array.isArray(state.darts)
  );
}
