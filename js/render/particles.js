// Event particles. Every bus event becomes exactly one pooled particle that travels its
// channel's conduit carrying a copy of the event: its label is the event's own label,
// never generated here. After arrival it rides its ring briefly and fades.
import { PALETTE, monoFont } from './palette.js';

const CONFIG = {
  MAX: 160,            // pool size = hard cap on live particles (M7 makes it adaptive)
  MAX_LABELS: 28,      // labels drawn at once (newest); other particles still carry their data
  SPEED: 380,          // px/s along a conduit
  DUR_MIN: 0.9,        // s, travel time clamp so short and long conduits both read
  DUR_MAX: 2.4,
  SPACING: 0.12,       // s between particles entering the same conduit; bursts become a stream
  MAX_DELAY: 4,        // s of queue per conduit; beyond this an event is counted as dropped
  LAND: 2.4,           // s on the ring after arrival
  LAND_SWEEP: 0.45,    // rad a landed particle slides along its ring
  SPRITE: 30,          // px glow sprite while travelling
  LAND_SCALE: 0.55,
  FAULT_SCALE: 1.35,
  LABEL_GAP: 9,
  LABEL_PAD: 3,
  LABEL_LAND: 0.8,     // s a label stays after landing
  LABEL_EDGE: 6,       // px kept clear at the screen edge; labels flip sides to respect it
  REDUCED_SPEED: 0.6,  // travel speed multiplier under reduced motion
};

const SYSTEM_RING = -1;

function makeSprite(color, dpr) {
  const size = Math.ceil(CONFIG.SPRITE * dpr);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, '#FFFFFF');
  grad.addColorStop(0.12, color);
  grad.addColorStop(0.35, color + '66');
  grad.addColorStop(1, color + '00');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

function blank() {
  return {
    active: false, conduit: 0, delay: 0, s: 0, dur: 1, phase: 0, age: 0,
    landA: 0, dir: 1, x: 0, y: 0, alpha: 0,
    // copy of the event
    seq: 0, ch: '', type: '', label: '', fault: false, value: 0, unit: '', t: 0, raw: null,
  };
}

