// The central geometric core: two counter-rotating hexagons with spokes.
// In M2 its size follows the real JS heap; until then it is structure only.
import { PALETTE, TAU } from './palette.js';

const CONFIG = {
  SIDES: 6,
  SPIN: 0.12,         // rad/s, outer hexagon
  INNER_SPIN: -0.2,   // rad/s, inner hexagon turns the other way
  INNER: 0.55,        // inner hexagon radius as a share of the core radius
  FILL_ALPHA: 0.05,
  OUTER_ALPHA: 0.9,
  INNER_ALPHA: 0.4,
  SPOKE_ALPHA: 0.22,
  VERTEX_TICK: 6,     // px, outward marks at each outer vertex
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
  const state = { a: -Math.PI / 2, b: 0 };

  function update(dt, motion) {
    state.a = (state.a + CONFIG.SPIN * dt * motion) % TAU;
    state.b = (state.b + CONFIG.INNER_SPIN * dt * motion) % TAU;
  }

  function draw(ctx, L) {
    const { cx, cy } = L;
    const r = L.coreR;
    const ri = r * CONFIG.INNER;
    const n = CONFIG.SIDES;

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

  return { update, draw };
}
