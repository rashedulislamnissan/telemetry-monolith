// Starts every source in the signal map. A source that throws is marked as an error
// on its channel instead of taking the page down.
import { STATUS } from './bus.js';
import { startVisibility } from './visibility.js';
import { startDevice } from './device.js';
import { startLongtask } from './longtask.js';
import { startPaint } from './paint.js';
import { startResource } from './resource.js';
import { startInteraction } from './interaction.js';
import { startHeap } from './heap.js';
import { startPing } from './ping.js';
import { startPointer } from './pointer.js';
import { startMutation } from './mutation.js';

const SOURCES = [
  ['visibility', startVisibility],
  ['device', startDevice],
  ['longtask', startLongtask],
  ['paint', startPaint],
  ['resource', startResource],
  ['interaction', startInteraction],
  ['heap', startHeap],
  ['ping', startPing],
  ['input', startPointer],
  ['mutation', startMutation],
];

export function startSignals(bus, clock) {
  clock.attach(bus);
  bus.setStatus('frame', STATUS.WAITING, 'requestAnimationFrame deltas');

  const handles = [];
  for (const [ch, start] of SOURCES) {
    try {
      const h = start(bus);
      if (h) handles.push(h);
    } catch (err) {
      bus.setStatus(ch, STATUS.ERROR, String(err && err.message || err));
    }
  }

  return {
    pause() { for (const h of handles) h.pause && h.pause(); },
    resume() { for (const h of handles) h.resume && h.resume(); },
  };
}