export function createParticles(conduits) {
  const pool = new Array(CONFIG.MAX);
  for (let i = 0; i < CONFIG.MAX; i++) pool[i] = blank();
  const pt = { x: 0, y: 0 };
  const stats = { spawned: 0, dropped: 0, live: 0, labelled: 0 };
  let now = 0;
  let lastSeq = 0;
  let sprites = null;
  let spriteDpr = 0;
  let font = '';
  let charW = 6;
  let onArrive = null;

  function free() {
    let oldest = -1;
    let oldestAge = -1;
    for (let i = 0; i < CONFIG.MAX; i++) {
      const p = pool[i];
      if (!p.active) return p;
      if (p.phase === 1 && p.age > oldestAge) { oldestAge = p.age; oldest = i; }
    }
    // Pool full: recycle the most faded landed particle rather than block new data.
    return oldest >= 0 ? pool[oldest] : null;
  }

  function spawn(e, motion) {
    const ci = conduits.indexFor(e.ch);
    const c = conduits.list[ci];
    const delay = Math.max(0, c.nextFree - now);
    if (delay > CONFIG.MAX_DELAY) { stats.dropped++; return; }
    const p = free();
    if (!p) { stats.dropped++; return; }
    c.nextFree = now + delay + CONFIG.SPACING;

    const speed = CONFIG.SPEED * (motion < 1 ? CONFIG.REDUCED_SPEED : 1);
    p.active = true;
    p.conduit = ci;
    p.delay = delay;
    p.s = 0;
    p.dur = Math.min(CONFIG.DUR_MAX, Math.max(CONFIG.DUR_MIN, c.len / speed));
    p.phase = 0;
    p.age = 0;
    p.landA = c.angle;
    p.dir = c.bow;
    p.alpha = 0;
    p.seq = e.seq; p.ch = e.ch; p.type = e.type; p.label = e.label; p.fault = e.fault;
    p.value = e.value; p.unit = e.unit; p.t = e.t; p.raw = e.raw;
    if (e.seq > lastSeq) lastSeq = e.seq;
    stats.spawned++;
  }

  function place(p, L) {
    const c = conduits.list[p.conduit];
    if (p.phase === 0) {
      const e = 1 - (1 - p.s) * (1 - p.s); // ease-out: fast from the edge, settling into the ring
      conduits.point(c, e, pt);
      p.x = pt.x;
      p.y = pt.y;
      return;
    }
    const k = p.age / CONFIG.LAND;
    if (c.id === 'heap') {
      // Absorbed into the core.
      const r = L.coreR * (1 - k);
      p.x = L.cx + r * Math.cos(p.landA);
      p.y = L.cy + r * Math.sin(p.landA);
    } else if (c.ring === SYSTEM_RING) {
      p.x = c.x2;
      p.y = c.y2;
    } else {
      const a = p.landA + p.dir * CONFIG.LAND_SWEEP * (1 - Math.exp(-2 * p.age));
      const r = L.ringR[c.ring];
      p.x = L.cx + r * Math.cos(a);
      p.y = L.cy + r * Math.sin(a);
    }
  }

  function update(dt, L) {
    now += dt;
    let live = 0;
    for (let i = 0; i < CONFIG.MAX; i++) {
      const p = pool[i];
      if (!p.active) continue;
      live++;
      if (p.delay > 0) {
        p.delay -= dt;
        if (p.delay > 0) continue;
        conduits.pulse(p.conduit, 0.5, p.fault);
      } else if (p.s === 0 && p.phase === 0) {
        conduits.pulse(p.conduit, 0.5, p.fault);
      }
      if (p.phase === 0) {
        p.s = Math.min(1, p.s + dt / p.dur);
        p.alpha = 1;
        if (p.s >= 1) {
          p.phase = 1;
          p.age = 0;
          if (onArrive) onArrive(p);
        }
      } else {
        p.age += dt;
        p.alpha = 1 - p.age / CONFIG.LAND;
        if (p.age >= CONFIG.LAND) { p.active = false; continue; }
      }
      place(p, L);
    }
    stats.live = live;
  }

  function ensureAssets(ctx, L) {
    if (spriteDpr !== L.dpr) {
      sprites = [makeSprite(PALETTE.sodium, L.dpr), makeSprite(PALETTE.fault, L.dpr)];
      spriteDpr = L.dpr;
    }
    if (font !== L.labelFont) {
      font = L.labelFont;
      ctx.font = font;
      charW = ctx.measureText('0').width; // monospace: width = chars x charW, no per-label measure
    }
  }

  function draw(ctx, L) {
    ensureAssets(ctx, L);
    const prev = ctx.globalCompositeOperation;

    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < CONFIG.MAX; i++) {
      const p = pool[i];
      if (!p.active || p.delay > 0) continue;
      let size = CONFIG.SPRITE * (p.phase === 0 ? 1 : CONFIG.LAND_SCALE);
      if (p.fault) size *= CONFIG.FAULT_SCALE;
      ctx.globalAlpha = p.alpha;
      ctx.drawImage(sprites[p.fault ? 1 : 0], p.x - size / 2, p.y - size / 2, size, size);
    }
    ctx.globalCompositeOperation = prev;

    // Labels: newest MAX_LABELS only. Text is the event's own label, verbatim.
    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const floor = lastSeq - CONFIG.MAX_LABELS;
    const h = L.labelPx + CONFIG.LABEL_PAD * 2;
    let labelled = 0;
    for (let i = 0; i < CONFIG.MAX; i++) {
      const p = pool[i];
      if (!p.active || p.delay > 0 || p.seq <= floor) continue;
      // Landed labels fade fast: the dot keeps riding the ring, but stacked labels on
      // one ring would be unreadable.
      const la = p.phase === 0 ? 1 : 1 - p.age / CONFIG.LABEL_LAND;
      if (la <= 0) continue;
      const w = p.label.length * charW;
      let right = p.x >= L.cx;
      if (right && p.x + CONFIG.LABEL_GAP + w > L.w - CONFIG.LABEL_EDGE) right = false;
      else if (!right && p.x - CONFIG.LABEL_GAP - w < CONFIG.LABEL_EDGE) right = true;
      const x = right ? p.x + CONFIG.LABEL_GAP : p.x - CONFIG.LABEL_GAP - w;
      ctx.globalAlpha = la * 0.8;
      ctx.fillStyle = PALETTE.void;
      ctx.fillRect(x - CONFIG.LABEL_PAD, p.y - h / 2, w + CONFIG.LABEL_PAD * 2, h);
      ctx.globalAlpha = la;
      ctx.fillStyle = p.fault ? PALETTE.fault : PALETTE.sodium;
      ctx.fillText(p.label, x, p.y);
      labelled++;
    }
    stats.labelled = labelled;
    ctx.globalAlpha = 1;
  }

  return {
    spawn,
    update,
    draw,
    stats,
    pool,
    set onArrive(fn) { onArrive = fn; },
  };
}
