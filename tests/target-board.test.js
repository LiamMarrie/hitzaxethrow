import { describe, it, expect, vi } from 'vitest';
import { renderTargetBoard } from '../src/ui/target-board.js';
import { createState } from '../src/games/target.js';

const players = [
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
];

const noop = () => {};

describe('renderTargetBoard', () => {
  it('renders an SVG target with all five scoring zones', () => {
    const board = renderTargetBoard(createState(players), {
      onThrow: noop,
      onUndo: noop,
    });
    const svg = board.querySelector('svg.tb__svg');
    expect(svg).not.toBeNull();
    // 3 rings + 2 clutch dots = 5 tappable zones.
    expect(board.querySelectorAll('.tb__zone').length).toBe(5);
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

  it('calls onThrow with the zone value when a zone is tapped', () => {
    const onThrow = vi.fn();
    const board = renderTargetBoard(createState(players), {
      onThrow,
      onUndo: noop,
    });
    // The bullseye (value 3) is the innermost ring.
    const bull = board.querySelector('[aria-label^="Bullseye"]');
    bull.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(onThrow).toHaveBeenCalledWith(3);
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
    // Tapping a zone after completion records nothing.
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
