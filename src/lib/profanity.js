/**
 * profanity.js — name filtering, wrapping the `bad-words` package.
 *
 * All blocked-word matching for player names lives here so the rest of the app
 * has a single, testable predicate and the underlying list/library is easy to
 * swap or tune (filter.addWords(...) / filter.removeWords(...)).
 *
 * `bad-words` matches whole words only: its own tokenizer splits on spaces, so
 * it catches a standalone `fuck` but not `fuckliam` (glued together). We want
 * both, so we run two checks:
 *   1. isProfane() on a normalized string — the library's full, maintained list
 *      of standalone words (fuck, bitch, ...).
 *   2. a substring scan of the glued (space-stripped) form against a small
 *      CURATED root set below — so fuckliam / fuckbitch are caught too.
 *
 * We deliberately do NOT scan the glued form against the library's full list:
 * it contains short roots (ass, tit, god, sex, cum, ...) that would match as
 * substrings of ordinary names (Cassandra, Titus, Godwin). The curated set is
 * only the severe words people actually glue onto names — keeping the scan
 * lightweight and false-positive-free for real names. Trade-off: an obscure
 * glued profanity outside this set can slip through, but its standalone form is
 * still caught by check (1). Tune GLUED_ROOTS here if needed.
 */

import { Filter } from 'bad-words';

const filter = new Filter();

/**
 * Severe roots scanned as substrings of the glued form. Lowercase, no spaces.
 * Keep this short — every entry risks a substring false positive, so only add
 * words long/specific enough not to appear inside ordinary names.
 * @type {string[]}
 */
const GLUED_ROOTS = [
  'fuck',
  'bitch',
  'shit',
  'cunt',
  'nigger',
  'faggot',
  'whore',
  'slut',
  'dick',
  'cock',
  'pussy',
  'asshole',
  'bastard',
  'wanker',
  'retard',
];

/**
 * Normalize a name for matching:
 *  - lowercase + trim
 *  - collapse single-letter spacing (`f u c k`, `f.u.c.k` → `fuck`) so that
 *    padded evasions are caught, while leaving normal spacing (`Jason S`)
 *    intact — a run of single letters separated by a single space/dot is
 *    joined; multi-letter tokens are left alone.
 * @param {string} name
 * @returns {string}
 */
function normalize(name) {
  const lowered = String(name ?? '')
    .trim()
    .toLowerCase();
  // Join runs of single letters separated by a single space or dot.
  // e.g. "f u c k" / "f.u.c.k" -> "fuck", but "jason s" stays "jason s".
  return lowered.replace(/\b([a-z])(?:[ .]([a-z])\b)+/g, (match) =>
    match.replace(/[ .]/g, '')
  );
}

/**
 * @param {string} name
 * @returns {boolean} true if the name contains a blocked word.
 */
export function containsBlockedWord(name) {
  const normalized = normalize(name);
  if (!normalized) return false;

  // 1. Whole-word match via the library (handles standalone fuck/bitch, and
  //    any legitimately space-separated tokens in a multi-word name).
  if (filter.isProfane(normalized)) return true;

  // 2. Substring match on the glued form so glued-together evasions
  //    (fuckliam, fuckbitch) are caught. Scanned against the curated root set,
  //    not the library's full list, to avoid false positives on real names.
  const glued = normalized.replace(/\s+/g, '');
  return GLUED_ROOTS.some((root) => glued.includes(root));
}
