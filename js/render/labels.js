// Channel labels. Each ring's name sits on that ring at 12 o'clock and knocks out the
// line beneath it, so the labels form one vertical spine above the core.
import { PALETTE } from './palette.js';

const CONFIG = {
  PAD_X: 4,     // knockout padding around the text
  PAD_Y: 2,
  GAP: 0.6,     // space between name and value, in multiples of the font size
  NA_ALPHA: 0.55,
};

export function createLabels(heap, rings) {
  let font = '';
  const nameW = new Float32Array(rings.length + 1);

  function measureNames(ctx) {
    nameW[0] = ctx.measureText(heap.name).width;
    for (let i = 0; i < rings.length; i++) nameW[i + 1] = ctx.measureText(rings[i].name).width;
  }

  function drawOne(ctx, L, ch, nw, x, y) {
    if (ch.valueW < 0) ch.valueW = ctx.measureText(ch.value).width;
    const gap = L.labelPx * CONFIG.GAP;
    const total = nw + gap + ch.valueW;
    const x0 = Math.round(x - total / 2);
    const boxH = L.labelPx + CONFIG.PAD_Y * 2;

    ctx.fillStyle = PALETTE.void;
    ctx.fillRect(x0 - CONFIG.PAD_X, Math.round(y - boxH / 2), total + CONFIG.PAD_X * 2, boxH);

    // Unsupported channels are dimmed as a whole so the N/A reads as absence, not as a value.
    const na = ch.status === 'unsupported';
    ctx.globalAlpha = na ? CONFIG.NA_ALPHA : 1;
    ctx.fillStyle = PALETTE.ash;
    ctx.fillText(ch.name, x0, y);
    ctx.fillStyle = na ? PALETTE.ash : ch.fault ? PALETTE.fault : ch.live ? PALETTE.sodium : PALETTE.ash;
    ctx.fillText(ch.value, x0 + nw + gap, y);
    ctx.globalAlpha = 1;
  }

  function draw(ctx, L) {
    if (font !== L.labelFont) {
      font = L.labelFont;
      ctx.font = font;
      measureNames(ctx);
    } else {
      ctx.font = font;
    }
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    drawOne(ctx, L, heap, nameW[0], L.cx, L.cy);
    for (let i = 0; i < rings.length; i++) {
      drawOne(ctx, L, rings[i], nameW[i + 1], L.cx, L.cy - L.ringR[i]);
    }
  }

  // Value widths depend on the font, so force a re-measure when it changes.
  function invalidate() {
    font = '';
    heap.valueW = -1;
    for (let i = 0; i < rings.length; i++) rings[i].valueW = -1;
  }

  return { draw, invalidate };
}
