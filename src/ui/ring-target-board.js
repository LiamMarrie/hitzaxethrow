/**
 * ui/ring-target-board.js — shared interactive board for the ring-target games
 * (Axe Classic, WATL, IATF).
 *
 * Draws the axe target as inline SVG on the same 0..1000 viewBox as the
 * prototype HTML boards, reproducing their look verbatim: a near-black target
 * field, heavy white concentric ring lines, a red bullseye/cluster, and glowing
 * blue killshot/clutch dots. Vector, so it stays razor-sharp when the tablet
 * screen is recorded and projected onto the physical target.
 *
 * Each game supplies only a "zone spec" (its discs + spots + line width, ported
 * straight from the matching prototype); this component renders the status line,
 * the SVG, and the MISS + Undo controls, and handles the disabled/complete state
 * and accessibility in one place.
 *
 * Layering matches the prototypes so taps resolve correctly: a full-board miss
 * rect at the back, then the scoring discs largest-first (smaller rings on top
 * so an inner tap scores the inner ring), then the white ring lines and the
 * horizontal point numerals (both visual only — pointer-events off), then the
 * spot dots on top (so a dot always wins the tap over the disc beneath it).
 *
 * Every tap also drops a transient hit marker + floating "+N" points chip at the
 * tap point via ui/hit-feedback.js, so the referee gets clear "the target was
 * hit" feedback even though recording the throw immediately re-renders the board.
 */

import { el } from './render.js';
import { showHitFeedback } from './hit-feedback.js';
import {
  activePosition,
  positionForPlayer,
  isComplete,
} from '../games/ring-target-scoring.js';

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

/** Centre of the 1000x1000 viewBox (all prototype boards are centred). */
const CX = 500;
const CY = 500;

/**
 * @typedef {Object} Disc
 * @property {number} r      radius in the 0..1000 viewBox
 * @property {number} points value this ring scores
 * @property {string} label  a11y label (e.g. '1 ring', 'Bullseye')
 * @property {string} [fill] optional fill (e.g. red bullseye); dark disc if omitted
 *
 * @typedef {Object} Spot
 * @property {number} cx
 * @property {number} cy
 * @property {number} r
 * @property {number} points value this dot scores
 * @property {string} label  a11y label (e.g. 'Killshot')
 * @property {'cluster'|'killshot'|'clutch'} kind styling class
 *
 * @typedef {Object} ZoneSpec
 * @property {string} ariaLabel   SVG group label
 * @property {number} lineWidth   white ring-line stroke width (viewBox units)
 * @property {Disc[]} discs       concentric scoring discs, largest first
 * @property {Spot[]} spots       dots drawn on top (cluster/killshot/clutch)
 */

/**
 * A point label with correct pluralisation for a11y.
 * @param {string} label
 * @param {number} points
 * @returns {string}
 */
function ariaFor(label, points) {
  return `${label}, ${points} point${points === 1 ? '' : 's'}`;
}

/**
 * The colour tone a zone contributes to its hit-feedback chip/marker.
 *  - a filled disc is the red bullseye ('bull'); a plain disc is a ring;
 *  - a cluster spot is the red bullseye tone, killshot/clutch are blue.
 * @param {Disc} disc
 * @returns {string}
 */
function discTone(disc) {
  return disc.fill ? 'bull' : 'ring';
}

/**
 * Resolve the viewport coordinates of a tap for the hit-feedback overlay. Uses
 * the pointer position when present (a real tap/click), and falls back to the
 * centre of the activated element for keyboard activation (Enter/Space fire a
 * click with no pointer coordinates) or headless environments.
 * @param {Event} event the click event
 * @returns {{x:number, y:number}}
 */
