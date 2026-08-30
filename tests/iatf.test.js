import { describe, it, expect, vi } from 'vitest';
import * as iatf from '../src/games/iatf.js';
import { renderIatfBoard } from '../src/ui/iatf-board.js';

const players = [
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
];
const noop = () => {};

describe('iatf config', () => {
  it('is the IATF Standard game with the official value set', () => {
    expect(iatf.GAME_KEY).toBe('iatf');
    expect(iatf.GAME_NAME).toBe('IATF Standard');
    expect([...iatf.THROW_VALUES]).toEqual([0, 1, 3, 5, 7]);
    expect(iatf.ROUNDS).toBe(5);
    expect(iatf.THROWS_PER_ROUND).toBe(5);
  });

  it('produces a valid, empty state', () => {
    const s = iatf.createState(players);
    expect(iatf.isValidState(s)).toBe(true);
    expect(s.scores.a.flat().every((t) => t === null)).toBe(true);
  });
});

describe('iatf applyThrow', () => {
  it('records an in-set value (clutch 7) and advances', () => {
    const s = iatf.applyThrow(iatf.createState(players), 7);
    expect(s.scores.a[0][0]).toBe(7);
    expect(iatf.activePosition(s).throwIdx).toBe(1);
  });

  it('rejects values not in the IATF set (2, 4, 6, 8)', () => {
    const s = iatf.createState(players);
    for (const v of [2, 4, 6, 8]) {
      expect(iatf.applyThrow(s, v)).toBe(s);
    }
  });

  it('is immutable on a real throw', () => {
    const s = iatf.createState(players);
    iatf.applyThrow(s, 5);
    expect(s.scores.a[0][0]).toBeNull();
  });
});

describe('renderIatfBoard', () => {
  it('renders 3 rings + 2 clutch = 5 zones', () => {
    const board = renderIatfBoard(iatf.createState(players), {
      onThrow: noop,
      onUndo: noop,
    });
    expect(board.querySelector('svg.tb__svg')).not.toBeNull();
    expect(board.querySelectorAll('.tb__zone').length).toBe(5);
    expect(board.querySelectorAll('.rt__clutch').length).toBe(2);
  });

  it('scores 7 when a clutch dot is tapped', () => {
    const onThrow = vi.fn();
    const board = renderIatfBoard(iatf.createState(players), {
      onThrow,
      onUndo: noop,
    });
    board
      .querySelector('.rt__clutch')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(onThrow).toHaveBeenCalledWith(7);
  });

  it('scores 5 when the bullseye ring is tapped', () => {
    const onThrow = vi.fn();
    const board = renderIatfBoard(iatf.createState(players), {
      onThrow,
      onUndo: noop,
    });
    board
      .querySelector('[aria-label^="Bullseye"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(onThrow).toHaveBeenCalledWith(5);
  });
});
