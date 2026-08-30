/**
 * ring-target.js — parameterized engine for the ring-target axe games.
 *
 * Axe Classic, WATL Standard, and IATF Standard share one scoring model and
 * differ only in their allowed point values (and their board artwork). This
 * factory builds a complete game module from a small config, so there is a
 * single implementation of the state/turn/undo logic and three thin config
 * modules (`target.js`, `watl.js`, `iatf.js`) on top of it.
 *
 * Scoring model:
 *  - A game is a fixed number of `rounds` (default 5).
 *  - Each round is a fixed number of `throwsPerRound` throws (default 5).
 *  - A throw is null (not thrown yet) or one of the config's `throwValues`.
 *  - A round's score is the sum of its thrown (non-null) values.
 *  - A round counts as "played" once at least one throw is entered, so a
 *    genuine all-miss 0 reads differently from an unplayed round.
 *
 * Every mutating function is immutable: it returns a NEW state, or the SAME
 * reference to signal a no-op (game over / illegal value / no open slot /
 * nothing to undo), matching the applyThrow/undoLastThrow convention so
 * main.js's no-op detection works unchanged.
 */

import {
  activePosition,
  positionForPlayer,
  lastFilledPosition,
  isComplete,
  roundScore,
  roundPlayed,
  totalScore,
} from './ring-target-scoring.js';

/**
 * Build the empty per-player score grid: `rounds` rounds, each with
 * `throwsPerRound` unthrown (null) throws.
 * @param {number} rounds
 * @param {number} throwsPerRound
 * @returns {(number|null)[][]}
 */
function emptyGrid(rounds, throwsPerRound) {
  return Array.from({ length: rounds }, () =>
    Array.from({ length: throwsPerRound }, () => null)
  );
}

/**
 * Deep-copy a player's score grid so updates never mutate the input state.
 * @param {Object<string, (number|null)[][]>} scores
 * @returns {Object<string, (number|null)[][]>}
 */
function cloneScores(scores) {
  const out = {};
  for (const [id, grid] of Object.entries(scores)) {
    out[id] = grid.map((round) => round.slice());
  }
  return out;
}

/**
 * @typedef {Object} RingTargetConfig
 * @property {string} key         unique game key (e.g. 'target', 'watl')
 * @property {string} name        display name (e.g. 'Axe Classic')
 * @property {number[]} throwValues  the point values a single throw may score
 * @property {number} [rounds]        rounds per game (default 5)
 * @property {number} [throwsPerRound] throws per round (default 5)
 */

/**
 * Create a complete ring-target game module from a config. The returned object
 * exports the same interface as the other games (createState, applyThrow,
 * undoLastThrow, activePosition, positionForPlayer, isComplete, isValidState)
 * plus the game's constants and the pure scoring helpers.
 * @param {RingTargetConfig} config
 * @returns {object}
 */
export function createRingTargetGame({
  key,
  name,
  throwValues,
  rounds = 5,
  throwsPerRound = 5,
}) {
  const THROW_VALUES = Object.freeze([...throwValues]);
  const ROUNDS = rounds;
  const THROWS_PER_ROUND = throwsPerRound;

  /**
   * Build a fresh game state for the given players.
   * @param {{id:string,name:string}[]} [players] session players ({id,name})
   * @returns {import('./ring-target-scoring.js').GameState}
   */
  function createState(players = []) {
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
   * Record a throw and return a new state. By default the throw goes to the
   * active position (normal turn order). Pass `playerId` to record for a
   * specific player instead — their next open throw is used, which lets a
   * referee correct or re-order out of strict turn order.
   *
   * A no-op (returns the same reference) when the game is already complete,
   * when there is no open slot for the chosen player, or when `value` is not
   * one of this game's THROW_VALUES.
   * @param {import('./ring-target-scoring.js').GameState} state
   * @param {number} value one of THROW_VALUES
   * @param {string} [playerId] override the active thrower
   * @returns {import('./ring-target-scoring.js').GameState}
   */
  function applyThrow(state, value, playerId) {
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
   * Revert the most recently entered throw to null and return a new state. A
   * no-op (same reference) when nothing has been thrown yet.
   * @param {import('./ring-target-scoring.js').GameState} state
   * @returns {import('./ring-target-scoring.js').GameState}
   */
  function undoLastThrow(state) {
    const pos = lastFilledPosition(state);
    if (!pos) return state;
    const scores = cloneScores(state.scores);
    scores[pos.playerId][pos.round][pos.throwIdx] = null;
    return { ...state, scores };
  }

  /**
   * Structural check that a value is a usable state. Used when restoring a
   * persisted session, whose shape is untrusted.
   * @param {unknown} state
   * @returns {boolean}
   */
  function isValidState(state) {
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

  return {
    GAME_KEY: key,
    GAME_NAME: name,
    THROW_VALUES,
    ROUNDS,
    THROWS_PER_ROUND,
    createState,
    applyThrow,
    undoLastThrow,
    isValidState,
    // Pure helpers re-exported so callers can import them from the game module.
    activePosition,
    positionForPlayer,
    isComplete,
    roundScore,
    roundPlayed,
    totalScore,
  };
}
