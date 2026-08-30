/**
 * pairs.test.js — game logic tests for Pairs (memory match).
 *
 * Covers the pure state layer the router drives: fresh state, the match rule
 * (including the wild Joker), the two-pick flip with peek/flip-back resolution,
 * win detection and the leftover card, no-op handling, immutability, rematch
 * reset, and structural validation of restored (untrusted) state.
 *
 * Tests use a FIXED, unshuffled deck (via buildDeck) so picks are deterministic
 * regardless of the real deal's Math.random shuffle:
 *   0:JD 1:JD  2:KC 3:KC  4:QH 5:QH  6:AS 7:AS  8:JOKER
 */

import { describe, it, expect } from 'vitest';
import {
  createState,
  applyMove,
  reset,
  isMatch,
  isComplete,
  isPeeking,
  leftoverIndex,
  isValidState,
  buildDeck,
  PAIRS,
  TOTAL_PAIRS,
  CARDS,
} from './pairs.js';

const PLAYERS = [{ id: 'a', name: 'Alice' }];

/** Fresh state with the deterministic, unshuffled deck for repeatable picks. */
function fixed(players = PLAYERS) {
  return { ...createState(players), deck: buildDeck() };
}

/** Apply a sequence of card indices in order from a starting state. */
function play(state, cells) {
  return cells.reduce((s, cell) => applyMove(s, cell), state);
}

describe('createState', () => {
  it('deals nine cards, nothing matched, no picks', () => {
    const state = createState(PLAYERS);
    expect(state.deck).toHaveLength(CARDS);
    expect(state.matched).toEqual(Array(CARDS).fill(false));
    expect(state.firstPick).toBeNull();
    expect(state.peek).toEqual([]);
    expect(state.matchedPairs).toBe(0);
  });

  it('deals four pairs plus one Joker', () => {
    const ids = createState(PLAYERS)
      .deck.map((c) => c.id)
      .sort();
    // Each pair id appears twice; JOKER once.
    for (const p of PAIRS) {
      expect(ids.filter((id) => id === p.id)).toHaveLength(2);
    }
    expect(ids.filter((id) => id === 'JOKER')).toHaveLength(1);
  });

  it('copies id/name of every player', () => {
    const state = createState([
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ]);
    expect(state.players).toEqual([
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ]);
  });
});

describe('isMatch', () => {
  it('matches two cards with the same id', () => {
    expect(isMatch({ id: 'JD' }, { id: 'JD' })).toBe(true);
  });

  it('does not match different ids', () => {
    expect(isMatch({ id: 'JD' }, { id: 'KC' })).toBe(false);
  });

  it('treats the Joker as wild against anything', () => {
    expect(isMatch({ id: 'JOKER', joker: true }, { id: 'KC' })).toBe(true);
    expect(isMatch({ id: 'AS' }, { id: 'JOKER', joker: true })).toBe(true);
  });
});

describe('applyMove — picking', () => {
  it('reveals the first pick', () => {
    const state = applyMove(fixed(), 0);
    expect(state.firstPick).toBe(0);
    expect(state.peek).toEqual([]);
  });

  it('locks both cards on a matching second pick', () => {
    const state = play(fixed(), [0, 1]); // JD + JD
    expect(state.matched[0]).toBe(true);
    expect(state.matched[1]).toBe(true);
    expect(state.firstPick).toBeNull();
    expect(state.matchedPairs).toBe(1);
  });

  it('holds a mismatch in peek instead of locking', () => {
    const state = play(fixed(), [0, 2]); // JD + KC
    expect(isPeeking(state)).toBe(true);
    expect(state.peek).toEqual([0, 2]);
    expect(state.firstPick).toBeNull();
    expect(state.matched[0]).toBe(false);
    expect(state.matched[2]).toBe(false);
    expect(state.matchedPairs).toBe(0);
  });

  it('matches any card against the wild Joker', () => {
    const state = play(fixed(), [8, 2]); // JOKER + KC
    expect(state.matched[8]).toBe(true);
    expect(state.matched[2]).toBe(true);
    expect(state.matchedPairs).toBe(1);
  });

  it('does not mutate the input state', () => {
    const start = fixed();
    applyMove(start, 0);
    expect(start.firstPick).toBeNull();
    expect(start.matched).toEqual(Array(CARDS).fill(false));
  });
});

