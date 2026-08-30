/**
 * ui/dartboard-board.js — the interactive 501 dartboard.
 *
 * Ports the custom dartboard SVG from dartboard.html verbatim (same radii,
 * clockwise number ORDER, wedge colours, concentric + radial "spider" wires, and
 * bull) into the project's inline-SVG helper. Vector, so it stays razor-sharp
 * when the tablet screen is recorded and projected. Tapping a segment records a
 * throw for the active thrower via onThrow(value), where `value` is that dart's
 * point total (single/double/triple of the number, 25/50 for the bull). A MISS
 * button records a 0 and Undo reverts the last dart.
 *
 * Unlike the Target board this game has its own count-down scoreboard baked in
 * (name + remaining, counting down from 501), since 501 state isn't the
 * rounds-grid the shared scoreboard renders.
 *
 * The dartboard's own look (dark cabinet, cream/black wedges, red/green
 * multipliers, thin wires, cream numerals) lives in the `.db__*` CSS block; only
 * the surrounding status line and controls reuse the shared `.btn` / board
 * chrome so it sits consistently with the other games.
 */

import { el } from './render.js';
import {
  activePosition,
  positionForPlayer,
  isComplete,
  remainingFor,
  START_SCORE,
  DARTS_PER_VISIT,
} from '../games/dartboard.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

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

// ---- board geometry, straight from dartboard.html ----
const CX = 500;
const CY = 500;

// Radii (double-outer = 400 sets scale; all others follow regulation ratios).
const R = {
  innerBull: 15,
  outerBull: 38,
  tripleIn: 233,
  tripleOut: 252,
  doubleIn: 381,
  doubleOut: 400,
  number: 436,
};

const COL = {
  black: '#161616',
  cream: '#e6d9b8',
  red: '#bf352e',
  green: '#2c8a4c',
  wire: 'rgba(210,224,213,.34)',
  wireLit: 'rgba(228,240,228,.55)',
};

// Standard clockwise order starting at the top.
const ORDER = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
];

/** Point on the board, angle measured clockwise from 12 o'clock. */
function pt(r, deg) {
  const a = (deg * Math.PI) / 180;
  return [CX + r * Math.sin(a), CY - r * Math.cos(a)];
}

/** Annular sector between radii r1..r2 over angles a1..a2 (a2 > a1, clockwise). */
function ring(r1, r2, a1, a2) {
  const [x1, y1] = pt(r2, a1);
  const [x2, y2] = pt(r2, a2);
  const [x3, y3] = pt(r1, a2);
  const [x4, y4] = pt(r1, a1);
  return `M${x1} ${y1} A${r2} ${r2} 0 0 1 ${x2} ${y2} L${x3} ${y3} A${r1} ${r1} 0 0 0 ${x4} ${y4} Z`;
}

/**
 * Build one tappable wedge segment (inner single, triple, outer single, or
 * double band of one number). Calls onPick with the dart's point total.
 * @param {object} opts
 * @param {string} opts.d path data
 * @param {string} opts.fill
 * @param {number} opts.number the wedge number
 * @param {'single'|'double'|'triple'} opts.band
 * @param {number} opts.mult multiplier for the score
 * @param {(value:number)=>void} opts.onPick
 * @param {boolean} opts.disabled
 * @returns {SVGElement}
 */
function segment({ d, fill, number, band, mult, onPick, disabled }) {
  const value = number * mult;
  const label =
    band === 'double'
      ? `Double ${number}, ${value}`
      : band === 'triple'
        ? `Triple ${number}, ${value}`
        : `${number}`;
  return svg('path', {
    d,
    fill,
    class: `db__seg${disabled ? ' db__seg--disabled' : ''}`,
    stroke: COL.wire,
    'stroke-width': 1.6,
    'stroke-linejoin': 'round',
    role: 'button',
    tabindex: disabled ? -1 : 0,
    'aria-label': label,
    ...(disabled ? {} : { onClick: () => onPick(value) }),
  });
}

/**
 * The 20 number wedges (inner single / triple / outer single / double per
 * number). Mirrors the build loop in dartboard.html.
 * @param {(value:number)=>void} onPick
 * @param {boolean} disabled
 * @returns {SVGElement[]}
 */
function renderWedges(onPick, disabled) {
  const segs = [];
  ORDER.forEach((num, i) => {
    const c = i * 18;
    const a1 = c - 9;
    const a2 = c + 9;
    const isDark = i % 2 === 0; // 20 sits on a dark/red wedge
    const single = isDark ? COL.black : COL.cream;
    const mult = isDark ? COL.red : COL.green;

    segs.push(
      segment({
        d: ring(R.outerBull, R.tripleIn, a1, a2),
        fill: single,
        number: num,
        band: 'single',
        mult: 1,
        onPick,
        disabled,
      }),
      segment({
        d: ring(R.tripleIn, R.tripleOut, a1, a2),
        fill: mult,
        number: num,
        band: 'triple',
        mult: 3,
        onPick,
        disabled,
      }),
      segment({
        d: ring(R.tripleOut, R.doubleIn, a1, a2),
        fill: single,
        number: num,
        band: 'single',
        mult: 1,
        onPick,
        disabled,
      }),
      segment({
        d: ring(R.doubleIn, R.doubleOut, a1, a2),
        fill: mult,
        number: num,
        band: 'double',
        mult: 2,
        onPick,
        disabled,
      })
    );
  });
  return segs;
}

