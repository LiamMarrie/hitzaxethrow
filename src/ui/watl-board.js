/**
 * ui/watl-board.js — WATL Standard board (zone spec for the shared ring board).
 *
 * Ports the WATL prototype target (games-to-build/watl-target.html) but scaled
 * up for the projected feed: five dark rings (66-unit bands, outer r=390)
 * scoring 1–5 from the outside in, a solid red bullseye worth 6 with four red
 * cluster satellites around it, and four blue killshot dots worth 8. The
 * killshots are enlarged and pushed out into the dark field beyond the outer
 * ring so they're easy to tap and clearly separate from the rings. Each ring's
 * point value is drawn along the horizontal centre line, marching in toward the
 * bullseye. Killshots are always live, so no toggle — the dots always score 8.
 */

import { renderRingTargetBoard } from './ring-target-board.js';

/** Red used for the bullseye + cluster dots, matching the prototype red. */
const CLUSTER_RED = '#d63a2f';

/**
 * WATL zone spec — scaled-up geometry with a red bullseye centre.
 * @type {import('./ring-target-board.js').ZoneSpec}
 */
const WATL_SPEC = {
  ariaLabel: 'WATL axe throwing target — tap where the axe landed',
  lineWidth: 7,
  discs: [
    { r: 390, points: 1, label: '1 ring' },
    { r: 324, points: 2, label: '2 ring' },
    { r: 258, points: 3, label: '3 ring' },
    { r: 192, points: 4, label: '4 ring' },
    { r: 126, points: 5, label: '5 ring' },
    { r: 66, points: 6, label: 'Bullseye', fill: CLUSTER_RED },
  ],
  spots: [
    // Bullseye cluster (6): four red satellites around the red bullseye disc.
    { cx: 432, cy: 432, r: 15, points: 6, label: 'Bullseye', kind: 'cluster' },
    { cx: 568, cy: 432, r: 15, points: 6, label: 'Bullseye', kind: 'cluster' },
    { cx: 432, cy: 568, r: 15, points: 6, label: 'Bullseye', kind: 'cluster' },
    { cx: 568, cy: 568, r: 15, points: 6, label: 'Bullseye', kind: 'cluster' },
    // Killshot dots (8): bigger and pushed out beyond the outer ring.
    { cx: 221, cy: 140, r: 30, points: 8, label: 'Killshot', kind: 'killshot' },
    { cx: 779, cy: 140, r: 30, points: 8, label: 'Killshot', kind: 'killshot' },
    { cx: 221, cy: 860, r: 30, points: 8, label: 'Killshot', kind: 'killshot' },
    { cx: 779, cy: 860, r: 30, points: 8, label: 'Killshot', kind: 'killshot' },
  ],
};

/**
 * Render the WATL Standard board.
 * @param {import('../games/ring-target-scoring.js').GameState} state
 * @param {{onThrow:(value:number)=>void, onUndo:()=>void, activeOverrideId?:string|null}} handlers
 * @returns {HTMLElement}
 */
export function renderWatlBoard(state, handlers) {
  return renderRingTargetBoard(state, handlers, WATL_SPEC);
}
