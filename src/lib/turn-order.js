/**
 * turn-order.js — global turn-order randomization.
 *
 * Turn order in every game is DERIVED from the order of the players array
 * passed to a game's `createState` (index 0 throws/moves first): the
 * ring-target games walk `state.players` in order, 501 starts at `players[0]`
 * and wraps, and the grid games (Tic-Tac-Toe, Connect 4) use
 * `moves.length % 2` so index 0 always goes first. So the single lever that
 * controls who goes first — for every game — is the order of that array.
 *
 * This module is that lever. Callers shuffle a COPY of the session roster with
 * `shuffleTurnOrder(...)` and hand the result to `createState`, so the game is
 * built with a randomized turn order. Doing it here (once) keeps every game
 * module free of turn-order randomization and gives a fresh order on both game
 * open and replay.
 *
 * Uses Math.random on purpose: turn order is cosmetic fairness, not something
 * that must be reproducible or cryptographically strong (mirrors the deck
 * shuffle in pairs.js). The input roster is never mutated — the roster shown on
 * the players screen keeps its entry order; only the per-game copy is shuffled.
 */

/**
 * Return a NEW array with players in a random order (Fisher–Yates on a shallow
 * copy). Never mutates the input, and tolerates a missing/invalid argument by
 * returning an empty array. Feed the result into a game's `createState` to
 * start that game with a randomized turn order.
 *
 * `seats` bounds which players are seated: a two-player game (Tic-Tac-Toe,
 * Connect 4) passes `seats: 2` so only the first two roster entries play, and
 * the shuffle just swaps who goes first between those same two — it never pulls
 * a different player into the seat. Omit `seats` (the default) to seat and
 * shuffle the whole roster, which is what the multi-player games want.
 * @template {{id:string,name:string}} T
 * @param {T[]} players the session roster ({id,name}[])
 * @param {number} [seats] cap the seated players to the first `seats` entries
 * @returns {T[]} a shuffled shallow copy of the seated players
 */
export function shuffleTurnOrder(players, seats) {
  const roster = Array.isArray(players) ? players.slice() : [];
  const order =
    typeof seats === 'number' ? roster.slice(0, Math.max(0, seats)) : roster;
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
