// Orbital rings: one per signal channel. Rotation and tick patterns are decorative
// and carry no data. The FRAME ring is the exception: its ticks are real rAF deltas.
import { PALETTE, TAU } from './palette.js';

const CONFIG = {
  // Per ring, inner to outer. segs = arc segments (0 = full circle).
  STYLES: [
    { ticks: 36, len: 3, major: 3, speed: 0.10, segs: 0 },    // interaction
    { ticks: 0, len: 0, major: 0, speed: 0, segs: 0 },        // frame (histogram)
    { ticks: 72, len: 4, major: 6, speed: -0.04, segs: 3 },   // longtask
    { ticks: 24, len: 7, major: 2, speed: 0.06, segs: 0 },    // paint
    { ticks: 120, len: 2, major: 10, speed: -0.02, segs: 0 }, // mutation
    { ticks: 48, len: 5, major: 4, speed: 0.03, segs: 6 },    // input
    { ticks: 90, len: 3, major: 15, speed: -0.05, segs: 0 },  // ping
    { ticks: 180, len: 4, major: 15, speed: 0.012, segs: 2 }, // resource
  ],
  ARC_ALPHA: 0.2,
  MINOR_ALPHA: 0.34,
  MAJOR_ALPHA: 0.62,
  MAJOR_LEN: 2.2,     // major tick length multiplier
  SEG_FILL: 0.82,     // share of each segment that is drawn; the rest is the gap

  FRAME_INDEX: 1,
  HIST_FULL_MS: 50,   // frame time that fills a histogram tick to full length
  HIST_FAULT_MS: 25,  // ~1.5x the 60 Hz budget: slower frames read as dropped
  HIST_RECENT: 60,    // newest N frames are drawn brighter
  HIST_LEN: 0.8,      // full tick length as a share of the gap to the next ring
};

export function createRings(count) {
  const angle = new Float32Array(count);

  function update(dt, motion) {
    for (let i = 0; i < count; i++) {
      angle[i] = (angle[i] + CONFIG.STYLES[i].speed * dt * motion) % TAU;
    }
  }

  function drawStructure(ctx, L) {
    const { cx, cy } = L;
    ctx.strokeStyle = PALETTE.bone;
    ctx.lineWidth = 1;

    // Ring arcs, all in one path.
    ctx.globalAlpha = CONFIG.ARC_ALPHA;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const r = L.ringR[i];
      const s = CONFIG.STYLES[i];
      if (s.segs === 0) {
        ctx.moveTo(cx + r, cy);
        ctx.arc(cx, cy, r, 0, TAU);
      } else {
        const step = TAU / s.segs;
        for (let k = 0; k < s.segs; k++) {
          const a0 = angle[i] + k * step;
          ctx.moveTo(cx + r * Math.cos(a0), cy + r * Math.sin(a0));
          ctx.arc(cx, cy, r, a0, a0 + step * CONFIG.SEG_FILL);
        }
      }
    }
    ctx.stroke();

    // Ticks point inward; minor and major are separate paths so each gets one stroke.
    for (let pass = 0; pass < 2; pass++) {
      const major = pass === 1;
      ctx.globalAlpha = major ? CONFIG.MAJOR_ALPHA : CONFIG.MINOR_ALPHA;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const s = CONFIG.STYLES[i];
        if (s.ticks === 0) continue;
        const r = L.ringR[i];
        const len = major ? s.len * CONFIG.MAJOR_LEN : s.len;
        const step = TAU / s.ticks;
        for (let k = 0; k < s.ticks; k++) {
          if ((k % s.major === 0) !== major) continue;
          const a = angle[i] + k * step;
          const c = Math.cos(a);
          const sn = Math.sin(a);
          ctx.moveTo(cx + r * c, cy + r * sn);
          ctx.lineTo(cx + (r - len) * c, cy + (r - len) * sn);
        }
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Radial histogram: each slot is one real frame. Slots are fixed; the write head sweeps.
  function drawFrameHistogram(ctx, L, clock) {
    const { cx, cy } = L;
    const r = L.ringR[CONFIG.FRAME_INDEX];
    const maxLen = L.ringGap * CONFIG.HIST_LEN;
    const n = clock.size;
    const step = TAU / n;
    const base = -Math.PI / 2;
    const lw = Math.max(1, Math.min(2, ((TAU * r) / n) * 0.45));

    ctx.lineWidth = lw;
    // pass 0 = older frames, 1 = recent frames, 2 = dropped frames
    for (let pass = 0; pass < 3; pass++) {
      ctx.beginPath();
      for (let j = 0; j < clock.count; j++) {
        const ms = clock.hist[j];
        const age = (clock.head - 1 - j + n) % n;
        const fault = ms > CONFIG.HIST_FAULT_MS;
        const want = fault ? 2 : age < CONFIG.HIST_RECENT ? 1 : 0;
        if (want !== pass) continue;
        const len = Math.min(1, ms / CONFIG.HIST_FULL_MS) * maxLen;
        const a = base + j * step;
        const c = Math.cos(a);
        const s = Math.sin(a);
        ctx.moveTo(cx + r * c, cy + r * s);
        ctx.lineTo(cx + (r + len) * c, cy + (r + len) * s);
      }
      if (pass === 2) {
        ctx.strokeStyle = PALETTE.fault;
        ctx.globalAlpha = 0.95;
      } else {
        ctx.strokeStyle = PALETTE.sodium;
        ctx.globalAlpha = pass === 1 ? 0.95 : 0.4;
      }
      ctx.stroke();
    }

    // Write head.
    const a = base + clock.head * step;
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = PALETTE.bone;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + (r - 4) * Math.cos(a), cy + (r - 4) * Math.sin(a));
    ctx.lineTo(cx + (r + maxLen) * Math.cos(a), cy + (r + maxLen) * Math.sin(a));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function draw(ctx, L, clock) {
    drawStructure(ctx, L);
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    drawFrameHistogram(ctx, L, clock);
    ctx.globalCompositeOperation = prev;
  }

  return { update, draw };
}
