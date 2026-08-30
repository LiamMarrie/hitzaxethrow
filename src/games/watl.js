/**
 * watl.js — WATL Standard game (thin config over the shared ring-target engine).
 *
 * The World Axe Throwing League official format: five rings scoring 1–5 from
 * the outside in, a bullseye cluster worth 6, and killshot dots worth 8.
 * Killshots are always live — a killshot always scores 8, and hitting a ring
 * while killshots exist simply scores that ring (no forfeit). 5 rounds of 5
 * throws, scored on the shared bowling-style scoreboard.
 *
 * All scoring/turn/undo logic lives in ring-target.js; this module only picks
 * the point values. The board artwork (ported from the WATL prototype) lives in
 * ui/watl-board.js.
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
  key: 'watl',
  name: 'WATL Standard',
  // Miss 0; rings 1–5 (outer→inner); bullseye cluster 6; killshot dots 8.
  throwValues: [0, 1, 2, 3, 4, 5, 6, 8],
});
