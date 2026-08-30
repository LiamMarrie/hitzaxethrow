/**
 * dartboard.test.js — game logic tests for 501 (dartboard).
 *
 * Covers the pure state layer the router drives: fresh state, subtracting a
 * dart's score, visit structure (3 darts per turn), turn order, any-out win at
 * exactly 0, whole-visit bust when a dart would go below 0, undo (including
 * undoing across a bust), the active/override position helpers, completion, and
 * structural validation of restored (untrusted) state.
 */

import { describe, it, expect } from 'vitest';
import {
  createState,
  applyThrow,
  undoLastThrow,
  activePosition,
  positionForPlayer,
  isComplete,
  isValidState,
  remainingFor,
  START_SCORE,
  DARTS_PER_VISIT,
} from './dartboard.js';

/** Two session-style players ({id,name}). */
const PLAYERS = [
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
];

/** Apply a sequence of dart values in order from a fresh state. */
function play(values, players = PLAYERS) {
  return values.reduce(
    (state, v) => applyThrow(state, v),
    createState(players)
  );
}

describe('createState', () => {
  it('starts every player at 501 with no darts thrown', () => {
    const state = createState(PLAYERS);
    expect(START_SCORE).toBe(501);
    for (const p of PLAYERS) {
      expect(remainingFor(state, p.id)).toBe(501);
    }
    expect(state.darts).toEqual([]);
    expect(state.winner).toBeNull();
  });

  it('keeps player id and name only', () => {
    const state = createState([{ id: 'a', name: 'Alice', extra: 1 }]);
    expect(state.players).toEqual([{ id: 'a', name: 'Alice' }]);
  });

  it('uses 3 darts per visit', () => {
    expect(DARTS_PER_VISIT).toBe(3);
  });
});

describe('applyThrow — scoring', () => {
  it('subtracts a dart value from the active player and records the dart', () => {
    const state = applyThrow(createState(PLAYERS), 60); // triple 20
    expect(remainingFor(state, 'a')).toBe(441);
    expect(state.darts).toHaveLength(1);
    expect(state.darts[0]).toMatchObject({ playerId: 'a', value: 60 });
  });

  it('keeps the same player active until 3 darts are thrown', () => {
    let state = createState(PLAYERS);
    state = applyThrow(state, 20);
    expect(activePosition(state).playerId).toBe('a');
    state = applyThrow(state, 20);
    expect(activePosition(state).playerId).toBe('a');
  });

  it('passes to the next player after 3 darts', () => {
    const state = play([20, 20, 20]);
    expect(remainingFor(state, 'a')).toBe(441);
    expect(activePosition(state).playerId).toBe('b');
  });

  it('rejects a value that is not a legal single-dart score', () => {
    const state = createState(PLAYERS);
    expect(applyThrow(state, 61)).toBe(state); // no dart scores 61
    expect(applyThrow(state, -5)).toBe(state);
    expect(applyThrow(state, 2.5)).toBe(state);
  });

  it('accepts 0 (a miss) as a dart', () => {
    const state = applyThrow(createState(PLAYERS), 0);
    expect(remainingFor(state, 'a')).toBe(501);
    expect(state.darts).toHaveLength(1);
  });
});

describe('applyThrow — win (any out)', () => {
  it('wins when a dart brings the player to exactly 0', () => {
    // Alice: 501 -> 3 (via big scores), then finishes on a single 3.
    let state = createState(PLAYERS);
    // Get Alice to 3 remaining using her visits, letting Bob throw between.
    // Simpler: drive directly with helper values that reach exactly 0.
    // 501 = 60+60+60 (v1) then 60+60+60 (v3) ... we build a known finish.
    state = play([60, 60, 60, 0, 0, 0]); // Alice 321, Bob 501, back to Alice
    state = play501ToZero(state);
    expect(state.winner).toBe('a');
    expect(remainingFor(state, 'a')).toBe(0);
    expect(isComplete(state)).toBe(true);
  });

  it('locks the board once won — further throws are no-ops', () => {
    let state = createState(PLAYERS);
    state = { ...state, winner: 'a', scores: { ...state.scores, a: 0 } };
    expect(applyThrow(state, 20)).toBe(state);
  });
});

describe('applyThrow — bust (revert whole visit)', () => {
  it('reverts the whole visit and passes turn when a dart would go below 0', () => {
    // Bring Alice to 40 remaining, then have her visit go bust.
    let state = bringToRemaining(createState(PLAYERS), 'a', 40);
    const before = remainingFor(state, 'a');
    expect(before).toBe(40);
    // Alice starts a fresh visit: 20 (->20), 20 (->0 would WIN)... use a bust path.
    state = applyThrow(state, 10); // 40 -> 30 (dart 1 of visit)
    state = applyThrow(state, 20); // 30 -> 10 (dart 2 of visit)
    state = applyThrow(state, 20); // 10 -> -10 BUST: revert whole visit
    expect(remainingFor(state, 'a')).toBe(40); // back to visit start
    expect(activePosition(state).playerId).toBe('b'); // turn passed
  });

  it('a single dart that overshoots busts and restores the visit start', () => {
    let state = bringToRemaining(createState(PLAYERS), 'a', 15);
    state = applyThrow(state, 20); // 15 - 20 = -5 BUST on first dart of visit
    expect(remainingFor(state, 'a')).toBe(15);
    expect(activePosition(state).playerId).toBe('b');
  });
});

