# Games-to-Build — Implementation Design Spec

**Date:** 2026-08-30
**Status:** Design approved — pending spec review, then implementation plan (`writing-plans`).
**Scope:** Port the three prototypes in `games-to-build/` (`pairs.html`, `watl-target.html`, `iatf-target.html`) into real game modules, and reshape the existing `target` game into **Axe Classic**. Result: four distinct games added/changed in the menu.

---

## 1. Context & current architecture

The app is a vanilla-JS, framework-free tablet kiosk (Capacitor → Android WebView), shipped to the Play Store and often projected onto the physical target. It has **no server and no database** — state lives in a per-session `localStorage` record. Key constraint: **never use `window.alert/confirm/prompt`** (see `no-web-popups` memory); use the in-app error banner (`src/lib/errors.js`) and styled overlays (`src/ui/confirm.js`).

Games are split into two layers:

- **Logic module** — `src/games/<key>.js`, pure and framework-free, fully unit-tested.
- **Board UI** — `src/ui/<key>-board.js`, a thin projection of state to inline SVG/DOM.

The router `src/main.js` drives every game through a fixed interface and persists after each interaction. A game becomes available by wiring **three spots**:

1. `src/games/index.js` — add to the `GAMES` array (drives the menu + `getGame`).
2. `src/main.js` — add a line to the `SCREENS` map (`key → renderer`).
3. `src/ui/screens.js` — add a `render<Game>` renderer + a `HOW_TO_PLAY` entry.

### Two interface flavours

**Scoring games** (Axe Classic, WATL, IATF — and the existing `dartboard`) export:

```
GAME_KEY, GAME_NAME
createState(players) -> state
applyThrow(state, value, playerId?) -> newState | same-ref (no-op)
undoLastThrow(state) -> newState | same-ref (no-op)
activePosition(state) -> { playerId, playerIdx, round, throwIdx } | null
positionForPlayer(state, playerId) -> ActivePosition | null
isComplete(state) -> boolean
isValidState(state) -> boolean
```

Driven by `main.js`'s `recordThrow(value)` / `undoThrow()`. The **referee override** (tap a scoreboard row to score out of turn) works for free via the `playerId` arg + `onPickPlayer`. Rendered by `renderGameShell(name, handlers, scoreboard, board)` with the shared `renderScoreboard`.

**Grid games** (Tic-Tac-Toe, Connect 4) export:

```
GAME_KEY, GAME_NAME
createState(players) -> state
applyMove(state, cell) -> newState | same-ref (no-op)
undoLastMove(state) -> newState | same-ref (no-op)   // optional
reset(state) -> newState
isComplete(state) -> boolean
isValidState(state) -> boolean
```

Driven by `main.js`'s `recordMove(cell)` / `resetGame()`. They carry their own state and render their own board; no shared scoreboard.

### The immutability contract (critical)

Every mutating function returns a **new** state object, or the **same reference** to signal a no-op. `main.js` relies on `next === state` meaning "nothing happened" to skip persist + re-render. Any new module MUST honour this.

### How the prototypes relate to the port

The `games-to-build/*.html` files are **self-contained reference prototypes** with their own `window.*` APIs and CustomEvents. They are **not embedded**. We port their reusable parts — the SVG target geometry (radii, zone coordinates, colours) and the card markup/animations — into the split logic/board pattern, exactly as `dartboard.html` was ported into `dartboard.js` + `dartboard-board.js`. The prototypes' `undo/reset/setKillshot` APIs and CustomEvents are discarded; state and turn logic live in the new logic modules instead.

---

## 2. Design decisions (locked)

