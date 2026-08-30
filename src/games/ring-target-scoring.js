/**
 * ring-target-scoring.js — pure scoring/turn helpers shared by every
 * ring-target game (Axe Classic, WATL, IATF).
 *
 * These functions are the parts of the scoring model that do NOT depend on a
 * game's specific point values (THROW_VALUES): reading a round's score, finding
 * whose throw is next, and walking the turn order forwards/backwards. They
 * operate purely on the shared ring-target state shape and read the board size
 * from the state itself (`state.rounds` / `state.throwsPerRound`), falling back
 * to the defaults below when a restored state omits them.
 *
 * Kept in their own module so both the engine (`ring-target.js`) and the shared
 * scoreboard/board UI can import them without any circular dependency on a
 * concrete game module.
 *
 * State shape (identical across all ring-target games):
 *   {
 *     players: [{ id, name }],
 *     rounds: number,
 *     throwsPerRound: number,
 *     scores: { [playerId]: (number|null)[][] }  // [round][throw] -> value|null
 *   }
 */

/** Default rounds per game (used when a restored state omits `rounds`). */
export const ROUNDS = 5;
/** Default throws per round (used when a restored state omits it). */
export const THROWS_PER_ROUND = 5;

/**
 * @typedef {{id:string,name:string}} Player
 * @typedef {(number|null)[]} Round  one entry per throw (null = not thrown)
 * @typedef {Object} GameState
 * @property {Player[]} players
 * @property {number} rounds
 * @property {number} throwsPerRound
 * @property {Object<string, Round[]>} scores  playerId -> rounds -> throws
 * @typedef {Object} ActivePosition
 * @property {string} playerId  id of the player who throws next
 * @property {number} playerIdx index of that player in state.players
 * @property {number} round     0-based round index
 * @property {number} throwIdx  0-based throw index within the round
 */

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
 * The position of the most recently entered throw, i.e. the last filled slot in
 * turn order. Null when nothing has been thrown. Walks turn order backwards
 * from the active position (or from the end when the game is complete).
 * @param {GameState} state
 * @returns {ActivePosition|null}
 */
export function lastFilledPosition(state) {
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
