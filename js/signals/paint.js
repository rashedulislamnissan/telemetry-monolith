// Paint timing, Largest Contentful Paint and layout shifts. The channel is live if
// any of the three is exposed; the missing ones are listed in the status note.
import { STATUS } from './bus.js';
import { observeEntries, fmtMs, snapshot } from './support.js';

const NAMES = { 'first-paint': 'FP', 'first-contentful-paint': 'FCP' };

export function startPaint(bus) {
  let cls = 0;

  const paint = observeEntries('paint', (e) => {
    const short = NAMES[e.name] || e.name.toUpperCase();
    bus.emit({
      ch: 'paint', type: short.toLowerCase(),
      label: `${short} ${fmtMs(e.startTime)}`, readout: `${short} ${fmtMs(e.startTime)}`,
      value: e.startTime, unit: 'ms', t: e.startTime, raw: snapshot(e),
    });
  });

  const lcp = observeEntries('largest-contentful-paint', (e) => {
    const at = e.renderTime || e.loadTime || e.startTime;
    const raw = snapshot(e);
    raw.element = e.element ? e.element.nodeName : null; // name only, never a live node
    bus.emit({
      ch: 'paint', type: 'lcp',
      label: `LCP ${fmtMs(at)} ${e.size}PX²`, readout: `LCP ${fmtMs(at)}`,
      value: at, unit: 'ms', t: e.startTime, raw,
    });
  });

  const shift = observeEntries('layout-shift', (e) => {
    // Shifts right after input are expected and excluded from CLS by definition.
    if (!e.hadRecentInput) cls += e.value;
    bus.emit({
      ch: 'paint', type: 'layout-shift',
      label: `SHIFT ${e.value.toFixed(4)}`, readout: `CLS ${cls.toFixed(4)}`,
      value: e.value, unit: 'score', t: e.startTime,
      raw: {
        entryType: e.entryType, startTime: e.startTime, value: e.value,
        hadRecentInput: e.hadRecentInput, cumulative: cls,
        sources: e.sources ? e.sources.length : 0,
      },
    });
  });

  const missing = [];
  if (!paint) missing.push('paint');
  if (!lcp) missing.push('LCP');
  if (!shift) missing.push('layout-shift');

  if (missing.length === 3) {
    bus.setStatus('paint', STATUS.UNSUPPORTED, 'paint, LCP and layout-shift entries not exposed');
  } else {
    bus.setStatus('paint', STATUS.WAITING, missing.length ? `Not exposed: ${missing.join(', ')}` : '');
  }
  return null;
}
