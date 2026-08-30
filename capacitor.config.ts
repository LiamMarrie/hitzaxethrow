import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor config.
 *
 * Offline (default): the app loads the bundled web assets from `dist`. This is
 * what ships and what a kiosk should run.
 *
 * Live reload (set CAP_LIVE=1 before `cap sync`): the WebView instead points at
 * the Vite dev server so code changes hot-reload on the device with no rebuild.
 * Use the `android:live` npm script — it sets CAP_LIVE for you. The URL targets
 * the Android emulator (10.0.2.2 is the emulator's alias for the host's
 * localhost). For a physical device, override the host via CAP_LIVE_HOST.
 */
const config: CapacitorConfig = {
  appId: 'com.hitz.axethrow',
  appName: 'Axe Throw Scoreboard',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

if (process.env.CAP_LIVE === '1') {
  const host = process.env.CAP_LIVE_HOST || '10.0.2.2';
  const port = process.env.CAP_LIVE_PORT || '5173';
  config.server = {
    url: `http://${host}:${port}`,
    cleartext: true,
  };
  // The dev server is plain http; allow it through the https-scheming WebView.
  config.android!.allowMixedContent = true;
}

export default config;
