import { describe, it, expect } from 'vitest';
import {
  createState,
  isValidState,
  roundScore,
  roundPlayed,
  totalScore,
  activePosition,
  applyThrow,
  undoLastThrow,
  isComplete,
  ROUNDS,
  THROWS_PER_ROUND,
} from '../src/games/target.js';

const players = [
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
];

describe('createState', () => {
  it('builds an empty grid of nulls per player', () => {
    const s = createState(players);
    expect(s.rounds).toBe(ROUNDS);
    expect(s.throwsPerRound).toBe(THROWS_PER_ROUND);
    expect(Object.keys(s.scores)).toEqual(['a', 'b']);
    expect(s.scores.a).toHaveLength(ROUNDS);
    expect(s.scores.a[0]).toHaveLength(THROWS_PER_ROUND);
    expect(s.scores.a.flat().every((t) => t === null)).toBe(true);
  });

  it('copies only id and name, and tolerates no players', () => {
    expect(createState().players).toEqual([]);
    const s = createState([{ id: 'x', name: 'X', extra: 1 }]);
    expect(s.players[0]).toEqual({ id: 'x', name: 'X' });
  });

  it('produces a valid state', () => {
    expect(isValidState(createState(players))).toBe(true);
  });
});

describe('isValidState', () => {
  it('rejects junk and the old {players} shape', () => {
    expect(isValidState(null)).toBe(false);
    expect(isValidState({})).toBe(false);
    expect(isValidState({ players: ['a', 'b'] })).toBe(false); // old shape
  });
});

describe('roundScore', () => {
  it('sums thrown values and ignores nulls', () => {
    expect(roundScore([3, 2, null, 0, 5])).toBe(10);
    expect(roundScore([null, null, null, null, null])).toBe(0);
  });
  it('is 0 for non-arrays', () => {
    expect(roundScore(undefined)).toBe(0);
  });
});

describe('roundPlayed', () => {
  it('is true once any throw is entered, including a 0', () => {
    expect(roundPlayed([0, null, null, null, null])).toBe(true);
    expect(roundPlayed([null, null, null, null, null])).toBe(false);
  });
  it('distinguishes an all-miss round from an unplayed one', () => {
    const allMiss = [0, 0, 0, 0, 0];
    expect(roundPlayed(allMiss)).toBe(true);
    expect(roundScore(allMiss)).toBe(0);
  });
});

describe('totalScore', () => {
  it('sums across all rounds', () => {
    const s = createState(players);
    s.scores.a[0] = [3, 2, 1, 0, 5]; // 11
    s.scores.a[1] = [1, 1, null, null, null]; // 2
    expect(totalScore(s.scores.a)).toBe(13);
    expect(totalScore(s.scores.b)).toBe(0);
  });
});

describe('activePosition', () => {
  it('starts at the first player, first round, first throw', () => {
    const s = createState(players);
    expect(activePosition(s)).toEqual({
      playerId: 'a',
      playerIdx: 0,
      round: 0,
      throwIdx: 0,
    });
  });

  it('advances through a player’s throws before moving to the next player', () => {
    const s = createState(players);
    s.scores.a[0] = [3, 2, null, null, null]; // Alice has thrown twice
    expect(activePosition(s)).toEqual({
      playerId: 'a',
      playerIdx: 0,
      round: 0,
      throwIdx: 2,
    });
  });

  it('moves to the next player once the current player finishes the round', () => {
    const s = createState(players);
    s.scores.a[0] = [3, 2, 1, 0, 5]; // Alice done with round 0
    expect(activePosition(s)).toEqual({
      playerId: 'b',
      playerIdx: 1,
      round: 0,
      throwIdx: 0,
    });
  });

  it('advances to the next round once all players finish the round', () => {
    const s = createState(players);
    s.scores.a[0] = [3, 2, 1, 0, 5];
    s.scores.b[0] = [1, 1, 1, 1, 1];
    expect(activePosition(s)).toEqual({
      playerId: 'a',
      playerIdx: 0,
      round: 1,
      throwIdx: 0,
    });
  });

  it('returns null when every throw is filled', () => {
    const s = createState(players);
    for (const p of ['a', 'b']) {
      s.scores[p] = Array.from({ length: ROUNDS }, () =>
        Array.from({ length: THROWS_PER_ROUND }, () => 1)
      );
    }
    expect(activePosition(s)).toBeNull();
  });

  it('returns null when there are no players', () => {
    expect(activePosition(createState())).toBeNull();
  });
});

