/**
 * ui/render.js — tiny DOM helpers + screen renderers.
 *
 * Deliberately framework-free (vanilla DOM) to keep the WebView bundle small.
 * All rendering is driven by plain state objects from the game modules, so the
 * logic stays testable and the UI stays a thin projection.
 */

import { MAX_NAME_LENGTH } from '../lib/session.js';

/**
 * Create an element with attributes/children.
 * @param {string} tag
 * @param {object} [attrs]
 * @param {(Node|string)[]} [children]
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v !== false && v !== null && v !== undefined) {
      node.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const child of children) {
    node.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return node;
}

/**
 * Replace the contents of a mount node with a single child.
 * @param {HTMLElement} mount
 * @param {Node} child
 */
export function mount(mount, child) {
  mount.replaceChildren(child);
}

/**
 * Render the player-entry form: an input + Add button, and an editable list of
 * players with per-row Edit/Delete, plus a Continue button to reach the menu.
 *
 * All handlers mutate + persist session state (in main.js), then call the
 * provided callbacks which re-render. The renderer itself is stateless apart
 * from a transient `editingId` used to show one row in edit mode.
 *
 * @param {{id:string,name:string}[]} players
 * @param {{
 *   onAdd:(name:string)=>void,
 *   onEdit:(id:string,name:string)=>void,
 *   onDelete:(id:string)=>void,
 *   onContinue:()=>void,
 *   editingId?:string|null,
 *   onBeginEdit:(id:string|null)=>void,
 * }} handlers
 * @returns {HTMLElement}
 */
export function renderPlayers(players, handlers) {
  const { onAdd, onEdit, onDelete, onContinue, editingId, onBeginEdit } =
    handlers;

  const input = el('input', {
    class: 'players__input',
    type: 'text',
    placeholder: 'Player name',
    'aria-label': 'Player name',
    autocomplete: 'off',
    maxlength: String(MAX_NAME_LENGTH),
  });

  const submit = () => {
    const value = input.value;
    onAdd(value);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });

  const addRow = el('div', { class: 'players__add' }, [
    input,
    el('button', {
      class: 'btn btn--primary',
      text: 'Add',
      onClick: submit,
    }),
  ]);

  const list =
    players.length === 0
      ? el('p', { class: 'players__empty', text: 'No players yet.' })
      : el(
          'ul',
          { class: 'players__list' },
          players.map((p) =>
            renderPlayerRow(p, editingId, { onEdit, onDelete, onBeginEdit })
          )
        );

  return el('div', { class: 'players' }, [
    el('h2', { class: 'players__heading', text: 'Who’s playing?' }),
    addRow,
    list,
    el('div', { class: 'players__footer' }, [
      el('button', {
        class: 'btn btn--primary players__continue',
        text: 'Continue →',
        onClick: onContinue,
      }),
    ]),
  ]);
}

/**
 * Render one player row — either a static name with Edit/Delete, or, when it's
 * the row being edited, an input with Save/Cancel.
 * @param {{id:string,name:string}} player
 * @param {string|null|undefined} editingId
 * @param {{onEdit:(id:string,name:string)=>void,onDelete:(id:string)=>void,onBeginEdit:(id:string|null)=>void}} handlers
 * @returns {HTMLElement}
 */
function renderPlayerRow(player, editingId, { onEdit, onDelete, onBeginEdit }) {
  if (editingId === player.id) {
    const editInput = el('input', {
      class: 'players__input',
      type: 'text',
      value: player.name,
      'aria-label': 'Edit player name',
      autocomplete: 'off',
      maxlength: String(MAX_NAME_LENGTH),
    });
    const save = () => onEdit(player.id, editInput.value);
    editInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        save();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onBeginEdit(null);
      }
    });
    // Focus the field as soon as it's in the DOM.
    setTimeout(() => {
      editInput.focus();
      editInput.select();
    }, 0);
    return el('li', { class: 'players__row players__row--editing' }, [
      editInput,
      el('button', { class: 'btn btn--primary', text: 'Save', onClick: save }),
      el('button', {
        class: 'btn btn--ghost',
        text: 'Cancel',
        onClick: () => onBeginEdit(null),
      }),
    ]);
  }

  return el('li', { class: 'players__row' }, [
    el('span', { class: 'players__name', text: player.name }),
    el('button', {
      class: 'btn btn--ghost',
      text: 'Edit',
      onClick: () => onBeginEdit(player.id),
    }),
    el('button', {
      class: 'btn btn--ghost players__delete',
      text: '✕',
      'aria-label': `Delete ${player.name}`,
      onClick: () => onDelete(player.id),
    }),
  ]);
}

/**
 * Presentational metadata for the game menu, keyed by game key. UI-only (a
 * short tagline shown beside each name), so it lives in the render layer rather
 * than the pure game modules.
 * @type {Object<string,{tagline:string}>}
 */
const MENU_META = {
  target: { tagline: 'Beginner six-zone target' },
  watl: { tagline: 'Official WATL · killshots' },
  iatf: { tagline: 'Official IATF · clutches' },
  dartboard: { tagline: '501 down to zero' },
  tictactoe: { tagline: 'Three in a row' },
  connect4: { tagline: 'Connect four' },
  pairs: { tagline: 'Match the pairs' },
};

/**
 * Build one game row: a big typographic name with a small dim tagline. No card,
 * no icon — the whole row is the tap target (a referee taps quickly from a
 * distance) and carries an aria-label combining name + tagline.
 * @param {{key:string,name:string}} game
 * @param {number} index 1-based position, shown as a lead numeral
 * @param {(key:string)=>void} onSelect
 * @returns {HTMLElement}
 */
function renderMenuRow(game, index, onSelect) {
  const meta = MENU_META[game.key] ?? { tagline: '' };
  const label = meta.tagline ? `${game.name} — ${meta.tagline}` : game.name;

  const num = el('span', {
    class: 'menu__num',
    'aria-hidden': 'true',
    text: String(index).padStart(2, '0'),
  });

  const nameBlock = el('span', { class: 'menu__label' }, [
    el('span', { class: 'menu__name', text: game.name }),
    meta.tagline
      ? el('span', { class: 'menu__tagline', text: meta.tagline })
      : '',
  ]);

  return el(
    'button',
    {
      class: 'menu__row',
      'aria-label': label,
      onClick: () => onSelect(game.key),
    },
    [
      num,
      nameBlock,
      el('span', { class: 'menu__arrow', 'aria-hidden': 'true', text: '→' }),
    ]
  );
}

/**
 * Render the game-selection menu: a heading, a big typographic list of games,
 * plus a footer button that returns to the player-entry screen to add/edit/
 * remove players. The footer button is always present so the roster can be
 * changed between games.
 * @param {{key:string,name:string}[]} games
 * @param {(key:string)=>void} onSelect
 * @param {()=>void} onEditPlayers  return to the player-entry screen
 * @returns {HTMLElement}
 */
export function renderMenu(games, onSelect, onEditPlayers) {
  const heading = el('h2', { class: 'menu__heading', text: 'Pick your game' });

  const list = el(
    'div',
    { class: 'menu' },
    games.map((g, i) => renderMenuRow(g, i + 1, onSelect))
  );

  const footer = el('div', { class: 'menu__footer' }, [
    el('button', {
      class: 'btn btn--ghost menu__edit-players',
      text: '← Edit players',
      onClick: onEditPlayers,
    }),
  ]);

  return el('div', { class: 'menu-screen' }, [heading, list, footer]);
}
