// One entry per signal channel in the spec's signal map.
// `value` is the text shown next to the name; it stays an em dash until a
// real source writes to it. `live` flips the value colour to Sodium.
// `valueW` caches the measured text width; -1 means "re-measure".

function channel(id, name) {
  return { id, name, value: '—', live: false, valueW: -1 };
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
  return RING_CHANNELS.find((c) => c.id === id) || null;
}

export function setValue(ch, text, live = true) {
  if (ch.value === text && ch.live === live) return;
  ch.value = text;
  ch.live = live;
  ch.valueW = -1;
}
