/**
 * pairs.js — Pairs (memory match) game logic (pure, framework-free).
 *
 * State layer only: the router (main.js) drives this through the grid/move
 * interface (`applyMove(state, cell)` + `reset(state)`) and the board UI is a
 * thin projection over the returned state, matching tictactoe.js / connect4.js.
 *
 * The board is nine face-down cards on a 3x3 grid: four distinct cards that
 * each appear twice (four pairs) plus one Joker that is WILD — it matches any
 * card. Flip two cards at a time; a match locks both face-up, a mismatch is
 * shown briefly ("peek") then flips back. The game is won once all four pairs
 * are matched, which uses eight of the nine cards and leaves one card over.
 *
 * Why the peek is real state (not just a UI animation): a WebView reload must
 * restore mid-flip progress cleanly, and the match rule must live here (never
 * in the UI). The UI shows the peek and then calls applyMove again to flip the
 * pair back down — tapping any card during a peek also resolves it. This keeps
 * the logic pure (no timers/DOM here) while staying persist-safe.
 *
 * State shape:
 *   {
 *     players: [{id,name}, ...],  // copied from the session (unused by rules;
 *                                 //   Pairs is solitaire, kept for the contract)
 *     deck: Card[],               // 9 shuffled cards (see Card below)
 *     matched: boolean[9],        // per-card: locked face-up as part of a pair
 *     firstPick: number|null,     // index of the lone card awaiting a partner
 *     peek: number[],             // [] normally, or [a,b] while a mismatch shows
 *     matchedPairs: number,       // pairs completed so far (win at TOTAL_PAIRS)
 *   }
 *
 *   Card (pair):  { id:'JD', rank:'J', suit:'♦', red:true }
 *   Card (joker): { id:'JOKER', joker:true }
 *
 * Every mutating function is immutable: it returns a NEW state, or the SAME
 * reference to signal a no-op (game over / bad index / tapping a matched card /
 * re-tapping the lone card), matching the applyMove convention so main.js's
 * `next === session.state` guard works unchanged.
 */

export const GAME_KEY = 'pairs';
export const GAME_NAME = 'Pairs';

/**
 * The four distinct cards. Each is dealt twice; together with one Joker they
 * make the nine-card board.
 * @type {ReadonlyArray<{id:string,rank:string,suit:string,red:boolean}>}
 */
export const PAIRS = [
  { id: 'JD', rank: 'J', suit: '\u2666', red: true }, // Jack of diamonds
  { id: 'KC', rank: 'K', suit: '\u2663', red: false }, // King of clubs
  { id: 'QH', rank: 'Q', suit: '\u2665', red: true }, // Queen of hearts
  { id: 'AS', rank: 'A', suit: '\u2660', red: false }, // Ace of spades
];

/** The wild card dealt alongside the pairs. */
export const JOKER = { id: 'JOKER', joker: true };

/** Pairs to match to win (one per distinct card). */
export const TOTAL_PAIRS = PAIRS.length; // 4

/** Total cards on the board (each pair twice, plus the Joker). */
export const CARDS = PAIRS.length * 2 + 1; // 9

/**
 * @typedef {{id:string,rank?:string,suit?:string,red?:boolean,joker?:boolean}} Card
 * @typedef {{id:string,name:string}} Player
 * @typedef {Object} GameState
 * @property {Player[]} players
 * @property {Card[]} deck
 * @property {boolean[]} matched
 * @property {number|null} firstPick
 * @property {number[]} peek
 * @property {number} matchedPairs
 */

/**
 * Build the unshuffled nine-card deck: each pair twice, plus the Joker. Returns
 * fresh card copies so callers can safely shuffle/mutate the array. Exported so
 * tests can assemble a deterministic board without relying on the shuffle.
 * @returns {Card[]}
 */
export function buildDeck() {
  const cards = PAIRS.flatMap((c) => [{ ...c }, { ...c }]);
  cards.push({ ...JOKER });
  return cards;
}

/**
 * Fisher–Yates shuffle on a COPY of the input (pure: never mutates the caller's
 * array). Uses Math.random, which is fine — deals aren't part of the tested
 * rules and don't need to be reproducible.
 * @param {Card[]} cards
 * @returns {Card[]}
 */
