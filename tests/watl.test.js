import { describe, it, expect, vi } from 'vitest';
import * as watl from '../src/games/watl.js';
import { renderWatlBoard } from '../src/ui/watl-board.js';

const players = [
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
];
const noop = () => {};

describe('watl config', () => {
  it('is the WATL Standard game with the official value set', () => {
    expect(watl.GAME_KEY).toBe('watl');
    expect(watl.GAME_NAME).toBe('WATL Standard');
    expect([...watl.THROW_VALUES]).toEqual([0, 1, 2, 3, 4, 5, 6, 8]);
    expect(watl.ROUNDS).toBe(5);
    expect(watl.THROWS_PER_ROUND).toBe(5);
  });

  it('produces a valid, empty state', () => {
    const s = watl.createState(players);
    expect(watl.isValidState(s)).toBe(true);
    expect(s.scores.a.flat().every((t) => t === null)).toBe(true);
  });
});

describe('watl applyThrow', () => {
  it('records an in-set value (killshot 8) and advances', () => {
    const s = watl.applyThrow(watl.createState(players), 8);
    expect(s.scores.a[0][0]).toBe(8);
    expect(watl.activePosition(s).throwIdx).toBe(1);
  });

  it('rejects a value that is not in the WATL set (7)', () => {
    const s = watl.createState(players);
    expect(watl.applyThrow(s, 7)).toBe(s);
  });

  it('is immutable on a real throw', () => {
    const s = watl.createState(players);
    watl.applyThrow(s, 6);
    expect(s.scores.a[0][0]).toBeNull();
  });
});

describe('renderWatlBoard', () => {
  it('renders 5 rings + red bullseye + 4-dot cluster + 4 killshot = 14 zones', () => {
    const board = renderWatlBoard(watl.createState(players), {
      onThrow: noop,
      onUndo: noop,
    });
    expect(board.querySelector('svg.tb__svg')).not.toBeNull();
    expect(board.querySelectorAll('.tb__zone').length).toBe(14);
    expect(board.querySelectorAll('.rt__killshot').length).toBe(4);
    expect(board.querySelectorAll('.rt__cluster').length).toBe(4);
  });

  it('scores 8 when a killshot dot is tapped', () => {
    const onThrow = vi.fn();
    const board = renderWatlBoard(watl.createState(players), {
      onThrow,
      onUndo: noop,
    });
    board
      .querySelector('.rt__killshot')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(onThrow).toHaveBeenCalledWith(8);
  });

  it('scores 6 when a bullseye cluster dot is tapped', () => {
    const onThrow = vi.fn();
    const board = renderWatlBoard(watl.createState(players), {
      onThrow,
      onUndo: noop,
    });
    board
      .querySelector('.rt__cluster')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(onThrow).toHaveBeenCalledWith(6);
  });
});
