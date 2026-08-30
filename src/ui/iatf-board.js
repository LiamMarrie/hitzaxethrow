/**
 * ui/iatf-board.js — IATF Standard board (zone spec for the shared ring board).
 *
 * Ports the IATF prototype target (games-to-build/iatf-target.html) but scaled
 * up for the projected feed: three dark rings — outer (r=340) worth 1, middle
 * (r=220) worth 3, and a solid red bullseye (r=104) worth 5 — with heavy white
 * ring lines and each ring's point value drawn along the horizontal centre
 * line. Two blue clutch dots worth 7 are enlarged (r=44) and pushed further out
 * into the dark field beyond the outer ring. Clutches are always live, so no
 * toggle — the dots always score 7.
 */

import { renderRingTargetBoard } from './ring-target-board.js';

/** Red used for the bullseye, matching the WATL/Axe Classic bullseye red. */
const BULLSEYE_RED = '#d63a2f';

/**
 * IATF zone spec — scaled-up geometry with a red bullseye centre.
 * @type {import('./ring-target-board.js').ZoneSpec}
 */
const IATF_SPEC = {
  ariaLabel: 'IATF axe throwing target — tap where the axe landed',
  lineWidth: 8,
  discs: [
    { r: 340, points: 1, label: 'Outer ring' },
    { r: 220, points: 3, label: 'Middle ring' },
    { r: 104, points: 5, label: 'Bullseye', fill: BULLSEYE_RED },
  ],
  spots: [
    { cx: 235, cy: 161, r: 44, points: 7, label: 'Clutch', kind: 'clutch' },
    { cx: 765, cy: 161, r: 44, points: 7, label: 'Clutch', kind: 'clutch' },
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
