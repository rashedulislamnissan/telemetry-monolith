// Tab visibility. main.js pauses the loop and the polling sources; this reports it.
import { STATUS } from './bus.js';
import { fmtMs } from './support.js';

export function startVisibility(bus) {
  if (typeof document.visibilityState !== 'string') {
    bus.setStatus('visibility', STATUS.UNSUPPORTED, 'Page Visibility not exposed');
    return null;
  }
  bus.setStatus('visibility', STATUS.LIVE, '');
  let hiddenAt = 0;

  document.addEventListener('visibilitychange', () => {
    const t = performance.now();
    if (document.hidden) {
      hiddenAt = t;
      bus.emit({ ch: 'visibility', type: 'hidden', label: 'TAB HIDDEN', readout: 'HIDDEN', value: 0, unit: '', t, raw: { visibilityState: document.visibilityState } });
    } else {
      const away = hiddenAt ? t - hiddenAt : 0;
      bus.emit({ ch: 'visibility', type: 'visible', label: `TAB VISIBLE AFTER ${fmtMs(away)}`, readout: 'VISIBLE', value: away, unit: 'ms', t, raw: { visibilityState: document.visibilityState, hiddenForMs: away } });
    }
  });
  return null;
}
