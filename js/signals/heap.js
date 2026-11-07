// JS heap from performance.memory (Chromium only, and quantised by the browser).
import { STATUS } from './bus.js';
import { fmtBytes } from './support.js';

const CONFIG = {
  POLL_MS: 1000,
  GC_DROP: 256 * 1024, // bytes; a fall bigger than this between polls is reported as GC
};

// Latest reading, for renderers (core size in M3). null = not exposed.
export const heapState = { used: null, total: null, limit: null };

export function startHeap(bus) {
  const mem = performance.memory;
  if (!mem || typeof mem.usedJSHeapSize !== 'number') {
    bus.setStatus('heap', STATUS.UNSUPPORTED, 'performance.memory is Chromium-only');
    return null;
  }
  bus.setStatus('heap', STATUS.WAITING, 'Values are quantised by the browser');

  let prev = 0;
  let timer = 0;

  function poll() {
    const used = mem.usedJSHeapSize;
    const t = performance.now();
    const raw = {
      source: 'performance.memory', usedJSHeapSize: used,
      totalJSHeapSize: mem.totalJSHeapSize, jsHeapSizeLimit: mem.jsHeapSizeLimit,
    };
    heapState.used = used;
    heapState.total = mem.totalJSHeapSize;
    heapState.limit = mem.jsHeapSizeLimit;

    if (prev && prev - used > CONFIG.GC_DROP) {
      const drop = prev - used;
      bus.emit({
        ch: 'heap', type: 'gc', label: `GC -${fmtBytes(drop)}`, readout: fmtBytes(used),
        value: -drop, unit: 'bytes', t, raw: Object.assign({ previousUsed: prev }, raw),
      });
    } else {
      bus.emit({
        ch: 'heap', type: 'heap', label: `HEAP ${fmtBytes(used)}`, readout: fmtBytes(used),
        value: used, unit: 'bytes', t, raw,
      });
    }
    prev = used;
  }

  function resume() {
    if (timer) return;
    poll();
    timer = setInterval(poll, CONFIG.POLL_MS);
  }
  function pause() {
    clearInterval(timer);
    timer = 0;
  }

  resume();
  return { pause, resume };
}
