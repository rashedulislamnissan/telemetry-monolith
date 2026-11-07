// Corner readouts. Top-left: identity and session clock (real performance.now()).
import { PALETTE } from './palette.js';

const CONFIG = {
  TITLE: 'TELEMETRY MONOLITH',
  CLOCK_HZ: 10,   // session clock refresh; the string is rebuilt only this often
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
    ctx.fillStyle = PALETTE.ash;
    ctx.fillText('SESSION', x, y + lh);
    ctx.fillStyle = PALETTE.sodium;
    ctx.fillText(clockText, x + L.hudPx * 5.4, y + lh);
  }

  return { draw };
}
