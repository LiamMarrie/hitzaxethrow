/**
 * turn-order.test.js — tests for the global turn-order shuffle.
 *
 * The shuffle is the single lever for who goes first in every game, so it must:
 *  - never mutate the caller's roster,
 *  - preserve exactly the same players (no drops/dupes), and
 *  - fail safe on junk input.
 * Randomness is made deterministic by stubbing Math.random.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { shuffleTurnOrder } from '../src/lib/turn-order.js';

const roster = () => [
  { id: 'a', name: 'Ann' },
  { id: 'b', name: 'Bob' },
  { id: 'c', name: 'Cy' },
  { id: 'd', name: 'Di' },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('shuffleTurnOrder', () => {
  it('returns a new array and does not mutate the input', () => {
    const input = roster();
    const before = input.map((p) => p.id);
    const out = shuffleTurnOrder(input);
    expect(out).not.toBe(input);
    expect(input.map((p) => p.id)).toEqual(before); // input untouched
  });

  it('keeps exactly the same players (same set, same length)', () => {
    const out = shuffleTurnOrder(roster());
    expect(out).toHaveLength(4);
    expect(out.map((p) => p.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('reorders according to Math.random (Fisher–Yates)', () => {
    // With length 4, the loop draws j for i=3,2,1. Returning 0 each time swaps
    // each i with index 0 in turn, producing a known permutation.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const out = shuffleTurnOrder(roster()).map((p) => p.id);
    // i=3: swap(3,0) -> d,b,c,a ; i=2: swap(2,0) -> c,b,d,a ; i=1: swap(1,0) -> b,c,d,a
    expect(out).toEqual(['b', 'c', 'd', 'a']);
  });

  it('can leave the order unchanged (identity permutation)', () => {
    // Math.random just below 1 makes j === i every step, i.e. no swaps.
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
    const out = shuffleTurnOrder(roster()).map((p) => p.id);
    expect(out).toEqual(['a', 'b', 'c', 'd']);
  });

  it('handles a single player and empty roster', () => {
    expect(shuffleTurnOrder([{ id: 'a', name: 'Ann' }])).toEqual([
      { id: 'a', name: 'Ann' },
    ]);
    expect(shuffleTurnOrder([])).toEqual([]);
  });

  it('with seats, keeps the same seated players and only reorders them', () => {
    // seats:2 must always seat the first two roster entries (a, b) — never pull
    // c or d into a seat — and only swap who goes first between them.
    for (let n = 0; n < 20; n++) {
      const out = shuffleTurnOrder(roster(), 2);
      expect(out).toHaveLength(2);
      expect(out.map((p) => p.id).sort()).toEqual(['a', 'b']);
    }
  });

  it('with seats, can swap the two seated players (who goes first)', () => {
    // Math.random 0 swaps index 1 with 0, flipping the pair's order.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const out = shuffleTurnOrder(roster(), 2).map((p) => p.id);
    expect(out).toEqual(['b', 'a']);
  });

  it('with seats, tolerates a roster smaller than seats', () => {
    const out = shuffleTurnOrder([{ id: 'a', name: 'Ann' }], 2);
    expect(out.map((p) => p.id)).toEqual(['a']);
  });

  it('fails safe on invalid input', () => {
    expect(shuffleTurnOrder(undefined)).toEqual([]);
    expect(shuffleTurnOrder(null)).toEqual([]);
    expect(shuffleTurnOrder('nope')).toEqual([]);
  });
});
