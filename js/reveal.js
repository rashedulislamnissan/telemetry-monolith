// The 10 s reveal: caption + raw event stream fade in together once, and any particle
// can be frozen (hover with a mouse, tap on touch) to read its raw event data.
// Every DOM node here is data-self, so the mutation source never counts our own updates.
import { PALETTE } from './render/palette.js';

const CONFIG = {
  CAPTION_AT_MS: 8500,   // after navigation start; lands inside the 10 s window
  STREAM_HZ: 4,          // raw stream refresh
  STREAM_LINE_PX: 13,    // must match .stream-body line-height
  STREAM_MIN_LINES: 1,   // small phones (360x640) only have room for one
  BLOCK_FIXED_H: 92,     // px of caption, hint and stream header above the stream lines
  STREAM_MAX_LINES: 8,
  HOVER_R: 14,           // px pick radius for a mouse
  RELEASE_R: 40,         // px the mouse must move away before a frozen particle is let go
  TAP_R: 28,             // px pick radius for touch and pen (fingers are blunt)
  LEFT_FIELD_MIN: 260,   // px; narrower than this and the block moves below the rings
  LEFT_FIELD_TIGHT: 160, // px; the left field is still used down to this if nothing else fits
  BLOCK_H: 190,          // px the block needs below the rings
  TIP_OFFSET: 18,        // px from the particle to the tooltip
  TIP_ROWS: 16,          // raw fields shown; the rest are summarised as "+N more"
  VALUE_MAX: 56,         // characters per value before it is clipped (fits the heap note)
};

// ---- formatting (shared by stream and tooltip) ----

function num(v) {
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 100) / 100);
}

function shortUrl(s) {
  try {
    const u = new URL(s, location.href);
    return u.origin === location.origin ? u.pathname + u.search : u.host + u.pathname;
  } catch {
    return s;
  }
}

function fmtValue(k, v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return num(v);
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'string') return (k === 'name' || k === 'url') && v.includes('/') ? shortUrl(v) : v;
  return JSON.stringify(v, (_, x) => (typeof x === 'number' ? Math.round(x * 100) / 100 : x));
}

const PRIORITY = [
  'name', 'url', 'entryType', 'source', 'note', 'initiatorType', 'startTime', 'duration',
  'transferSize', 'encodedBodySize', 'decodedBodySize', 'responseStatus', 'status',
  'renderTime', 'loadTime', 'size', 'element', 'value', 'hadRecentInput', 'cumulative',
  'processingStart', 'processingEnd', 'inputDelay', 'interactionId',
  'usedJSHeapSize', 'totalJSHeapSize', 'rttMs', 'ttfbMs', 'deltaMs', 'smoothedMs',
  'speedPxS', 'accelPxS2', 'jerkPxS3', 'records', 'targets',
];
function rank(k) {
  const i = PRIORITY.indexOf(k);
  return i < 0 ? PRIORITY.length : i;
}

function clip(s, n) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// One compact line of raw JSON for the stream.
function streamLine(e) {
  const raw = e.raw || {};
  const parts = [];
  for (const k of Object.keys(raw)) {
    const v = raw[k];
    if (v === undefined || (typeof v === 'object' && v !== null)) continue; // nested data stays in the tooltip
    parts.push(`"${k}":${typeof v === 'string' ? JSON.stringify(fmtValue(k, v)) : fmtValue(k, v)}`);
  }
  return `${num(Math.round(e.t)).padStart(6)} ${e.type.padEnd(11)} {${parts.join(',')}}`;
}

