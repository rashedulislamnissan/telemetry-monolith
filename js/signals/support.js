// Feature detection and formatting shared by the sources.

export function entrySupported(type) {
  return (
    typeof PerformanceObserver === 'function' &&
    Array.isArray(PerformanceObserver.supportedEntryTypes) &&
    PerformanceObserver.supportedEntryTypes.includes(type)
  );
}

// Observe one entry type (buffered, so entries from before boot are delivered too).
// Returns false when the browser does not expose the type; never throws.
export function observeEntries(type, onEntry, extra) {
  if (!entrySupported(type)) return false;
  try {
    const po = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (let i = 0; i < entries.length; i++) onEntry(entries[i]);
    });
    po.observe(Object.assign({ type, buffered: true }, extra));
    return true;
  } catch {
    return false;
  }
}

export function fmtMs(ms) {
  if (ms >= 10000) return `${(ms / 1000).toFixed(1)}S`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}S`;
  if (ms >= 100) return `${Math.round(ms)}MS`;
  return `${ms.toFixed(1)}MS`;
}

export function fmtBytes(b) {
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)}MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${Math.round(b)}B`;
}

export function fileName(url) {
  try {
    const u = new URL(url, location.href);
    const last = u.pathname.split('/').filter(Boolean).pop();
    return last || u.host || url;
  } catch {
    return String(url);
  }
}

export function clip(s, n) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// PerformanceEntry -> plain object, so raw data survives after the entry is gone
// and never holds DOM references.
export function snapshot(entry) {
  const out = typeof entry.toJSON === 'function' ? entry.toJSON() : {};
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (v && typeof v === 'object' && typeof v.nodeType === 'number') out[k] = v.nodeName;
  }
  return out;
}