| Decision | Choice |
|---|---|
| Number of games | **Four**, all distinct menu entries: Axe Classic, WATL Standard, IATF Standard, Pairs. |
| Existing "Target" game | **Replaced by Axe Classic.** Reuse the internal key `target` to preserve session/test wiring; change `GAME_NAME` to "Axe Classic" and rebuild the board to the 6-ring layout. *(Open to a clean `classic` key if preferred — see §7.)* |
| WATL/IATF relationship | Separate official-format games. They **reuse components** (shared engine + shared board component) but are **distinct games**. |
| Killshot / clutch | **Always live.** The zone always scores its full value (WATL 8, IATF 7). No toggle, no "designated throw" gating. The prototypes' `setKillshot/setClutch` are not wired. |
| Missed killshot | **No forfeit.** Hitting a ring while a killshot zone exists just scores the ring's points. |
| Match format | **5 rounds × 5 throws**, same as the current Target, reusing `renderScoreboard`. |
| Pairs multiplayer | **Turn-based, keep-on-match.** Flip 2 cards; a match scores a point and the player goes again; a miss passes the turn. Most pairs when the board clears wins. |
| Shared engine | **Parameterized factory** for the three ring-target games (approach A). One core implementation, three thin config modules. |
| Doc depth | This spec now → `writing-plans` for the implementation plan. |

---

## 3. Shared ring-target engine (serves Axe Classic, WATL, IATF)

The current `target.js` is ~290 lines of scoring/turn logic that differs between the three games **only** in `GAME_KEY`, `GAME_NAME`, and `THROW_VALUES`. We extract the logic into a factory so there is one implementation and three thin configs — reuse of components, distinct games.

### 3.1 `src/games/ring-target.js` (new — the engine)

```
export function createRingTargetGame({ key, name, throwValues, rounds = 5, throwsPerRound = 5 })
  -> { GAME_KEY, GAME_NAME, THROW_VALUES, ROUNDS, THROWS_PER_ROUND,
       createState, applyThrow, undoLastThrow, activePosition,
       positionForPlayer, isComplete, isValidState,
       roundScore, roundPlayed, totalScore }
```

The body is the *current* `target.js` logic verbatim (state grid `scores[playerId][round][throw]`, `activePosition`, `applyThrow`/`undoLastThrow`, `positionForPlayer`, `isComplete`, `isValidState`), with `THROW_VALUES`/`ROUNDS`/`THROWS_PER_ROUND` closed over from config instead of module constants. `applyThrow` validates `value ∈ throwValues`.

**Scoreboard dependency note:** `src/ui/scoreboard.js` currently imports `roundScore`, `roundPlayed`, `totalScore`, `activePosition` **from `../games/target.js`**. These are pure helpers independent of `THROW_VALUES`, so the engine must re-export them. Two clean options — the plan will pick one:
- (a) Keep the four helpers in a tiny shared `src/games/ring-target-scoring.js` and have both the engine and `scoreboard.js` import from there; or
- (b) Have `scoreboard.js` accept the helpers via the game module it's already handed.
Recommended: **(a)** — smallest change, keeps `scoreboard.js` a pure projection.

### 3.2 The three game modules (thin configs)

```js
// src/games/target.js  (Axe Classic — key kept as 'target')
export const { GAME_KEY, GAME_NAME, THROW_VALUES, /* … */ } =
  createRingTargetGame({ key: 'target', name: 'Axe Classic',
                         throwValues: [0, 1, 2, 3, 4, 5, 6] });

// src/games/watl.js
createRingTargetGame({ key: 'watl', name: 'WATL Standard',
                       throwValues: [0, 1, 2, 3, 4, 5, 6, 8] });

// src/games/iatf.js
createRingTargetGame({ key: 'iatf', name: 'IATF Standard',
                       throwValues: [0, 1, 3, 5, 7] });
```

Each re-exports the engine's members so existing imports (`import { THROW_VALUES } from '../games/target.js'`) keep working.

### 3.3 Shared board component `src/ui/ring-target-board.js` (new)

Generalizes the current `target-board.js`. Takes a **zone spec** — an array of tappable zones, each `{ shape, points, label, fill, ...geometry }` — plus the throw/undo handlers and `activeOverrideId`. Renders the status line (reused verbatim), the SVG, and the MISS + Undo controls. The per-game board files supply only their zone spec (ported from the prototype SVGs) and call this component. This keeps the status line, MISS/Undo, disabled/complete handling, and a11y in one place.

