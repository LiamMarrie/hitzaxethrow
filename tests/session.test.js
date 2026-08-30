import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateSessionId,
  generatePlayerId,
  startNewSession,
  loadOrStartSession,
  saveSession,
  getHistory,
  archiveCurrentSession,
  addPlayer,
  editPlayer,
  removePlayer,
  canContinue,
  MAX_NAME_LENGTH,
  MIN_PLAYERS,
  MAX_PLAYERS,
  __keys__,
} from '../src/lib/session.js';
import { readJSON } from '../src/lib/storage.js';

describe('session', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generates unique-ish ids', () => {
    const a = generateSessionId();
    const b = generateSessionId();
    expect(a).not.toBe(b);
    expect(typeof a).toBe('string');
  });

  it('startNewSession persists a fresh session', () => {
    const s = startNewSession();
    expect(s.id).toBeTruthy();
    expect(s.game).toBeNull();
    expect(readJSON(__keys__.CURRENT_KEY).id).toBe(s.id);
  });

  it('loadOrStartSession returns existing session when present', () => {
    const s = startNewSession();
    const loaded = loadOrStartSession();
    expect(loaded.id).toBe(s.id);
  });

  it('loadOrStartSession creates one when none exists', () => {
    const loaded = loadOrStartSession();
    expect(loaded.id).toBeTruthy();
  });

  it('saveSession round-trips updated state', () => {
    const s = startNewSession();
    s.game = 'target';
    saveSession(s);
    expect(readJSON(__keys__.CURRENT_KEY).game).toBe('target');
  });

  it('archiveCurrentSession moves current into history and clears current', () => {
    const s = startNewSession();
    archiveCurrentSession();
    expect(readJSON(__keys__.CURRENT_KEY)).toBeNull();
    const history = getHistory();
    expect(history[0].id).toBe(s.id);
    expect(history[0].archivedAt).toBeGreaterThan(0);
  });

  it('archiving with no current session is a no-op', () => {
    archiveCurrentSession();
    expect(getHistory()).toEqual([]);
  });

  it('history is capped at MAX_HISTORY', () => {
    for (let i = 0; i < __keys__.MAX_HISTORY + 5; i++) {
      startNewSession();
      archiveCurrentSession();
    }
    expect(getHistory().length).toBe(__keys__.MAX_HISTORY);
  });

  it('preserves the current session when the history write fails (quota)', () => {
    const s = startNewSession();
    // Simulate a full store: the history write throws, so archiving must NOT
    // clear the current session (otherwise it would be lost entirely).
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceeded');
      });
    const ok = archiveCurrentSession();
    spy.mockRestore();

    expect(ok).toBe(false);
    // Current session is still there (not removed on a failed archive).
    expect(readJSON(__keys__.CURRENT_KEY).id).toBe(s.id);
  });

  it('a new open after archive yields a different session id', () => {
    const first = startNewSession();
    archiveCurrentSession();
    const second = loadOrStartSession();
    expect(second.id).not.toBe(first.id);
  });

  describe('players', () => {
    it('startNewSession begins with an empty players list on the players stage', () => {
      const s = startNewSession();
      expect(s.players).toEqual([]);
      expect(s.stage).toBe('players');
    });

    it('loadOrStartSession backfills players/stage on a legacy session', () => {
      // Simulate a session persisted before players existed.
      saveSession({ id: 'legacy', createdAt: 1, game: null, state: null });
      const loaded = loadOrStartSession();
      expect(loaded.id).toBe('legacy');
      expect(loaded.players).toEqual([]);
      expect(loaded.stage).toBe('players');
    });

    it('addPlayer appends a trimmed name with an id and persists', () => {
      const s = startNewSession();
      const player = addPlayer(s, '  Alice  ');
      expect(player).toMatchObject({ name: 'Alice' });
      expect(player.id).toBeTruthy();
      expect(s.players).toHaveLength(1);
      expect(readJSON(__keys__.CURRENT_KEY).players[0].name).toBe('Alice');
    });

    it('addPlayer ignores blank / whitespace-only names', () => {
      const s = startNewSession();
      expect(addPlayer(s, '')).toBeNull();
      expect(addPlayer(s, '   ')).toBeNull();
      expect(s.players).toHaveLength(0);
    });

    it('addPlayer ignores case-insensitive duplicate names', () => {
      const s = startNewSession();
      addPlayer(s, 'Alice');
      expect(addPlayer(s, 'alice')).toBeNull();
      expect(s.players).toHaveLength(1);
    });

    it('editPlayer renames an existing player and persists', () => {
      const s = startNewSession();
      const { id } = addPlayer(s, 'Alice');
      expect(editPlayer(s, id, '  Bob ')).toBe(true);
      expect(s.players[0].name).toBe('Bob');
      expect(readJSON(__keys__.CURRENT_KEY).players[0].name).toBe('Bob');
    });

    it('editPlayer rejects a blank new name', () => {
      const s = startNewSession();
      const { id } = addPlayer(s, 'Alice');
      expect(editPlayer(s, id, '   ')).toBe(false);
      expect(s.players[0].name).toBe('Alice');
    });

    it('editPlayer rejects renaming to an existing name (case-insensitive)', () => {
      const s = startNewSession();
      addPlayer(s, 'Alice');
      const { id } = addPlayer(s, 'Bob');
      expect(editPlayer(s, id, 'alice')).toBe(false);
      expect(s.players[1].name).toBe('Bob');
    });

    it('editPlayer allows renaming to the same name (only case change)', () => {
      const s = startNewSession();
      const { id } = addPlayer(s, 'Alice');
      expect(editPlayer(s, id, 'ALICE')).toBe(true);
      expect(s.players[0].name).toBe('ALICE');
    });

    it('editPlayer returns false for an unknown id', () => {
      const s = startNewSession();
      expect(editPlayer(s, 'nope', 'Bob')).toBe(false);
    });

    it('removePlayer deletes by id and persists', () => {
      const s = startNewSession();
      const { id } = addPlayer(s, 'Alice');
      addPlayer(s, 'Bob');
      expect(removePlayer(s, id)).toBe(true);
      expect(s.players.map((p) => p.name)).toEqual(['Bob']);
      expect(readJSON(__keys__.CURRENT_KEY).players).toHaveLength(1);
    });

    it('removePlayer returns false for an unknown id', () => {
      const s = startNewSession();
      expect(removePlayer(s, 'nope')).toBe(false);
    });

    it('generatePlayerId returns unique-ish strings', () => {
      expect(generatePlayerId()).not.toBe(generatePlayerId());
    });

    it('MAX_NAME_LENGTH accommodates "Jason S"', () => {
      expect('Jason S'.length).toBeLessThanOrEqual(MAX_NAME_LENGTH);
    });

    it('addPlayer rejects a blocked name', () => {
      const s = startNewSession();
      expect(addPlayer(s, 'fuckliam')).toBeNull();
      expect(s.players).toHaveLength(0);
    });

    it('addPlayer rejects a name longer than MAX_NAME_LENGTH', () => {
      const s = startNewSession();
      const tooLong = 'a'.repeat(MAX_NAME_LENGTH + 1);
      expect(addPlayer(s, tooLong)).toBeNull();
      expect(s.players).toHaveLength(0);
    });

    it('addPlayer accepts a name exactly at MAX_NAME_LENGTH', () => {
      const s = startNewSession();
      const exact = 'a'.repeat(MAX_NAME_LENGTH);
      expect(addPlayer(s, exact)).toMatchObject({ name: exact });
    });

    it('editPlayer rejects renaming to a blocked name', () => {
      const s = startNewSession();
      const { id } = addPlayer(s, 'Alice');
      expect(editPlayer(s, id, 'fuckbitch')).toBe(false);
      expect(s.players[0].name).toBe('Alice');
    });

    it('editPlayer rejects renaming to a name longer than MAX_NAME_LENGTH', () => {
      const s = startNewSession();
      const { id } = addPlayer(s, 'Alice');
      expect(editPlayer(s, id, 'a'.repeat(MAX_NAME_LENGTH + 1))).toBe(false);
      expect(s.players[0].name).toBe('Alice');
    });

    it('addPlayer accepts up to MAX_PLAYERS players', () => {
      const s = startNewSession();
      for (let i = 0; i < MAX_PLAYERS; i++) {
        expect(addPlayer(s, `P${i}`)).not.toBeNull();
      }
      expect(s.players).toHaveLength(MAX_PLAYERS);
    });

    it('addPlayer rejects a player beyond MAX_PLAYERS', () => {
      const s = startNewSession();
      for (let i = 0; i < MAX_PLAYERS; i++) addPlayer(s, `P${i}`);
      expect(addPlayer(s, 'OneTooMany')).toBeNull();
      expect(s.players).toHaveLength(MAX_PLAYERS);
    });

    it('canContinue is false below MIN_PLAYERS', () => {
      const s = startNewSession();
      expect(canContinue(s)).toBe(false); // 0 players
      addPlayer(s, 'Alice');
      expect(canContinue(s)).toBe(false); // 1 player, MIN_PLAYERS is 2
    });

    it('canContinue is true from MIN_PLAYERS up to MAX_PLAYERS', () => {
      const s = startNewSession();
      addPlayer(s, 'Alice');
      addPlayer(s, 'Bob');
      expect(canContinue(s)).toBe(true); // 2 players
      while (s.players.length < MAX_PLAYERS)
        addPlayer(s, `P${s.players.length}`);
      expect(canContinue(s)).toBe(true); // MAX_PLAYERS players
    });

    it('MIN_PLAYERS is 2 and MAX_PLAYERS is 6', () => {
      expect(MIN_PLAYERS).toBe(2);
      expect(MAX_PLAYERS).toBe(6);
    });
  });
});