describe('applyMove — resolving a peek', () => {
  it('flips the mismatched pair back down and starts a fresh pick', () => {
    const peeking = play(fixed(), [0, 2]); // mismatch
    const next = applyMove(peeking, 4); // tap a fresh card
    expect(next.peek).toEqual([]);
    expect(next.firstPick).toBe(4);
    expect(next.matched[0]).toBe(false);
    expect(next.matched[2]).toBe(false);
  });

  it('just clears the peek when tapping one of the peeked cards', () => {
    const peeking = play(fixed(), [0, 2]);
    const next = applyMove(peeking, 0); // tap a card that is peeking
    expect(next.peek).toEqual([]);
    expect(next.firstPick).toBeNull();
  });
});

describe('applyMove — no-ops (same reference)', () => {
  it('ignores an out-of-range index', () => {
    const state = fixed();
    expect(applyMove(state, -1)).toBe(state);
    expect(applyMove(state, CARDS)).toBe(state);
    expect(applyMove(state, 1.5)).toBe(state);
  });

  it('ignores a re-tap of the current first pick', () => {
    const first = applyMove(fixed(), 0);
    expect(applyMove(first, 0)).toBe(first);
  });

  it('ignores tapping an already-matched card', () => {
    const matched = play(fixed(), [0, 1]); // 0 and 1 locked
    expect(applyMove(matched, 0)).toBe(matched);
  });

  it('ignores any move once the game is won', () => {
    const won = play(fixed(), [0, 1, 2, 3, 4, 5, 6, 7]);
    expect(isComplete(won)).toBe(true);
    expect(applyMove(won, 8)).toBe(won);
  });
});

describe('win detection', () => {
  it('wins after all four natural pairs, leaving the Joker over', () => {
    const won = play(fixed(), [0, 1, 2, 3, 4, 5, 6, 7]);
    expect(won.matchedPairs).toBe(TOTAL_PAIRS);
    expect(isComplete(won)).toBe(true);
    expect(leftoverIndex(won)).toBe(8); // JOKER
  });

  it('wins when the Joker is spent early, leaving an orphan over', () => {
    // JOKER+JD (pair 1), then KC/QH/AS naturally. Card 1 (JD) is orphaned.
    const won = play(fixed(), [8, 0, 2, 3, 4, 5, 6, 7]);
    expect(won.matchedPairs).toBe(TOTAL_PAIRS);
    expect(isComplete(won)).toBe(true);
    expect(leftoverIndex(won)).toBe(1); // the orphaned JD
  });

  it('reports no leftover before the game is won', () => {
    expect(leftoverIndex(fixed())).toBe(-1);
  });
});

describe('reset', () => {
  it('clears progress and keeps the players', () => {
    const state = reset(play(fixed(), [0, 1, 2, 3]));
    expect(state.matched).toEqual(Array(CARDS).fill(false));
    expect(state.matchedPairs).toBe(0);
    expect(state.firstPick).toBeNull();
    expect(state.peek).toEqual([]);
    expect(state.players).toEqual(PLAYERS);
    expect(state.deck).toHaveLength(CARDS);
  });
});

describe('isComplete', () => {
  it('is false on a fresh deal and true once all pairs are matched', () => {
    expect(isComplete(createState(PLAYERS))).toBe(false);
    expect(isComplete(play(fixed(), [0, 1, 2, 3, 4, 5, 6, 7]))).toBe(true);
  });
});

describe('isValidState', () => {
  it('accepts a freshly created state', () => {
    expect(isValidState(createState(PLAYERS))).toBe(true);
  });

  it('rejects non-objects and missing fields', () => {
    expect(isValidState(null)).toBe(false);
    expect(isValidState({})).toBe(false);
    expect(isValidState({ players: PLAYERS })).toBe(false);
  });

  it('rejects a deck of the wrong length', () => {
    const bad = { ...createState(PLAYERS), deck: buildDeck().slice(0, 8) };
    expect(isValidState(bad)).toBe(false);
  });

  it('rejects a matched array of the wrong length or type', () => {
    expect(
      isValidState({ ...createState(PLAYERS), matched: Array(8).fill(false) })
    ).toBe(false);
    expect(
      isValidState({ ...createState(PLAYERS), matched: Array(CARDS).fill(0) })
    ).toBe(false);
  });

  it('rejects a peek longer than two', () => {
    expect(isValidState({ ...createState(PLAYERS), peek: [0, 1, 2] })).toBe(
      false
    );
  });
});
