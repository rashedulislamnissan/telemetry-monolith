// Event-triggered effects, all pooled and never labelled:
// - shockwaves: an expanding ring (long task = red burst at the core, ping = faint amber
//   pulse ring, press = Bone ring at the pointer)
// - shards: short Bone streaks thrown out by a press
import { PALETTE, TAU } from './palette.js';

const CONFIG = {
  MAX_WAVES: 10,
  MAX_SHARDS: 64,
  SHARDS_PER_PRESS: 14,
  SHARD_SPEED_MIN: 180,  // px/s
  SHARD_SPEED_MAX: 620,
  SHARD_DRAG: 3.2,       // per second
  SHARD_LIFE: 0.7,       // s
  SHARD_LEN: 0.045,      // streak length in seconds of travel
  PRESS_RING: 90,        // px the press ring expands to
};

export function createEffects() {
  const waves = [];
  for (let i = 0; i < CONFIG.MAX_WAVES; i++) {
    waves.push({ active: false, x: 0, y: 0, atCore: true, r0: 0, r1: 0, age: 0, dur: 1, color: 0, width: 1, alpha: 1 });
  }
  const shards = [];
  for (let i = 0; i < CONFIG.MAX_SHARDS; i++) {
    shards.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0 });
  }
  let shardCursor = 0;

  function take() {
    let oldest = waves[0];
    for (const w of waves) {
      if (!w.active) return w;
      if (w.age / w.dur > oldest.age / oldest.dur) oldest = w;
    }
    return oldest;
  }

  // color: 0 = sodium (data), 1 = fault, 2 = bone (decorative response to input)
  function wave(r0, r1, dur, fault, width, alpha = 1) {
    const w = take();
    w.active = true; w.atCore = true; w.r0 = r0; w.r1 = r1; w.age = 0; w.dur = dur;
    w.color = fault ? 1 : 0; w.width = width; w.alpha = alpha;
  }

  // A press: Bone ring + shards at the pointer. motion < 1 keeps only a smaller ring.
  function press(x, y, motion) {
    const w = take();
    const full = motion >= 1;
    w.active = true; w.atCore = false; w.x = x; w.y = y;
    w.r0 = 4; w.r1 = CONFIG.PRESS_RING * (full ? 1 : 0.5); w.age = 0; w.dur = full ? 0.55 : 0.4;
    w.color = 2; w.width = 1.5; w.alpha = full ? 1 : 0.6;
    if (!full) return;
    for (let i = 0; i < CONFIG.SHARDS_PER_PRESS; i++) {
      const s = shards[shardCursor];
      shardCursor = (shardCursor + 1) % CONFIG.MAX_SHARDS;
      const a = Math.random() * TAU;
      const v = CONFIG.SHARD_SPEED_MIN + Math.random() * (CONFIG.SHARD_SPEED_MAX - CONFIG.SHARD_SPEED_MIN);
      s.active = true; s.x = x; s.y = y; s.vx = Math.cos(a) * v; s.vy = Math.sin(a) * v; s.age = 0;
    }
  }

  function update(dt) {
    for (const w of waves) {
      if (!w.active) continue;
      w.age += dt;
      if (w.age >= w.dur) w.active = false;
    }
    const drag = Math.exp(-CONFIG.SHARD_DRAG * dt);
    for (const s of shards) {
      if (!s.active) continue;
      s.age += dt;
      if (s.age >= CONFIG.SHARD_LIFE) { s.active = false; continue; }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= drag;
      s.vy *= drag;
    }
  }

  const COLORS = [PALETTE.sodium, PALETTE.fault, PALETTE.bone];

  function draw(ctx, L) {
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    for (const w of waves) {
      if (!w.active) continue;
      const k = w.age / w.dur;
      const e = 1 - (1 - k) * (1 - k) * (1 - k);
      const r = w.r0 + (w.r1 - w.r0) * e;
      ctx.globalAlpha = (1 - k) * 0.9 * w.alpha;
      ctx.strokeStyle = COLORS[w.color];
      ctx.lineWidth = w.width * (1 - k * 0.6);
      ctx.beginPath();
      ctx.arc(w.atCore ? L.cx : w.x, w.atCore ? L.cy : w.y, r, 0, TAU);
      ctx.stroke();
    }

    ctx.strokeStyle = PALETTE.bone;
    ctx.lineWidth = 1.2;
    for (const s of shards) {
      if (!s.active) continue;
      ctx.globalAlpha = 1 - s.age / CONFIG.SHARD_LIFE;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * CONFIG.SHARD_LEN, s.y - s.vy * CONFIG.SHARD_LEN);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = prev;
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  }

  return { wave, press, update, draw };
}
