/**
 * target.js — Target (axe-throwing) game: WATL-style scoring model.
 *
 * Scoring model:
 *  - A game is a fixed number of ROUNDS (default 5).
 *  - Each round is a fixed number of THROWS (default 5).
 *  - A throw is null (not thrown yet) or one of the allowed point values:
 *    0 (miss), 1/2/3 (rings), or 5 (clutch / killshot).
 *  - A round's score is the sum of its thrown (non-null) values.
 *  - A round counts as "played" once at least one throw has been entered.
 *    This is what distinguishes a genuine 0 (an all-miss round) from an
 *    unplayed round: the scoreboard shows "/" for unplayed, "0" for all-miss.
 *
 * State shape:
 *   {
 *     players: [{ id, name }],
 *     rounds: number,
 *     throwsPerRound: number,
 *     scores: { [playerId]: number[][] }  // [round][throw] -> value | null
 *   }
 */

export const GAME_KEY = 'target';
export const GAME_NAME = 'Target';

/** Rounds per game. */
export const ROUNDS = 5;
/** Throws per round. */
export const THROWS_PER_ROUND = 5;
/** Point values a single throw may score. */
export const THROW_VALUES = [0, 1, 2, 3, 5];

/**
 * @typedef {{id:string,name:string}} Player
 * @typedef {(number|null)[]} Round  one entry per throw (null = not thrown)
 * @typedef {Object} GameState
 * @property {Player[]} players
 * @property {number} rounds
 * @property {number} throwsPerRound
 * @property {Object<string, Round[]>} scores  playerId -> rounds -> throws
 */

/**
 * Build the empty per-player score grid: `rounds` rounds, each with
 * `throwsPerRound` unthrown (null) throws.
 * @param {number} rounds
 * @param {number} throwsPerRound
 * @returns {Round[]}
 */
function emptyGrid(rounds, throwsPerRound) {
  return Array.from({ length: rounds }, () =>
    Array.from({ length: throwsPerRound }, () => null)
  );
}

/**
 * Build a fresh game state for the given players.
 * @param {Player[]} [players] session players ({id,name})
 * @returns {GameState}
 */
export function createState(players = []) {
  const list = players.map((p) => ({ id: p.id, name: p.name }));
  const scores = {};
  for (const p of list) {
    scores[p.id] = emptyGrid(ROUNDS, THROWS_PER_ROUND);
  }
  return {
    players: list,
    rounds: ROUNDS,
    throwsPerRound: THROWS_PER_ROUND,
    scores,
  };
}

/**
 * Sum of a round's thrown values (ignores unthrown null slots).
 * @param {Round} round
 * @returns {number}
 */
export function roundScore(round) {
  if (!Array.isArray(round)) return 0;
  return round.reduce((sum, t) => sum + (typeof t === 'number' ? t : 0), 0);
}

/**
 * Whether a round has been played at all — true once any throw is entered.
 * Distinguishes a genuine all-miss 0 from an unplayed round.
 * @param {Round} round
 * @returns {boolean}
 */
export function roundPlayed(round) {
  return Array.isArray(round) && round.some((t) => typeof t === 'number');
}

/**
 * Running total across all of a player's rounds.
 * @param {Round[]} rounds
 * @returns {number}
 */
export function totalScore(rounds) {
  if (!Array.isArray(rounds)) return 0;
  return rounds.reduce((sum, r) => sum + roundScore(r), 0);
}

/**
 * Whether a throw slot is unthrown. A slot is unthrown when it holds null, or
 * when it's missing entirely (a sparse/partial round from a restored session).
 * @param {number|null|undefined} slot
 * @returns {boolean}
 */
function isEmptySlot(slot) {
  return slot === null || slot === undefined;
}

/**
 * @typedef {Object} ActivePosition
 * @property {string} playerId  id of the player who throws next
 * @property {number} playerIdx index of that player in state.players
 * @property {number} round     0-based round index
 * @property {number} throwIdx  0-based throw index within the round
 */

/**
 * Where the next throw goes. Play advances throw-by-throw for a player, then to
 * the next player, then to the next round: for each round, every player takes
 * all of their throws in player order before the round advances. Returns the
 * first slot that is still null, or null when the game is complete (or there
 * are no players).
 * @param {GameState} state
 * @returns {ActivePosition|null}
 */
export function activePosition(state) {
  const players = state?.players ?? [];
  const scores = state?.scores ?? {};
  const rounds = state?.rounds ?? ROUNDS;
  const throwsPerRound = state?.throwsPerRound ?? THROWS_PER_ROUND;
  if (players.length === 0) return null;

  for (let round = 0; round < rounds; round++) {
    for (let playerIdx = 0; playerIdx < players.length; playerIdx++) {
      const player = players[playerIdx];
      const grid = scores[player.id] ?? [];
      const roundThrows = grid[round] ?? [];
      for (let throwIdx = 0; throwIdx < throwsPerRound; throwIdx++) {
        if (isEmptySlot(roundThrows[throwIdx])) {
          return { playerId: player.id, playerIdx, round, throwIdx };
        }
      }
    }
  }
  return null;
}

