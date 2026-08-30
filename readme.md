# Axe Throw Scoreboard

## Fast dev loop — live reload (recommended)

Hot-reload code changes on the Android **emulator** with no rebuild/reinstall.
The WebView points at the Vite dev server, so every save updates instantly.

**One-time per live session:**

```
npm run android:live    # build + sync, points the app at http://10.0.2.2:5173
# install the app ONCE (only needed when the app isn't already installed
# in live mode): cd android ; .\gradlew.bat installDebug   — or Run ▶ in Android Studio
npm run dev             # start Vite (leave it running)
```

Now edit files and save — the emulator reloads automatically. Keep `npm run dev`
running; you do NOT need to sync or reinstall for web/UI/logic changes.

- **Physical device instead of emulator:** the emulator alias `10.0.2.2` won't
  work. Point at your PC's LAN IP: `set CAP_LIVE_HOST=192.168.x.x` before
  `npm run android:live`, make sure the device is on the same Wi-Fi, then
  reinstall once. (`CAP_LIVE_PORT` overrides the port if 5173 is taken.)

## Going back to a real (offline) build

Live mode bakes the dev-server URL into the app. Before shipping, or to run the
app standalone (no PC/dev server), switch back to the bundled assets:

```
npm run android:offline # build + sync with assets bundled into the app
cd android ; .\gradlew.bat installDebug   # or Run ▶ in Android Studio
```

## Manual full rebuild (the old way)

`npm run dev` alone won't update an offline-installed app. Rebuild + re-sync,
then reinstall:

```
npm run build       # rebuilds dist/
npm run cap:sync    # copies dist/ into android/
```

- then reinstall (`.\gradlew.bat installDebug` from `android/`) or hit Run in
  Android Studio.

## Notes

- Live vs. offline is controlled by the `CAP_LIVE` env var, read in
  `capacitor.config.ts`. The `android:live` / `android:offline` scripts set it
  for you — no need to hand-edit config.