function shuffled(cards) {
  const a = cards.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build a fresh game state for the given players. The deck is shuffled on every
 * deal. Players are copied (id/name only) for the contract, though Pairs is a
 * solitaire game and doesn't use turn order.
 * @param {Player[]} [players]
 * @returns {GameState}
 */
export function createState(players = [{ id: 'p1', name: 'Player 1' }]) {
  return {
    players: (players ?? []).map((p) => ({ id: p.id, name: p.name })),
    deck: shuffled(buildDeck()),
    matched: Array(CARDS).fill(false),
    firstPick: null,
    peek: [],
    matchedPairs: 0,
  };
}

/**
 * Whether two cards form a pair. The Joker is wild, so it matches anything;
 * otherwise two cards match when they share the same id.
 * @param {Card} a
 * @param {Card} b
 * @returns {boolean}
 */
export function isMatch(a, b) {
  if (!a || !b) return false;
  return Boolean(a.joker) || Boolean(b.joker) || a.id === b.id;
}

/** @param {GameState} state @returns {boolean} */
export function isComplete(state) {
  return state.matchedPairs >= TOTAL_PAIRS;
}

/**
 * True while two mismatched cards are shown and waiting to flip back. The UI
 * uses this to schedule the flip-back and to lock other rules meanwhile.
 * @param {GameState} state
 * @returns {boolean}
 */
export function isPeeking(state) {
  return Array.isArray(state.peek) && state.peek.length === 2;
}

/**
 * Flip a card, or resolve a pending peek. Rules, in order:
 *  - Game over, or a non-integer / out-of-range index: no-op (same ref).
 *  - A peek is showing (two mismatched cards): the peek flips back down. If the
 *    tapped card is a fresh, unmatched card it also becomes the new first pick;
 *    tapping one of the peeked cards (or a matched card) just clears the peek.
 *  - Tapping an already-matched card: no-op.
 *  - No first pick yet: the tapped card becomes the first pick.
 *  - Re-tapping the current first pick: no-op.
 *  - Otherwise this is the second pick: on a match both lock (matchedPairs++);
 *    on a mismatch both are held in `peek` to be shown, then flipped back.
 * @param {GameState} state
 * @param {number} cell 0..CARDS-1
 * @returns {GameState}
 */
export function applyMove(state, cell) {
  if (isComplete(state)) return state;
  if (!Number.isInteger(cell) || cell < 0 || cell >= CARDS) return state;

  // Resolve a pending mismatch: the two peeked cards flip back down.
  if (isPeeking(state)) {
    const startsFresh = !state.matched[cell] && !state.peek.includes(cell);
    return {
      ...state,
      peek: [],
      firstPick: startsFresh ? cell : null,
    };
  }

  if (state.matched[cell]) return state; // already locked face-up
  if (state.firstPick === cell) return state; // re-tapped the same lone card

  // First of a pair: just reveal it and wait for the partner.
  if (state.firstPick === null) {
    return { ...state, firstPick: cell };
  }

  // Second of a pair: compare against the first pick.
  const a = state.firstPick;
  const b = cell;
  if (isMatch(state.deck[a], state.deck[b])) {
    const matched = state.matched.slice();
    matched[a] = true;
    matched[b] = true;
    return {
      ...state,
      matched,
      firstPick: null,
      peek: [],
      matchedPairs: state.matchedPairs + 1,
    };
  }

  // Mismatch: hold both face-up so the UI can show them before the flip-back.
  return { ...state, firstPick: null, peek: [a, b] };
}

/**
 * Start a fresh deal (rematch): reshuffle and clear all progress, keeping the
 * same players.
 * @param {GameState} state
 * @returns {GameState}
 */
export function reset(state) {
  return createState(state.players);
}

/**
 * The single card left unmatched once the game is won, or -1 if none/not won.
 * Exported so the board can highlight the leftover card on the win screen
 * without re-deriving the rule.
 * @param {GameState} state
 * @returns {number}
 */
export function leftoverIndex(state) {
  if (!isComplete(state)) return -1;
  return state.matched.findIndex((m) => !m);
}

/**
 * Structural check that a value is a usable state. Used when restoring a
 * persisted session, whose shape is untrusted — reject anything that couldn't
 * be safely rendered.
 * @param {unknown} state
 * @returns {boolean}
 */
export function isValidState(state) {
  if (!state || typeof state !== 'object') return false;
  const s = /** @type {Record<string, unknown>} */ (state);
  return (
    Array.isArray(s.players) &&
    Array.isArray(s.deck) &&
    s.deck.length === CARDS &&
    s.deck.every(
      (c) => c && typeof c === 'object' && typeof c.id === 'string'
    ) &&
    Array.isArray(s.matched) &&
    s.matched.length === CARDS &&
    s.matched.every((m) => typeof m === 'boolean') &&
    (s.firstPick === null || Number.isInteger(s.firstPick)) &&
    Array.isArray(s.peek) &&
    s.peek.length <= 2 &&
    typeof s.matchedPairs === 'number'
  );
}