/**
 * Whether every throw of every player has been entered.
 * @param {GameState} state
 * @returns {boolean}
 */
export function isComplete(state) {
  const players = state?.players ?? [];
  if (players.length === 0) return false;
  return activePosition(state) === null;
}

/**
 * Deep-copy a player's score grid so updates never mutate the input state.
 * @param {Object<string, Round[]>} scores
 * @returns {Object<string, Round[]>}
 */
function cloneScores(scores) {
  const out = {};
  for (const [id, grid] of Object.entries(scores)) {
    out[id] = grid.map((round) => round.slice());
  }
  return out;
}

/**
 * Record a throw and return a new state. By default the throw goes to the
 * active position (normal turn order). Pass `playerId` to record for a specific
 * player instead — their next open throw in the current round is used, which
 * lets a referee correct or re-order out of strict turn order.
 *
 * A no-op (returns the same reference) when the game is already complete, when
 * there is no open slot for the chosen player, or when `value` is not one of
 * the allowed THROW_VALUES.
 * @param {GameState} state
 * @param {number} value one of THROW_VALUES
 * @param {string} [playerId] override the active thrower
 * @returns {GameState}
 */
export function applyThrow(state, value, playerId) {
  if (!THROW_VALUES.includes(value)) return state;

  const pos = playerId
    ? positionForPlayer(state, playerId)
    : activePosition(state);
  if (!pos) return state;

  const scores = cloneScores(state.scores);
  scores[pos.playerId][pos.round][pos.throwIdx] = value;
  return { ...state, scores };
}

/**
 * The next open slot for a specific player, searching rounds in order. Used by
 * the manual-override path in applyThrow and by the board to show the status
 * line for a referee-selected player. Null if that player has no open slot.
 * @param {GameState} state
 * @param {string} playerId
 * @returns {ActivePosition|null}
 */
export function positionForPlayer(state, playerId) {
  const players = state?.players ?? [];
  const playerIdx = players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return null;
  const grid = state.scores?.[playerId] ?? [];
  const rounds = state?.rounds ?? ROUNDS;
  const throwsPerRound = state?.throwsPerRound ?? THROWS_PER_ROUND;
  for (let round = 0; round < rounds; round++) {
    const roundThrows = grid[round] ?? [];
    for (let throwIdx = 0; throwIdx < throwsPerRound; throwIdx++) {
      if (isEmptySlot(roundThrows[throwIdx])) {
        return { playerId, playerIdx, round, throwIdx };
      }
    }
  }
  return null;
}

/**
 * Revert the most recently entered throw to null and return a new state. The
 * "most recent" throw is the one just before the active position in turn order
 * (or the game's last throw when the game is complete). A no-op (same reference)
 * when nothing has been thrown yet.
 * @param {GameState} state
 * @returns {GameState}
 */
export function undoLastThrow(state) {
  const pos = lastFilledPosition(state);
  if (!pos) return state;
  const scores = cloneScores(state.scores);
  scores[pos.playerId][pos.round][pos.throwIdx] = null;
  return { ...state, scores };
}

/**
 * The position of the most recently entered throw, i.e. the last filled slot in
 * turn order. Null when nothing has been thrown. Walks turn order backwards
 * from the active position (or from the end when the game is complete).
 * @param {GameState} state
 * @returns {ActivePosition|null}
 */
function lastFilledPosition(state) {
  const players = state?.players ?? [];
  const scores = state?.scores ?? {};
  const rounds = state?.rounds ?? ROUNDS;
  const throwsPerRound = state?.throwsPerRound ?? THROWS_PER_ROUND;
  if (players.length === 0) return null;

  for (let round = rounds - 1; round >= 0; round--) {
    for (let playerIdx = players.length - 1; playerIdx >= 0; playerIdx--) {
      const player = players[playerIdx];
      const grid = scores[player.id] ?? [];
      const roundThrows = grid[round] ?? [];
      for (let throwIdx = throwsPerRound - 1; throwIdx >= 0; throwIdx--) {
        if (!isEmptySlot(roundThrows[throwIdx])) {
          return { playerId: player.id, playerIdx, round, throwIdx };
        }
      }
    }
  }
  return null;
}

/**
 * Structural check that a value is a usable state. Used when restoring a
 * persisted session, whose shape is untrusted.
 * @param {unknown} state
 * @returns {boolean}
 */
export function isValidState(state) {
  return (
    !!state &&
    typeof state === 'object' &&
    Array.isArray(state.players) &&
    typeof state.rounds === 'number' &&
    typeof state.throwsPerRound === 'number' &&
    !!state.scores &&
    typeof state.scores === 'object'
  );
}
