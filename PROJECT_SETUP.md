# Axe Throw Scoreboard — Project Setup

A local-only Android tablet app for manually tracking axe-throwing games
(**Target**, **Connect 4**, **Tic-Tac-Toe**) at a venue. The tablet screen is
screen-recorded and projected via Chromecast, so the UI is built as a big,
touch-friendly, kiosk-style scoreboard.

- **No server. No database.** Everything is stored locally on the device.
- **A new session is created every time the app is opened or closed.** Any
  in-progress game is restored if the app is merely reloaded, but a real
  close/background archives the session so the next open starts fresh.
- Built to be shipped to the **Google Play Store**.

---

## 1. Tech stack

| Concern           | Choice                                    |
| ----------------- | ----------------------------------------- |
| Language          | Vanilla **JavaScript (ES modules)**       |
| Markup / styling  | **HTML + CSS** (no UI framework)          |
| Build tool        | **Vite 6**                                |
| Unit tests        | **Vitest** (jsdom environment) + **v8** coverage |
| Coding standards  | **ESLint 9** (flat config) + **Prettier** |
| Native packaging  | **Capacitor 6** → Android APK/AAB         |
| Local storage     | `localStorage` via a defensive wrapper    |

Node **24** / npm **11** were used. Requires Node 18+.

---

## 2. What has been built (done ✅)

### Project scaffolding & tooling

- `package.json` with all scripts (dev / build / test / lint / format / cap:\*).
- `vite.config.js` — build config (relative `base` for the WebView) **and**
  Vitest config with a coverage floor.
- `eslint.config.js` — flat config, browser + test globals, `dist/` ignored.
- `.prettierrc.json`, `.gitignore`, `capacitor.config.json`.
- All dependencies installed (`npm install` complete).

### Application architecture (`src/`)

The app is split so that **all game logic is pure and framework-free**, which
makes it fully unit-testable and keeps correctness bugs out of the DOM layer.

```
src/
  index.html            App shell (header, screen mount, error banner)
  main.js               Bootstrap, routing, move handling, lifecycle wiring
  styles/main.css       Kiosk-oriented, touch-friendly styling + design tokens
  lib/
    storage.js          Defensive localStorage wrapper (namespaced, never clears)
    session.js          Session lifecycle: new-on-open, archive-on-close, history
    errors.js           Global error handlers + non-blocking error banner + guard()
  games/
    index.js            Game registry (add a game once, it appears everywhere)
    target.js           Standard axe-target scoring (rings, kill shot, rounds)
    tictactoe.js        3x3 X-and-O
    connect4.js         Connect 4 with gravity + win detection (all directions)
  ui/
    render.js           Tiny DOM helpers + menu renderer
    screens.js          Per-game screen renderers (state -> DOM)
```

### Requirement coverage — "don't wipe memory" / error handling

These were called out as critical, so they are handled deliberately:

- **`localStorage.clear()` is never called anywhere.** Data is only ever removed
  one known, namespaced key at a time (`storage.js`). A stray or corrupt key can
  never wipe game data.
- **Every read/write is wrapped in try/catch.** Corrupt JSON returns a fallback
  instead of throwing; a failed write (e.g. quota) returns `false` instead of
  crashing.
- **In-progress games are persisted on every move**, so an accidental reload or
  WebView restart restores the current game rather than losing it.
- **Global `error` and `unhandledrejection` handlers** funnel to a dismissible
  on-screen banner — never `alert()` — so a stray error can't white-screen or
  freeze the projected display.
- **Illegal moves** (claiming a taken cell, dropping into a full column, playing
  after game over) throw in the logic layer and are caught + shown gently in the
  UI, never crashing the session.

### Unit testing (the "beefed up" requirement)

- **45 tests across 5 files**, all passing.
- Coverage on the logic layer (`games/` + `lib/`): **~87% lines, ~91% branches,
  96% funcs.** A threshold floor (70% lines/statements/functions, 60% branches)
  is enforced by `vite.config.js`, so coverage can't silently rot.
