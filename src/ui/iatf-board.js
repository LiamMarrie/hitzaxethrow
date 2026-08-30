/**
 * ui/iatf-board.js — IATF Standard board (zone spec for the shared ring board).
 *
 * Ports the IATF prototype target (games-to-build/iatf-target.html) verbatim:
 * three dark rings — outer (r=300) worth 1, middle (r=190) worth 3, bullseye
 * (r=78) worth 5 — with heavy white ring lines, plus two blue clutch dots
 * (r=34, at 278,216 and 722,216) worth 7. Clutches are always live, so no
 * toggle — the dots always score 7.
 */

import { renderRingTargetBoard } from './ring-target-board.js';

/**
 * IATF zone spec — geometry and colours copied from the prototype SVG.
 * @type {import('./ring-target-board.js').ZoneSpec}
 */
const IATF_SPEC = {
  ariaLabel: 'IATF axe throwing target — tap where the axe landed',
  lineWidth: 7,
  discs: [
    { r: 300, points: 1, label: 'Outer ring' },
    { r: 190, points: 3, label: 'Middle ring' },
    { r: 78, points: 5, label: 'Bullseye' },
  ],
  spots: [
    { cx: 278, cy: 216, r: 34, points: 7, label: 'Clutch', kind: 'clutch' },
    { cx: 722, cy: 216, r: 34, points: 7, label: 'Clutch', kind: 'clutch' },
  ],
};

/**
 * Render the IATF Standard board.
 * @param {import('../games/ring-target-scoring.js').GameState} state
 * @param {{onThrow:(value:number)=>void, onUndo:()=>void, activeOverrideId?:string|null}} handlers
 * @returns {HTMLElement}
 */
export function renderIatfBoard(state, handlers) {
  return renderRingTargetBoard(state, handlers, IATF_SPEC);
}
