// Computes every screen-space position once per resize so renderers never do layout math per frame.
import { monoFont } from './render/palette.js';

const CONFIG = {
  NARROW_BELOW: 760,  // px width; below this, type moves to a top band and the core centres
  MARGIN_WIDE: 40,
  MARGIN_NARROW: 16,
  CORE_X_WIDE: 0.58,  // core sits right of centre so the kinetic type owns the left field
  R_OF_H_WIDE: 0.42,  // outer ring radius as a share of viewport height
  RING_INNER: 0.34,   // innermost ring radius as a share of R
  CORE_OF_R: 0.20,    // core hexagon radius as a share of R
  TYPE_OF_H_WIDE: 0.72,
  TYPE_OF_H_NARROW: 0.30,
  TYPE_TOP_NARROW: 0.07,
  BOTTOM_RESERVE: 48, // keeps the ring system clear of the back-link on narrow screens
  MIN_R: 60,
};

export function createLayout(ringCount) {
  return {
    w: 0, h: 0, dpr: 1,
    narrow: false,
    margin: 0,
    cx: 0, cy: 0,
    R: 0,
    coreR: 0,
    ringR: new Float32Array(ringCount),
    ringGap: 0,
    labelPx: 10,
    labelFont: '',
    hudFont: '',
    hudPx: 11,
    typeH: 0,
    typeY: 0,
    motion: 1, // 1 = full motion, lower under prefers-reduced-motion
  };
}

export function computeLayout(L, w, h, dpr) {
  L.w = w;
  L.h = h;
  L.dpr = dpr;
  L.narrow = w < CONFIG.NARROW_BELOW;
  L.margin = L.narrow ? CONFIG.MARGIN_NARROW : CONFIG.MARGIN_WIDE;

  if (!L.narrow) {
    L.cx = Math.round(w * CONFIG.CORE_X_WIDE);
    L.cy = Math.round(h / 2);
    L.R = Math.min(h * CONFIG.R_OF_H_WIDE, w - L.cx - L.margin, L.cx - L.margin);
    L.typeH = h * CONFIG.TYPE_OF_H_WIDE;
    L.typeY = (h - L.typeH) / 2;
  } else {
    // Type takes a band at the top; the ring system centres in whatever is left below it.
    L.cx = Math.round(w / 2);
    L.typeH = h * CONFIG.TYPE_OF_H_NARROW;
    L.typeY = h * CONFIG.TYPE_TOP_NARROW;
    const top = L.typeY + L.typeH;
    const bottom = h - CONFIG.BOTTOM_RESERVE;
    L.R = Math.min(w / 2 - L.margin, (bottom - top) / 2 - 12);
    L.cy = Math.round((top + bottom) / 2);
  }
  L.R = Math.max(CONFIG.MIN_R, Math.floor(L.R));

  L.coreR = L.R * CONFIG.CORE_OF_R;
  const n = L.ringR.length;
  const span = 1 - CONFIG.RING_INNER;
  for (let i = 0; i < n; i++) {
    L.ringR[i] = L.R * (CONFIG.RING_INNER + (i * span) / (n - 1));
  }
  L.ringGap = (L.R * span) / (n - 1);

  L.labelPx = L.narrow ? 9 : 10;
  L.labelFont = monoFont(L.labelPx);
  L.hudPx = L.narrow ? 10 : 11;
  L.hudFont = monoFont(L.hudPx);
}
