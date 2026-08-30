/**
 * ui/target-board.js — the interactive WATL-style axe target.
 *
 * This replaces the old placeholder box. It draws a real axe-throwing target as
 * inline SVG (vector, so it stays razor-sharp when the tablet screen is recorded
 * and projected onto the physical target — no raster assets to blur). Tapping a
 * zone records a throw for the active thrower via the onThrow handler; a MISS
 * button records a 0 and an Undo button reverts the last throw.
 *
 * Scoring zones (WATL model, see games/target.js THROW_VALUES = [0,1,2,3,5]):
 *   - bullseye (centre)      -> 3
 *   - middle ring            -> 2
 *   - outer ring             -> 1
 *   - two clutch dots (top)  -> 5
 *   - MISS button            -> 0
 *
 * Colours are chosen for maximum projector legibility: a black field, bright
 * saturated rings, and heavy white outlines/labels. No thin lines or muddy
 * greys that wash out when projected.
 */

import { el } from './render.js';
import {
  activePosition,
  positionForPlayer,
  isComplete,
  THROW_VALUES,
} from '../games/target.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Small helper mirroring render.js `el` but in the SVG namespace, since SVG
 * elements must be created with createElementNS to render.
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

// Target geometry, in the 0..100 viewBox. Centre is a bit low so the two
// clutch dots have room in the top corners, like a real WATL board.
const CX = 50;
const CY = 56;
const R_OUTER = 40; // value 1
const R_MIDDLE = 26; // value 2
const R_BULL = 12; // value 3
const CLUTCH_R = 6; // value 5
const CLUTCH_Y = 14;
const CLUTCH_LEFT_X = 16;
const CLUTCH_RIGHT_X = 84;

// Zone fills — saturated so each ring is unmistakable when projected.
const FILL_OUTER = '#1f6feb'; // blue
const FILL_MIDDLE = '#e5484d'; // red
const FILL_BULL = '#f5b301'; // gold
const FILL_CLUTCH = '#37c8ab'; // teal (the app accent-2)
const STROKE = '#ffffff';

/**
 * Build one tappable target zone: a circle plus its value label. The whole
 * group is the tap target so a referee doesn't have to hit the tiny numeral.
 * @param {object} opts
 * @param {number} opts.cx
 * @param {number} opts.cy
 * @param {number} opts.r
 * @param {string} opts.fill
 * @param {number} opts.value points this zone scores
 * @param {string} opts.label human label for a11y (e.g. "Bullseye")
 * @param {number} opts.fontSize label font size in viewBox units
 * @param {number} opts.labelDy vertical offset for the label (rings label near top)
 * @param {(value:number)=>void} opts.onPick
 * @param {boolean} opts.disabled
 * @returns {SVGElement}
 */
function zone({
  cx,
  cy,
  r,
  fill,
  value,
  label,
  fontSize,
  labelDy,
  onPick,
  disabled,
}) {
  const group = svg(
    'g',
    {
      class: `tb__zone${disabled ? ' tb__zone--disabled' : ''}`,
      role: 'button',
      tabindex: disabled ? -1 : 0,
      'aria-label': `${label}, ${value} point${value === 1 ? '' : 's'}`,
      ...(disabled ? {} : { onClick: () => onPick(value) }),
    },
    [
      svg('circle', {
        cx,
        cy,
        r,
        fill,
        stroke: STROKE,
        'stroke-width': 1.4,
      }),
      svg(
        'text',
        {
          x: cx,
          y: cy + labelDy,
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          class: 'tb__zone-label',
          'font-size': fontSize,
        },
        [String(value)]
      ),
    ]
  );
  return group;
}

/**
 * Render the target SVG itself (rings + clutch dots).
 * @param {(value:number)=>void} onPick
 * @param {boolean} disabled whole board disabled (game complete)
 * @returns {SVGElement}
 */
