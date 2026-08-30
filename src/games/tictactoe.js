/**
 * tictactoe.js — Tic-Tac-Toe game logic (pure, framework-free).
 *
 * State layer only: the router (main.js) drives this and the board UI is a thin
 * projection over the returned state, matching how target.js works. Two players
 * take turns — player index 0 is X and always goes first, index 1 is O — and
 * turns strictly alternate.
 *
 * State shape:
 *   {
 *     players: [{id,name}, {id,name}],   // first two session players; X then O
 *     board: (0|1|null)[9],              // row-major 3x3; playerIdx or null
 *     moves: number[],                   // cell indices in play order (for undo)
 *     winner: null | 0 | 1 | 'draw',     // null while in progress
 *     line: [number,number,number]|null, // winning cells, for highlight
 *   }
 *
 * Every mutating function is immutable: it returns a NEW state, or the SAME
 * reference to signal a no-op (illegal move / nothing to undo / game over),
 * matching target.js's applyThrow/undoLastThrow convention so main.js's guards
 * work unchanged.
 */

export const GAME_KEY = 'tictactoe';
export const GAME_NAME = 'Tic-Tac-Toe';

/** Number of cells on the 3x3 board. */
export const CELLS = 9;

/**
 * The eight winning lines as cell-index triples (three rows, three columns,
 * two diagonals).
 * @type {ReadonlyArray<[number,number,number]>}
 */
const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8], // rows
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8], // columns
  [0, 4, 8],
  [2, 4, 6], // diagonals
];

/**
 * @typedef {{id:string,name:string}} Player
 * @typedef {Object} GameState
 * @property {Player[]} players
 * @property {(0|1|null)[]} board
 * @property {number[]} moves
 * @property {null|0|1|'draw'} winner
 * @property {[number,number,number]|null} line
 */

/**
 * Build a fresh game state for the given players. Only the first two play
 * (X then O); any extras are ignored.
 * @param {Player[]} [players]
 * @returns {GameState}
 */
export function createState(
  players = [
    { id: 'x', name: 'Player 1' },
    { id: 'o', name: 'Player 2' },
  ]
) {
  return {
    players: players.slice(0, 2).map((p) => ({ id: p.id, name: p.name })),
    board: Array(CELLS).fill(null),
    moves: [],
    winner: null,
    line: null,
  };
}

/**
 * Whose turn it is, as a player index (0 = X, 1 = O). X moves on even move
 * counts, O on odd. Meaningless once the game is complete, but harmless.
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
 * Scan the board for a completed line. Returns the winning player index and the
 * three cells, or null if no line is complete.
 * @param {(0|1|null)[]} board
 * @returns {{winner:0|1, line:[number,number,number]}|null}
 */
function findWin(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] !== null && board[a] === board[b] && board[a] === board[c]) {
      return { winner: /** @type {0|1} */ (board[a]), line };
    }
  }
  return null;
}

/**
 * Claim `cell` for the current player. No-op (returns the SAME state) when the
 * game is already over, the cell is out of range, or the cell is taken.
 * @param {GameState} state
 * @param {number} cell 0..8
 * @returns {GameState}
 */
export function applyMove(state, cell) {
  if (isComplete(state)) return state;
  if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS) return state;
  if (state.board[cell] !== null) return state;

  const player = currentPlayerIdx(state);
  const board = state.board.slice();
  board[cell] = player;
  const moves = [...state.moves, cell];

  const win = findWin(board);
  let winner = null;
  let line = null;
  if (win) {
    winner = win.winner;
    line = win.line;
  } else if (moves.length === CELLS) {
    winner = 'draw';
  }

  return { ...state, board, moves, winner, line };
}

/**
 * Undo the most recent move, clearing any resulting win/draw. No-op (returns
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
 * turn order (X first again).
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
    s.board.length === CELLS &&
    Array.isArray(s.moves)
  );
}
