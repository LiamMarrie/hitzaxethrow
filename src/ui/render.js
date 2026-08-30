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
 * Presentational metadata for the game menu, keyed by game key. This is a UI
 * concern only (an icon and a one-line tagline for the card), so it lives in
 * the render layer rather than the pure game modules. Icons are inline SVG so
 * they stay crisp on the projected display and inherit the accent via
 * `currentColor`. `kind` groups games for a subtle card accent.
 * @type {Object<string,{tagline:string,kind:string,icon:string}>}
 */
const MENU_META = {
  target: {
    tagline: 'Beginner six-zone target · 5 rounds',
    kind: 'throw',
    icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <circle cx="24" cy="24" r="20"/><circle cx="24" cy="24" r="12.5"/>
      <circle cx="24" cy="24" r="5" fill="currentColor" stroke="none"/></svg>`,
  },
  watl: {
    tagline: 'Official WATL format · killshots live',
    kind: 'throw',
    icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <circle cx="24" cy="24" r="20"/><circle cx="24" cy="24" r="11"/>
      <circle cx="24" cy="24" r="4.5" fill="currentColor" stroke="none"/>
      <circle cx="10" cy="10" r="2.6" fill="currentColor" stroke="none"/>
      <circle cx="38" cy="10" r="2.6" fill="currentColor" stroke="none"/></svg>`,
  },
  iatf: {
    tagline: 'Official IATF format · clutches live',
    kind: 'throw',
    icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <circle cx="24" cy="24" r="20"/><circle cx="24" cy="24" r="12"/>
      <circle cx="24" cy="24" r="4.5" fill="currentColor" stroke="none"/>
      <circle cx="9" cy="24" r="2.6" fill="currentColor" stroke="none"/>
      <circle cx="39" cy="24" r="2.6" fill="currentColor" stroke="none"/></svg>`,
  },
  dartboard: {
    tagline: 'Race from 501 down to zero',
    kind: 'throw',
    icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <circle cx="24" cy="24" r="20"/><circle cx="24" cy="24" r="11"/>
      <circle cx="24" cy="24" r="3.5" fill="currentColor" stroke="none"/>
      <path d="M24 4v8M24 36v8M4 24h8M36 24h8"/></svg>`,
  },
  tictactoe: {
    tagline: 'Two players · three in a row',
    kind: 'grid',
    icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <path d="M18 6v36M30 6v36M6 18h36M6 30h36"/>
      <path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>
      <circle cx="36" cy="36" r="4"/></svg>`,
  },
  connect4: {
    tagline: 'Two players · drop discs, connect four',
    kind: 'grid',
    icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round">
      <rect x="6" y="10" width="36" height="32" rx="4"/>
      <circle cx="16" cy="20" r="3.4"/><circle cx="24" cy="20" r="3.4"/><circle cx="32" cy="20" r="3.4"/>
      <circle cx="16" cy="32" r="3.4" fill="currentColor"/><circle cx="24" cy="32" r="3.4"/><circle cx="32" cy="32" r="3.4" fill="currentColor"/></svg>`,
  },
  pairs: {
    tagline: 'Flip cards · match all the pairs',
    kind: 'grid',
    icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round">
      <rect x="6" y="12" width="20" height="28" rx="3"/>
      <rect x="22" y="8" width="20" height="28" rx="3" fill="var(--surface)"/>
      <path d="M32 16v12M26 22h12"/></svg>`,
  },
};

/**
 * Build one game card: an inline-SVG icon, the game name, and a short tagline.
 * The whole card is the tap target (a referee taps quickly from a distance),
 * and it carries an aria-label combining name + tagline for screen readers.
 * @param {{key:string,name:string}} game
 * @param {(key:string)=>void} onSelect
 * @returns {HTMLElement}
 */
function renderMenuCard(game, onSelect) {
  const meta = MENU_META[game.key] ?? { tagline: '', kind: 'throw', icon: '' };
  const label = meta.tagline ? `${game.name} — ${meta.tagline}` : game.name;

  const icon = el('span', { class: 'menu__icon', 'aria-hidden': 'true' });
  // Trusted static markup (no user data) — safe to inject as inline SVG.
  icon.innerHTML = meta.icon;

  return el(
    'button',
    {
      class: 'menu__card',
      'data-kind': meta.kind,
      'aria-label': label,
      onClick: () => onSelect(game.key),
    },
    [
      icon,
      el('span', { class: 'menu__name', text: game.name }),
      meta.tagline
        ? el('span', { class: 'menu__tagline', text: meta.tagline })
        : '',
    ]
  );
}

/**
 * Render the game-selection menu: a heading, a grid of game cards, plus a
 * footer button that returns to the player-entry screen to add/edit/remove
 * players. The footer button is always present so the roster can be changed
 * between games.
 * @param {{key:string,name:string}[]} games
 * @param {(key:string)=>void} onSelect
 * @param {()=>void} onEditPlayers  return to the player-entry screen
 * @returns {HTMLElement}
 */
export function renderMenu(games, onSelect, onEditPlayers) {
  const heading = el('h2', { class: 'menu__heading', text: 'Choose a game' });

  const grid = el(
    'div',
    { class: 'menu' },
    games.map((g) => renderMenuCard(g, onSelect))
  );

  const footer = el('div', { class: 'menu__footer' }, [
    el('button', {
      class: 'btn btn--ghost menu__edit-players',
      text: '← Edit players',
      onClick: onEditPlayers,
    }),
  ]);

  return el('div', { class: 'menu-screen' }, [heading, grid, footer]);
}
