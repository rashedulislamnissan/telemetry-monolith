// Round-trip time to this page's own host: a cache-busted same-origin fetch of ping.txt.
// This is the only network request the page makes after load.
import { STATUS } from './bus.js';
import { fmtMs } from './support.js';

const CONFIG = {
  URL: './ping.txt',
  INTERVAL_MS: 1000,  // gap between the end of one ping and the start of the next
  TIMEOUT_MS: 3000,
};

export function startPing(bus) {
  if (typeof fetch !== 'function') {
    bus.setStatus('ping', STATUS.UNSUPPORTED, 'fetch not available');
    return null;
  }
  bus.setStatus('ping', STATUS.WAITING, '');

  let seq = 0;
  let timer = 0;
  let running = false;

  async function once() {
    timer = 0;
    const n = ++seq;
    const url = `${CONFIG.URL}?n=${n}&t=${Date.now()}`;
    const ac = typeof AbortController === 'function' ? new AbortController() : null;
    const kill = ac ? setTimeout(() => ac.abort(), CONFIG.TIMEOUT_MS) : 0;
    const t0 = performance.now();
    try {
      const res = await fetch(url, { cache: 'no-store', signal: ac ? ac.signal : undefined });
      const body = await res.text();
      const rtt = performance.now() - t0;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Resource Timing gives the server's share of the round trip, when exposed.
      let ttfb = null;
      const list = performance.getEntriesByName?.(new URL(url, location.href).href) || [];
      const en = list[list.length - 1];
      if (en && en.responseStart > 0 && en.requestStart > 0) ttfb = en.responseStart - en.requestStart;

      bus.emit({
        ch: 'ping', type: 'ping', label: `PING ${fmtMs(rtt)}`, readout: fmtMs(rtt),
        value: rtt, unit: 'ms', t: t0,
        raw: { source: 'fetch', seq: n, url, status: res.status, bytes: body.length, rttMs: rtt, ttfbMs: ttfb },
      });
    } catch (err) {
      bus.emit({
        ch: 'ping', type: 'ping-fail', label: 'PING FAIL', readout: 'FAIL',
        value: performance.now() - t0, unit: 'ms', t: t0, fault: true,
        raw: { source: 'fetch', seq: n, url, error: err && err.name === 'AbortError' ? `timeout ${CONFIG.TIMEOUT_MS}ms` : String(err && err.message || err) },
      });
    } finally {
      if (kill) clearTimeout(kill);
    }
    if (running) timer = setTimeout(once, CONFIG.INTERVAL_MS);
  }

  function resume() {
    if (running) return;
    running = true;
    once();
  }
  function pause() {
    running = false;
    clearTimeout(timer);
    timer = 0;
  }

  resume();
  return { pause, resume };
}
