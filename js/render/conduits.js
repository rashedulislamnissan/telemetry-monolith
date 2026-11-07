// Vector conduits: one curved path per channel from the screen edge into its ring.
// Every particle travels one of these. The dash flow is decorative and carries no label;
// the pulse brightness comes only from real particles passing through.
import { PALETTE } from './palette.js';

const CONFIG = {
  // Entry angle per channel in degrees (0 = right, 90 = down). The top wedge stays clear
  // for the label spine; 'system' (device, visibility) points toward the device panel.
  ANGLES: {
    system: -40, ping: -10, input: 20, mutation: 50, frame: 80,
    interaction: 110, heap: 140, longtask: 170, paint: 200, resource: 230,
  },
  EDGE_INSET: 0.5,     // origin inset from the screen edge, as a share of the margin
  CURVE: 0.08,         // sideways bow as a share of conduit length
  NARROW_X: 0.25,      // on narrow screens, origins lean vertical so side conduits are not stubs
  NARROW_Y: 0.5,
  BASE_ALPHA: 0.13,
  FLOW_ALPHA: 0.22,
  PULSE_DECAY: 3.0,    // per second
  PULSE_ALPHA: 0.6,
  PORT: 2.5,           // half-size of the square origin marker
  FLOW_SPEED: 22,      // px/s of the decorative dash flow
};

const IDS = Object.keys(CONFIG.ANGLES);
const DASH = [2, 7];
const NO_DASH = [];

export function createConduits(ringIds) {
  const list = IDS.map((id, i) => ({
    id,
    angle: (CONFIG.ANGLES[id] * Math.PI) / 180,
    ring: ringIds.indexOf(id),   // -1 for heap (core) and system
    bow: i % 2 === 0 ? 1 : -1,
    x0: 0, y0: 0, x1: 0, y1: 0, x2: 0, y2: 0,
    // Resting control point; M4 bends x1/y1 away from it toward the cursor.
    rx1: 0, ry1: 0,
    len: 0,
    pulse: 0,
    fault: 0,
    nextFree: 0,                 // sim time when the next particle may enter (staggers bursts)
  }));
  const index = Object.create(null);
  for (let i = 0; i < list.length; i++) index[list[i].id] = i;
  let flow = 0;

  function layout(L) {
    const a = L.margin * CONFIG.EDGE_INSET;
    for (const c of list) {
      const ca = Math.cos(c.angle);
      const sa = Math.sin(c.angle);
      const r = c.id === 'heap' ? L.coreR : c.ring >= 0 ? L.ringR[c.ring] : L.R;
      c.x2 = L.cx + r * ca;
      c.y2 = L.cy + r * sa;

      let dx = ca;
      let dy = sa;
      if (L.narrow) {
        dx = ca * CONFIG.NARROW_X;
        dy = sa + (sa >= 0 ? CONFIG.NARROW_Y : -CONFIG.NARROW_Y);
      }
      // Ray from the core to the inset screen rectangle.
      let t = Infinity;
      if (dx > 1e-6) t = Math.min(t, (L.w - a - L.cx) / dx);
      if (dx < -1e-6) t = Math.min(t, (a - L.cx) / dx);
      if (dy > 1e-6) t = Math.min(t, (L.h - a - L.cy) / dy);
      if (dy < -1e-6) t = Math.min(t, (a - L.cy) / dy);
      c.x0 = L.cx + dx * t;
      c.y0 = L.cy + dy * t;

      const mx = (c.x0 + c.x2) / 2;
      const my = (c.y0 + c.y2) / 2;
      const vx = c.x2 - c.x0;
      const vy = c.y2 - c.y0;
      const chord = Math.hypot(vx, vy) || 1;
      const k = (CONFIG.CURVE * c.bow);
      c.rx1 = c.x1 = mx - vy * k;
      c.ry1 = c.y1 = my + vx * k;
      c.len = chord * 1.02;
    }
  }

  function indexFor(ch) {
    const i = index[ch];
    return i === undefined ? index.system : i;
  }

  // Quadratic Bezier; writes into `out` so callers never allocate.
  function point(c, s, out) {
    const u = 1 - s;
    out.x = u * u * c.x0 + 2 * u * s * c.x1 + s * s * c.x2;
    out.y = u * u * c.y0 + 2 * u * s * c.y1 + s * s * c.y2;
  }

  function pulse(i, amount, fault) {
    const c = list[i];
    c.pulse = Math.min(1, c.pulse + amount);
    if (fault) c.fault = 1;
  }

  function update(dt, motion) {
    flow = (flow + CONFIG.FLOW_SPEED * dt * motion) % 9;
    const k = Math.exp(-CONFIG.PULSE_DECAY * dt);
    for (const c of list) {
      c.pulse *= k;
      c.fault *= k;
    }
  }

  function trace(ctx, c) {
    ctx.moveTo(c.x0, c.y0);
    ctx.quadraticCurveTo(c.x1, c.y1, c.x2, c.y2);
  }

  function draw(ctx) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = PALETTE.bone;

    ctx.globalAlpha = CONFIG.BASE_ALPHA;
    ctx.beginPath();
    for (const c of list) trace(ctx, c);
    ctx.stroke();

    ctx.setLineDash(DASH);
    ctx.lineDashOffset = -flow;
    ctx.globalAlpha = CONFIG.FLOW_ALPHA;
    ctx.beginPath();
    for (const c of list) trace(ctx, c);
    ctx.stroke();
    ctx.setLineDash(NO_DASH);

    // Origin ports.
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = PALETTE.bone;
    const p = CONFIG.PORT;
    for (const c of list) ctx.fillRect(c.x0 - p, c.y0 - p, p * 2, p * 2);

    // Pulses from real traffic, additive.
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.5;
    for (const c of list) {
      const a = Math.max(c.pulse, c.fault);
      if (a < 0.02) continue;
      ctx.strokeStyle = c.fault > c.pulse ? PALETTE.fault : PALETTE.sodium;
      ctx.globalAlpha = a * CONFIG.PULSE_ALPHA;
      ctx.beginPath();
      trace(ctx, c);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = prev;
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  }

  return { list, layout, indexFor, point, pulse, update, draw };
}
