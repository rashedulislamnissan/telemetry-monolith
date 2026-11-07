// The one place every real signal passes through. Sources hand it events; the bus
// normalises them into pooled slots, throttles bursty types, tracks per-channel
// support status, and fans out to listeners (renderers, debug log, raw stream).
//
// Event shape (slot): { seq, ch, type, label, readout, value, unit, t, fault, raw }
//   ch      ring/channel id ('ping', 'heap', ...), or 'device' / 'visibility'
//   type    specific kind ('lcp', 'gc', 'pointerdown', ...)
//   label   full uppercase text for a particle, e.g. 'LONGTASK 54MS'
//   readout short text for the ring label, e.g. '54MS'
//   value   the number behind the readout; unit names it
//   t       performance-timeline ms of the underlying event
//   raw     plain snapshot of the source data (PerformanceEntry.toJSON() etc.)
//
// Listeners receive the pooled slot. It is overwritten after HISTORY more events,
// so copy what you need instead of holding the reference.

const CONFIG = {
  HISTORY: 512,           // pooled slots; also the depth of the raw stream and debug log
  MIN_GAP_MS: {           // per-type throttle so bursty sources cannot flood the display
    pointer: 150,
    wheel: 100,
    drop: 50,
    mutation: 250,
    'input-delay': 50,
  },
};

export const STATUS = Object.freeze({
  WAITING: 'waiting',          // supported, nothing has happened yet
  LIVE: 'live',
  FALLBACK: 'fallback',        // primary API missing; a weaker real measurement is used
  UNSUPPORTED: 'unsupported',  // not exposed by this browser: shown as N/A, never simulated
  ERROR: 'error',
});

function blankSlot() {
  return { seq: 0, ch: '', type: '', label: '', readout: '', value: 0, unit: '', t: 0, fault: false, raw: null };
}

export function createBus() {
  const slots = new Array(CONFIG.HISTORY);
  for (let i = 0; i < CONFIG.HISTORY; i++) slots[i] = blankSlot();
  let seq = 0;

  const listeners = [];
  const statusListeners = [];
  const lastT = Object.create(null);
  const status = Object.create(null);
  const counts = Object.create(null);   // events delivered per channel
  const dropped = Object.create(null);  // events throttled per type (reported, not hidden)

  // Sources call this before building an event so throttled events cost nothing.
  function ready(type, t = performance.now()) {
    const gap = CONFIG.MIN_GAP_MS[type];
    if (!gap) return true;
    const last = lastT[type];
    if (last !== undefined && t - last < gap) {
      dropped[type] = (dropped[type] || 0) + 1;
      return false;
    }
    return true;
  }

  function emit(e) {
    if (CONFIG.MIN_GAP_MS[e.type]) {
      const now = performance.now();
      if (!ready(e.type, now)) return null;
      lastT[e.type] = now;
    }
    const t = typeof e.t === 'number' && Number.isFinite(e.t) ? e.t : performance.now();

    const s = slots[seq % CONFIG.HISTORY];
    s.seq = ++seq;
    s.ch = e.ch;
    s.type = e.type;
    s.label = String(e.label || e.type).toUpperCase();
    s.readout = String(e.readout ?? '').toUpperCase();
    s.value = Number.isFinite(e.value) ? e.value : 0;
    s.unit = e.unit || '';
    s.t = t;
    s.fault = !!e.fault;
    s.raw = e.raw ?? null;

    counts[e.ch] = (counts[e.ch] || 0) + 1;
    const st = status[e.ch];
    if (!st || st.state === STATUS.WAITING) setStatus(e.ch, STATUS.LIVE, st ? st.note : '');

    for (let i = 0; i < listeners.length; i++) listeners[i](s);
    return s;
  }

  function setStatus(ch, state, note = '') {
    const prev = status[ch];
    if (prev && prev.state === state && prev.note === note) return;
    // A channel that has delivered real events stays live; a later "waiting" must not hide that.
    if (prev && prev.state === STATUS.LIVE && state === STATUS.WAITING) return;
    status[ch] = { state, note };
    for (let i = 0; i < statusListeners.length; i++) statusListeners[i](ch, status[ch]);
  }

  // Newest first. fn returns false to stop early.
  function forEachRecent(n, fn) {
    const count = Math.min(n, seq, CONFIG.HISTORY);
    for (let i = 0; i < count; i++) {
      const s = slots[(seq - 1 - i) % CONFIG.HISTORY];
      if (fn(s) === false) break;
    }
  }

  return {
    ready,
    emit,
    setStatus,
    forEachRecent,
    on: (fn) => listeners.push(fn),
    onStatus: (fn) => statusListeners.push(fn),
    status,
    counts,
    dropped,
    get seq() { return seq; },
  };
}
