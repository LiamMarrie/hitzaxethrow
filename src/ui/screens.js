/**
 * ui/screens.js — per-game screen renderers (bare-bones foundation).
 *
 * Each game currently renders the same thing: a centered "target" box taking up
 * ~80% of the screen with the game's name, plus a back button. No scoring, no
 * boards, no interactivity yet — this is the clean slate to build real screens
 * on top of.
 */

import { el } from './render.js';
import { renderScoreboard } from './scoreboard.js';
import { renderTargetBoard } from './target-board.js';
import { renderWatlBoard } from './watl-board.js';
import { renderIatfBoard } from './iatf-board.js';
import { renderDartboardBoard } from './dartboard-board.js';
import { renderTicTacToeBoard } from './tictactoe-board.js';
import { renderConnect4Board } from './connect4-board.js';
import { renderPairsBoard } from './pairs-board.js';

/**
 * How-to-play copy per game, shown in the info card. Each entry is a title and
 * an array of paragraphs.
 * @type {Object<string,{title:string,paragraphs:string[]}>}
 */
const HOW_TO_PLAY = {
  'Axe Classic': {
    title: 'How to play — Axe Classic',
    paragraphs: [
      'Take turns throwing the axe at the target. A game is 5 rounds, and each round is 5 throws.',
      'Score each throw by where it lands: a miss is 0, the five rings score 1, 2, 3, 4, and 5 from the outside in, and the red bullseye centre is worth 6. No clutch or killshot — just where the axe sticks.',
      'Your round score is the sum of that round’s five throws. The running total on the right is the sum of every round.',
      'A round shows “/” until it’s thrown. Highest total after 5 rounds wins.',
    ],
  },
  'WATL Standard': {
    title: 'How to play — WATL Standard',
    paragraphs: [
      'The World Axe Throwing League format. Take turns throwing the axe: a game is 5 rounds of 5 throws each.',
      'The five rings score 1 to 5 from the outside in, and the bullseye cluster in the centre is worth 6.',
      'The two pairs of blue killshot dots are always live and score 8 each — hitting a ring instead just scores that ring, with no penalty.',
      'A miss is 0. Your round score is the sum of its five throws; highest total after 5 rounds wins.',
    ],
  },
  'IATF Standard': {
    title: 'How to play — IATF Standard',
    paragraphs: [
      'The International Axe Throwing Federation format. Take turns throwing the axe: a game is 5 rounds of 5 throws each.',
      'The outer ring scores 1, the middle ring 3, and the bullseye 5.',
      'The two blue clutch dots are always live and score 7 each — hitting a ring instead just scores that ring, with no penalty.',
      'A miss is 0. Your round score is the sum of its five throws; highest total after 5 rounds wins.',
    ],
  },
  501: {
    title: 'How to play — 501',
    paragraphs: [
      'Every player starts at 501. Take turns throwing 3 darts each, and subtract every dart’s score from your remaining total.',
      'Tap the dartboard where the dart landed — singles score the number, the thin outer band doubles it, the thin inner band triples it, and the bull is 25 (outer) or 50 (centre).',
      'Overshoot below zero and you “bust”: that whole turn is wiped and your total goes back to where it started before the turn.',
      'First player to land on exactly 0 wins — any segment finishes, no double needed.',
    ],
  },
  'Tic-Tac-Toe': {
    title: 'How to play — Tic-Tac-Toe',
    paragraphs: [
      'Two players take turns claiming squares on a 3×3 grid, one as X and one as O.',
      'The first player to line up three of their marks in a row — across, down, or diagonally — wins.',
      'If every square is filled and no one has three in a row, the round is a draw.',
    ],
  },
  'Connect 4': {
    title: 'How to play — Connect 4',
    paragraphs: [
      'Two players take turns dropping discs into the columns. A disc falls to the lowest open slot in that column.',
      'Be the first to line up four of your discs in a row — horizontally, vertically, or diagonally.',
      'If the grid fills up before either player connects four, the round is a draw.',
    ],
  },
  Pairs: {
    title: 'How to play — Pairs',
    paragraphs: [
      'Nine cards sit face-down: four matching pairs plus one wild Joker. Tap a card to flip it up, then tap a second to try for a match.',
      'A match locks both cards face-up; a mismatch flips both back down after a moment, so remember where they were.',
      'The Joker is wild — it pairs with whatever card you flip alongside it.',
      'Match all four pairs to win. One card is always left over at the end.',
    ],
  },
};

