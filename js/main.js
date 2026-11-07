// Boot, main loop and resize. Simulation runs on a fixed timestep; rendering runs once per rAF.
import { OWNER } from '../config.js';
import { createLayout, computeLayout } from './layout.js';
import { HEAP, RING_CHANNELS, byId, setValue, NA } from './channels.js';
import { createBus, STATUS } from './signals/bus.js';
import { startSignals } from './signals/index.js';
import { FrameClock } from './signals/frame.js';
import { startDebug } from './debug.js';
import { createGrid } from './render/grid.js';
import { createType } from './render/type.js';
import { createRings } from './render/rings.js';
import { createCore } from './render/core.js';
import { createLabels } from './render/labels.js';
import { createHud } from './render/hud.js';
import { createDevicePanel } from './render/device.js';
import { createConduits } from './render/conduits.js';
import { createParticles } from './render/particles.js';
import { createEffects } from './render/effects.js';

const CONFIG = {
  MAX_DPR: 2,          // above 2 the fill cost grows faster than anyone can see the difference
  STEP: 1 / 120,       // fixed sim step; 120 Hz keeps motion smooth on high-refresh screens
  MAX_FRAME: 0.25,     // s; clamp long gaps (debugger, tab thaw) so the sim cannot spiral
  REDUCED_MOTION: 0.25,// speed multiplier for decorative motion under prefers-reduced-motion
  REDUCED_FLASH: 0.5,  // flash strength under reduced motion (shockwaves are skipped entirely)
  SAMPLE_FLASH: 0.3,   // ring flash strength for routine periodic samples
};

// Event types that arrive on a timer rather than because something happened.
const SAMPLE_TYPES = new Set(['frame', 'heap', 'ping']);

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

  const L = createLayout(RING_CHANNELS.length);
  const clock = new FrameClock();
  const bus = createBus();
  const grid = createGrid();
  const type = createType();
  const rings = createRings(RING_CHANNELS);
  const core = createCore();
  const labels = createLabels(HEAP, RING_CHANNELS);
  const hud = createHud();
  const devicePanel = createDevicePanel();
  const conduits = createConduits(RING_CHANNELS.map((c) => c.id));
  const particles = createParticles(conduits);
  const effects = createEffects();

  // Channel readouts follow the bus: latest event wins; status decides N/A.
  // Every event also becomes one particle.
  let naCount = 0;
  bus.on((e) => {
    const ch = byId(e.ch);
    if (ch && ch.status !== STATUS.UNSUPPORTED) setValue(ch, e.readout, true, e.fault);
    particles.spawn(e, L.motion);
  });

  // What a particle's arrival does. Every reaction is caused by that particle's real event.
  particles.onArrive = (p) => {
    const full = L.motion >= 1;
    const amp = full ? 1 : CONFIG.REDUCED_FLASH;
    const c = conduits.list[p.conduit];
    // Periodic samples arrive every 0.5-1 s; full flashes for them would never settle.
    const soft = !p.fault && SAMPLE_TYPES.has(p.type);
    if (c.ring >= 0) rings.flash(c.ring, p.fault, amp * (soft ? CONFIG.SAMPLE_FLASH : 1));
    switch (p.ch) {
      case 'heap':
        if (p.raw && typeof p.raw.usedJSHeapSize === 'number') core.setHeap(p.raw.usedJSHeapSize);
        core.pulse((p.type === 'gc' ? 0.6 : 0.15) * amp);
        break;
      case 'interaction':
        core.pulse(0.8 * amp);
        break;
      case 'longtask':
        core.pulse(0.8 * amp, true);
        if (full) effects.wave(L.coreR, L.R * 1.25, 0.8, true, 3);
        break;
      case 'ping':
        if (full) effects.wave(L.ringR[c.ring], L.ringR[c.ring] + L.ringGap * 1.6, 0.6, p.fault, 1, p.fault ? 1 : 0.4);
        break;
      default:
        break;
    }
  };
  bus.onStatus((id, st) => {
    const ch = byId(id);
    if (!ch) return;
    ch.status = st.state;
    if (st.state === STATUS.UNSUPPORTED) setValue(ch, NA, false);
    naCount = 0;
    if (HEAP.status === STATUS.UNSUPPORTED) naCount++;
    for (const c of RING_CHANNELS) if (c.status === STATUS.UNSUPPORTED) naCount++;
  });

  // Test hook (debug only): lets automated checks compare particle labels with bus events.
  if (startDebug(bus)) window.__particles = particles;
  const signals = startSignals(bus, clock);

  const back = document.getElementById('backlink');
  if (back) back.href = OWNER.portfolioUrl;

  let raf = 0;
  let acc = 0;
  let simT = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.MAX_DPR);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    computeLayout(L, w, h, dpr);
    grid.build(L);
    conduits.layout(L);
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
    conduits.update(dt, L.motion);
    effects.update(dt);
    particles.update(dt, L);
  }

  function render(now) {
    grid.draw(ctx, L);
    type.draw(ctx, L, simT);
    conduits.draw(ctx);
    rings.draw(ctx, L, clock);
    effects.draw(ctx, L);
    core.draw(ctx, L);
    labels.draw(ctx, L);
    particles.draw(ctx, L);
    hud.draw(ctx, L, now);
    devicePanel.draw(ctx, L, naCount > 0);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dMs = clock.tick(now);
    acc += Math.min(dMs / 1000, CONFIG.MAX_FRAME);
    while (acc >= CONFIG.STEP) {
      update(CONFIG.STEP);
      acc -= CONFIG.STEP;
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
    if (document.hidden) {
      stop();
      signals.pause();
    } else {
      signals.resume();
      start();
    }
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