function renderTargetSvg(onPick, disabled) {
  return svg(
    'svg',
    {
      class: 'tb__svg',
      viewBox: '0 0 100 100',
      role: 'group',
      'aria-label': 'Axe target — tap where the axe landed',
    },
    [
      // Rings, outer first so inner ones layer on top. Ring numerals sit near
      // the top edge of each ring so they aren't hidden by the inner ring.
      zone({
        cx: CX,
        cy: CY,
        r: R_OUTER,
        fill: FILL_OUTER,
        value: 1,
        label: 'Outer ring',
        fontSize: 7,
        labelDy: -(R_OUTER - 6),
        onPick,
        disabled,
      }),
      zone({
        cx: CX,
        cy: CY,
        r: R_MIDDLE,
        fill: FILL_MIDDLE,
        value: 2,
        label: 'Middle ring',
        fontSize: 7,
        labelDy: -(R_MIDDLE - 6),
        onPick,
        disabled,
      }),
      zone({
        cx: CX,
        cy: CY,
        r: R_BULL,
        fill: FILL_BULL,
        value: 3,
        label: 'Bullseye',
        fontSize: 10,
        labelDy: 0,
        onPick,
        disabled,
      }),
      // Clutch dots (worth 5) in the two upper corners.
      zone({
        cx: CLUTCH_LEFT_X,
        cy: CLUTCH_Y,
        r: CLUTCH_R,
        fill: FILL_CLUTCH,
        value: 5,
        label: 'Left clutch',
        fontSize: 6,
        labelDy: 0,
        onPick,
        disabled,
      }),
      zone({
        cx: CLUTCH_RIGHT_X,
        cy: CLUTCH_Y,
        r: CLUTCH_R,
        fill: FILL_CLUTCH,
        value: 5,
        label: 'Right clutch',
        fontSize: 6,
        labelDy: 0,
        onPick,
        disabled,
      }),
    ]
  );
}

/**
 * The status line above the target: whose throw it is, and which round/throw,
 * or a "game complete" note once every throw is in. When the referee has picked
 * a player out of turn (`activeOverrideId`), that player's next open slot is
 * shown instead of the natural turn-order position.
 * @param {import('../games/target.js').GameState} state
 * @param {string|null} activeOverrideId
 * @returns {HTMLElement}
 */
function renderStatus(state, activeOverrideId) {
  if (isComplete(state)) {
    return el('div', { class: 'tb__status tb__status--done' }, [
      el('span', { class: 'tb__status-done', text: 'Game complete' }),
    ]);
  }
  const pos = activeOverrideId
    ? (positionForPlayer(state, activeOverrideId) ?? activePosition(state))
    : activePosition(state);
  if (!pos) {
    // No players / nothing to throw — keep the board inert but visible.
    return el('div', { class: 'tb__status' }, [
      el('span', { class: 'tb__status-name', text: '—' }),
    ]);
  }
  const player = state.players[pos.playerIdx];
  return el('div', { class: 'tb__status' }, [
    el('span', { class: 'tb__status-name', text: player?.name ?? '—' }),
    el('span', {
      class: 'tb__status-meta',
      text: `Round ${pos.round + 1} · Throw ${pos.throwIdx + 1} of ${state.throwsPerRound}`,
    }),
  ]);
}

/**
 * Render the whole interactive target board: status line, the SVG target, and a
 * control row (MISS + Undo). Tapping a zone or MISS calls onThrow(value) for the
 * active thrower; Undo calls onUndo.
 * @param {import('../games/target.js').GameState} state
 * @param {{onThrow:(value:number)=>void, onUndo:()=>void, activeOverrideId?:string|null}} handlers
 * @returns {HTMLElement}
 */
export function renderTargetBoard(
  state,
  { onThrow, onUndo, activeOverrideId = null }
) {
  const done = isComplete(state);
  const onPick = (value) => {
    if (done) return;
    onThrow(value);
  };

  const targetSvg = renderTargetSvg(onPick, done);

  const missBtn = el('button', {
    class: 'btn tb__miss',
    text: 'MISS · 0',
    'aria-label': 'Miss, 0 points',
    disabled: done,
    onClick: () => onPick(0),
  });

  const undoBtn = el('button', {
    class: 'btn btn--ghost tb__undo',
    text: '↶ Undo',
    'aria-label': 'Undo last throw',
    onClick: onUndo,
  });

  return el('div', { class: `tb${done ? ' tb--done' : ''}` }, [
    renderStatus(state, activeOverrideId),
    el('div', { class: 'tb__target' }, [targetSvg]),
    el('div', { class: 'tb__controls' }, [missBtn, undoBtn]),
  ]);
}

// Re-export for callers/tests that want the canonical value set.
export { THROW_VALUES };
