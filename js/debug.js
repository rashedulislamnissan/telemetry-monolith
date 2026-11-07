// Debug log, enabled with ?debug in the URL. Lists every channel's support status and
// the latest bus events. Marked data-self so the mutation source ignores its updates.

const CONFIG = {
  REFRESH_MS: 250,
  ROWS: 36,
};

const CHANNELS = ['frame', 'longtask', 'paint', 'resource', 'interaction', 'heap', 'ping', 'input', 'mutation', 'device', 'visibility'];

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

export function startDebug(bus) {
  if (!new URLSearchParams(location.search).has('debug')) return false;

  const box = document.createElement('aside');
  box.className = 'debug';
  box.setAttribute('data-self', '');
  box.setAttribute('aria-label', 'Signal debug log');
  const pre = document.createElement('pre');
  box.appendChild(pre);
  document.body.appendChild(box);

  // Test hook: lets automated checks read the bus directly.
  window.__telemetry = bus;

  setInterval(() => {
    const lines = ['CHANNEL      STATUS       EVENTS  NOTE'];
    for (const ch of CHANNELS) {
      const st = bus.status[ch] || { state: '-', note: '' };
      lines.push(`${pad(ch, 12)} ${pad(st.state, 12)} ${pad(bus.counts[ch] || 0, 7)} ${st.note}`);
    }
    const dropped = Object.entries(bus.dropped).map(([k, v]) => `${k}:${v}`).join(' ');
    lines.push(`throttled: ${dropped || 'none'}`, '', 'T(MS)      CH           LABEL');
    bus.forEachRecent(CONFIG.ROWS, (e) => {
      lines.push(`${pad(e.t.toFixed(1), 10)} ${pad(e.ch, 12)} ${e.label}`);
    });
    pre.textContent = lines.join('\n');
  }, CONFIG.REFRESH_MS);
  return true;
}