function pointerXY(event) {
  const hasPointer =
    event &&
    typeof event.clientX === 'number' &&
    (event.clientX !== 0 || event.clientY !== 0);
  if (hasPointer) return { x: event.clientX, y: event.clientY };
  const target = event?.currentTarget ?? event?.target;
  if (target && typeof target.getBoundingClientRect === 'function') {
    const rect = target.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  return { x: 0, y: 0 };
}

/**
 * One tappable scoring disc (a filled circle). Dark by default, or the disc's
 * own fill (used for the red bullseye). The whole circle is the tap target.
 * @param {Disc} disc
 * @param {(value:number, tone:string, event:Event)=>void} onHit
 * @param {boolean} disabled
 * @returns {SVGElement}
 */
function discZone(disc, onHit, disabled) {
  return svg('circle', {
    class: `tb__zone rt__disc${disabled ? ' tb__zone--disabled' : ''}`,
    cx: CX,
    cy: CY,
    r: disc.r,
    ...(disc.fill ? { fill: disc.fill } : {}),
    role: 'button',
    tabindex: disabled ? -1 : 0,
    'aria-label': ariaFor(disc.label, disc.points),
    ...(disabled
      ? {}
      : { onClick: (e) => onHit(disc.points, discTone(disc), e) }),
  });
}

/**
 * A white ring outline for a disc — visual only, taps fall through to the discs.
 * @param {Disc} disc
 * @param {number} lineWidth
 * @returns {SVGElement}
 */
function ringLine(disc, lineWidth) {
  return svg('circle', {
    class: 'rt__line',
    cx: CX,
    cy: CY,
    r: disc.r,
    'stroke-width': lineWidth,
  });
}

/**
 * The point-value numerals for each disc, laid out horizontally from the outer
 * ring in to the centre (the referee reads "1 2 3 …" marching toward the
 * bullseye). Each numeral sits at the middle of its ring's visible band on the
 * horizontal centre line. Visual only — pointer-events are off so taps fall
 * through to the disc beneath, and they're aria-hidden because each disc already
 * carries a spoken label.
 * @param {Disc[]} discs concentric discs, largest first
 * @returns {SVGElement[]}
 */
function ringNumbers(discs) {
  return discs.map((disc, i) => {
    const innerR = discs[i + 1]?.r ?? 0; // centre for the innermost disc
    const bandMid = (disc.r + innerR) / 2;
    return svg('text', {
      class: 'rt__num',
      x: CX - bandMid,
      y: CY,
      'aria-hidden': 'true',
      text: String(disc.points),
    });
  });
}

/**
 * One tappable spot dot (bullseye cluster, killshot, or clutch).
 * @param {Spot} spot
 * @param {(value:number, tone:string, event:Event)=>void} onHit
 * @param {boolean} disabled
 * @returns {SVGElement}
 */
function spotZone(spot, onHit, disabled) {
  const tone = spot.kind === 'cluster' ? 'bull' : 'kill';
  return svg('circle', {
    class: `tb__zone rt__${spot.kind}${disabled ? ' tb__zone--disabled' : ''}`,
    cx: spot.cx,
    cy: spot.cy,
    r: spot.r,
    role: 'button',
    tabindex: disabled ? -1 : 0,
    'aria-label': ariaFor(spot.label, spot.points),
    ...(disabled ? {} : { onClick: (e) => onHit(spot.points, tone, e) }),
  });
}

/**
 * Render the target SVG from a zone spec, in prototype layering order.
 * @param {ZoneSpec} spec
 * @param {(value:number, tone:string, event:Event)=>void} onHit
 * @param {boolean} disabled whole board disabled (game complete)
 * @returns {SVGElement}
 */
function renderTargetSvg(spec, onHit, disabled) {
  // Full-board miss zone at the back — tapping off the rings scores 0, matching
  // the prototypes. Pointer-only (aria-hidden); the MISS button is the
  // keyboard/screen-reader accessible way to record a miss.
  const missZone = svg('rect', {
    class: 'rt__miss-zone',
    x: 0,
    y: 0,
    width: 1000,
    height: 1000,
    'aria-hidden': 'true',
    ...(disabled ? {} : { onClick: (e) => onHit(0, 'miss', e) }),
  });

  const discs = spec.discs.map((d) => discZone(d, onHit, disabled));
  const lines = spec.discs.map((d) => ringLine(d, spec.lineWidth));
  const numbers = ringNumbers(spec.discs);
  const spots = spec.spots.map((s) => spotZone(s, onHit, disabled));

  return svg(
    'svg',
    {
      class: 'tb__svg rt__svg',
      viewBox: '0 0 1000 1000',
      role: 'group',
      'aria-label': spec.ariaLabel,
    },
    [missZone, ...discs, ...lines, ...numbers, ...spots]
  );
}

/**
 * The status line above the target: whose throw it is, and which round/throw,
 * or a "game complete" note once every throw is in. When the referee has picked
 * a player out of turn (`activeOverrideId`), that player's next open slot is
 * shown instead of the natural turn-order position.
 * @param {import('../games/ring-target-scoring.js').GameState} state
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
 * Render the whole interactive ring-target board: status line, the SVG target
 * (from the game's zone spec), and a control row (MISS + Undo). Tapping a zone
 * or MISS calls onThrow(value) for the active thrower; Undo calls onUndo.
 * @param {import('../games/ring-target-scoring.js').GameState} state
 * @param {{onThrow:(value:number)=>void, onUndo:()=>void, activeOverrideId?:string|null}} handlers
 * @param {ZoneSpec} spec the game's board geometry/colours
 * @returns {HTMLElement}
 */
export function renderRingTargetBoard(
  state,
  { onThrow, onUndo, activeOverrideId = null },
  spec
) {
  const done = isComplete(state);
  // A tap on any zone: first drop the hit marker + floating points at the tap
  // point (this overlay lives on <body>, so it survives the re-render that
  // recording the throw triggers), then record the throw.
  const onHit = (value, tone, event) => {
    if (done) return;
    const { x, y } = pointerXY(event);
    showHitFeedback({ x, y, points: value, tone });
    onThrow(value);
  };

  const targetSvg = renderTargetSvg(spec, onHit, done);

  const missBtn = el('button', {
    class: 'btn tb__miss',
    text: 'MISS · 0',
    'aria-label': 'Miss, 0 points',
    disabled: done,
    onClick: (e) => onHit(0, 'miss', e),
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
