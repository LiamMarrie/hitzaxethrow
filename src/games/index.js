/**
 * games/index.js — game registry.
 *
 * Each game module exports GAME_KEY and GAME_NAME. New games are added here
 * once and become available to the menu and router automatically.
 */

import * as target from './target.js';
import * as watl from './watl.js';
import * as iatf from './iatf.js';
import * as dartboard from './dartboard.js';
import * as tictactoe from './tictactoe.js';
import * as connect4 from './connect4.js';

export const GAMES = [
  { key: target.GAME_KEY, name: target.GAME_NAME, module: target },
  { key: watl.GAME_KEY, name: watl.GAME_NAME, module: watl },
  { key: iatf.GAME_KEY, name: iatf.GAME_NAME, module: iatf },
  { key: dartboard.GAME_KEY, name: dartboard.GAME_NAME, module: dartboard },
  { key: tictactoe.GAME_KEY, name: tictactoe.GAME_NAME, module: tictactoe },
  { key: connect4.GAME_KEY, name: connect4.GAME_NAME, module: connect4 },
];

/**
 * @param {string} key
 * @returns {{key:string,name:string,module:object}|undefined}
 */
export function getGame(key) {
  return GAMES.find((g) => g.key === key);
}
