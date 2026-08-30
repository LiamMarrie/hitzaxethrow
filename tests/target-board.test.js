import { describe, it, expect, vi } from 'vitest';
import { renderTargetBoard } from '../src/ui/target-board.js';
import { createState } from '../src/games/target.js';

const players = [
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
];

const noop = () => {};

describe('renderTargetBoard (Axe Classic)', () => {
  it('renders an SVG target with all six scoring zones', () => {
    const board = renderTargetBoard(createState(players), {
      onThrow: noop,
      onUndo: noop,
    });
    const svg = board.querySelector('svg.tb__svg');
    expect(svg).not.toBeNull();
    // 5 rings + red bullseye = 6 tappable zones (no clutch/killshot dots).
    expect(board.querySelectorAll('.tb__zone').length).toBe(6);
  });

  it('shows the active thrower and round/throw in the status line', () => {
    const board = renderTargetBoard(createState(players), {
      onThrow: noop,
      onUndo: noop,
    });
    expect(board.querySelector('.tb__status-name').textContent).toBe('Alice');
    expect(board.querySelector('.tb__status-meta').textContent).toContain(
      'Round 1 · Throw 1'
    );
  });

  it('calls onThrow with 6 when the red bullseye is tapped', () => {
    const onThrow = vi.fn();
    const board = renderTargetBoard(createState(players), {
      onThrow,
      onUndo: noop,
    });
    const bull = board.querySelector('[aria-label^="Bullseye"]');
    bull.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(onThrow).toHaveBeenCalledWith(6);
  });

  it('calls onThrow with 1 when the outer (1) ring is tapped', () => {
    const onThrow = vi.fn();
    const board = renderTargetBoard(createState(players), {
      onThrow,
      onUndo: noop,
    });
    const outer = board.querySelector('[aria-label^="1 ring"]');
    outer.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(onThrow).toHaveBeenCalledWith(1);
  });

  it('calls onThrow(0) when MISS is tapped', () => {
    const onThrow = vi.fn();
    const board = renderTargetBoard(createState(players), {
      onThrow,
      onUndo: noop,
    });
    board.querySelector('.tb__miss').click();
    expect(onThrow).toHaveBeenCalledWith(0);
  });

  it('calls onUndo when Undo is tapped', () => {
    const onUndo = vi.fn();
    const board = renderTargetBoard(createState(players), {
      onThrow: noop,
      onUndo,
    });
    board.querySelector('.tb__undo').click();
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it('shows "Game complete" and disables scoring once every throw is in', () => {
    const state = createState(players);
    for (const p of ['a', 'b']) {
      state.scores[p] = state.scores[p].map((round) => round.map(() => 1));
    }
    const onThrow = vi.fn();
    const board = renderTargetBoard(state, { onThrow, onUndo: noop });
    expect(board.querySelector('.tb__status-done').textContent).toBe(
      'Game complete'
    );
    board
      .querySelector('[aria-label^="Bullseye"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(onThrow).not.toHaveBeenCalled();
  });

  it('shows the referee-selected player when an override is set', () => {
    const board = renderTargetBoard(createState(players), {
      onThrow: noop,
      onUndo: noop,
      activeOverrideId: 'b',
    });
    expect(board.querySelector('.tb__status-name').textContent).toBe('Bob');
  });
});
