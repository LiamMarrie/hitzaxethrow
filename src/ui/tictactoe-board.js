/**
 * ui/tictactoe-board.js — the interactive Tic-Tac-Toe board.
 *
 * Like the axe target, this is drawn as inline SVG (vector, so it stays sharp
 * when the tablet screen is recorded and projected). The whole thing is built
 * for projector legibility: a dark field, a heavy white 3x3 grid, and huge,
 * thick X / O marks in the app's two accent colours so each mark reads from
 * across the room. Tapping an empty cell plays the current player's mark via
 * onMove; when the game ends the board locks, the winning line is struck
 * through with a glowing bar, and a New game button (onReset) starts a rematch.
 *
 * Marks:
 *   - player 0 (X) -> accent orange, two crossing strokes
 *   - player 1 (O) -> accent-2 teal, a stroked ring
 */

import { el } from './render.js';
import { currentPlayerIdx, isComplete, CELLS } from '../games/tictactoe.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// The board lives in a 0..300 viewBox: three 100-unit cells. Marks are inset
// from the cell edges so nothing crowds the grid lines.
const CELL = 100;
const PAD = 22; // inset of a mark from its cell edge
const MARK_STROKE = 12; // thickness of X strokes / O ring

const COLOR_X = '#ff5a3c'; // --accent
const COLOR_O = '#37c8ab'; // --accent-2
const GRID = '#ffffff';

/**
 * SVG-namespaced element helper mirroring render.js `el`. SVG nodes must be
 * created with createElementNS to render.
 * @param {string} tag
 * @param {object} [attrs]
 * @param {(Node|string)[]} [children]
 * @returns {SVGElement}
 */
function svg(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v !== false && v !== null && v !== undefined) {
      node.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const child of children) {
    node.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return node;
}

/** Top-left corner (x,y) of cell `i` in viewBox units. */
function cellOrigin(i) {
  return { x: (i % 3) * CELL, y: Math.floor(i / 3) * CELL };
}

/** Centre point of cell `i`. */
function cellCenter(i) {
  const { x, y } = cellOrigin(i);
  return { cx: x + CELL / 2, cy: y + CELL / 2 };
}

/**
 * Draw the X mark for a cell: two crossing strokes with rounded caps.
 * @param {number} i cell index
 * @returns {SVGElement}
 */
function markX(i) {
  const { x, y } = cellOrigin(i);
  const lo = PAD;
  const hi = CELL - PAD;
  const common = {
    stroke: COLOR_X,
    'stroke-width': MARK_STROKE,
    'stroke-linecap': 'round',
    class: 'ttt__mark ttt__mark--x',
  };
  return svg('g', { 'aria-hidden': 'true' }, [
    svg('line', { x1: x + lo, y1: y + lo, x2: x + hi, y2: y + hi, ...common }),
    svg('line', { x1: x + hi, y1: y + lo, x2: x + lo, y2: y + hi, ...common }),
  ]);
}

/**
 * Draw the O mark for a cell: a stroked ring.
 * @param {number} i cell index
 * @returns {SVGElement}
 */
function markO(i) {
  const { cx, cy } = cellCenter(i);
  return svg('circle', {
    cx,
    cy,
    r: CELL / 2 - PAD,
    fill: 'none',
    stroke: COLOR_O,
    'stroke-width': MARK_STROKE,
    class: 'ttt__mark ttt__mark--o',
    'aria-hidden': 'true',
  });
}

/**
 * One tappable cell: an invisible hit-rect covering the cell plus the mark (if
 * played). The whole cell is the tap target so a referee never has to hit a
 * thin stroke.
 * @param {object} opts
 * @param {number} opts.i cell index
 * @param {0|1|null} opts.value played mark, or null
 * @param {string[]} opts.playerNames [xName, oName] for a11y labels
 * @param {boolean} opts.locked board is complete / cell taken
 * @param {(cell:number)=>void} opts.onPick
 * @returns {SVGElement}
 */
