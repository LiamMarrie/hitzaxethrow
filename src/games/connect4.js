/**
 * connect4.js — Connect 4 game logic (pure, framework-free).
 *
 * State layer only: the router (main.js) drives this and the board UI is a thin
 * projection over the returned state, matching target.js / tictactoe.js. Two
 * players take turns — index 0 goes first, index 1 second — dropping discs into
 * columns. A disc falls to the lowest open slot (gravity). First to line up
 * four in a row (horizontal, vertical, or either diagonal) wins.
 *
 * Board layout: a flat row-major array of COLS*ROWS cells, row 0 at the TOP,
 * so the bottom row (where discs first land) is the last ROWS-1 row.
 *   index = row * COLS + col
 *
 * State shape:
 *   {
 *     players: [{id,name}, {id,name}],
 *     board: (0|1|null)[COLS*ROWS],       // playerIdx or null
 *     moves: number[],                    // cell indices in drop order (undo)
 *     winner: null | 0 | 1 | 'draw',
 *     line: number[4] | null,             // winning cells, for highlight
 *   }
 *
 * Every mutating function is immutable: it returns a NEW state, or the SAME
 * reference to signal a no-op (full column / bad column / game over / nothing
 * to undo), matching the applyMove/undoLastMove convention so main.js's guards
 * work unchanged.
 */

export const GAME_KEY = 'connect4';
export const GAME_NAME = 'Connect 4';

/** Board dimensions (classic Connect 4). */
export const COLS = 7;
export const ROWS = 6;
/** Discs in a row needed to win. */
export const CONNECT = 4;

/**
 * @typedef {{id:string,name:string}} Player
 * @typedef {Object} GameState
 * @property {Player[]} players
 * @property {(0|1|null)[]} board
 * @property {number[]} moves
 * @property {null|0|1|'draw'} winner
 * @property {number[]|null} line
 */

/** Cell index for a (row, col). */
function idx(row, col) {
  return row * COLS + col;
}

/**
 * Build a fresh game state for the given players. Only the first two play; any
 * extras are ignored.
 * @param {Player[]} [players]
 * @returns {GameState}
 */
export function createState(
  players = [
    { id: 'p1', name: 'Player 1' },
    { id: 'p2', name: 'Player 2' },
  ]
) {
  return {
    players: players.slice(0, 2).map((p) => ({ id: p.id, name: p.name })),
    board: Array(COLS * ROWS).fill(null),
    moves: [],
    winner: null,
    line: null,
  };
}

/**
 * Whose turn it is (0 first, 1 second). Meaningless once complete, but harmless.
 * @param {GameState} state
 * @returns {0|1}
 */
export function currentPlayerIdx(state) {
  return /** @type {0|1} */ (state.moves.length % 2);
}

/** @param {GameState} state @returns {boolean} */
export function isComplete(state) {
  return state.winner !== null;
}

/**
 * The lowest open row in `col`, or -1 if the column is full.
 * @param {(0|1|null)[]} board
 * @param {number} col
 * @returns {number}
 */
function lowestOpenRow(board, col) {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[idx(row, col)] === null) return row;
  }
  return -1;
}

// The four directions to scan for a run, as (dRow, dCol). Only one orientation
// each is needed since the scan walks both ways from the placed disc.
const DIRS = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // descending diagonal (\)
  [1, -1], // ascending diagonal (/)
];

/**
 * After placing a disc at (row,col) for `player`, look for a run of CONNECT
 * through that cell. Returns the winning cells (sorted for a stable, drawable
 * line), or null.
 * @param {(0|1|null)[]} board
 * @param {number} row
 * @param {number} col
 * @param {0|1} player
 * @returns {number[]|null}
 */
function findWinThrough(board, row, col, player) {
  for (const [dr, dc] of DIRS) {
    const cells = [idx(row, col)];
    // Walk forward.
    for (let step = 1; step < CONNECT; step++) {
      const r = row + dr * step;
      const c = col + dc * step;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) break;
      if (board[idx(r, c)] !== player) break;
      cells.push(idx(r, c));
    }
    // Walk backward.
    for (let step = 1; step < CONNECT; step++) {
      const r = row - dr * step;
      const c = col - dc * step;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) break;
      if (board[idx(r, c)] !== player) break;
      cells.push(idx(r, c));
    }
    if (cells.length >= CONNECT) {
      // Pick the CONNECT-long window aligned with the direction and sort it so
      // the highlight bar is drawn consistently regardless of scan order.
      return cells.sort((a, b) => a - b).slice(0, CONNECT);
    }
  }
  return null;
}

/**
 * Drop a disc into `col` for the current player. No-op (returns the SAME state)
 * when the game is over, the column is out of range, or the column is full.
 * @param {GameState} state
 * @param {number} col 0..COLS-1
 * @returns {GameState}
 */
export function dropDisc(state, col) {
  if (isComplete(state)) return state;
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return state;
  const row = lowestOpenRow(state.board, col);
  if (row === -1) return state; // column full

  const player = currentPlayerIdx(state);
  const cell = idx(row, col);
  const board = state.board.slice();
  board[cell] = player;
  const moves = [...state.moves, cell];

  const win = findWinThrough(board, row, col, player);
  let winner = null;
  let line = null;
  if (win) {
    winner = player;
    line = win;
  } else if (moves.length === COLS * ROWS) {
    winner = 'draw';
  }

  return { ...state, board, moves, winner, line };
}

/**
 * Router-facing alias. main.js drives every grid game through `applyMove(state,
 * cell)`; for Connect 4 a "cell" is the chosen column, so this is dropDisc.
 * @param {GameState} state
 * @param {number} col
 * @returns {GameState}
 */
export const applyMove = dropDisc;

/**
 * Undo the most recent drop, clearing any resulting win/draw. No-op (returns
 * the SAME state) when no move has been made.
 * @param {GameState} state
 * @returns {GameState}
 */
export function undoLastMove(state) {
  if (state.moves.length === 0) return state;
  const moves = state.moves.slice(0, -1);
  const last = state.moves[state.moves.length - 1];
  const board = state.board.slice();
  board[last] = null;
  return { ...state, board, moves, winner: null, line: null };
}

/**
 * Start a rematch: clear the board and result, keeping the same players and
 * turn order.
 * @param {GameState} state
 * @returns {GameState}
 */
export function reset(state) {
  return createState(state.players);
}

/**
 * Structural check that a value is a usable state. Used when restoring a
 * persisted session, whose shape is untrusted.
 * @param {unknown} state
 * @returns {boolean}
 */
export function isValidState(state) {
  if (!state || typeof state !== 'object') return false;
  const s = /** @type {Record<string, unknown>} */ (state);
  return (
    Array.isArray(s.players) &&
    Array.isArray(s.board) &&
    s.board.length === COLS * ROWS &&
    Array.isArray(s.moves)
  );
}