/**
 * The concentric + radial wire overlay ("spider") drawn on top of the wedges.
 * Pointer-events off so taps fall through to the segments beneath.
 * @returns {SVGElement}
 */
function renderSpider() {
  const children = [];
  [R.outerBull, R.tripleIn, R.tripleOut, R.doubleIn].forEach((r) =>
    children.push(svg('circle', { cx: CX, cy: CY, r }))
  );
  children.push(
    svg('circle', {
      cx: CX,
      cy: CY,
      r: R.doubleOut,
      stroke: 'rgba(232,244,232,.7)',
      'stroke-width': 3,
    })
  );
  for (let i = 0; i < 20; i++) {
    const a = i * 18 - 9;
    const [x1, y1] = pt(R.outerBull, a);
    const [x2, y2] = pt(R.doubleOut, a);
    children.push(svg('line', { x1, y1, x2, y2 }));
  }
  return svg(
    'g',
    {
      class: 'db__spider',
      fill: 'none',
      stroke: COL.wireLit,
      'stroke-width': 2,
      'pointer-events': 'none',
    },
    children
  );
}

/**
 * The bull: outer bull (25, green) and inner bull (50, red), both tappable.
 * @param {(value:number)=>void} onPick
 * @param {boolean} disabled
 * @returns {SVGElement[]}
 */
function renderBull(onPick, disabled) {
  const bull25 = svg('circle', {
    cx: CX,
    cy: CY,
    r: R.outerBull,
    fill: COL.green,
    class: `db__bull${disabled ? ' db__seg--disabled' : ''}`,
    stroke: COL.wireLit,
    'stroke-width': 2,
    role: 'button',
    tabindex: disabled ? -1 : 0,
    'aria-label': 'Outer bull, 25',
    ...(disabled ? {} : { onClick: () => onPick(25) }),
  });
  const bull50 = svg('circle', {
    cx: CX,
    cy: CY,
    r: R.innerBull,
    fill: COL.red,
    class: `db__bull${disabled ? ' db__seg--disabled' : ''}`,
    stroke: COL.wireLit,
    'stroke-width': 2,
    role: 'button',
    tabindex: disabled ? -1 : 0,
    'aria-label': 'Bullseye, 50',
    ...(disabled ? {} : { onClick: () => onPick(50) }),
  });
  return [bull25, bull50];
}

/** The cream numerals around the rim. */
function renderNumbers() {
  return ORDER.map((num, i) => {
    const [x, y] = pt(R.number, i * 18);
    return svg('text', { x, y, class: 'db__num' }, [String(num)]);
  });
}

/**
 * Render the whole dartboard SVG: dark cabinet, wedges, spider wires, bull, and
 * numerals — matching the layered order in dartboard.html.
 * @param {(value:number)=>void} onPick
 * @param {boolean} disabled
 * @returns {SVGElement}
 */
function renderBoardSvg(onPick, disabled) {
  const defs = svg('defs', {}, [
    svg('radialGradient', { id: 'db-disc', cx: '50%', cy: '46%', r: '60%' }, [
      svg('stop', { offset: '0%', 'stop-color': '#171b21' }),
      svg('stop', { offset: '70%', 'stop-color': '#0a0c10' }),
      svg('stop', { offset: '100%', 'stop-color': '#050609' }),
    ]),
    svg('radialGradient', { id: 'db-halo', cx: '50%', cy: '50%', r: '50%' }, [
      svg('stop', { offset: '82%', 'stop-color': 'rgba(0,0,0,0)' }),
      svg('stop', { offset: '100%', 'stop-color': 'rgba(0,0,0,.55)' }),
    ]),
  ]);

  const cabinet = [
    svg('circle', { cx: CX, cy: CY, r: 472, fill: 'url(#db-disc)' }),
    svg('circle', { cx: CX, cy: CY, r: 472, fill: 'url(#db-halo)' }),
    svg('circle', {
      cx: CX,
      cy: CY,
      r: 470,
      fill: 'none',
      stroke: 'rgba(255,255,255,.05)',
      'stroke-width': 2,
    }),
  ];

  const board = svg('g', { class: 'db__board' }, [
    ...renderWedges(onPick, disabled),
    renderSpider(),
    ...renderBull(onPick, disabled),
    ...renderNumbers(),
  ]);

  return svg(
    'svg',
    {
      class: 'db__svg',
      viewBox: '0 0 1000 1000',
      role: 'group',
      'aria-label': 'Dartboard — tap where the dart landed',
    },
    [defs, ...cabinet, board]
  );
}

