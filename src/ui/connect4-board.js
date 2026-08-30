/**
 * ui/connect4-board.js — the interactive Connect 4 board.
 *
 * Drawn as inline SVG (vector, so it stays sharp when the tablet screen is
 * recorded and projected). Built for projector legibility: the classic solid
 * blue board with circular holes punched through it, big discs in the app's two
 * accent colours showing through each hole, and whole-column tap targets so a
 * referee just taps the column and the disc falls to the lowest open slot.
 *
 * Discs:
 *   - player 0 -> accent orange
 *   - player 1 -> accent-2 teal
 *
 * Rendering order (back to front):
 *   1. disc circles (filled = a played disc, dark = an empty hole)
 *   2. the blue board panel, drawn as a path with circular holes cut out
 *      (even-odd rule) so the discs/holes below show through
 *   3. per-column transparent hit targets
 *   4. the winning-four glow ring overlay
 */

import { el } from './render.js';
import { currentPlayerIdx, isComplete, COLS, ROWS } from '../games/connect4.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// One cell is CELL units square; discs are inset by GAP from the cell edge.
const CELL = 100;
const GAP = 12;
const R = CELL / 2 - GAP; // disc / hole radius
const W = COLS * CELL;
const H = ROWS * CELL;

const BOARD_BLUE = '#1f6feb'; // matches the target board's outer-ring blue
const HOLE_DARK = '#0f1115'; // --bg, so empty holes read as the app background
const DISC_X = '#ff5a3c'; // --accent
const DISC_O = '#37c8ab'; // --accent-2

/**
 * SVG-namespaced element helper mirroring render.js `el`.
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

/** Centre point of the cell at (row, col). */
function cellCenter(row, col) {
  return { cx: col * CELL + CELL / 2, cy: row * CELL + CELL / 2 };
}

/**
 * Layer 1: the disc / hole circles. A played cell shows its player's colour;
 * an empty cell shows the dark background so it reads as an open hole.
 * @param {import('../games/connect4.js').GameState} state
 * @param {string[]} playerNames
 * @returns {SVGElement}
 */
function renderDiscs(state, playerNames) {
  const circles = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const value = state.board[row * COLS + col];
      const { cx, cy } = cellCenter(row, col);
      const fill = value === 0 ? DISC_X : value === 1 ? DISC_O : HOLE_DARK;
      const label =
        value === null
          ? undefined
          : `${playerNames[value]} disc, row ${ROWS - row}, column ${col + 1}`;
      circles.push(
        svg('circle', {
          cx,
          cy,
          r: R,
          fill,
          class: value === null ? 'c4__hole' : 'c4__disc',
          ...(label
            ? { role: 'img', 'aria-label': label }
            : { 'aria-hidden': 'true' }),
        })
      );
    }
  }
  return svg('g', {}, circles);
}

/**
 * Layer 2: the blue board panel with a circular hole cut out over every cell.
 * A single path: the outer rectangle plus one sub-path circle per hole, filled
 * with the even-odd rule so the circles become holes.
 * @returns {SVGElement}
 */
function renderBoardPanel() {
  let d = `M0,0 H${W} V${H} H0 Z`;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const { cx, cy } = cellCenter(row, col);
      // A circle as two arcs, so it's a closed sub-path the even-odd rule cuts.
      d +=
        ` M${cx - R},${cy}` +
        ` a${R},${R} 0 1,0 ${R * 2},0` +
        ` a${R},${R} 0 1,0 ${-R * 2},0 Z`;
    }
  }
  return svg('path', {
    d,
    'fill-rule': 'evenodd',
    fill: BOARD_BLUE,
    class: 'c4__panel',
    'aria-hidden': 'true',
  });
}

/**
 * Layer 3: one transparent, full-height tap target per column. Tapping drops
 * into that column. Disabled columns (full, or game over) are inert.
 * @param {import('../games/connect4.js').GameState} state
 * @param {boolean} locked whole board locked (game complete)
 * @param {(col:number)=>void} onPick
 * @returns {SVGElement}
 */
