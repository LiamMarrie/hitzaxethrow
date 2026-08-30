/**
 * ui/pairs-board.js — the interactive Pairs (memory match) board.
 *
 * Ports the "Pairs" prototype look: a 3x3 grid of face-down cards with a glowing
 * "?" cover that flips in 3D to reveal a playing card (or the wild Joker) on a
 * cream face. Matched pairs lock with a green glow; on a win the single leftover
 * card flips up with a purple glow. Whole cards are the tap target so a referee
 * can play quickly from across the room.
 *
 * This is a plain DOM grid (not SVG) so it reproduces the prototype's 3D card
 * flip, borders, and glows exactly; the colours live in the `.pairs__*` CSS.
 *
 * The board is a thin projection of pure state (games/pairs.js): a card is shown
 * face-up when it's the lone first pick, part of the current peek, matched, or
 * the leftover on the win screen. Tapping calls onMove(index); the match rule
 * lives entirely in the logic layer. While a mismatch is peeking, the board also
 * schedules a flip-back by calling onMove again — guarded by isConnected so a
 * stale timer can never act on a board the router has already replaced.
 */

import { el } from './render.js';
import {
  isComplete,
  isPeeking,
  leftoverIndex,
  TOTAL_PAIRS,
} from '../games/pairs.js';

/** How long a mismatched pair stays shown before it flips back (ms). */
const PEEK_MS = 900;

/** Human-readable suit name for a11y labels. */
const SUIT_NAMES = {
  '\u2666': 'diamonds',
  '\u2665': 'hearts',
  '\u2663': 'clubs',
  '\u2660': 'spades',
};

/**
 * Accessible name for a card's revealed value.
 * @param {import('../games/pairs.js').Card} card
 * @returns {string}
 */
function cardName(card) {
  if (card.joker) return 'Joker, wild';
  return `${card.rank} of ${SUIT_NAMES[card.suit] ?? ''}`.trim();
}

/**
 * Build the revealed face contents for a card: the Joker layout, or a rank +
 * suit in red/black.
 * @param {import('../games/pairs.js').Card} card
 * @returns {HTMLElement}
 */
function revealContent(card) {
  if (card.joker) {
    return el('span', { class: 'pairs__joker' }, [
      el('span', { class: 'pairs__j-top', text: 'Joker' }),
      el('span', { class: 'pairs__j-star', text: '\u2605' }),
      el('span', { class: 'pairs__j-bot', text: 'Wild' }),
    ]);
  }
  return el(
    'span',
    { class: `pairs__reveal ${card.red ? 'is-red' : 'is-black'}` },
    [
      el('span', { class: 'pairs__rank', text: card.rank }),
      el('span', { class: 'pairs__suit', text: card.suit }),
    ]
  );
}

/**
 * One card as a <button>. Face-up state and the matched/leftover glows are
 * derived from pure state; only face-up cards announce their value.
 * @param {object} opts
 * @param {number} opts.i card index
 * @param {import('../games/pairs.js').Card} opts.card
 * @param {boolean} opts.faceUp card is currently revealed
 * @param {boolean} opts.matched card is locked as part of a pair
 * @param {boolean} opts.leftover card is the win-screen leftover
 * @param {boolean} opts.locked no more picks accepted on this card
 * @param {(i:number)=>void} opts.onPick
 * @returns {HTMLElement}
 */
function renderCard({ i, card, faceUp, matched, leftover, locked, onPick }) {
  const classes = ['pairs__card'];
  if (faceUp) classes.push('flipped');
  if (matched) classes.push('matched');
  if (leftover) classes.push('leftover');

  const flipper = el('span', { class: 'pairs__flipper' }, [
    el('span', { class: 'pairs__face pairs__face--cover' }, [
      el('span', { class: 'pairs__qmark', text: '?', 'aria-hidden': 'true' }),
    ]),
    el(
      'span',
      { class: `pairs__face pairs__face--reveal${card.joker ? ' joker' : ''}` },
      [revealContent(card)]
    ),
  ]);

  const label = faceUp
    ? `${cardName(card)}${matched ? ', matched' : ''}${leftover ? ', leftover' : ''}`
    : 'Face-down card';

  const btn = el(
    'button',
    {
      class: classes.join(' '),
      type: 'button',
      role: 'gridcell',
      'aria-label': label,
      tabindex: locked ? -1 : 0,
    },
    [flipper]
  );

  if (!locked) btn.addEventListener('click', () => onPick(i));
  return btn;
}

/**
 * The status line above the board: pairs found so far, or the win message.
 * @param {import('../games/pairs.js').GameState} state
 * @returns {HTMLElement}
 */
function renderStatus(state) {
  if (isComplete(state)) {
    return el('div', { class: 'pairs__status pairs__status--done' }, [
      el('span', { class: 'pairs__status-done', text: 'All pairs matched!' }),
    ]);
  }
  return el('div', { class: 'pairs__status' }, [
    el('span', { class: 'pairs__status-label', text: 'Pairs' }),
    el('span', {
      class: 'pairs__status-count',
      text: `${state.matchedPairs} / ${TOTAL_PAIRS}`,
    }),
  ]);
}

/**
 * Render the whole interactive Pairs board: status line, the 3x3 card grid, and
 * (once won) a New game button. Schedules the mismatch flip-back via onMove.
 * @param {import('../games/pairs.js').GameState} state
 * @param {{onMove:(cell:number)=>void, onReset:()=>void}} handlers
 * @returns {HTMLElement}
 */
export function renderPairsBoard(state, { onMove, onReset }) {
  const done = isComplete(state);
  const peeking = isPeeking(state);
  const leftover = leftoverIndex(state);
  const peekSet = new Set(state.peek);

  // During a peek the board is "busy": ignore taps until it flips back, so a
  // referee can't race the reveal. Otherwise a tap resolves/advances play.
  const onPick = (i) => {
    if (peeking) return;
    onMove(i);
  };

  const cards = state.deck.map((card, i) => {
    const matched = state.matched[i];
    const isLeftover = done && i === leftover;
    const faceUp =
      matched || state.firstPick === i || peekSet.has(i) || isLeftover;
    // Locked = not tappable: matched cards, the win screen, or (during a peek)
    // everything, since taps are ignored while the mismatch is shown.
    const locked = matched || done || peeking;
    return renderCard({
      i,
      card,
      faceUp,
      matched,
      leftover: isLeftover,
      locked,
      onPick,
    });
  });

  const grid = el(
    'div',
    { class: 'pairs__grid', role: 'grid', 'aria-label': 'Pairs game board' },
    cards
  );

  const controls = el('div', { class: 'pairs__controls' }, [
    el('button', {
      class: 'btn btn--primary pairs__new',
      text: '↺ New game',
      'aria-label': 'Deal a new game',
      onClick: onReset,
    }),
  ]);

  const root = el('div', { class: `pairs${done ? ' pairs--done' : ''}` }, [
    renderStatus(state),
    el('div', { class: 'pairs__board' }, [grid]),
    done
      ? controls
      : el('div', { class: 'pairs__controls pairs__controls--empty' }),
  ]);

  // Flip a mismatched pair back down after a beat. Tapping onMove with a peeked
  // index clears the peek (see pairs.js). The isConnected guard means a stale
  // timer from a superseded render never fires an action on the live board.
  if (peeking) {
    const flipBackTarget = state.peek[0];
    setTimeout(() => {
      if (grid.isConnected) onMove(flipBackTarget);
    }, PEEK_MS);
  }

  return root;
}