Each game gets a tiny board file:
- `src/ui/target-board.js` → Axe Classic zones (6 concentric rings + bullseye).
- `src/ui/watl-board.js` → WATL zones (5 rings + 5-dot bullseye cluster + 4 killshot dots).
- `src/ui/iatf-board.js` → IATF zones (3 rings + 2 clutch dots).

---

## 4. Per-game specifications

### 4.1 Axe Classic  *(replaces "Target")*

> **Axe Classic** — Simple six-ring target perfect for beginners and casual play. Outermost ring scores 1 point, each inner ring adds 1, with a red bullseye centre worth 6 points. No clutch or killshot mechanics — just pure throwing skill. 6 evenly spaced scoring zones · 5 throws per player · simple scoring, great for beginners.

- **Key / name:** `target` / `Axe Classic`.
- **Throw values:** `[0, 1, 2, 3, 4, 5, 6]` — miss 0; six concentric zones 1→5 outward-to-inward; red bullseye centre = 6.
- **Board:** rebuild `target-board.js` to six evenly-spaced concentric rings + a red bullseye, via `ring-target-board.js`. No clutch dots. Colours chosen for projector legibility (heavy white ring lines on dark discs, red centre), following the WATL prototype's ring styling.
- **Format:** 5 rounds × 5 throws (matches "5 throws per player" per round). Reuses `renderScoreboard`.
- **HOW_TO_PLAY:** update the existing `Target` entry (keyed by display name `'Axe Classic'`): six rings score 1–6 from the outside in, bullseye is 6, no clutch, highest total after 5 rounds wins.
- **Files:** `src/games/target.js` (thin config), `src/ui/target-board.js` (rebuilt zones). Update existing `tests/target.test.js` + `tests/target-board.test.js` for the new value set and layout.

### 4.2 WATL Standard

> **WATL Standard** — World Axe Throwing League official scoring format. The 5-ring target offers more scoring zones with the bullseye cluster worth 6 points, descending rings from 5 to 1, and killshot zones worth 8 points on designated throws. Official WATL target layout · Killshot zones (8 points) · Multi-player and team modes.

- **Key / name:** `watl` / `WATL Standard`.
- **Throw values:** `[0, 1, 2, 3, 4, 5, 6, 8]` — miss 0; five rings 1→5 (outer ring = 1 … innermost ring = 5); **bullseye cluster = 6** (centre dot + 4 satellite dots); **killshot dots = 8**.
- **Killshot:** **always live** — killshot dots always score 8. A ring hit while killshots exist just scores the ring (no forfeit). `setKillshot` from the prototype is **not** wired.
- **Board:** port `watl-target.html` geometry into `watl-board.js` zones: 5 disc radii (340/284/228/172/116), the 5-dot red cluster at centre worth 6, and 4 blue killshot dots worth 8. Layered largest-first so inner rings tap correctly (as in the prototype).
- **Format:** 5 rounds × 5 throws. Reuses `renderScoreboard`.
- **HOW_TO_PLAY:** new entry — five rings score 1–5 inward, the bullseye cluster is 6, killshots are 8 and always count, highest total after 5 rounds wins. (Note: "team modes" beyond per-player scoring is out of scope for v1 — see §6.)
- **Files:** `src/games/watl.js`, `src/ui/watl-board.js`, `src/games/watl.test.js`.

### 4.3 IATF Standard

> **IATF Standard** — Official International Axe Throwing Federation scoring. The classic 3-ring target with bullseye (5 points), middle ring (3 points), and outer ring (1 point). Includes clutch/killshot zones worth 7 points, available on designated throws. Official IATF target layout · Clutch throw support · Multi-player and team modes.

- **Key / name:** `iatf` / `IATF Standard`.
- **Throw values:** `[0, 1, 3, 5, 7]` — miss 0; **outer ring = 1**, **middle ring = 3**, **bullseye = 5**; **clutch dots = 7**.
- **Clutch:** **always live** — clutch dots always score 7. No forfeit on a ring hit. `setClutch` not wired.
- **Board:** port `iatf-target.html` geometry into `iatf-board.js` zones: 3 disc radii (300/190/78) for 1/3/5, and 2 blue clutch dots (r=34 at 278,216 and 722,216) worth 7. Layered largest-first.
- **Format:** 5 rounds × 5 throws. Reuses `renderScoreboard`.
- **HOW_TO_PLAY:** new entry — outer/middle/bull score 1/3/5, clutch dots are 7 and always count, highest total after 5 rounds wins.
- **Files:** `src/games/iatf.js`, `src/ui/iatf-board.js`, `src/games/iatf.test.js`.

