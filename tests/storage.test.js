import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isStorageAvailable,
  readJSON,
  writeJSON,
  remove,
  __PREFIX__,
} from '../src/lib/storage.js';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reports storage available in jsdom', () => {
    expect(isStorageAvailable()).toBe(true);
  });

  it('writes and reads back a JSON value', () => {
    expect(writeJSON('foo', { a: 1 })).toBe(true);
    expect(readJSON('foo')).toEqual({ a: 1 });
  });

  it('namespaces keys under the prefix', () => {
    writeJSON('bar', 42);
    expect(localStorage.getItem(`${__PREFIX__}bar`)).toBe('42');
  });

  it('returns fallback for a missing key', () => {
    expect(readJSON('missing', 'default')).toBe('default');
  });

  it('returns fallback (not throw) for corrupt JSON', () => {
    localStorage.setItem(`${__PREFIX__}corrupt`, '{not valid json');
    expect(readJSON('corrupt', [])).toEqual([]);
  });

  it('removes only the targeted key', () => {
    writeJSON('keep', 1);
    writeJSON('drop', 2);
    remove('drop');
    expect(readJSON('drop')).toBeNull();
    expect(readJSON('keep')).toBe(1);
  });

  it('does not throw and returns false when write fails (quota)', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceeded');
      });
    expect(writeJSON('x', 1)).toBe(false);
    spy.mockRestore();
  });
});
