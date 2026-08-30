import { describe, it, expect, beforeEach, vi } from 'vitest';
import { writeJSON, __PREFIX__ } from '../src/lib/storage.js';
import { __keys__ } from '../src/lib/session.js';
import { createState } from '../src/games/tictactoe.js';
import { createState as createWatlState } from '../src/games/watl.js';

/**
 * Boot / restore regression tests.
 *
 * main.js runs boot() as a side effect of import, so each test seeds the DOM
 * and localStorage first, then imports a FRESH copy of the module via
 * vi.resetModules() + dynamic import.
 */

function setupDom() {
  document.body.innerHTML = `
    <div id="app">
      <span id="session-badge"></span>
      <main id="screen"></main>
      <div id="error-banner" hidden></div>
    </div>
  `;
}

async function boot() {
  vi.resetModules();
  await import('../src/main.js');
}

describe('boot / session restore', () => {
  beforeEach(() => {
    localStorage.clear();
    setupDom();
  });

  it('renders the player-entry screen on a clean first open', async () => {
    await boot();
    const screen = document.getElementById('screen');
    // A fresh session starts on the players stage, before the game menu.
    expect(screen.querySelector('.players')).not.toBeNull();
    expect(screen.querySelector('.players__add')).not.toBeNull();
    expect(screen.querySelector('.menu')).toBeNull();
  });

  it('renders the menu when the restored session is already past player entry', async () => {
    writeJSON(__keys__.CURRENT_KEY, {
      id: 'restore-menu',
      createdAt: Date.now(),
      stage: 'menu',
      players: [{ id: 'p1', name: 'Alice' }],
      game: null,
      state: null,
    });

    await boot();

    const screen = document.getElementById('screen');
    expect(screen.querySelector('.menu')).not.toBeNull();
    expect(screen.querySelectorAll('.menu__row').length).toBeGreaterThan(0);
  });

  it('recovers when the restored game state is corrupt', async () => {
    // A session that claims to be mid-Connect-4 but whose state is unusable
    // (no players array) — the shape that would fail isValidState.
    writeJSON(__keys__.CURRENT_KEY, {
      id: 'restore-corrupt',
      createdAt: Date.now(),
      game: 'connect4',
      state: { foo: 'bar' },
    });

    await boot();

    const screen = document.getElementById('screen');
    // The app must NOT have thrown into a blank/broken game screen. A restored
    // session with no stage backfills to the players screen.
    expect(screen.querySelector('.game')).toBeNull();
    expect(screen.querySelector('.players')).not.toBeNull();

    // The corrupt game was scrubbed from the persisted session so a reopen is clean.
    const persisted = JSON.parse(
      localStorage.getItem(`${__PREFIX__}${__keys__.CURRENT_KEY}`)
    );
    expect(persisted.game).toBeNull();
    expect(persisted.state).toBeNull();
  });

  it('recovers when the restored game key is unknown', async () => {
    writeJSON(__keys__.CURRENT_KEY, {
      id: 'restore-unknown',
      createdAt: Date.now(),
      game: 'checkers', // not a registered game
      state: {},
    });

    await boot();

    const screen = document.getElementById('screen');
    expect(screen.querySelector('.game')).toBeNull();
    expect(screen.querySelector('.players')).not.toBeNull();
  });

  it('restores a valid in-progress game rather than dropping to the menu', async () => {
    // A well-formed game state should be restored into its game screen.
    writeJSON(__keys__.CURRENT_KEY, {
      id: 'restore-valid',
      createdAt: Date.now(),
      game: 'tictactoe',
      state: createState([
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ]),
    });

    await boot();

    const screen = document.getElementById('screen');
    // It renders the game screen (with its interactive board), not the menu.
    expect(screen.querySelector('.game')).not.toBeNull();
    expect(screen.querySelector('.ttt')).not.toBeNull();
    expect(screen.querySelector('.menu')).toBeNull();
  });

  it('restores a valid in-progress ring-target game (WATL) into its board', async () => {
    writeJSON(__keys__.CURRENT_KEY, {
      id: 'restore-watl',
      createdAt: Date.now(),
      game: 'watl',
      state: createWatlState([
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ]),
    });

    await boot();

    const screen = document.getElementById('screen');
    expect(screen.querySelector('.game')).not.toBeNull();
    // The shared ring-target board (.tb) with its SVG target renders.
    expect(screen.querySelector('.tb__svg')).not.toBeNull();
    expect(screen.querySelector('.menu')).toBeNull();
  });
});
