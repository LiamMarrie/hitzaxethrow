/**
 * tictactoe.test.js — game logic tests for Tic-Tac-Toe.
 *
 * Covers the pure state layer the router drives: fresh state, applying and
 * undoing moves, turn order, win/draw detection, rematch reset, and structural
 * validation of restored (untrusted) state.
 */

import { describe, it, expect } from 'vitest';
import {
  createState,
  applyMove,
  undoLastMove,
  reset,
  currentPlayerIdx,
  isComplete,
  isValidState,
} from './tictactoe.js';

/** Two session-style players ({id,name}). */
const PLAYERS = [
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
];

/**
 * Play a sequence of cell indices in order, alternating players, starting from
 * a fresh state. Returns the final state.
 * @param {number[]} cells
 * @returns {import('./tictactoe.js').GameState}
 */
function playMoves(cells) {
  return cells.reduce(
    (state, cell) => applyMove(state, cell),
    createState(PLAYERS)
  );
}

describe('createState', () => {
  it('starts with an empty 9-cell board and no winner', () => {
    const state = createState(PLAYERS);
    expect(state.board).toEqual(Array(9).fill(null));
    expect(state.moves).toEqual([]);
    expect(state.winner).toBeNull();
    expect(state.line).toBeNull();
  });

  it('keeps only the first two players (X then O)', () => {
    const state = createState([...PLAYERS, { id: 'c', name: 'Carol' }]);
    expect(state.players).toEqual(PLAYERS);
  });
});

describe('currentPlayerIdx', () => {
  it('is player 0 (X) on an empty board', () => {
    expect(currentPlayerIdx(createState(PLAYERS))).toBe(0);
  });

  it('alternates X, O, X after each move', () => {
    let state = createState(PLAYERS);
    expect(currentPlayerIdx(state)).toBe(0);
    state = applyMove(state, 0);
    expect(currentPlayerIdx(state)).toBe(1);
    state = applyMove(state, 1);
    expect(currentPlayerIdx(state)).toBe(0);
  });
});

describe('applyMove', () => {
  it('claims the tapped cell for the current player', () => {
    const state = applyMove(createState(PLAYERS), 4);
    expect(state.board[4]).toBe(0);
    expect(state.moves).toEqual([4]);
  });

  it('records moves in play order for later undo', () => {
    const state = playMoves([0, 3, 1]);
    expect(state.moves).toEqual([0, 3, 1]);
  });

  it('returns the same state (no-op) when the cell is already taken', () => {
    const first = applyMove(createState(PLAYERS), 4);
    const again = applyMove(first, 4);
    expect(again).toBe(first);
  });

  it('returns the same state (no-op) for an out-of-range cell', () => {
    const state = createState(PLAYERS);
    expect(applyMove(state, 9)).toBe(state);
    expect(applyMove(state, -1)).toBe(state);
  });

  it('does not mutate the input state', () => {
    const state = createState(PLAYERS);
    applyMove(state, 0);
    expect(state.board).toEqual(Array(9).fill(null));
    expect(state.moves).toEqual([]);
  });
});

describe('win detection', () => {
  it('detects a top-row win for X', () => {
    // X: 0,1,2  O: 3,4
    const state = playMoves([0, 3, 1, 4, 2]);
    expect(state.winner).toBe(0);
    expect(state.line).toEqual([0, 1, 2]);
  });

  it('detects a middle-column win for O', () => {
    // X: 0,2,6  O: 1,4,7
    const state = playMoves([0, 1, 2, 4, 6, 7]);
    expect(state.winner).toBe(1);
    expect(state.line).toEqual([1, 4, 7]);
  });

  it('detects a diagonal win', () => {
    // X: 0,4,8  O: 1,2
    const state = playMoves([0, 1, 4, 2, 8]);
    expect(state.winner).toBe(0);
    expect(state.line).toEqual([0, 4, 8]);
  });

  it('locks the board once won: further moves are no-ops', () => {
    const won = playMoves([0, 3, 1, 4, 2]); // X wins top row
    const after = applyMove(won, 5);
    expect(after).toBe(won);
  });
});

describe('draw detection', () => {
  it('marks a full board with no line as a draw', () => {
    // A known cat's game:
    // X O X
    // X O O
    // O X X
    const state = playMoves([0, 1, 2, 4, 3, 5, 7, 6, 8]);
    expect(state.winner).toBe('draw');
    expect(state.line).toBeNull();
    expect(isComplete(state)).toBe(true);
  });
});

describe('undoLastMove', () => {
  it('reverts the most recent move and returns the turn', () => {
    const state = undoLastMove(playMoves([0, 4]));
    expect(state.board[4]).toBeNull();
    expect(state.moves).toEqual([0]);
    expect(currentPlayerIdx(state)).toBe(1);
  });

  it('clears a win when undoing the winning move', () => {
    const won = playMoves([0, 3, 1, 4, 2]); // X wins
    const state = undoLastMove(won);
    expect(state.winner).toBeNull();
    expect(state.line).toBeNull();
  });

  it('is a no-op with nothing to undo', () => {
    const state = createState(PLAYERS);
    expect(undoLastMove(state)).toBe(state);
  });
});

describe('reset', () => {
  it('clears the board but keeps the same players', () => {
    const state = reset(playMoves([0, 3, 1, 4, 2]));
    expect(state.board).toEqual(Array(9).fill(null));
    expect(state.moves).toEqual([]);
    expect(state.winner).toBeNull();
    expect(state.players).toEqual(PLAYERS);
  });
});

describe('isComplete', () => {
  it('is false mid-game and true after a win', () => {
    expect(isComplete(createState(PLAYERS))).toBe(false);
    expect(isComplete(playMoves([0, 3, 1, 4, 2]))).toBe(true);
  });
});

describe('isValidState', () => {
  it('accepts a freshly created state', () => {
    expect(isValidState(createState(PLAYERS))).toBe(true);
  });

  it('rejects non-objects and missing fields', () => {
    expect(isValidState(null)).toBe(false);
    expect(isValidState({})).toBe(false);
    expect(isValidState({ players: PLAYERS })).toBe(false);
  });

  it('rejects a board of the wrong length', () => {
    const bad = { ...createState(PLAYERS), board: Array(8).fill(null) };
    expect(isValidState(bad)).toBe(false);
  });
});
