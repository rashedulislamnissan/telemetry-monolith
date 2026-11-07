// Main-thread tasks over 50 ms, straight from the Long Tasks API.
import { STATUS } from './bus.js';
import { observeEntries, fmtMs, snapshot } from './support.js';

export function startLongtask(bus) {
  const ok = observeEntries('longtask', (e) => {
    bus.emit({
      ch: 'longtask', type: 'longtask',
      label: `LONGTASK ${fmtMs(e.duration)}`, readout: fmtMs(e.duration),
      value: e.duration, unit: 'ms', t: e.startTime, fault: true,
      raw: snapshot(e),
    });
  });
  bus.setStatus('longtask', ok ? STATUS.WAITING : STATUS.UNSUPPORTED,
    ok ? 'No task over 50 ms yet' : 'longtask entries not exposed');
  return null;
}
