/**
 * ui/watl-board.js — WATL Standard board (zone spec for the shared ring board).
 *
 * Ports the WATL prototype target (games-to-build/watl-target.html) verbatim:
 * five dark rings (radii 340/284/228/172/116) scoring 1–5 from the outside in,
 * a five-dot red bullseye cluster worth 6 (centre dot + four satellites), and
 * four blue killshot dots worth 8. Killshots are always live, so no toggle —
 * the dots always score 8.
 */

import { renderRingTargetBoard } from './ring-target-board.js';

/**
 * WATL zone spec — geometry and colours copied from the prototype SVG.
 * @type {import('./ring-target-board.js').ZoneSpec}
 */
const WATL_SPEC = {
  ariaLabel: 'WATL axe throwing target — tap where the axe landed',
  lineWidth: 6,
  discs: [
    { r: 340, points: 1, label: '1 ring' },
    { r: 284, points: 2, label: '2 ring' },
    { r: 228, points: 3, label: '3 ring' },
    { r: 172, points: 4, label: '4 ring' },
    { r: 116, points: 5, label: '5 ring' },
  ],
  spots: [
    // Bullseye cluster (6): centre dot + four satellites.
    { cx: 500, cy: 500, r: 14, points: 6, label: 'Bullseye', kind: 'cluster' },
    { cx: 382, cy: 410, r: 12, points: 6, label: 'Bullseye', kind: 'cluster' },
    { cx: 618, cy: 410, r: 12, points: 6, label: 'Bullseye', kind: 'cluster' },
    { cx: 382, cy: 590, r: 12, points: 6, label: 'Bullseye', kind: 'cluster' },
    { cx: 618, cy: 590, r: 12, points: 6, label: 'Bullseye', kind: 'cluster' },
    // Killshot dots (8).
    { cx: 311, cy: 256, r: 16, points: 8, label: 'Killshot', kind: 'killshot' },
    { cx: 689, cy: 256, r: 16, points: 8, label: 'Killshot', kind: 'killshot' },
    { cx: 311, cy: 744, r: 16, points: 8, label: 'Killshot', kind: 'killshot' },
    { cx: 689, cy: 744, r: 16, points: 8, label: 'Killshot', kind: 'killshot' },
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
