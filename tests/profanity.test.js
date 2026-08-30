import { describe, it, expect } from 'vitest';
import { containsBlockedWord } from '../src/lib/profanity.js';

describe('profanity', () => {
  describe('standalone profanity (library whole-word match)', () => {
    it('blocks "fuck"', () => {
      expect(containsBlockedWord('fuck')).toBe(true);
    });

    it('blocks "bitch"', () => {
      expect(containsBlockedWord('bitch')).toBe(true);
    });

    it('blocks regardless of case', () => {
      expect(containsBlockedWord('FUCK')).toBe(true);
      expect(containsBlockedWord('BiTcH')).toBe(true);
    });
  });

  describe('glued-together profanity (substring match)', () => {
    it('blocks "fuckliam"', () => {
      expect(containsBlockedWord('fuckliam')).toBe(true);
    });

    it('blocks "fuckbitch"', () => {
      expect(containsBlockedWord('fuckbitch')).toBe(true);
    });
  });

  describe('single-letter spacing normalization', () => {
    it('blocks "f u c k"', () => {
      expect(containsBlockedWord('f u c k')).toBe(true);
    });

    it('blocks "f.u.c.k"', () => {
      expect(containsBlockedWord('f.u.c.k')).toBe(true);
    });
  });

  describe('clean names are allowed', () => {
    it('allows "Jason S" (normal spacing is not collapsed)', () => {
      expect(containsBlockedWord('Jason S')).toBe(false);
    });

    it('allows "Alice"', () => {
      expect(containsBlockedWord('Alice')).toBe(false);
    });

    it('allows "Liam"', () => {
      expect(containsBlockedWord('Liam')).toBe(false);
    });

    it('allows an empty string', () => {
      expect(containsBlockedWord('')).toBe(false);
    });
  });

  describe('real names that contain a short blocked substring are allowed', () => {
    // The glued-form scan uses a small curated root set, not the library's
    // full list, so short roots (ass, tit, god, sex, cum, ...) don't
    // false-positive on ordinary names.
    it.each(['Cass', 'Cassie', 'Cassandra', 'Titus', 'Godwin', 'Sassy'])(
      'allows "%s"',
      (name) => {
        expect(containsBlockedWord(name)).toBe(false);
      }
    );
  });
});