/**
 * Build the info card overlay for a game. Hidden until the `i` button opens it.
 * Closing removes the overlay from the DOM.
 * @param {string} name game display name (key into HOW_TO_PLAY)
 * @returns {{overlay:HTMLElement, open:()=>void}}
 */
function buildInfoCard(name) {
  const info = HOW_TO_PLAY[name] ?? {
    title: `How to play — ${name}`,
    paragraphs: ['Rules coming soon.'],
  };

  const close = () => overlay.remove();

  const card = el('div', { class: 'info-card', role: 'document' }, [
    el('button', {
      class: 'info-card__close',
      text: '✕',
      'aria-label': 'Close',
      onClick: close,
    }),
    el('h2', { class: 'info-card__title', text: info.title }),
    el(
      'div',
      { class: 'info-card__body' },
      info.paragraphs.map((p) => el('p', { class: 'info-card__p', text: p }))
    ),
  ]);

  const overlay = el(
    'div',
    {
      class: 'info-overlay',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': info.title,
      // Tap the dimmed backdrop (but not the card) to dismiss.
      onClick: (e) => {
        if (e.target === overlay) close();
      },
    },
    [card]
  );

  return {
    overlay,
    open: () => document.body.appendChild(overlay),
  };
}

/**
 * Render a game screen: a back button, an info button that opens a how-to-play
 * card, an optional scoreboard, and a main board area. When no `board` node is
 * given, a placeholder box with the game name is shown (used by the games that
 * don't have a real board yet).
 * @param {string} name game display name
 * @param {{onBack:()=>void}} handlers
 * @param {Node} [scoreboard] optional scoreboard node to place above the board
 * @param {Node} [board] optional main board node; falls back to a placeholder
 * @returns {HTMLElement}
 */
function renderGameShell(name, { onBack }, scoreboard = null, board = null) {
  const info = buildInfoCard(name);
  return el('div', { class: 'game' }, [
    el('div', { class: 'game__bar' }, [
      el('button', {
        class: 'btn btn--ghost btn--sm',
        text: '← Menu',
        onClick: onBack,
      }),
      // Info button, pushed to the far right of the bar (see .game__info).
      el('button', {
        class: 'btn btn--ghost game__info',
        text: 'i',
        'aria-label': 'How to play',
        onClick: info.open,
      }),
    ]),
    ...(scoreboard ? [scoreboard] : []),
    board ?? el('div', { class: 'target-box', text: name }),
  ]);
}

/**
 * Target screen — scoreboard above the interactive target board.
 * @param {import('../games/target.js').GameState} state
 * @param {{
 *   onBack:()=>void,
 *   onThrow:(value:number)=>void,
 *   onUndo:()=>void,
 *   onPickPlayer?:(playerId:string)=>void,
 *   activeOverrideId?:string|null,
 * }} handlers
 * @returns {HTMLElement}
 */
export function renderTarget(state, handlers) {
  const board = renderTargetBoard(state, {
    onThrow: handlers.onThrow,
    onUndo: handlers.onUndo,
    activeOverrideId: handlers.activeOverrideId ?? null,
  });
  const scoreboard = renderScoreboard(state, {
    onPickPlayer: handlers.onPickPlayer,
    activeOverrideId: handlers.activeOverrideId ?? null,
  });
  return renderGameShell('Axe Classic', handlers, scoreboard, board);
}

/**
 * WATL Standard screen — shared scoreboard above the WATL target board.
 * @param {import('../games/ring-target-scoring.js').GameState} state
 * @param {{
 *   onBack:()=>void,
 *   onThrow:(value:number)=>void,
 *   onUndo:()=>void,
 *   onPickPlayer?:(playerId:string)=>void,
 *   activeOverrideId?:string|null,
 * }} handlers
 * @returns {HTMLElement}
 */
