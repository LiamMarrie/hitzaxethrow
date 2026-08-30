---
inclusion: always
---

# Game-Building Guide — Axe Throw Scoreboard

Rules to follow whenever adding or changing a game in this codebase. This is a
kiosk scoreboard for an Android tablet whose screen is **projected**. Local-only:
no server, no database, no network calls.

## 1. Architecture — keep logic and UI separate

- **Game logic is pure and framework-free.** It lives in `src/games/<game>.js`
  and must never touch the DOM, `localStorage`, `window`, or timers. This is
  what keeps it unit-testable.
- **UI is a thin projection** of logic state. It lives in `src/ui/<game>-board.js`
  (the board) and a renderer in `src/ui/screens.js`. UI reads state and calls
  handlers; it never contains game rules.
- **Never put scoring/win/turn rules in the UI layer.** If the UI needs to know
  something (whose turn, is it complete, next slot), add a pure exported helper
  to the game module and call it.

## 2. Game module contract (`src/games/<game>.js`)

Every game module MUST export:

- `GAME_KEY` — unique lowercase string (e.g. `'target'`).
- `GAME_NAME` — display name (e.g. `'Target'`).
- `createState(players)` — build fresh state from the session `players`
  array (`[{id, name}]`). Copy only `{id, name}` into state.
- `isValidState(state)` — structural check for an untrusted restored session.
  Return `false` for anything that can't be safely rendered.
- `isComplete(state)` — whether the game is over.

Then implement ONE interaction interface:

- **Throw-based games** (Target, 501): `applyThrow(state, value, playerId?)`,
  `undoLastThrow(state)`, `activePosition(state)`, `positionForPlayer(state, id)`.
- **Grid/move-based games** (Tic-Tac-Toe, Connect 4): `applyMove(state, cell)`,
  `reset(state)` (rematch), `currentPlayerIdx(state)`. (Provide
  `undoLastMove` if you add undo, but see §6.)

## 3. Immutability & the no-op convention (critical)

- Mutating functions return a **NEW** state object. Never mutate the input.
  Deep-copy the mutable parts (score grids, boards, arrays) before writing.
- To signal a rejected/illegal action (game over, illegal move, bad value,
  nothing to undo), return the **SAME reference** (`return state`).
- `main.js` detects no-ops with `next === session.state` and skips persist +
  re-render. Breaking this convention causes phantom saves and re-renders.
- Illegal actions are rejected in the logic layer (return same ref), never by
  throwing for expected cases.

## 4. Registering a new game (wire it in three places)

1. `src/games/index.js` — import the module and add it to the `GAMES` array.
2. `src/main.js` — add the game key → renderer entry to the `SCREENS` map.
3. `src/ui/screens.js` — add a `render<Game>` renderer that builds the board via
   `renderGameShell(...)`, and add a `HOW_TO_PLAY` entry for the info card.

Also confirm `main.js` calls the right interface: `recordThrow`/`undoThrow` use
`applyThrow`/`undoLastThrow`; `recordMove`/`resetGame` use `applyMove`/`reset`.

## 5. Data safety (non-negotiable requirements)

- **Never call `localStorage.clear()`.** Only remove one namespaced key via the
  `storage.js` wrapper. All reads/writes go through `readJSON`/`writeJSON`.
- **Persist on every move.** After a successful state change, call
  `saveSession(session)` so a reload restores the in-progress game.
- Reads/writes must fail safe: corrupt data returns a fallback, a failed write
  returns `false` — never throw to the UI.

## 6. Error handling & kiosk resilience

- **Never use `alert()` or `confirm()`.** Use `showError(...)` for messages and
  the `confirmDialog(...)` overlay for confirmations.
- Wrap state mutations driven from the UI in `guard(...)` so an exception shows
  a banner instead of white-screening the projected display.
- A renderer must never be able to crash the app. Guard the first render and
  fall back to the menu on failure.

## 7. UI / projector rules

- **Draw boards as inline SVG** (vector stays sharp when projected). No raster
  game assets.
- Use **saturated, high-contrast colors** and heavy outlines; avoid thin lines
  and muted greys that wash out on a projector.
- Make **whole zones/columns the tap target**, not tiny numerals or strokes — a
  referee taps quickly from across the room.
- Reuse the app's accent tokens/`.btn` chrome; player names fall back to
  `'Player 1'` / `'Player 2'` when absent.
- Add `role`/`aria-label` to interactive SVG nodes.

## 8. Player names

- Validate through `session.js` (`addPlayer`/`editPlayer`): trimmed, non-blank,
  `<= MAX_NAME_LENGTH`, profanity-checked via `containsBlockedWord`, no
  case-insensitive duplicates, within `MIN_PLAYERS`..`MAX_PLAYERS`.
- Don't re-implement these checks in a game module.

## 9. Testing (required for every game)

- Add `src/games/<game>.test.js` (or `tests/<game>.test.js`) with Vitest.
- Cover: fresh state, full rules, win/draw detection, illegal-move/no-op
  handling, undo (including edge cases like undo across a bust), and
  `isValidState` accepting good state / rejecting corrupt state.
- The logic layer (`src/games/*.js`, `src/lib/*.js`) has an enforced coverage
  floor (70% lines/stmts/functions, 60% branches). Keep new logic above it.

## 10. Coding standards

- ES modules, vanilla JS. `const`/`let` only (no `var`), `===`/`!==` only,
  no `console.log` (only `console.warn`/`console.error`).
- JSDoc every exported function with `@param`/`@returns` and a short "why".
- Match the existing file style and helpers (`el`, `svg`, `mount`); don't add
  new frameworks or dependencies without a clear reason.

## 11. Definition of done — always verify before finishing

Run and confirm all three pass:

```
npm test
npm run lint
npm run build
```

Fix any failures before reporting the work complete. Clean up temp files.
