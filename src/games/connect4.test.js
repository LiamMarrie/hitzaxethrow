/**
 * connect4.test.js — game logic tests for Connect 4.
 *
 * Covers the pure state layer the router drives: fresh state, dropping discs
 * with gravity, turn order, undo, rematch reset, win detection in all four
 * directions, draw, and structural validation of restored (untrusted) state.
 */

import { describe, it, expect } from 'vitest';
import {
  createState,
  dropDisc,
  undoLastMove,
  reset,
  currentPlayerIdx,
  isComplete,
  isValidState,
  COLS,
  ROWS,
} from './connect4.js';

/** Two session-style players ({id,name}). */
const PLAYERS = [
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
];

/** Cell index for a (row, col), row 0 at the top. */
const at = (row, col) => row * COLS + col;

/**
 * Drop a sequence of columns in order, alternating players, from a fresh state.
 * @param {number[]} cols
 * @returns {import('./connect4.js').GameState}
 */
function playCols(cols) {
  return cols.reduce(
    (state, col) => dropDisc(state, col),
    createState(PLAYERS)
  );
}

describe('createState', () => {
  it('starts with an empty 7x6 board and no winner', () => {
    const state = createState(PLAYERS);
    expect(state.board).toEqual(Array(COLS * ROWS).fill(null));
    expect(state.moves).toEqual([]);
    expect(state.winner).toBeNull();
    expect(state.line).toBeNull();
  });

  it('is a 7-wide, 6-tall board', () => {
    expect(COLS).toBe(7);
    expect(ROWS).toBe(6);
  });

  it('keeps only the first two players', () => {
    const state = createState([...PLAYERS, { id: 'c', name: 'Carol' }]);
    expect(state.players).toEqual(PLAYERS);
  });
});

describe('gravity', () => {
  it('drops the first disc into the bottom row of the column', () => {
    const state = dropDisc(createState(PLAYERS), 3);
    expect(state.board[at(ROWS - 1, 3)]).toBe(0);
    expect(state.moves).toEqual([at(ROWS - 1, 3)]);
  });

  it('stacks discs upward in the same column', () => {
    const state = playCols([3, 3, 3]);
    expect(state.board[at(ROWS - 1, 3)]).toBe(0); // X bottom
    expect(state.board[at(ROWS - 2, 3)]).toBe(1); // O on top
    expect(state.board[at(ROWS - 3, 3)]).toBe(0); // X next
  });

  it('returns the same state (no-op) when the column is full', () => {
    // Fill column 0 (6 discs), then one more drop is a no-op.
    const full = playCols([0, 0, 0, 0, 0, 0]);
    expect(full.board[at(0, 0)]).not.toBeNull(); // top filled
    const after = dropDisc(full, 0);
    expect(after).toBe(full);
  });

  it('returns the same state (no-op) for an out-of-range column', () => {
    const state = createState(PLAYERS);
    expect(dropDisc(state, COLS)).toBe(state);
    expect(dropDisc(state, -1)).toBe(state);
  });

  it('does not mutate the input state', () => {
    const state = createState(PLAYERS);
    dropDisc(state, 0);
    expect(state.board).toEqual(Array(COLS * ROWS).fill(null));
    expect(state.moves).toEqual([]);
  });
});

describe('currentPlayerIdx', () => {
  it('alternates X, O, X after each drop', () => {
    let state = createState(PLAYERS);
    expect(currentPlayerIdx(state)).toBe(0);
    state = dropDisc(state, 0);
    expect(currentPlayerIdx(state)).toBe(1);
    state = dropDisc(state, 1);
    expect(currentPlayerIdx(state)).toBe(0);
  });
});