### 4.4 Pairs

> **Pairs** — A memory matching game with axes! Cards are placed face-down. Flip a card to reveal its symbol; match pairs to score points. Watch out for the Joker — a wild card that matches anything! Tests memory and accuracy · card-flip animations · Joker wild card adds excitement.

Pairs is **not** a scoring/throw game — it's a **grid-style game** (like Tic-Tac-Toe / Connect 4): tapping a face-down card is a *move*, not a scored throw. It carries its own state and uses `applyMove` / `reset`.

**Multiplayer model (turn-based, keep-on-match):**
- Players take turns. A turn = flip one card, then a second card.
- **Match** (same id, or either is the Joker) → both cards lock as matched, the active player scores **+1 pair** and **goes again**.
- **Miss** → both flip back face-down and the **turn passes** to the next player.
- Board clears when all pairs are matched. **Most pairs wins**; tie is possible (shown as a tie).
- Deck: the prototype's 4 ranks × 2 + 1 Joker = **9 cards** in a 3×3 grid. The Joker is a lone wild that matches the next single card flipped alongside it (odd card out), so exactly 4 "pairs" are attainable and the Joker guarantees one of them resolves. *(Edge case to pin down in the plan: with 9 cards there is one unpaired natural card that only the Joker can clear; confirm the win condition counts 4 matched pairs = 8 cards, leaving the logic to lock the final card. The prototype's `win()` reveals leftovers — we replicate "all matchable pairs found" as the completion test.)*

**State shape (proposed):**
```
{
  players: [{id,name}],
  deck: [{ id, rank, suit, red, joker }],   // fixed order; shuffled once at createState
  revealed: (cardIndex)[],                    // 0, 1, or 2 cards currently face-up this turn
  matched: boolean[],                         // per card index
  owner: (playerId|null)[],                   // which player matched each card (for per-player pair counts)
  turnIdx: number,                            // whose turn (index into players)
  moves: number[],                            // flip history, for undo
  winner: playerId | 'tie' | null,
}
```

**Interface:**
- `createState(players)` — shuffle deck (seeded via `Math.random`; determinism only matters for tests, which will inject a fixed deck through a test hook or by testing `applyMove` against a known `deck`).
- `applyMove(state, cardIndex)` — flip logic above; returns new state or same-ref no-op (card already matched / already the 2 face-up cards resolving / game over). **Note:** the two-cards-then-resolve flow needs a resolution step. Two sub-options for the plan:
  - **(a) Resolve on the 2nd flip within `applyMove`** (compute match, set matched/turn immediately). The board shows the 2nd card face-up, then the shared re-render reflects matched/reset. Simplest for state purity; the flip-back animation is handled by the board reacting to state (a brief "mismatch" visual before the next tap). 
  - **(b) A pending-resolve state** where a mismatch leaves both cards up until the next tap dismisses them (classic memory UX). More faithful to the prototype's 850ms auto-flip-back, but introduces a timer/among-render concern.
  Recommended: **(b)** with the board owning the *timing* (setTimeout to dispatch a "clear mismatch" action) while logic stays pure — mirrors how the prototype separates the flip from the settle. The plan will finalize.
- `reset(state)` — new shuffled deck, keep players.
- `isComplete(state)` — all pairs matched.
- `isValidState(state)` — structural check (players array, deck array, matched array length matches deck).