export function createReveal({ particles, bus, surge }) {
  const root = document.getElementById('reveal');
  const body = root ? root.querySelector('.stream-body') : null;
  const hint = root ? root.querySelector('.reveal-hint') : null;
  const tip = document.getElementById('tip');

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (hint) hint.textContent = coarse ? 'Tap any particle to read its raw data.' : 'Hover any particle to read its raw data.';

  const st = { shown: false, frozen: null, tipX: 0, tipY: 0, tipW: 0, tipH: 0, lines: 6 };
  const cache = new Map(); // seq -> stream line, so each event is formatted once
  let nextStream = 0;

  // ---- placement ----
  function layout(L) {
    if (!root) return;
    const left = L.cx - L.R - L.margin * 2;
    const s = root.style;
    s.left = `${L.margin}px`;
    s.right = 'auto';
    // Wide: the empty left field. Tall: below the rings. Otherwise a narrower left field
    // (the caption wraps). Phones: the band under the HUD.
    const leftField = () => {
      s.top = 'auto';
      s.bottom = `${L.margin}px`;
      s.width = `${Math.min(440, left)}px`;
      st.lines = CONFIG.STREAM_MAX_LINES;
    };
    if (!L.narrow && left >= CONFIG.LEFT_FIELD_MIN) {
      leftField();
    } else if (!L.narrow && L.h - (L.cy + L.R) >= CONFIG.BLOCK_H) {
      s.top = `${Math.round(L.cy + L.R + 24)}px`;
      s.bottom = 'auto';
      s.width = `${L.w - L.margin * 2 - 160}px`; // leaves the bottom-right controls clear
      st.lines = 6;
    } else if (!L.narrow && left >= CONFIG.LEFT_FIELD_TIGHT) {
      leftField();
    } else {
      // Narrow: the band under the HUD, above the ring system's label spine.
      const lh = Math.round(L.hudPx * 1.6);
      const top = L.margin + lh * 7.2;
      const room = L.cy - L.R - 12 - top;
      s.top = `${Math.round(top)}px`;
      s.bottom = 'auto';
      s.width = `${L.w - L.margin * 2}px`;
      st.lines = Math.floor((room - CONFIG.BLOCK_FIXED_H) / CONFIG.STREAM_LINE_PX);
    }
    st.lines = Math.max(CONFIG.STREAM_MIN_LINES, Math.min(CONFIG.STREAM_MAX_LINES, st.lines));
    if (body) body.style.height = `${st.lines * CONFIG.STREAM_LINE_PX}px`;
    // Geometry changed under a frozen particle; let it go rather than show it off-curve.
    release();
  }

  // ---- stream ----
  function renderStream() {
    if (!body) return;
    const out = [];
    bus.forEachRecent(st.lines, (e) => {
      let line = cache.get(e.seq);
      if (!line) {
        line = streamLine(e);
        cache.set(e.seq, line);
        if (cache.size > 64) cache.delete(cache.keys().next().value);
      }
      out.push(line);
    });
    out.reverse(); // oldest at top, newest at the bottom: it scrolls upward
    body.textContent = out.join('\n');
  }

  // ---- tooltip ----
  function row(k, v, cls) {
    const r = document.createElement('div');
    r.className = 'tip-row';
    const a = document.createElement('span');
    a.className = 'tip-k';
    a.textContent = k;
    const b = document.createElement('span');
    b.className = cls ? `tip-v ${cls}` : 'tip-v';
    b.textContent = v;
    r.append(a, b);
    return r;
  }

  function fillTip(p) {
    tip.replaceChildren();
    const head = document.createElement('div');
    head.className = p.fault ? 'tip-head is-fault' : 'tip-head';
    head.textContent = p.label;
    tip.append(head);
    tip.append(row('channel', `${p.ch} / ${p.type}`, 'is-meta'));
    tip.append(row('event', `#${p.seq} at ${num(Math.round(p.t * 100) / 100)} ms`, 'is-meta'));
    const raw = p.raw || {};
    // Most telling fields first; Resource Timing alone has 20+ keys, mostly phase stamps.
    const keys = Object.keys(raw).filter((k) => raw[k] !== undefined);
    keys.sort((a, b) => rank(a) - rank(b));
    for (const k of keys.slice(0, CONFIG.TIP_ROWS)) tip.append(row(k, clip(fmtValue(k, raw[k]), CONFIG.VALUE_MAX)));
    if (keys.length > CONFIG.TIP_ROWS) tip.append(row('', `+${keys.length - CONFIG.TIP_ROWS} more`, 'is-meta'));
  }

  function placeTip(L) {
    const p = st.frozen;
    tip.hidden = false;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    // Beside the particle if a side fits; otherwise (narrow screens) above or below it,
    // so the tooltip never covers the particle it describes.
    const o = CONFIG.TIP_OFFSET;
    let x;
    let y = p.y - h / 2;
    if (p.x + o + w <= L.w - 8) x = p.x + o;
    else if (p.x - o - w >= 8) x = p.x - o - w;
    else {
      x = p.x - w / 2;
      y = p.y + o + h <= L.h - 8 ? p.y + o : p.y - o - h;
    }
    x = Math.max(8, Math.min(L.w - w - 8, x));
    y = Math.max(8, Math.min(L.h - h - 8, y));
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    st.tipX = x; st.tipY = y; st.tipW = w; st.tipH = h;
  }

  function freeze(p, L) {
    if (st.frozen === p) return;
    release();
    p.frozen = true;
    p.alpha = 1;
    st.frozen = p;
    if (!tip) return;
    fillTip(p);
    placeTip(L);
  }

  function release() {
    if (st.frozen) st.frozen.frozen = false;
    st.frozen = null;
    if (tip) tip.hidden = true;
  }

  // Touch and pen: tap a particle to freeze it, tap anywhere else to let go.
  let lastL = null;
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !lastL) return;
    const p = particles.hit(e.clientX, e.clientY, CONFIG.TAP_R);
    if (p) freeze(p, lastL);
    else release();
  }, { passive: true });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') release(); });

  // ---- per frame ----
  function update(now, L) {
    lastL = L;
    if (!st.shown && now >= CONFIG.CAPTION_AT_MS && root) {
      st.shown = true;
      root.classList.add('is-on');
    }
    if (st.shown && now >= nextStream) {
      nextStream = now + 1000 / CONFIG.STREAM_HZ;
      renderStream();
    }

    // Mouse: whatever sits under the cursor freezes, including a particle drifting into
    // a still cursor; moving well away lets it go.
    const s = surge.state;
    const mouse = s.present && surge.pointerType() === 'mouse';
    if (st.frozen) {
      if (!st.frozen.active) release();
      else if (mouse && Math.hypot(s.x - st.frozen.x, s.y - st.frozen.y) > CONFIG.RELEASE_R) release();
      else if (!mouse && surge.pointerType() === 'mouse') release(); // mouse left the page
    }
    if (!st.frozen && mouse) {
      const p = particles.hit(s.x, s.y, CONFIG.HOVER_R);
      if (p) freeze(p, L);
    }
  }

  // Highlight ring and a leader line from the particle to its tooltip.
  function draw(ctx, L) {
    const p = st.frozen;
    if (!p) return;
    ctx.strokeStyle = p.fault ? PALETTE.fault : PALETTE.bone;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
    ctx.stroke();
    if (tip && !tip.hidden) {
      // Leader to the nearest point on the tooltip's edge.
      const tx = Math.max(st.tipX, Math.min(st.tipX + st.tipW, p.x));
      const ty = Math.max(st.tipY, Math.min(st.tipY + st.tipH, p.y));
      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.hypot(dx, dy) || 1;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(p.x + (dx / d) * 9, p.y + (dy / d) * 9);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  return { layout, update, draw, release, state: st };
}