- Tests cover: storage fallback/quota/corruption, session new-on-open &
  archive-on-close & history cap, and full rules + win/draw/illegal-move
  handling for all three games.

### Verified working

```
npm test            → 45 passed
npm run lint        → clean
npm run build       → dist/ produced successfully
npm run test:coverage → thresholds met
```

---

## 3. How to run it

```bash
npm install          # already done
npm run dev          # open the printed localhost URL in a browser to play
npm test             # run unit tests
npm run test:coverage
npm run lint         # check coding standards
npm run lint:fix     # auto-fix lint + formatting
npm run build        # production build into dist/
```

---

## 4. Next steps — to turn this into a Play Store app

These are **not yet done** and are the natural next chunk of work.

### A. Add the Android native project (Capacitor)

Requires **Android Studio + JDK 17** installed on this machine.

```bash
npm run build             # produce dist/
npm run cap:add:android   # creates the ./android native project (one time)
npm run cap:sync          # build + copy web assets into android/
npm run cap:open          # open the project in Android Studio
```

Then in Android Studio: run on a device/emulator, and use **Build → Generate
Signed Bundle / APK** to produce a release **.aab** for the Play Store.

### B. Kiosk / projection hardening (recommended before launch)

- **Keep the screen awake** — add `@capacitor-community/keep-awake` (or set
  `FLAG_KEEP_SCREEN_ON`) so the tablet never sleeps mid-game.
- **Fullscreen / immersive mode** so the projected feed has no status bars.
- **Lock orientation** (likely landscape) in `AndroidManifest.xml`.
- Consider Android **screen pinning / kiosk mode** so customers can't leave the
  app.

### C. Play Store listing requirements

- **App icons & splash screen** (`@capacitor/assets` can generate all sizes).
- **`appId`** is currently `com.hitz.axethrow` — confirm/rename before first
  upload (it's permanent once published).
- **Version code / name** bump strategy in `android/app/build.gradle`.
- **Signing keystore** — create and store it safely (never commit it; it's
  already in `.gitignore`).
- **Privacy policy** — the Play Console requires one even for a local-only app.
  (Ours collects nothing and stores everything locally, which makes this easy.)

### D. Product features still open (design decisions for you)

- **Player name entry** — currently defaults to "Player 1 / Player 2".
- **Configurable round count / rules** for Target (hardcoded to 5 rounds now).
- **Rematch / new-game button** on the game-over screen.
- **A "session history" view** (data is already archived; there's no UI yet).
- **Sound / haptic feedback** on scoring (nice for a live venue).
- Confirm the **exact Target scoring ruleset** — I used a common WATL-style
  ring set (6 / 4 / 3 / 2 / 1 / 0, kill shot 8 on the final round). Adjust
  `src/games/target.js` (`RING_VALUES`, `KILL_SHOT_VALUE`) to match your house
  rules.

### E. Testing gaps to close

- **DOM/UI tests** for `main.js`, `ui/render.js`, `ui/screens.js` (rendering,
  click → move → re-render, back button). Excluded from the coverage floor for
  now; the logic layer is what's enforced.
- **End-to-end smoke test** on the actual tablet + Chromecast projection.

---

## 5. Known notes

- **`npm audit`** reports vulnerabilities in **dev-only, transitive** packages
  (e.g. `node-tar` pulled in by the Capacitor CLI). These are build-time
  tooling, **not shipped in the app bundle**. `npm audit fix --force` would
  downgrade/break Capacitor, so it was intentionally not run. Revisit when
  Capacitor releases updated tooling.
- **App ID / name** in `capacitor.config.json` are placeholders — set the real
  values before the Android project is generated.
- The viewport is intentionally locked (no pinch-zoom) for kiosk use; editor
  accessibility linters flag this, which is expected for a projected display.

---

_Generated as the initial scaffold. Logic, storage, sessions, error handling,
and unit tests are in place and verified. The remaining work is native Android
packaging + product polish, listed above._