**Board `src/ui/pairs-board.js`:** port the prototype's card markup + CSS (flip animation, cover `?`, reveal face, Joker star, matched glow) into the project's `el` helper and a `.pairs__*` CSS block in `main.css`. Renders a per-player pair-count scoreboard (small, like the dartboard's baked-in scores), the 3×3 card grid, a status line ("<name>'s turn"), and a New game button on completion. Honours `prefers-reduced-motion` (prototype already does).

**Files:** `src/games/pairs.js`, `src/ui/pairs-board.js`, `src/games/pairs.test.js`. CSS added to `src/styles/main.css`.

---

## 5. Wiring (per game)

For each of `watl`, `iatf`, `pairs` (Axe Classic already wired as `target`):

1. **`src/games/index.js`** — `import * as watl from './watl.js';` and add `{ key, name, module }` to `GAMES`. (Order in the array = menu order.)
2. **`src/main.js`** — add `watl: renderWatl,` etc. to the `SCREENS` map, and import the renderer.
3. **`src/ui/screens.js`** — add `export function renderWatl(state, handlers)` (mirrors `renderTarget`: build board via `renderScoreboard` + the game's board component, wrap in `renderGameShell`) and a `HOW_TO_PLAY` entry keyed by display name. Pairs mirrors `renderTicTacToe`/`renderConnect4` (grid-game handlers: `onMove`, `onReset`; no shared scoreboard).

`main.js`'s `recordThrow`/`undoThrow` already work for any scoring game via `getGame`. `recordMove`/`resetGame` already work for any grid game. **No `main.js` router logic changes** beyond the `SCREENS` map lines + renderer imports — this is the payoff of the shared interface.

`sanitizeRestoredSession` already validates restored state via each module's `isValidState`, so persistence + safe-restore come for free once the modules export it.

---

## 6. Out of scope (v1)

- **Team modes.** The WATL/IATF marketing copy mentions "multi-player and team modes." v1 ships **multi-player** (per-player scoring, which the existing scoreboard + session roster already provide). **Team grouping/aggregation is deferred** — it needs a roster-level "teams" concept that touches the players screen and scoreboard, a separate feature. Flagged here so it isn't silently assumed done.
- **Killshot toggling / designated-throw gating.** Locked as "always live" per decision; the prototype toggle APIs are intentionally unused.
- **Timed / flip-count Pairs scoring.** v1 is pairs-matched-count only.

---

## 7. Open items for spec review

1. **Axe Classic key reuse.** Keeping the internal key `target` preserves `tests/target.test.js`, `tests/target-board.test.js`, session records, and `screens.js`'s `renderTarget`. Alternative: a clean `classic` key (clearer, but renames files/tests and orphans any persisted `target` sessions — minor, since sessions are per-visit). **Recommendation: keep `target`.** Confirm.
2. **Scoreboard helper location** (§3.1) — factor scoring helpers into `ring-target-scoring.js` (recommended) vs. threading them through. Confirm before the plan commits.
3. **Pairs resolution flow** (§4.4) — pending-resolve state + board-owned timing (recommended) vs. resolve-on-2nd-flip. Confirm.
4. **Menu order.** Proposed: Axe Classic, WATL Standard, IATF Standard, 501, Pairs, Tic-Tac-Toe, Connect 4. Adjust if you want a different ordering.

---

## 8. Testing strategy

Follow the existing pattern (`vitest`, jsdom). Every logic module gets a unit-test file asserting the immutability contract (`applyThrow`/`applyMove` returns new state on a real move, same-ref on a no-op), turn order, scoring math, undo (including undo across turn/round boundaries), completion, and `isValidState` on malformed input. Board tests (jsdom) assert the SVG renders the right zones, taps call the handler with the right value, and the board disables on completion — mirroring `tests/target-board.test.js`.

- Shared engine: test `ring-target.js` once thoroughly via one config, plus a small per-game test asserting each config's `THROW_VALUES` and name.
- Pairs: test with an injected known deck so match/miss/turn-pass/keep-on-match/win are deterministic.
- Regression: update `tests/target.test.js` + `tests/target-board.test.js` for Axe Classic's `[0,1,2,3,4,5,6]` and 6-ring board; add a `boot.test.js` assertion that all four games render from a restored session without white-screening.

Run before "done": `npm test`, `npm run lint`, `npm run format:check`.