describe('undoLastThrow', () => {
  it('reverts the last dart and its score', () => {
    let state = play([60]);
    expect(remainingFor(state, 'a')).toBe(441);
    state = undoLastThrow(state);
    expect(remainingFor(state, 'a')).toBe(501);
    expect(state.darts).toEqual([]);
  });

  it('is a no-op when nothing has been thrown', () => {
    const state = createState(PLAYERS);
    expect(undoLastThrow(state)).toBe(state);
  });

  it('restores darts voided by a bust when undoing past the bust', () => {
    let state = bringToRemaining(createState(PLAYERS), 'a', 40);
    state = applyThrow(state, 10); // -> 30
    state = applyThrow(state, 20); // -> 10
    state = applyThrow(state, 20); // BUST -> back to 40, turn passed
    // Undo the busting dart: back to Alice mid-visit at 10 remaining.
    state = undoLastThrow(state);
    expect(remainingFor(state, 'a')).toBe(10);
    expect(activePosition(state).playerId).toBe('a');
  });
});

describe('positionForPlayer / activePosition', () => {
  it('activePosition follows turn order across visits', () => {
    const state = play([20, 20, 20]); // Alice done her visit
    const pos = activePosition(state);
    expect(pos.playerId).toBe('b');
    expect(pos.dartInVisit).toBe(0);
  });

  it('positionForPlayer returns a slot for a chosen player', () => {
    const state = createState(PLAYERS);
    const pos = positionForPlayer(state, 'b');
    expect(pos.playerId).toBe('b');
  });

  it('applyThrow with a playerId scores for that player out of turn', () => {
    let state = createState(PLAYERS);
    state = applyThrow(state, 40, 'b'); // referee scores Bob though Alice is active
    expect(remainingFor(state, 'b')).toBe(461);
    expect(remainingFor(state, 'a')).toBe(501);
  });
});

describe('isValidState', () => {
  it('accepts a fresh state', () => {
    expect(isValidState(createState(PLAYERS))).toBe(true);
  });

  it('rejects junk', () => {
    expect(isValidState(null)).toBe(false);
    expect(isValidState({})).toBe(false);
    expect(isValidState({ players: [], scores: null })).toBe(false);
  });
});

// --- test helpers that drive the logic through legal states ---

/**
 * Drive the active player down to `target` remaining by feeding safe darts,
 * letting the other player throw harmless 0s between visits. Only used to set up
 * finish/bust scenarios. Assumes `playerId` is the currently active player at a
 * visit boundary in a 2-player fresh-ish game.
 */
function bringToRemaining(state, playerId, target) {
  let s = state;
  let guardLoops = 0;
  while (remainingFor(s, playerId) > target) {
    const pos = activePosition(s);
    if (pos.playerId === playerId) {
      const rem = remainingFor(s, playerId);
      // Step down without overshooting `target`, capped at 20 (a legal single).
      const step = Math.min(20, rem - target);
      s = applyThrow(s, step, playerId);
    } else {
      s = applyThrow(s, 0); // opponent throws a miss to advance turn order
    }
    if (++guardLoops > 500)
      throw new Error('bringToRemaining did not converge');
  }
  if (remainingFor(s, playerId) !== target) {
    throw new Error(
      `bringToRemaining overshot: got ${remainingFor(s, playerId)}, want ${target}`
    );
  }
  // Advance to a fresh visit boundary for `playerId` so the caller starts a new
  // visit — throw harmless 0s for whoever is active until it's this player's
  // turn AND they're at the start of a visit.
  while (
    activePosition(s).playerId !== playerId ||
    activePosition(s).dartInVisit !== 0
  ) {
    s = applyThrow(s, 0);
  }
  return s;
}

/** Finish the active player (assumed Alice) from her current remaining to 0. */
function play501ToZero(state) {
  let s = state;
  // ensure Alice is active
  while (activePosition(s).playerId !== 'a') s = applyThrow(s, 0);
  let rem = remainingFor(s, 'a');
  let dartsThisVisit = 0;
  while (rem > 0) {
    if (dartsThisVisit === 3) {
      // hand a visit to Bob then come back
      while (activePosition(s).playerId !== 'a') s = applyThrow(s, 0);
      dartsThisVisit = 0;
      rem = remainingFor(s, 'a');
      if (rem === 0) break;
    }
    const step = Math.min(20, rem);
    s = applyThrow(s, step, 'a');
    dartsThisVisit++;
    rem = remainingFor(s, 'a');
    if (s.winner) break;
  }
  return s;
}
