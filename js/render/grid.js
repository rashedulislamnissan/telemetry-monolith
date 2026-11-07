// Static backdrop: grid, rulers, crosshair and corner brackets.
// Pre-rendered to an offscreen canvas on resize, then blitted once per frame.
import { PALETTE } from './palette.js';

const CONFIG = {
  MINOR: 24,         // px between grid dots
  MAJOR: 96,         // px between grid lines; a multiple of MINOR so dots land on lines
  CROSS: 3,          // half-length of the + marks at major intersections
  RULER_STEP: 8,     // px between edge-ruler ticks
  RULER_MINOR: 3,
  RULER_MAJOR: 9,
  BRACKET: 22,       // arm length of the corner brackets
};

// Positive modulo, so the grid phase is the same whichever side of the core you are on.
function phase(v, step) {
  return ((v % step) + step) % step;
}

export function createGrid() {
  const cvs = document.createElement('canvas');
  const g = cvs.getContext('2d');

  function build(L) {
    const { w, h, dpr, cx, cy, margin } = L;
    cvs.width = Math.round(w * dpr);
    cvs.height = Math.round(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    g.fillStyle = PALETTE.void;
    g.fillRect(0, 0, w, h);

    // Grid is phased to pass through the core, so the core sits on the structure, not on top of it.
    const ox = phase(cx, CONFIG.MAJOR);
    const oy = phase(cy, CONFIG.MAJOR);

    g.strokeStyle = PALETTE.graphite;
    g.lineWidth = 1;
    g.beginPath();
    for (let x = ox; x <= w; x += CONFIG.MAJOR) {
      const sx = Math.round(x) + 0.5;
      g.moveTo(sx, 0);
      g.lineTo(sx, h);
    }
    for (let y = oy; y <= h; y += CONFIG.MAJOR) {
      const sy = Math.round(y) + 0.5;
      g.moveTo(0, sy);
      g.lineTo(w, sy);
    }
    g.stroke();

    g.fillStyle = PALETTE.ash;
    g.globalAlpha = 0.22;
    const mx = phase(cx, CONFIG.MINOR);
    const my = phase(cy, CONFIG.MINOR);
    for (let x = mx; x <= w; x += CONFIG.MINOR) {
      for (let y = my; y <= h; y += CONFIG.MINOR) {
        g.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }

    g.globalAlpha = 0.5;
    g.strokeStyle = PALETTE.ash;
    g.beginPath();
    for (let x = ox; x <= w; x += CONFIG.MAJOR) {
      for (let y = oy; y <= h; y += CONFIG.MAJOR) {
        const sx = Math.round(x) + 0.5;
        const sy = Math.round(y) + 0.5;
        g.moveTo(sx - CONFIG.CROSS, sy);
        g.lineTo(sx + CONFIG.CROSS + 1, sy);
        g.moveTo(sx, sy - CONFIG.CROSS);
        g.lineTo(sx, sy + CONFIG.CROSS + 1);
      }
    }
    g.stroke();

    // Crosshair through the core.
    g.globalAlpha = 0.09;
    g.strokeStyle = PALETTE.bone;
    g.beginPath();
    g.moveTo(0, Math.round(cy) + 0.5);
    g.lineTo(w, Math.round(cy) + 0.5);
    g.moveTo(Math.round(cx) + 0.5, 0);
    g.lineTo(Math.round(cx) + 0.5, h);
    g.stroke();

    // Edge rulers on top and left only: a viewfinder, not a frame.
    g.globalAlpha = 0.45;
    g.strokeStyle = PALETTE.ash;
    g.beginPath();
    const rx = phase(cx, CONFIG.RULER_STEP);
    for (let x = rx; x <= w; x += CONFIG.RULER_STEP) {
      const major = Math.abs(phase(x - cx, CONFIG.MAJOR)) < 0.5;
      const sx = Math.round(x) + 0.5;
      g.moveTo(sx, 0);
      g.lineTo(sx, major ? CONFIG.RULER_MAJOR : CONFIG.RULER_MINOR);
    }
    const ry = phase(cy, CONFIG.RULER_STEP);
    for (let y = ry; y <= h; y += CONFIG.RULER_STEP) {
      const major = Math.abs(phase(y - cy, CONFIG.MAJOR)) < 0.5;
      const sy = Math.round(y) + 0.5;
      g.moveTo(0, sy);
      g.lineTo(major ? CONFIG.RULER_MAJOR : CONFIG.RULER_MINOR, sy);
    }
    g.stroke();

    // Corner brackets, inset by half the margin.
    const inset = Math.round(margin / 2) + 0.5;
    const b = CONFIG.BRACKET;
    g.globalAlpha = 0.6;
    g.strokeStyle = PALETTE.bone;
    g.beginPath();
    g.moveTo(inset, inset + b); g.lineTo(inset, inset); g.lineTo(inset + b, inset);
    g.moveTo(w - inset - b, inset); g.lineTo(w - inset, inset); g.lineTo(w - inset, inset + b);
    g.moveTo(inset, h - inset - b); g.lineTo(inset, h - inset); g.lineTo(inset + b, h - inset);
    g.moveTo(w - inset - b, h - inset); g.lineTo(w - inset, h - inset); g.lineTo(w - inset, h - inset - b);
    g.stroke();

    g.globalAlpha = 1;
  }

  function draw(ctx, L) {
    ctx.drawImage(cvs, 0, 0, L.w, L.h);
  }

  return { build, draw };
}