function renderColumnTargets(state, locked, onPick) {
  const targets = [];
  for (let col = 0; col < COLS; col++) {
    // A column is full when its top cell is occupied.
    const full = state.board[col] !== null;
    const active = !locked && !full;
    targets.push(
      svg('rect', {
        x: col * CELL,
        y: 0,
        width: CELL,
        height: H,
        fill: 'transparent',
        class: `c4__col${active ? '' : ' c4__col--disabled'}`,
        role: 'button',
        tabindex: active ? 0 : -1,
        'aria-label': active
          ? `Drop in column ${col + 1}`
          : `Column ${col + 1} full`,
        ...(active ? { onClick: () => onPick(col) } : {}),
      })
    );
  }
  return svg('g', {}, targets);
}

/**
 * Layer 4: a glow ring over each of the four winning cells.
 * @param {number[]} line winning cell indices
 * @returns {SVGElement}
 */
function renderWinOverlay(line) {
  const rings = line.map((cell) => {
    const row = Math.floor(cell / COLS);
    const col = cell % COLS;
    const { cx, cy } = cellCenter(row, col);
    return svg('circle', {
      cx,
      cy,
      r: R,
      fill: 'none',
      class: 'c4__win',
      'aria-hidden': 'true',
    });
  });
  return svg('g', {}, rings);
}

/**
 * Render the SVG board: discs, the blue panel, column targets, win overlay.
 * @param {import('../games/connect4.js').GameState} state
 * @param {string[]} playerNames
 * @param {(col:number)=>void} onPick
 * @returns {SVGElement}
 */
function renderBoardSvg(state, playerNames, onPick) {
  const locked = isComplete(state);
  const children = [
    renderDiscs(state, playerNames),
    renderBoardPanel(),
    renderColumnTargets(state, locked, onPick),
  ];
  if (state.line) children.push(renderWinOverlay(state.line));

  return svg(
    'svg',
    {
      class: 'c4__svg',
      viewBox: `0 0 ${W} ${H}`,
      role: 'group',
      'aria-label': 'Connect 4 board',
    },
    children
  );
}

/**
 * The status line above the board: whose turn (with a colour dot) or the result.
 * @param {import('../games/connect4.js').GameState} state
 * @param {string[]} playerNames
 * @returns {HTMLElement}
 */
function renderStatus(state, playerNames) {
  if (state.winner === 'draw') {
    return el('div', { class: 'c4__status c4__status--done' }, [
      el('span', { class: 'c4__status-done', text: 'Draw — board full' }),
    ]);
  }
  if (state.winner === 0 || state.winner === 1) {
    return el('div', { class: 'c4__status c4__status--done' }, [
      el('span', {
        class: `c4__status-done c4__status-done--${state.winner === 0 ? 'x' : 'o'}`,
        text: `${playerNames[state.winner]} wins!`,
      }),
    ]);
  }
  const turn = currentPlayerIdx(state);
  return el('div', { class: 'c4__status' }, [
    el('span', {
      class: `c4__dot c4__dot--${turn === 0 ? 'x' : 'o'}`,
      'aria-hidden': 'true',
    }),
    el('span', {
      class: 'c4__status-name',
      text: `${playerNames[turn]}'s turn`,
    }),
  ]);
}

/**
 * Render the whole interactive Connect 4 board: status line, the SVG board, and
 * (once the game ends) a New game button.
 * @param {import('../games/connect4.js').GameState} state
 * @param {{onMove:(col:number)=>void, onReset:()=>void}} handlers
 * @returns {HTMLElement}
 */
export function renderConnect4Board(state, { onMove, onReset }) {
  const done = isComplete(state);
  const playerNames = [
    state.players[0]?.name ?? 'Player 1',
    state.players[1]?.name ?? 'Player 2',
  ];
  const onPick = (col) => {
    if (done) return;
    onMove(col);
  };

  const boardSvg = renderBoardSvg(state, playerNames, onPick);

  const controls = el('div', { class: 'c4__controls' }, [
    el('button', {
      class: 'btn btn--primary c4__new',
      text: '↺ New game',
      'aria-label': 'Start a new game',
      onClick: onReset,
    }),
  ]);

  return el('div', { class: `c4${done ? ' c4--done' : ''}` }, [
    renderStatus(state, playerNames),
    el('div', { class: 'c4__board' }, [boardSvg]),
    done ? controls : el('div', { class: 'c4__controls c4__controls--empty' }),
  ]);
}
