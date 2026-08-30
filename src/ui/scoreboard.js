/**
 * ui/scoreboard.js — bowling-style scoreboard shown above a game board.
 *
 * One row per player: name on the left, then a cell per round across, then a
 * running total. A round cell shows its score, or "/" when the round has not
 * been played yet. All text is white so it reads on a projector.
 *
 * Pure projection of game state — no interactivity here.
 */

import { el } from './render.js';
import {
  roundScore,
  roundPlayed,
  totalScore,
  activePosition,
} from '../games/ring-target-scoring.js';

/**
 * Render the scoreboard for a target-game state.
 *
 * When `onPickPlayer` is given, each player row becomes tappable so a referee
 * can make that player the active thrower (overriding turn order). The row for
 * the current active thrower is highlighted so it's clear whose throw is being
 * entered.
 * @param {import('../games/target.js').GameState} state
 * @param {{onPickPlayer?:(playerId:string)=>void, activeOverrideId?:string|null}} [opts]
 * @returns {HTMLElement}
 */
export function renderScoreboard(state, opts = {}) {
  const { onPickPlayer, activeOverrideId = null } = opts;
  const { players = [], rounds = 0, scores = {} } = state ?? {};
  // The row to highlight as "up next": the referee's override if they picked
  // one, otherwise the natural turn-order position.
  const activeId = activeOverrideId ?? activePosition(state)?.playerId ?? null;

  // Leader = highest total (only once someone has actually played a round).
  const totals = players.map((p) => totalScore(scores[p.id]));
  const anyPlayed = players.some((p) =>
    (scores[p.id] ?? []).some((r) => roundPlayed(r))
  );
  const topScore = anyPlayed ? Math.max(...totals) : -1;

  // Header: PLAYER | R1..Rn | TOTAL
  const roundHeaders = Array.from({ length: rounds }, (_, i) =>
    el('div', { class: 'sb__cell sb__cell--head', text: `R${i + 1}` })
  );
  const header = el('div', { class: 'sb__row sb__row--head' }, [
    el('div', { class: 'sb__cell sb__cell--name', text: 'PLAYER' }),
    ...roundHeaders,
    el('div', { class: 'sb__cell sb__cell--total', text: 'TOTAL' }),
  ]);

  const playerRows = players.map((p, idx) => {
    const grid = scores[p.id] ?? [];
    const isLeader = anyPlayed && totals[idx] === topScore;
    const isActive = p.id === activeId;

    const cells = Array.from({ length: rounds }, (_, r) => {
      const round = grid[r];
      const played = roundPlayed(round);
      return el(
        'div',
        {
          class: `sb__cell sb__cell--score${played ? '' : ' sb__cell--empty'}`,
        },
        [played ? String(roundScore(round)) : '/']
      );
    });

    const rowClass = [
      'sb__row',
      isLeader ? 'sb__row--leader' : '',
      isActive ? 'sb__row--active' : '',
      onPickPlayer ? 'sb__row--tappable' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return el(
      'div',
      {
        class: rowClass,
        ...(onPickPlayer
          ? {
              role: 'button',
              tabindex: 0,
              'aria-label': `Score for ${p.name}`,
              onClick: () => onPickPlayer(p.id),
            }
          : {}),
      },
      [
        el('div', { class: 'sb__cell sb__cell--name' }, [
          isLeader ? el('span', { class: 'sb__crown', text: '🪓' }) : '',
          el('span', { class: 'sb__playername', text: p.name }),
        ]),
        ...cells,
        el('div', {
          class: 'sb__cell sb__cell--total',
          text: String(totals[idx]),
        }),
      ]
    );
  });

  // Grid columns: name + one per round + total. Set once so header and rows
  // line up regardless of round count.
  const board = el('div', { class: 'sb__grid' }, [header, ...playerRows]);
  board.style.setProperty('--sb-rounds', String(rounds));

  return el('section', { class: 'sb', 'aria-label': 'Scoreboard' }, [board]);
}
