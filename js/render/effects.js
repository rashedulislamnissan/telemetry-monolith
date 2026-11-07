// Shockwaves: an expanding ring triggered by a real event's arrival (long task = red
// burst, ping = small amber pulse ring). Pooled; never labelled.
import { PALETTE } from './palette.js';

const CONFIG = {
  MAX: 8,
};

export function createEffects() {
  const waves = [];
  for (let i = 0; i < CONFIG.MAX; i++) {
    waves.push({ active: false, r0: 0, r1: 0, age: 0, dur: 1, fault: false, width: 1, alpha: 1 });
  }

  function wave(r0, r1, dur, fault, width, alpha = 1) {
    let w = null;
    let oldest = null;
    for (const x of waves) {
      if (!x.active) { w = x; break; }
      if (!oldest || x.age / x.dur > oldest.age / oldest.dur) oldest = x;
    }
    w = w || oldest;
    w.active = true;
    w.r0 = r0;
    w.r1 = r1;
    w.age = 0;
    w.dur = dur;
    w.fault = fault;
    w.width = width;
    w.alpha = alpha;
  }

  function update(dt) {
    for (const w of waves) {
      if (!w.active) continue;
      w.age += dt;
      if (w.age >= w.dur) w.active = false;
    }
  }

  function draw(ctx, L) {
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    for (const w of waves) {
      if (!w.active) continue;
      const k = w.age / w.dur;
      const e = 1 - (1 - k) * (1 - k) * (1 - k);
      const r = w.r0 + (w.r1 - w.r0) * e;
      ctx.globalAlpha = (1 - k) * 0.9 * w.alpha;
      ctx.strokeStyle = w.fault ? PALETTE.fault : PALETTE.sodium;
      ctx.lineWidth = w.width * (1 - k * 0.6);
      ctx.beginPath();
      ctx.arc(L.cx, L.cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = prev;
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  }

  return { wave, update, draw };
}
