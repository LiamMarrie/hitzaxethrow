import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Vite build config.
// `base: './'` produces relative asset paths, which is REQUIRED for the
// Capacitor Android WebView (it loads from the file:// / https://localhost
// scheme, so absolute "/" paths would break).
export default defineConfig({
  base: './',
  root: 'src',
  publicDir: '../public',
  server: {
    // Listen on all interfaces + a fixed port so the Android emulator's WebView
    // can reach the dev server at http://10.0.2.2:5173 for Capacitor live reload.
    // `strictPort` fails loudly rather than silently picking a port the app
    // isn't pointed at (see capacitor.config.dev.json).
    host: true,
    port: 5173,
    strictPort: true,
  },
  build: {
    // Capacitor's `webDir` points here (see capacitor.config.json).
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: true,
  },
  test: {
    // Vitest runs against a jsdom environment so DOM-touching code is testable.
    // `root` is pinned to the project dir (not Vite's `root: 'src'`) so test
    // and coverage globs resolve from the repository root.
    root: fileURLToPath(new URL('.', import.meta.url)),
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js', 'src/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      // Coverage is enforced on the pure logic layer (games + lib), which is
      // where correctness bugs would hurt. The DOM wiring (main.js, ui/*, the
      // games registry) is thin glue exercised by running the app; adding DOM
      // tests for it is a documented next step (see PROJECT_SETUP.md).
      include: ['src/games/*.js', 'src/lib/*.js'],
      exclude: ['src/games/index.js', 'src/**/*.test.js'],
      // Enforce a floor so the "beefed up testing" requirement doesn't rot.
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
});
