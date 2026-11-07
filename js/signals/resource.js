// Every file this page loads, from Resource Timing.
import { STATUS } from './bus.js';
import { observeEntries, fmtBytes, fileName, clip, snapshot } from './support.js';

const CONFIG = {
  // The ping channel already reports its own request; listing it here too would
  // make one request look like two events and drown out real loads.
  EXCLUDE: /\/ping\.txt(\?|$)/,
  NAME_MAX: 14,   // characters of file name kept in the ring readout
};

function sizeText(e) {
  // transferSize 0 with a body means it came from cache; label that rather than "0B".
  if (typeof e.transferSize === 'number' && e.transferSize > 0) return fmtBytes(e.transferSize);
  if (e.decodedBodySize > 0) return 'CACHE';
  if (e.encodedBodySize > 0) return fmtBytes(e.encodedBodySize);
  return '0B';
}

export function startResource(bus) {
  const ok = observeEntries('resource', (e) => {
    if (CONFIG.EXCLUDE.test(e.name)) return;
    const name = clip(fileName(e.name), CONFIG.NAME_MAX);
    const size = sizeText(e);
    bus.emit({
      ch: 'resource', type: 'resource',
      label: `RES ${name} ${size}`, readout: `${name} ${size}`,
      value: e.transferSize || e.encodedBodySize || 0, unit: 'bytes', t: e.startTime,
      raw: snapshot(e),
    });
  });

  if (ok) {
    // The ping adds an entry every second; clearing the buffer stops it filling up.
    // Observers still receive every entry, so nothing is lost.
    performance.addEventListener?.('resourcetimingbufferfull', () => performance.clearResourceTimings());
  }
  bus.setStatus('resource', ok ? STATUS.WAITING : STATUS.UNSUPPORTED,
    ok ? '' : 'resource entries not exposed');
  return null;
}
