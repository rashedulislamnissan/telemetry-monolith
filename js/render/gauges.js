// Cursor kinematics gauges under the session clock: velocity, acceleration, jerk.
// Real values from pointermove (0 when the cursor is still), log-scaled bars with
// a peak-hold tick so a fast flick visibly spikes and then settles.
import { PALETTE } from './palette.js';

const CONFIG = {
  TEXT_HZ: 10,          // numeric refresh; bars move every frame
  BAR_W_WIDE: 72,
  BAR_W_NARROW: 40,
  BAR_H: 3,
  PEAK_DECAY: 0.5,      // per second, peak-hold tick falls this share of full scale
  TOP_LINES: 2.8,       // first row sits this many HUD lines below the margin
};

// full = value at which the bar is full (log scale from 1).
const ROWS = [
  { name: 'VEL', unit: 'PX/S', key: 'speed', full: 1e4 },
  { name: 'ACC', unit: 'PX/S²', key: 'accel', full: 1e6 },
  { name: 'JERK', unit: 'PX/S³', key: 'jerk', full: 1e8 },
];

function fmtSI(v) {
  const a = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (a < 1000) return sign + Math.round(a);
  if (a < 1e6) return `${sign}${(a / 1e3).toFixed(1)}K`;
  return `${sign}${(a / 1e6).toFixed(1)}M`;
}

export function createGauges() {
  const level = new Float32Array(ROWS.length);
  const peak = new Float32Array(ROWS.length);
  const text = ROWS.map(() => '0');
  let nextText = 0;
  let font = '';
  let nameW = 0;

  function draw(ctx, L, s, now, na) {
    ctx.font = L.hudFont;
    if (font !== L.hudFont) {
      font = L.hudFont;
      nameW = ctx.measureText('JERK ').width;
    }
    const refresh = now >= nextText;
    if (refresh) nextText = now + 1000 / CONFIG.TEXT_HZ;

    const lh = Math.round(L.hudPx * 1.6);
    const x = L.margin;
    const barW = L.narrow ? CONFIG.BAR_W_NARROW : CONFIG.BAR_W_WIDE;
    const barX = x + nameW;
    const valX = barX + barW + L.hudPx * 0.8;
    let y = L.margin + Math.round(lh * CONFIG.TOP_LINES);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (let i = 0; i < ROWS.length; i++) {
      const r = ROWS[i];
      const v = s[r.key];
      const k = Math.min(1, Math.log10(1 + Math.abs(v)) / Math.log10(r.full));
      level[i] = k;
      peak[i] = Math.max(k, peak[i] - CONFIG.PEAK_DECAY / 60);
      if (refresh) text[i] = na ? 'N/A' : `${fmtSI(v)} ${r.unit}`;

      ctx.fillStyle = PALETTE.ash;
      ctx.fillText(r.name, x, y);

      const by = y + Math.round(L.hudPx / 2) - 1;
      ctx.fillStyle = PALETTE.graphite;
      ctx.fillRect(barX, by, barW, CONFIG.BAR_H);
      if (!na) {
        ctx.fillStyle = PALETTE.sodium;
        ctx.fillRect(barX, by, barW * level[i], CONFIG.BAR_H);
        ctx.fillStyle = PALETTE.bone;
        ctx.fillRect(barX + Math.max(0, barW * peak[i] - 1), by - 2, 1.5, CONFIG.BAR_H + 4);
      }

      ctx.fillStyle = na ? PALETTE.ash : v === 0 ? PALETTE.ash : PALETTE.sodium;
      ctx.fillText(text[i], valX, y);
      y += lh;
    }
  }

  return { draw };
}