describe('applyThrow', () => {
  it('records the value at the active position and advances', () => {
    const s = createState(players);
    const s2 = applyThrow(s, 3);
    expect(s2.scores.a[0][0]).toBe(3);
    expect(activePosition(s2)).toEqual({
      playerId: 'a',
      playerIdx: 0,
      round: 0,
      throwIdx: 1,
    });
  });

  it('records a genuine miss (0) as a played throw', () => {
    const s = applyThrow(createState(players), 0);
    expect(s.scores.a[0][0]).toBe(0);
    expect(roundPlayed(s.scores.a[0])).toBe(true);
  });

  it('does not mutate the input state', () => {
    const s = createState(players);
    applyThrow(s, 5);
    expect(s.scores.a[0][0]).toBeNull();
  });

  it('is a no-op once the game is complete', () => {
    const s = createState(players);
    for (const p of ['a', 'b']) {
      s.scores[p] = Array.from({ length: ROUNDS }, () =>
        Array.from({ length: THROWS_PER_ROUND }, () => 1)
      );
    }
    expect(applyThrow(s, 5)).toBe(s);
  });

  it('can record a throw for a chosen player, overriding turn order', () => {
    const s = createState(players);
    const s2 = applyThrow(s, 2, 'b');
    expect(s2.scores.b[0][0]).toBe(2);
    expect(s2.scores.a[0][0]).toBeNull();
  });
});

describe('undoLastThrow', () => {
  it('reverts the most recently entered throw to null', () => {
    let s = createState(players);
    s = applyThrow(s, 3);
    s = applyThrow(s, 2);
    const undone = undoLastThrow(s);
    expect(undone.scores.a[0][1]).toBeNull();
    expect(undone.scores.a[0][0]).toBe(3);
    expect(activePosition(undone)).toEqual({
      playerId: 'a',
      playerIdx: 0,
      round: 0,
      throwIdx: 1,
    });
  });

  it('walks back across a round boundary', () => {
    const s = createState(players);
    s.scores.a[0] = [3, 2, 1, 0, 5];
    s.scores.b[0] = [1, 1, 1, 1, 1];
    // active is now a/round1/throw0; undo should clear b/round0/throw4
    const undone = undoLastThrow(s);
    expect(undone.scores.b[0][4]).toBeNull();
    expect(activePosition(undone)).toEqual({
      playerId: 'b',
      playerIdx: 1,
      round: 0,
      throwIdx: 4,
    });
  });

  it('is a no-op when nothing has been thrown', () => {
    const s = createState(players);
    expect(undoLastThrow(s)).toBe(s);
  });

  it('does not mutate the input state', () => {
    let s = createState(players);
    s = applyThrow(s, 3);
    const before = s.scores.a[0][0];
    undoLastThrow(s);
    expect(s.scores.a[0][0]).toBe(before);
  });
});

describe('isComplete', () => {
  it('is false on a fresh game', () => {
    expect(isComplete(createState(players))).toBe(false);
  });

  it('is false with no players', () => {
    expect(isComplete(createState())).toBe(false);
  });

  it('is true once every throw of every player is filled', () => {
    const s = createState(players);
    for (const p of ['a', 'b']) {
      s.scores[p] = Array.from({ length: ROUNDS }, () =>
        Array.from({ length: THROWS_PER_ROUND }, () => 0)
      );
    }
    expect(isComplete(s)).toBe(true);
  });
});
