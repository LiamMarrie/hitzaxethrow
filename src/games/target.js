/**
 * target.js — Axe Classic game (thin config over the shared ring-target engine).
 *
 * Axe Classic is the beginner-friendly six-zone target: five concentric rings
 * scoring 1–5 from the outside in, plus a red bullseye centre worth 6. No
 * clutch/killshot mechanics — just where the axe landed. It is 5 rounds of 5
 * throws, scored on the shared bowling-style scoreboard.
 *
 * The internal game key stays `target` so existing session records, the router
 * wiring, and the tests keep working; only the display name and the point set
 * change from the original placeholder "Target" game.
 *
 * All scoring/turn/undo logic lives in ring-target.js; this module only picks
 * the point values and re-exports the engine's members so existing imports
 * (e.g. `import { createState } from '../games/target.js'`) keep working.
 */

import { createRingTargetGame } from './ring-target.js';

export const {
  GAME_KEY,
  GAME_NAME,
  THROW_VALUES,
  ROUNDS,
  THROWS_PER_ROUND,
  createState,
  applyThrow,
  undoLastThrow,
  isValidState,
  activePosition,
  positionForPlayer,
  isComplete,
  roundScore,
  roundPlayed,
  totalScore,
} = createRingTargetGame({
  key: 'target',
  name: 'Axe Classic',
  // Miss 0; five rings 1–5 (outer→inner); red bullseye centre 6.
  throwValues: [0, 1, 2, 3, 4, 5, 6],
});
