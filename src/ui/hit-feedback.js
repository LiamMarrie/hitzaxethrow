/**
 * ui/hit-feedback.js — transient "the target was hit" feedback for the
 * ring-target boards (Axe Classic, WATL, IATF).
 *
 * Why this lives outside the board: every throw re-renders the board from state
 * (main.js does apply -> persist -> re-render), which replaces the whole SVG
 * and would instantly wipe any marker/animation drawn inside it. So instead of
 * drawing feedback in the board, we drop a short-lived overlay on <body> at the
 * tap point — the same layer the error banner and info card use. It survives the
 * re-render, is pointer-events:none so it never traps a tap, and self-removes so
 * markers never accumulate on the projected display.
 *
 * Each hit shows two things, mirroring the prototype boards: a marker ring where
 * the axe landed (the "hit" indicator) and a floating "+N" chip that rises and
 * fades (the "points" indicator).
 */

/** How long the overlay lives before it's removed (ms). Matches the CSS anim. */
const REMOVE_MS = 950;

/**
 * The colour a floating-points chip / marker uses for a given zone tone. Kept
 * here (not in CSS) so the board can pick a tone per zone without a class-per-
 * value explosion. Saturated + high-contrast for the projector, per the style
 * guide.
 * @type {Object<string,string>}
 */
const TONE_COLORS = {
  ring: '#f4f4f2', // white rings
  bull: '#ff5a4d', // red bullseye / cluster
  kill: '#4b86ef', // blue killshot / clutch
  miss: '#e8663a', // orange-red drop/miss
};

/**
 * Resolve a tone key to its colour, defaulting to the ring white.
 * @param {string} tone one of TONE_COLORS' keys
 * @returns {string}
 */
export function toneColor(tone) {
  return TONE_COLORS[tone] ?? TONE_COLORS.ring;
}

/**
 * Show a one-shot hit marker + floating points chip at a screen position.
 * No-op when there's no DOM (unit tests may run headless bits) so it can be
 * called unconditionally from the board's tap handler.
 * @param {{x:number, y:number, points:number, tone:string}} hit
 *   x,y      viewport (clientX/clientY) coordinates of the tap
 *   points   value scored (0 for a miss)
 *   tone     colour tone key (ring|bull|kill|miss)
 * @returns {void}
 */
export function showHitFeedback({ x, y, points, tone }) {
  if (typeof document === 'undefined' || !document.body) return;

  const color = toneColor(tone);
  const wrap = document.createElement('div');
  wrap.className = 'hitfx';
  wrap.style.left = `${x}px`;
  wrap.style.top = `${y}px`;
  wrap.style.setProperty('--hitfx-color', color);

  // Marker ring: shows exactly where the axe landed.
  const marker = document.createElement('div');
  marker.className = 'hitfx__marker';

  // Floating points chip: "+5", or "0" for a miss (no plus on a zero).
  const chip = document.createElement('div');
  chip.className = 'hitfx__pts';
  chip.textContent = points > 0 ? `+${points}` : String(points);

  wrap.append(marker, chip);
  document.body.append(wrap);

  // Self-remove after the animation. A timer (not animationend) is used so a
  // single removal covers both children and the reduced-motion case where no
  // animation fires at all.
  setTimeout(() => wrap.remove(), REMOVE_MS);
}
