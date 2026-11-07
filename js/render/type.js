// Kinetic type: a heavy condensed face built from block cells, drawn in code.
// Drawing it ourselves gives the same condensed look on every OS with no font download.
import { PALETTE } from './palette.js';

const CONFIG = {
  TEXT: 'TELEMETRY RUNTIME OBSERVER SELF ', // trailing space makes the loop seamless
  ROWS: 10,             // glyph height in cells
  CELL_ASPECT: 0.55,    // cell width / height; below 1 gives the condensed proportion
  TRACKING: 2,          // empty cells between letters
  SPACE: 5,             // cells for a word space
  SCANLINE: 0.16,       // gap between cell rows as a share of cell height. Columns merge so
                        // strokes stay solid and letters read; only the rows break, like scanlines
  SPEED: 0.9,           // scroll speed, cells per second
  BASE_ALPHA: 0.075,    // backdrop, so it never competes with the rings
  LIT_ALPHA: 0.17,
  WAVE_COL: 0.31,       // spatial frequency of the shimmer across columns
  WAVE_ROW: 0.45,       // and down rows; the mix gives a diagonal sweep
  WAVE_SPEED: 1.6,
  WAVE_THRESHOLD: 0.8,  // higher = fewer lit cells
};

// 6 x 10 cells (M is 7 wide). Two-cell stems give the heavy weight.
const GLYPHS = {
  T: ['######', '######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..'],
  E: ['######', '######', '##....', '##....', '#####.', '#####.', '##....', '##....', '######', '######'],
  L: ['##....', '##....', '##....', '##....', '##....', '##....', '##....', '##....', '######', '######'],
  M: ['##...##', '###.###', '#######', '##.#.##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##'],
  R: ['#####.', '######', '##..##', '##..##', '######', '#####.', '##.##.', '##..##', '##..##', '##..##'],
  Y: ['##..##', '##..##', '##..##', '##..##', '######', '.####.', '..##..', '..##..', '..##..', '..##..'],
  U: ['##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '######', '.####.'],
  N: ['##..##', '###.##', '###.##', '######', '######', '##.###', '##.###', '##..##', '##..##', '##..##'],
  I: ['######', '######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '######', '######'],
  O: ['.####.', '######', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '######', '.####.'],
  B: ['#####.', '######', '##..##', '##..##', '#####.', '######', '##..##', '##..##', '######', '#####.'],
  S: ['.#####', '######', '##....', '##....', '#####.', '.#####', '....##', '....##', '######', '#####.'],
  V: ['##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.', '.####.', '..##..'],
  F: ['######', '######', '##....', '##....', '#####.', '#####.', '##....', '##....', '##....', '##....'],
};

function compile(rows) {
  const cells = [];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      if (rows[r][c] === '#') cells.push(c, r);
    }
  }
  return { w: rows[0].length, cells: Uint8Array.from(cells) };
}

const COMPILED = {};
for (const k of Object.keys(GLYPHS)) COMPILED[k] = compile(GLYPHS[k]);

// The tape: each letter with its x position in cells. Built once.
const TAPE = [];
let tapeCells = 0;
for (const ch of CONFIG.TEXT) {
  if (ch === ' ') {
    tapeCells += CONFIG.SPACE;
    continue;
  }
  const g = COMPILED[ch];
  TAPE.push({ g, x: tapeCells });
  tapeCells += g.w + CONFIG.TRACKING;
}
const TAPE_CELLS = tapeCells;

export function createType() {
  const state = { scroll: 0 };

  function update(dt, motion) {
    state.scroll = (state.scroll + CONFIG.SPEED * dt * motion) % TAPE_CELLS;
  }

  // pass 0 draws unlit cells (or all cells when the shimmer is off); pass 1 draws lit ones.
  function drawPass(ctx, L, t, pass, wave) {
    const cellH = L.typeH / CONFIG.ROWS;
    const cellW = cellH * CONFIG.CELL_ASPECT;
    const insY = cellH * CONFIG.SCANLINE * 0.5;
    const ch = cellH - insY * 2;
    // Overlap by a hair so adjacent cells in one path fill without seams.
    const cw = cellW + 0.5;
    const tapePx = TAPE_CELLS * cellW;
    const shift = state.scroll * cellW;
    const phaseT = t * CONFIG.WAVE_SPEED;

    ctx.beginPath();
    for (let x0 = -shift; x0 < L.w; x0 += tapePx) {
      for (let i = 0; i < TAPE.length; i++) {
        const item = TAPE[i];
        const gx = x0 + item.x * cellW;
        if (gx >= L.w) break;
        if (gx + item.g.w * cellW <= 0) continue;
        const cells = item.g.cells;
        for (let k = 0; k < cells.length; k += 2) {
          const c = cells[k];
          const r = cells[k + 1];
          if (wave) {
            const lit = Math.sin((item.x + c) * CONFIG.WAVE_COL + r * CONFIG.WAVE_ROW - phaseT) > CONFIG.WAVE_THRESHOLD;
            if (lit !== (pass === 1)) continue;
          }
          ctx.rect(gx + c * cellW, L.typeY + r * cellH + insY, cw, ch);
        }
      }
    }
    ctx.globalAlpha = pass === 1 ? CONFIG.LIT_ALPHA : CONFIG.BASE_ALPHA;
    ctx.fill();
  }

  function draw(ctx, L, t) {
    // The shimmer is pure flicker, so reduced motion turns it off rather than slowing it.
    const wave = L.motion >= 1;
    ctx.fillStyle = PALETTE.bone;
    drawPass(ctx, L, t, 0, wave);
    if (wave) drawPass(ctx, L, t, 1, wave);
    ctx.globalAlpha = 1;
  }

  return { update, draw };
}
