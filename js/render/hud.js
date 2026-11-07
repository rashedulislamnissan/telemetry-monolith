// Corner readouts. Top-left: identity and session clock (real performance.now()).
import { PALETTE } from './palette.js';

const CONFIG = {
  TITLE: 'TELEMETRY MONOLITH',
  CLOCK_HZ: 10,   // session clock refresh; the string is rebuilt only this often
  MARK_R: 0.55,   // logo hexagon radius, in multiples of the HUD font size
  MARK_GAP: 8,    // px between the hexagon and the title
};

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

export function createHud() {
  let clockText = 'T+00:00.0';
  let nextClock = 0;

  function formatClock(ms) {
    const total = ms / 1000;
    const m = Math.floor(total / 60);
    const s = total - m * 60;
    const si = Math.floor(s);
    const tenth = Math.floor((s - si) * 10);
    return `T+${pad2(m)}:${pad2(si)}.${tenth}`;
  }

  function draw(ctx, L, now) {
    if (now >= nextClock) {
      clockText = formatClock(now);
      nextClock = now + 1000 / CONFIG.CLOCK_HZ;
    }
    const x = L.margin;
    const y = L.margin;
    const lh = Math.round(L.hudPx * 1.6);

    ctx.font = L.hudFont;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = PALETTE.bone;
    ctx.fillText(CONFIG.TITLE, x, y);

    // The logo's hexagon, hung in the margin so the text column stays aligned.
    // Narrow screens have no margin to spare; the favicon carries the mark there.
    if (!L.narrow) {
      const r = L.hudPx * CONFIG.MARK_R;
      const mx = x - r - CONFIG.MARK_GAP;
      const my = y + L.hudPx * 0.5;
      ctx.strokeStyle = PALETTE.bone;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        if (i === 0) ctx.moveTo(mx + r * Math.cos(a), my + r * Math.sin(a));
        else ctx.lineTo(mx + r * Math.cos(a), my + r * Math.sin(a));
      }
      ctx.closePath();
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    ctx.fillStyle = PALETTE.ash;
    ctx.fillText('SESSION', x, y + lh);
    ctx.fillStyle = PALETTE.sodium;
    ctx.fillText(clockText, x + L.hudPx * 5.4, y + lh);
  }

  return { draw };
}
