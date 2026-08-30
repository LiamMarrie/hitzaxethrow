/**
 * ui/tictactoe-board.js — the interactive Tic-Tac-Toe board.
 *
 * Ports the "Tic-Tac-Axe" prototype look: a 3x3 CSS grid of dark, rounded cells
 * with glowing white borders, big red X / blue O glyph marks with a neon glow,
 * a faint hover preview of the mark you'd place, and a pulsing highlight on the
 * winning line. Tapping an empty cell plays the current player's mark via
 * onMove; when the game ends the board locks and a New game button (onReset)
 * starts a rematch.
 *
 * Marks:
 *   - player 0 (X) -> red (#ff4b4b)
 *   - player 1 (O) -> blue (#4d9bff)
 *
 * This is a plain DOM grid (not SVG) so it reproduces the prototype's cell
 * borders, shadows, and glow exactly; the colours live in the `.ttt__*` CSS.
 */

import { el } from './render.js';
import { currentPlayerIdx, isComplete, CELLS } from '../games/tictactoe.js';

/** Glyph per player index (0 = X, 1 = O). */
const MARKS = ['X', 'O'];

/**
 * One board cell as a <button>. Empty cells are tappable (and preview the
 * current player's mark on hover); played/locked cells are inert but still
 * carry an a11y label for their mark.
 * @param {object} opts
 * @param {number} opts.i cell index (0..8)
 * @param {0|1|null} opts.value played mark, or null
 * @param {boolean} opts.done game is over (locks empty cells too)
 * @param {0|1} opts.turn current player index (for the hover preview)
 * @param {boolean} opts.isWin cell is part of the winning line
 * @param {string[]} opts.playerNames [xName, oName] for a11y labels
 * @param {(cell:number)=>void} opts.onPick
 * @returns {HTMLElement}
 */
function renderCell({ i, value, done, turn, isWin, playerNames, onPick }) {
  const taken = value !== null;
  const empty = !taken && !done;

  const markEl = el('span', {
    class: 'ttt__mark',
    text: taken ? MARKS[value] : '',
    'aria-hidden': 'true',
  });

  const classes = ['ttt__cell'];
  if (value === 0) classes.push('ttt__cell--x');
  else if (value === 1) classes.push('ttt__cell--o');
  if (isWin) classes.push('ttt__cell--win');
  if (!empty) classes.push('ttt__cell--locked');

  const label = taken
    ? `${MARKS[value]}, ${playerNames[value]}`
    : `Empty cell ${i + 1}`;

  const btn = el(
    'button',
    {
      class: classes.join(' '),
      type: 'button',
      role: 'gridcell',
      'aria-label': label,
      tabindex: empty ? 0 : -1,
    },
    [markEl]
  );

  if (empty) {
    const pv = turn === 0 ? 'x' : 'o';
    btn.addEventListener('click', () => onPick(i));
    // Hover preview: show the faint mark the current player would place. Purely
    // transient DOM state (cleared on leave); never touches game state.
    btn.addEventListener('mouseenter', () => {
      markEl.textContent = MARKS[turn];
      btn.classList.add('ttt__cell--preview', `ttt__cell--pv-${pv}`);
    });
    btn.addEventListener('mouseleave', () => {
      markEl.textContent = '';
      btn.classList.remove('ttt__cell--preview', `ttt__cell--pv-${pv}`);
    });
  }

  return btn;
}

/**
 * The status line above the board: whose turn it is (with their X/O mark), or
 * the result once the game ends.
 * @param {import('../games/tictactoe.js').GameState} state
 * @param {string[]} playerNames
 * @returns {HTMLElement}
 */
function renderStatus(state, playerNames) {
  if (state.winner === 'draw') {
    return el('div', { class: 'ttt__status ttt__status--done' }, [
      el('span', { class: 'ttt__status-done', text: "Draw — cat's game" }),
    ]);
  }
  if (state.winner === 0 || state.winner === 1) {
    return el('div', { class: 'ttt__status ttt__status--done' }, [
      el('span', {
        class: `ttt__status-done ttt__status-done--${state.winner === 0 ? 'x' : 'o'}`,
        text: `${playerNames[state.winner]} wins!`,
      }),
    ]);
  }
  const turn = currentPlayerIdx(state);
  return el('div', { class: 'ttt__status' }, [
    el('span', {
      class: `ttt__badge ttt__badge--${turn === 0 ? 'x' : 'o'}`,
      text: turn === 0 ? 'X' : 'O',
      'aria-hidden': 'true',
    }),
    el('span', {
      class: 'ttt__status-name',
      text: `${playerNames[turn]}'s turn`,
    }),
  ]);
}

/**
 * Render the whole interactive Tic-Tac-Toe board: status line, the 3x3 grid,
 * and (once the game ends) a New game button.
 * @param {import('../games/tictactoe.js').GameState} state
 * @param {{onMove:(cell:number)=>void, onReset:()=>void}} handlers
 * @returns {HTMLElement}
 */
export function renderTicTacToeBoard(state, { onMove, onReset }) {
  const done = isComplete(state);
  const playerNames = [
    state.players[0]?.name ?? 'Player 1',
    state.players[1]?.name ?? 'Player 2',
  ];
  const turn = currentPlayerIdx(state);
  const winSet = new Set(state.line ?? []);
  const onPick = (cell) => {
    if (done) return;
    onMove(cell);
  };

  const cells = Array.from({ length: CELLS }, (_, i) =>
    renderCell({
      i,
      value: state.board[i],
      done,
      turn,
      isWin: winSet.has(i),
      playerNames,
      onPick,
    })
  );

  const grid = el(
    'div',
    { class: 'ttt__grid', role: 'grid', 'aria-label': 'Tic-Tac-Toe board' },
    cells
  );

  const controls = el('div', { class: 'ttt__controls' }, [
    el('button', {
      class: 'btn btn--primary ttt__new',
      text: '↺ New game',
      'aria-label': 'Start a new game',
      onClick: onReset,
    }),
  ]);

  return el('div', { class: `ttt${done ? ' ttt--done' : ''}` }, [
    renderStatus(state, playerNames),
    el('div', { class: 'ttt__board' }, [grid]),
    // The rematch button only matters once the round is over; keep the layout
    // stable by reserving the row but only filling it when done.
    done
      ? controls
      : el('div', { class: 'ttt__controls ttt__controls--empty' }),
  ]);
}
