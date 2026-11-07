// Cursor reticle with a velocity tail. Drawn only while a pointer is present
// (mouse hovering, or a finger/pen down). Unlabelled: the numbers are in the gauges.
import { PALETTE } from './palette.js';

const CONFIG = {
  ARM: 7,          // px length of each crosshair arm
  GAP: 4,          // px empty centre
  TAIL_S: 0.05,    // tail length in seconds of travel
  TAIL_MAX: 140,   // px
};

export function drawReticle(ctx, s) {
  if (!s.present) return;
  const { x, y } = s;
  const a = CONFIG.ARM;
  const g = CONFIG.GAP;

  ctx.strokeStyle = PALETTE.bone;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(x - g - a, y); ctx.lineTo(x - g, y);
  ctx.moveTo(x + g, y); ctx.lineTo(x + g + a, y);
  ctx.moveTo(x, y - g - a); ctx.lineTo(x, y - g);
  ctx.moveTo(x, y + g); ctx.lineTo(x, y + g + a);
  ctx.stroke();

  if (s.speed > 1) {
    let tx = -s.vx * CONFIG.TAIL_S;
    let ty = -s.vy * CONFIG.TAIL_S;
    const len = Math.hypot(tx, ty);
    if (len > CONFIG.TAIL_MAX) {
      tx *= CONFIG.TAIL_MAX / len;
      ty *= CONFIG.TAIL_MAX / len;
    }
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + tx, y + ty);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