describe('win detection', () => {
  it('detects a horizontal four along the bottom row', () => {
    // X: cols 0,1,2,3   O: cols 0,1,2 (stacked one row up)
    const state = playCols([0, 0, 1, 1, 2, 2, 3]);
    expect(state.winner).toBe(0);
    expect(state.line).toEqual([
      at(ROWS - 1, 0),
      at(ROWS - 1, 1),
      at(ROWS - 1, 2),
      at(ROWS - 1, 3),
    ]);
  });

  it('detects a vertical four in one column', () => {
    // X drops col 0 four times; O drops col 1 three times in between.
    // `line` is the four winning cells in ascending index order.
    const state = playCols([0, 1, 0, 1, 0, 1, 0]);
    expect(state.winner).toBe(0);
    expect(state.line).toEqual(
      [at(ROWS - 1, 0), at(ROWS - 2, 0), at(ROWS - 3, 0), at(ROWS - 4, 0)].sort(
        (a, b) => a - b
      )
    );
  });

  it('detects an ascending diagonal (/)', () => {
    // Build a staircase so X connects (r=5,c=0)(r=4,c=1)(r=3,c=2)(r=2,c=3).
    const state = playCols([0, 1, 1, 2, 3, 2, 2, 3, 3, 6, 3]);
    expect(state.winner).toBe(0);
    expect(state.line).toEqual(
      [at(5, 0), at(4, 1), at(3, 2), at(2, 3)].sort((a, b) => a - b)
    );
  });

  it('detects a descending diagonal (\\)', () => {
    // X connects (r=2,c=0)(r=3,c=1)(r=4,c=2)(r=5,c=3).
    const state = playCols([3, 2, 2, 1, 1, 0, 1, 0, 0, 6, 0]);
    expect(state.winner).toBe(0);
    expect(state.line).toEqual([at(2, 0), at(3, 1), at(4, 2), at(5, 3)]);
  });

  it('locks the board once won: further drops are no-ops', () => {
    const won = playCols([0, 0, 1, 1, 2, 2, 3]); // X wins bottom row
    expect(won.winner).toBe(0);
    const after = dropDisc(won, 5);
    expect(after).toBe(won);
  });
});

describe('draw detection', () => {
  it('marks a completely full board with no four as a draw', () => {
    // A column-pattern that fills all 42 cells without any 4-in-a-row.
    // Pattern per pair of columns is offset so no line of four forms.
    const order = [];
    // Fill columns in a striped order: cols 0,1,2 then 3,4,5 then 6, each row.
    // Simpler: play a known draw-producing full sequence.
    const cols = [
      0,
      1,
      0,
      1,
      0,
      1, // col0: XOXOXO, col1: OXOXOX pattern via alternation
      1,
      0,
      1,
      0,
      1,
      0,
      2,
      3,
      2,
      3,
      2,
      3,
      3,
      2,
      3,
      2,
      3,
      2,
      4,
      5,
      4,
      5,
      4,
      5,
      5,
      4,
      5,
      4,
      5,
      4,
      6,
      6,
      6,
      6,
      6,
      6,
    ];
    for (const c of cols) order.push(c);
    const state = playCols(order);
    expect(state.moves.length).toBe(COLS * ROWS);
    expect(state.winner).toBe('draw');
    expect(state.line).toBeNull();
    expect(isComplete(state)).toBe(true);
  });
});

describe('undoLastMove', () => {
  it('reverts the most recent drop and returns the turn', () => {
    const state = undoLastMove(playCols([3, 4]));
    expect(state.board[at(ROWS - 1, 4)]).toBeNull();
    expect(state.moves).toEqual([at(ROWS - 1, 3)]);
    expect(currentPlayerIdx(state)).toBe(1);
  });

  it('clears a win when undoing the winning drop', () => {
    const won = playCols([0, 0, 1, 1, 2, 2, 3]); // X wins
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
    const state = reset(playCols([0, 1, 2, 3]));
    expect(state.board).toEqual(Array(COLS * ROWS).fill(null));
    expect(state.moves).toEqual([]);
    expect(state.winner).toBeNull();
    expect(state.players).toEqual(PLAYERS);
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
    const bad = { ...createState(PLAYERS), board: Array(10).fill(null) };
    expect(isValidState(bad)).toBe(false);
  });
});
