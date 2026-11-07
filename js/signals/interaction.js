// Interaction latency. Event Timing when exposed (it only reports events of 16 ms or
// more, by spec); otherwise the delay between a pointerdown's timestamp and its handler.
import { STATUS } from './bus.js';
import { observeEntries, fmtMs } from './support.js';

const CONFIG = {
  DURATION_THRESHOLD: 16, // ms; the lowest threshold the Event Timing spec allows
};

function eventRaw(e) {
  return {
    entryType: e.entryType, name: e.name, startTime: e.startTime, duration: e.duration,
    processingStart: e.processingStart, processingEnd: e.processingEnd,
    inputDelay: e.processingStart - e.startTime, interactionId: e.interactionId ?? null,
  };
}

export function startInteraction(bus) {
  // One interaction (a click) yields several entries (pointerdown, mouseup, click...)
  // sharing an interactionId; report it once. Hover events have no interactionId and
  // are not interactions, so they are skipped.
  let lastId = 0;

  function onEntry(e) {
    if (e.entryType === 'event') {
      const id = e.interactionId || 0;
      if (id === 0 || id === lastId) return;
      lastId = id;
    }
    const name = e.name.toUpperCase();
    bus.emit({
      ch: 'interaction', type: e.entryType === 'first-input' ? 'first-input' : 'event',
      label: `${e.entryType === 'first-input' ? 'FIRST INPUT' : 'INTERACTION'} ${name} ${fmtMs(e.duration)}`,
      readout: fmtMs(e.duration),
      value: e.duration, unit: 'ms', t: e.startTime, raw: eventRaw(e),
    });
  }

  const ok = observeEntries('event', onEntry, { durationThreshold: CONFIG.DURATION_THRESHOLD });
  observeEntries('first-input', onEntry);

  if (ok) {
    bus.setStatus('interaction', STATUS.WAITING, `Event Timing reports events of ${CONFIG.DURATION_THRESHOLD} ms or more`);
    return null;
  }

  // Fallback: still a real measurement, just a narrower one (input delay, not full duration).
  window.addEventListener('pointerdown', (ev) => {
    const now = performance.now();
    if (!bus.ready('input-delay', now)) return;
    const d = Math.max(0, now - ev.timeStamp);
    bus.emit({
      ch: 'interaction', type: 'input-delay',
      label: `INPUT DELAY ${fmtMs(d)}`, readout: fmtMs(d),
      value: d, unit: 'ms', t: ev.timeStamp,
      raw: { source: 'pointerdown timestamps', eventTimeStamp: ev.timeStamp, handledAt: now, delayMs: d, pointerType: ev.pointerType },
    });
  }, { passive: true });
  bus.setStatus('interaction', STATUS.FALLBACK, 'Event Timing not exposed; measuring handler delay from event timestamps');
  return null;
}
