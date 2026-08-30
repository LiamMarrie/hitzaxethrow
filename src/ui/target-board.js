/**
 * ui/target-board.js — Axe Classic board (zone spec for the shared ring board).
 *
 * Six evenly-spaced concentric zones on the shared 0..1000 target field: five
 * dark rings scoring 1–5 from the outside in (heavy white ring lines, exactly
 * like the WATL prototype), plus a red bullseye centre worth 6. No
 * clutch/killshot dots. Radii follow the WATL prototype's 56-unit spacing
 * (340/284/228/172/116) and extend it by one ring for the bullseye, so the
 * board sits visually alongside the WATL target it's derived from.
 */

import { renderRingTargetBoard } from './ring-target-board.js';

/** Red used for the bullseye, matching the prototype cluster red. */
const BULLSEYE_RED = '#d63a2f';

/**
 * Axe Classic zone spec: 6 concentric discs (largest first), no spots.
 * @type {import('./ring-target-board.js').ZoneSpec}
 */
const AXE_CLASSIC_SPEC = {
  ariaLabel: 'Axe Classic target — tap where the axe landed',
  lineWidth: 6,
  discs: [
    { r: 340, points: 1, label: '1 ring' },
    { r: 284, points: 2, label: '2 ring' },
    { r: 228, points: 3, label: '3 ring' },
    { r: 172, points: 4, label: '4 ring' },
    { r: 116, points: 5, label: '5 ring' },
    { r: 60, points: 6, label: 'Bullseye', fill: BULLSEYE_RED },
  ],
  spots: [],
};

/**
 * Render the Axe Classic board.
 * @param {import('../games/ring-target-scoring.js').GameState} state
 * @param {{onThrow:(value:number)=>void, onUndo:()=>void, activeOverrideId?:string|null}} handlers
 * @returns {HTMLElement}
 */
export function renderTargetBoard(state, handlers) {
  return renderRingTargetBoard(state, handlers, AXE_CLASSIC_SPEC);
}