export function renderWatl(state, handlers) {
  const board = renderWatlBoard(state, {
    onThrow: handlers.onThrow,
    onUndo: handlers.onUndo,
    activeOverrideId: handlers.activeOverrideId ?? null,
  });
  const scoreboard = renderScoreboard(state, {
    onPickPlayer: handlers.onPickPlayer,
    activeOverrideId: handlers.activeOverrideId ?? null,
  });
  return renderGameShell('WATL Standard', handlers, scoreboard, board);
}

/**
 * IATF Standard screen — shared scoreboard above the IATF target board.
 * @param {import('../games/ring-target-scoring.js').GameState} state
 * @param {{
 *   onBack:()=>void,
 *   onThrow:(value:number)=>void,
 *   onUndo:()=>void,
 *   onPickPlayer?:(playerId:string)=>void,
 *   activeOverrideId?:string|null,
 * }} handlers
 * @returns {HTMLElement}
 */
export function renderIatf(state, handlers) {
  const board = renderIatfBoard(state, {
    onThrow: handlers.onThrow,
    onUndo: handlers.onUndo,
    activeOverrideId: handlers.activeOverrideId ?? null,
  });
  const scoreboard = renderScoreboard(state, {
    onPickPlayer: handlers.onPickPlayer,
    activeOverrideId: handlers.activeOverrideId ?? null,
  });
  return renderGameShell('IATF Standard', handlers, scoreboard, board);
}

/**
 * 501 dartboard screen — the interactive dartboard. The board carries its own
 * count-down scoreboard, so no separate scoreboard node is passed to the shell.
 * The throw/undo/pick-player handlers are the same ones main.js drives for
 * Target (shared applyThrow/undoLastThrow interface).
 * @param {import('../games/dartboard.js').GameState} state
 * @param {{
 *   onBack:()=>void,
 *   onThrow:(value:number)=>void,
 *   onUndo:()=>void,
 *   onPickPlayer?:(playerId:string)=>void,
 *   activeOverrideId?:string|null,
 * }} handlers
 * @returns {HTMLElement}
 */
export function renderDartboard(state, handlers) {
  const board = renderDartboardBoard(state, {
    onThrow: handlers.onThrow,
    onUndo: handlers.onUndo,
    onPickPlayer: handlers.onPickPlayer,
    activeOverrideId: handlers.activeOverrideId ?? null,
  });
  return renderGameShell('501', handlers, null, board);
}

/**
 * Tic-Tac-Toe screen — the interactive 3x3 board (no scoreboard; the board
 * carries the whole game state itself).
 * @param {import('../games/tictactoe.js').GameState} state
 * @param {{onBack:()=>void, onMove:(cell:number)=>void, onReset:()=>void}} handlers
 * @returns {HTMLElement}
 */
export function renderTicTacToe(state, handlers) {
  const board = renderTicTacToeBoard(state, {
    onMove: handlers.onMove,
    onReset: handlers.onReset,
  });
  return renderGameShell('Tic-Tac-Toe', handlers, null, board);
}

/**
 * Connect 4 screen — the interactive 7x6 board (no scoreboard; the board
 * carries the whole game state itself).
 * @param {import('../games/connect4.js').GameState} state
 * @param {{onBack:()=>void, onMove:(col:number)=>void, onReset:()=>void}} handlers
 * @returns {HTMLElement}
 */
export function renderConnect4(state, handlers) {
  const board = renderConnect4Board(state, {
    onMove: handlers.onMove,
    onReset: handlers.onReset,
  });
  return renderGameShell('Connect 4', handlers, null, board);
}

/**
 * Pairs screen — the interactive memory-match board (no scoreboard; the board
 * carries the whole game state itself).
 * @param {import('../games/pairs.js').GameState} state
 * @param {{onBack:()=>void, onMove:(cell:number)=>void, onReset:()=>void}} handlers
 * @returns {HTMLElement}
 */
export function renderPairs(state, handlers) {
  const board = renderPairsBoard(state, {
    onMove: handlers.onMove,
    onReset: handlers.onReset,
  });
  return renderGameShell('Pairs', handlers, null, board);
}