/**
 * The count-down scoreboard: one row per player showing name + remaining. The
 * active thrower is highlighted; the leader (fewest remaining) wears the crown.
 * When onPickPlayer is given, rows are tappable so a referee can score out of
 * turn, matching the Target scoreboard's referee override.
 * @param {import('../games/dartboard.js').GameState} state
 * @param {string|null} activeId
 * @param {((playerId:string)=>void)|undefined} onPickPlayer
 * @returns {HTMLElement}
 */
function renderScores(state, activeId, onPickPlayer) {
  const players = state.players ?? [];
  const remainings = players.map((p) => remainingFor(state, p.id));
  const anyStarted = remainings.some((r) => r !== START_SCORE);
  const lowest = anyStarted ? Math.min(...remainings) : -1;

  const rows = players.map((p, idx) => {
    const rem = remainings[idx];
    const isLeader = anyStarted && rem === lowest;
    const isActive = p.id === activeId;
    const isWinner = state.winner === p.id;

    const rowClass = [
      'db__score-row',
      isLeader ? 'db__score-row--leader' : '',
      isActive ? 'db__score-row--active' : '',
      isWinner ? 'db__score-row--winner' : '',
      onPickPlayer ? 'db__score-row--tappable' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return el(
      'div',
      {
        class: rowClass,
        ...(onPickPlayer
          ? {
              role: 'button',
              tabindex: 0,
              'aria-label': `Score for ${p.name}, ${rem} remaining`,
              onClick: () => onPickPlayer(p.id),
            }
          : {}),
      },
      [
        el('span', { class: 'db__score-name' }, [
          isLeader ? el('span', { class: 'db__crown', text: '🎯' }) : '',
          el('span', { class: 'db__score-playername', text: p.name }),
        ]),
        el('span', { class: 'db__score-remaining', text: String(rem) }),
      ]
    );
  });

  return el('section', { class: 'db__scores', 'aria-label': 'Scores' }, rows);
}

/**
 * The status line above the board: whose throw it is and which dart of the
 * visit, or the winner once someone reaches 0.
 * @param {import('../games/dartboard.js').GameState} state
 * @param {string|null} activeOverrideId
 * @returns {HTMLElement}
 */
function renderStatus(state, activeOverrideId) {
  if (isComplete(state)) {
    const winner = state.players.find((p) => p.id === state.winner);
    return el('div', { class: 'db__status db__status--done' }, [
      el('span', {
        class: 'db__status-done',
        text: `${winner?.name ?? 'Player'} wins!`,
      }),
    ]);
  }
  const pos = activeOverrideId
    ? (positionForPlayer(state, activeOverrideId) ?? activePosition(state))
    : activePosition(state);
  if (!pos) {
    return el('div', { class: 'db__status' }, [
      el('span', { class: 'db__status-name', text: '—' }),
    ]);
  }
  const player = state.players[pos.playerIdx];
  return el('div', { class: 'db__status' }, [
    el('span', { class: 'db__status-name', text: player?.name ?? '—' }),
    el('span', {
      class: 'db__status-meta',
      text: `${remainingFor(state, pos.playerId)} left · Dart ${pos.dartInVisit + 1} of ${DARTS_PER_VISIT}`,
    }),
  ]);
}

/**
 * Render the whole interactive dartboard screen: the count-down scoreboard, the
 * status line, the dartboard SVG, and a control row (MISS + Undo). Tapping a
 * segment or MISS calls onThrow(value) for the active thrower; Undo calls
 * onUndo; tapping a scoreboard row (via onPickPlayer) overrides the thrower.
 * @param {import('../games/dartboard.js').GameState} state
 * @param {{
 *   onThrow:(value:number)=>void,
 *   onUndo:()=>void,
 *   onPickPlayer?:(playerId:string)=>void,
 *   activeOverrideId?:string|null,
 * }} handlers
 * @returns {HTMLElement}
 */
export function renderDartboardBoard(
  state,
  { onThrow, onUndo, onPickPlayer, activeOverrideId = null }
) {
  const done = isComplete(state);
  const activeId = activeOverrideId ?? activePosition(state)?.playerId ?? null;
  const onPick = (value) => {
    if (done) return;
    onThrow(value);
  };

  const boardSvg = renderBoardSvg(onPick, done);

  const missBtn = el('button', {
    class: 'btn tb__miss db__miss',
    text: 'MISS · 0',
    'aria-label': 'Miss, 0 points',
    disabled: done,
    onClick: () => onPick(0),
  });

  const undoBtn = el('button', {
    class: 'btn btn--ghost tb__undo',
    text: '↶ Undo',
    'aria-label': 'Undo last dart',
    onClick: onUndo,
  });

  return el('div', { class: `db${done ? ' db--done' : ''}` }, [
    renderScores(state, activeId, onPickPlayer),
    renderStatus(state, activeOverrideId),
    el('div', { class: 'db__target' }, [boardSvg]),
    el('div', { class: 'db__controls' }, [missBtn, undoBtn]),
  ]);
}
