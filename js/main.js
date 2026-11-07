// Boot, main loop and resize. Simulation runs on a fixed timestep; rendering runs once per rAF.
import { OWNER } from '../config.js';
import { createLayout, computeLayout } from './layout.js';
import { HEAP, RING_CHANNELS, byId, setValue } from './channels.js';
import { FrameClock } from './signals/frame.js';
import { createGrid } from './render/grid.js';
import { createType } from './render/type.js';
import { createRings } from './render/rings.js';
import { createCore } from './render/core.js';
import { createLabels } from './render/labels.js';
import { createHud } from './render/hud.js';

const CONFIG = {
  MAX_DPR: 2,          // above 2 the fill cost grows faster than anyone can see the difference
  STEP: 1 / 120,       // fixed sim step; 120 Hz keeps motion smooth on high-refresh screens
  MAX_FRAME: 0.25,     // s; clamp long gaps (debugger, tab thaw) so the sim cannot spiral
  VALUE_HZ: 5,         // numeric readout refresh rate; faster just flickers
  REDUCED_MOTION: 0.25 // speed multiplier for decorative motion under prefers-reduced-motion
};

function showFallback(message) {
  const box = document.getElementById('fallback');
  const msg = document.getElementById('fallback-msg');
  if (!box || !msg) return;
  msg.textContent = message;
  box.hidden = false;
}

function boot() {
  const canvas = document.getElementById('stage');
  const ctx = canvas && canvas.getContext ? canvas.getContext('2d', { alpha: false }) : null;
  if (!ctx) {
    showFallback('This page draws with Canvas 2D, which this browser does not provide.');
    return;
  }

  const back = document.getElementById('backlink');
  if (back) back.href = OWNER.portfolioUrl;

  const L = createLayout(RING_CHANNELS.length);
  const clock = new FrameClock();
  const grid = createGrid();
  const type = createType();
  const rings = createRings(RING_CHANNELS.length);
  const core = createCore();
  const labels = createLabels(HEAP, RING_CHANNELS);
  const hud = createHud();
  const frameCh = byId('frame');

  let raf = 0;
  let acc = 0;
  let simT = 0;
  let nextValue = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.MAX_DPR);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    computeLayout(L, w, h, dpr);
    grid.build(L);
    labels.invalidate();
  }

  // devicePixelRatio changes (zoom, moving between monitors) do not always fire resize.
  function watchDpr() {
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener('change', () => { resize(); watchDpr(); }, { once: true });
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  function applyMotion() {
    L.motion = reduced.matches ? CONFIG.REDUCED_MOTION : 1;
  }

  function update(dt) {
    simT += dt;
    type.update(dt, L.motion);
    rings.update(dt, L.motion);
    core.update(dt, L.motion);
  }

  function render(now) {
    grid.draw(ctx, L);
    type.draw(ctx, L, simT);
    rings.draw(ctx, L, clock);
    core.draw(ctx, L);
    labels.draw(ctx, L);
    hud.draw(ctx, L, now);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dMs = clock.tick(now);
    acc += Math.min(dMs / 1000, CONFIG.MAX_FRAME);
    while (acc >= CONFIG.STEP) {
      update(CONFIG.STEP);
      acc -= CONFIG.STEP;
    }
    if (now >= nextValue && clock.count > 0) {
      setValue(frameCh, `${clock.smoothed.toFixed(1)}MS`);
      nextValue = now + 1000 / CONFIG.VALUE_HZ;
    }
    render(now);
  }

  function start() {
    if (raf) return;
    clock.reset();
    acc = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  window.addEventListener('resize', resize);
  reduced.addEventListener('change', applyMotion);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  applyMotion();
  resize();
  watchDpr();
  if (!document.hidden) start();
}

try {
  boot();
} catch (err) {
  showFallback('The display could not start in this browser. Try a current version of Chrome, Firefox or Safari.');
  // Surface the cause for whoever is debugging; the viewer sees the message above.
  console.warn(err);
}
