// One entry per signal channel in the spec's signal map.
// `value` is the text shown next to the name; it stays an em dash until a
// real source writes to it. `live` flips the value colour to Sodium, `fault` to Fault.
// `status` mirrors the bus status ('waiting', 'live', 'fallback', 'unsupported', 'error').
// `valueW` caches the measured text width; -1 means "re-measure".

export const DASH = '—';
export const NA = 'N/A';

function channel(id, name) {
  return { id, name, value: DASH, live: false, fault: false, status: 'waiting', valueW: -1 };
}

// The core itself is the heap channel.
export const HEAP = channel('heap', 'HEAP');

// Rings, inner to outer. Resource is outermost because its packets arrive from the edge.
export const RING_CHANNELS = [
  channel('interaction', 'INTERACTION'),
  channel('frame', 'FRAME'),
  channel('longtask', 'LONGTASK'),
  channel('paint', 'PAINT/LCP/CLS'),
  channel('mutation', 'DOM MUTATION'),
  channel('input', 'POINTER/WHEEL'),
  channel('ping', 'PING'),
  channel('resource', 'RESOURCE'),
];

export function byId(id) {
  if (id === HEAP.id) return HEAP;
  for (let i = 0; i < RING_CHANNELS.length; i++) if (RING_CHANNELS[i].id === id) return RING_CHANNELS[i];
  return null;
}

export function setValue(ch, text, live = true, fault = false) {
  if (ch.value === text && ch.live === live && ch.fault === fault) return;
  ch.value = text;
  ch.live = live;
  ch.fault = fault;
  ch.valueW = -1;
}

export function isUnsupported(ch) {
  return ch.status === 'unsupported';
}
