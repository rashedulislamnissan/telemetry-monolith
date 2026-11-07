// Top-right readout of device facts (all real; N/A where the browser does not expose one),
// plus the one footnote explaining what N/A means.
import { PALETTE } from './palette.js';
import { device } from '../signals/device.js';

const CONFIG = {
  NA: 'N/A',
  FOOTNOTE: 'N/A = NOT EXPOSED BY THIS BROWSER',
  COL_GAP: 1.2,   // gap between label and value columns, in multiples of the font size
};

// w = measured value width, cached on rebuild so drawing never measures.
const ROWS = [
  { name: 'CPU THREADS', value: '', w: 0 },
  { name: 'DEVICE MEMORY', value: '', w: 0 },
  { name: 'PIXEL RATIO', value: '', w: 0 },
  { name: 'VIEWPORT', value: '', w: 0 },
  { name: 'NETWORK', value: '', w: 0 },
];

function fmtNet(n) {
  if (!n) return CONFIG.NA;
  let s = String(n.effectiveType).toUpperCase();
  if (typeof n.rttMs === 'number') s += ` ${n.rttMs}MS RTT`;
  return s;
}

export function createDevicePanel() {
  let version = -1;
  let font = '';
  let nameW = 0;
  let valueW = 0;
  let anyNA = false;

  function rebuild(ctx) {
    ROWS[0].value = device.threads === null ? CONFIG.NA : String(device.threads);
    ROWS[1].value = device.memoryGB === null ? CONFIG.NA : `${device.memoryGB} GB`;
    // Shows the real DPR, and the capped render DPR when they differ.
    ROWS[2].value = device.dpr === device.renderDpr
      ? device.dpr.toFixed(2)
      : `${device.dpr.toFixed(2)} (RENDER ${device.renderDpr.toFixed(2)})`;
    ROWS[3].value = `${device.vw}×${device.vh}`;
    ROWS[4].value = fmtNet(device.net);
    nameW = 0;
    valueW = 0;
    for (const r of ROWS) {
      nameW = Math.max(nameW, ctx.measureText(r.name).width);
      r.w = ctx.measureText(r.value).width;
      valueW = Math.max(valueW, r.w);
    }
    version = device.version;
  }

  // naChannels: true when any ring channel is N/A, so the footnote covers it too.
  function draw(ctx, L, naChannels) {
    ctx.font = L.hudFont;
    if (version !== device.version || font !== L.hudFont) {
      font = L.hudFont;
      rebuild(ctx);
    }
    const right = L.w - L.margin;
    const lh = Math.round(L.hudPx * 1.6);
    let y = L.margin;
    anyNA = naChannels;

    ctx.textBaseline = 'top';
    for (const r of ROWS) {
      const na = r.value === CONFIG.NA;
      if (na) anyNA = true;
      ctx.textAlign = 'right';
      ctx.fillStyle = na ? PALETTE.ash : PALETTE.sodium;
      ctx.globalAlpha = na ? 0.7 : 1;
      ctx.fillText(r.value, right, y);
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.ash;
      ctx.fillText(r.name, right - valueW - L.hudPx * CONFIG.COL_GAP - nameW, y);
      ctx.globalAlpha = 1;
      y += lh;
    }
    if (anyNA) {
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.ash;
      ctx.globalAlpha = 0.7;
      ctx.fillText(CONFIG.FOOTNOTE, right, y + Math.round(lh * 0.5));
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  }

  return { draw };
}
