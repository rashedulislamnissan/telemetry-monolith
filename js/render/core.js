// The central geometric core: two counter-rotating hexagons with spokes.
// Its size follows the real JS heap where exposed, and it pulses on real interactions.
import { PALETTE, TAU } from './palette.js';

const CONFIG = {
  SIDES: 6,
  SPIN: 0.12,          // rad/s, outer hexagon
  INNER_SPIN: -0.2,    // rad/s, inner hexagon turns the other way
  INNER: 0.55,         // inner hexagon radius as a share of the core radius
  FILL_ALPHA: 0.05,
  OUTER_ALPHA: 0.9,
  INNER_ALPHA: 0.4,
  SPOKE_ALPHA: 0.22,
  VERTEX_TICK: 6,      // px, outward marks at each outer vertex

  HEAP_MIN_SCALE: 0.8, // core scale at the smallest heap seen this session
  HEAP_MAX_SCALE: 1.2, // and at the largest
  HEAP_MIN_SPAN: 1048576, // bytes; below this range the core holds mid-size instead of jittering
  SCALE_EASE: 3,       // per second, how fast size follows the heap
  PULSE_DECAY: 4,      // per second
  PULSE_GROW: 0.14,    // extra scale at full pulse
  GLOW_ALPHA: 0.16,    // amber fill when the heap is live, plus pulse
};

function polygon(ctx, cx, cy, r, a, n) {
  ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  for (let i = 1; i < n; i++) {
    const t = a + (i * TAU) / n;
    ctx.lineTo(cx + r * Math.cos(t), cy + r * Math.sin(t));
  }
  ctx.closePath();
}

export function createCore() {
  const state = {
    a: -Math.PI / 2, b: 0,
    scale: 1, target: 1,
    pulse: 0, fault: 0,
    live: false,         // true once a real heap reading arrives
    lo: Infinity, hi: 0, // session min/max heap, bytes
  };

  // Called with a real usedJSHeapSize reading.
  function setHeap(used) {
    state.live = true;
    state.lo = Math.min(state.lo, used);
    state.hi = Math.max(state.hi, used);
    const span = state.hi - state.lo;
    const k = span < CONFIG.HEAP_MIN_SPAN ? 0.5 : (used - state.lo) / span;
    state.target = CONFIG.HEAP_MIN_SCALE + (CONFIG.HEAP_MAX_SCALE - CONFIG.HEAP_MIN_SCALE) * k;
  }

  function pulse(amount, fault) {
    if (fault) state.fault = Math.min(1, state.fault + amount);
    else state.pulse = Math.min(1, state.pulse + amount);
  }

  function update(dt, motion) {
    state.a = (state.a + CONFIG.SPIN * dt * motion) % TAU;
    state.b = (state.b + CONFIG.INNER_SPIN * dt * motion) % TAU;
    state.scale += (state.target - state.scale) * (1 - Math.exp(-CONFIG.SCALE_EASE * dt));
    const k = Math.exp(-CONFIG.PULSE_DECAY * dt);
    state.pulse *= k;
    state.fault *= k;
  }

  function draw(ctx, L) {
    const { cx, cy } = L;
    const p = Math.max(state.pulse, state.fault);
    const r = L.coreR * state.scale * (1 + CONFIG.PULSE_GROW * p);
    const ri = r * CONFIG.INNER;
    const n = CONFIG.SIDES;

    // Amber only once the heap is real data; otherwise the core is structure in Bone.
    if (state.live || p > 0.02) {
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = state.fault > state.pulse ? PALETTE.fault : PALETTE.sodium;
      ctx.globalAlpha = (state.live ? CONFIG.GLOW_ALPHA : 0) + p * 0.35;
      ctx.beginPath();
      polygon(ctx, cx, cy, r, state.a, n);
      ctx.fill();
      ctx.globalCompositeOperation = prev;
    }

    ctx.fillStyle = PALETTE.bone;
    ctx.strokeStyle = PALETTE.bone;

    ctx.globalAlpha = CONFIG.FILL_ALPHA;
    ctx.beginPath();
    polygon(ctx, cx, cy, r, state.a, n);
    ctx.fill();

    ctx.globalAlpha = CONFIG.SPOKE_ALPHA;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const t = state.a + (i * TAU) / n;
      ctx.moveTo(cx + ri * Math.cos(t), cy + ri * Math.sin(t));
      ctx.lineTo(cx + r * Math.cos(t), cy + r * Math.sin(t));
    }
    ctx.stroke();

    ctx.globalAlpha = CONFIG.INNER_ALPHA;
    ctx.beginPath();
    polygon(ctx, cx, cy, ri, state.b, n);
    ctx.stroke();

    ctx.globalAlpha = CONFIG.OUTER_ALPHA;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    polygon(ctx, cx, cy, r, state.a, n);
    for (let i = 0; i < n; i++) {
      const t = state.a + (i * TAU) / n;
      const c = Math.cos(t);
      const s = Math.sin(t);
      ctx.moveTo(cx + (r + 3) * c, cy + (r + 3) * s);
      ctx.lineTo(cx + (r + 3 + CONFIG.VERTEX_TICK) * c, cy + (r + 3 + CONFIG.VERTEX_TICK) * s);
    }
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  }

  return { update, draw, setHeap, pulse };
}