function cell({ i, value, playerNames, locked, onPick }) {
  const { x, y } = cellOrigin(i);
  const taken = value !== null;
  const empty = !taken && !locked;
  const label = taken
    ? `${value === 0 ? 'X' : 'O'}, ${playerNames[value]}`
    : `Empty cell ${i + 1}`;

  const children = [
    // Transparent hit area — always present so empty cells are still tappable.
    svg('rect', {
      x,
      y,
      width: CELL,
      height: CELL,
      fill: 'transparent',
      class: 'ttt__hit',
    }),
  ];
  if (value === 0) children.push(markX(i));
  else if (value === 1) children.push(markO(i));

  return svg(
    'g',
    {
      class: `ttt__cell${empty ? '' : ' ttt__cell--locked'}`,
      role: 'button',
      tabindex: empty ? 0 : -1,
      'aria-label': label,
      ...(empty ? { onClick: () => onPick(i) } : {}),
    },
    children
  );
}

/**
 * The heavy white 3x3 grid lines, drawn inside the board so the outer edge is
 * left open (like a real drawn board).
 * @returns {SVGElement}
 */
function grid() {
  const lineAttrs = {
    stroke: GRID,
    'stroke-width': 6,
    'stroke-linecap': 'round',
    class: 'ttt__grid',
  };
  return svg('g', { 'aria-hidden': 'true' }, [
    svg('line', {
      x1: CELL,
      y1: 10,
      x2: CELL,
      y2: 3 * CELL - 10,
      ...lineAttrs,
    }),
    svg('line', {
      x1: 2 * CELL,
      y1: 10,
      x2: 2 * CELL,
      y2: 3 * CELL - 10,
      ...lineAttrs,
    }),
    svg('line', {
      x1: 10,
      y1: CELL,
      x2: 3 * CELL - 10,
      y2: CELL,
      ...lineAttrs,
    }),
    svg('line', {
      x1: 10,
      y1: 2 * CELL,
      x2: 3 * CELL - 10,
      y2: 2 * CELL,
      ...lineAttrs,
    }),
  ]);
}

/**
 * The glowing strike-through bar over the winning line.
 * @param {[number,number,number]} line winning cell triple
 * @returns {SVGElement}
 */
function winStrike(line) {
  const a = cellCenter(line[0]);
  const c = cellCenter(line[2]);
  return svg('line', {
    x1: a.cx,
    y1: a.cy,
    x2: c.cx,
    y2: c.cy,
    class: 'ttt__win',
    'stroke-linecap': 'round',
    'aria-hidden': 'true',
  });
}

/**
 * Render the SVG board (grid + marks + optional win strike).
 * @param {import('../games/tictactoe.js').GameState} state
 * @param {string[]} playerNames
 * @param {(cell:number)=>void} onPick
 * @returns {SVGElement}
 */
function renderBoardSvg(state, playerNames, onPick) {
  const locked = isComplete(state);
  const cells = Array.from({ length: CELLS }, (_, i) =>
    cell({ i, value: state.board[i], playerNames, locked, onPick })
  );
  const children = [grid(), ...cells];
  if (state.line) children.push(winStrike(state.line));

  return svg(
    'svg',
    {
      class: 'ttt__svg',
      viewBox: '0 0 300 300',
      role: 'group',
      'aria-label': 'Tic-Tac-Toe board',
    },
    children
  );
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
 * Render the whole interactive Tic-Tac-Toe board: status line, the SVG board,
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
  const onPick = (cell) => {
    if (done) return;
    onMove(cell);
  };

  const boardSvg = renderBoardSvg(state, playerNames, onPick);

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
    el('div', { class: 'ttt__board' }, [boardSvg]),
    // The rematch button only matters once the round is over; keep the layout
    // stable by reserving the row but only filling it when done.
    done
      ? controls
      : el('div', { class: 'ttt__controls ttt__controls--empty' }),
  ]);
}
