/**
 * iatf.js — IATF Standard game (thin config over the shared ring-target engine).
 *
 * The International Axe Throwing Federation official format: a three-ring
 * target scoring outer 1, middle 3, bullseye 5, plus two clutch dots worth 7.
 * Clutches are always live — a clutch always scores 7, and hitting a ring while
 * clutches exist simply scores that ring (no forfeit). 5 rounds of 5 throws,
 * scored on the shared bowling-style scoreboard.
 *
 * All scoring/turn/undo logic lives in ring-target.js; this module only picks
 * the point values. The board artwork (ported from the IATF prototype) lives in
 * ui/iatf-board.js.
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
  key: 'iatf',
  name: 'IATF Standard',
  // Miss 0; outer ring 1, middle ring 3, bullseye 5; clutch dots 7.
  throwValues: [0, 1, 3, 5, 7],
});
