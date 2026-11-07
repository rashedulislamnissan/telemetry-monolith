// Cursor kinematics (velocity, acceleration, jerk), presses and wheel deltas.
// The page never scrolls; wheel input is read as a virtual scroll.
import { STATUS } from './bus.js';

const CONFIG = {
  SMOOTH: 0.35,       // EMA on the derivatives; raw jerk from 1 ms events is mostly noise
  MAX_GAP_S: 0.25,    // a longer gap between moves starts a new stroke instead of a huge spike
  LINE_PX: 16,        // wheel deltaMode 1 (lines) to px
};

// Shared, mutated in place; M4 reads it to bend beams and spike gauges.
export const kinematics = {
  x: 0, y: 0, vx: 0, vy: 0, speed: 0, accel: 0, jerk: 0, t: 0,
  active: false, pointerType: '', down: false,
};

export function startPointer(bus) {
  if (typeof window.PointerEvent !== 'function') {
    bus.setStatus('input', STATUS.UNSUPPORTED, 'Pointer Events not exposed');
    return null;
  }
  bus.setStatus('input', STATUS.WAITING, '');
  const k = kinematics;
  let wheelAcc = 0;

  window.addEventListener('pointermove', (e) => {
    const t = e.timeStamp;
    const dt = (t - k.t) / 1000;
    if (k.active && dt > 0 && dt < CONFIG.MAX_GAP_S) {
      const vx = (e.clientX - k.x) / dt;
      const vy = (e.clientY - k.y) / dt;
      const v = Math.hypot(vx, vy);
      const a = (v - k.speed) / dt;
      const j = (a - k.accel) / dt;
      k.vx += (vx - k.vx) * CONFIG.SMOOTH;
      k.vy += (vy - k.vy) * CONFIG.SMOOTH;
      k.speed += (v - k.speed) * CONFIG.SMOOTH;
      k.accel += (a - k.accel) * CONFIG.SMOOTH;
      k.jerk += (j - k.jerk) * CONFIG.SMOOTH;
    } else {
      k.vx = 0; k.vy = 0; k.speed = 0; k.accel = 0; k.jerk = 0;
    }
    k.x = e.clientX;
    k.y = e.clientY;
    k.t = t;
    k.active = true;
    k.pointerType = e.pointerType;

    if (!bus.ready('pointer')) return;
    const s = Math.round(k.speed);
    bus.emit({
      ch: 'input', type: 'pointer', label: `PTR ${s}PX/S`, readout: `${s}PX/S`,
      value: k.speed, unit: 'px/s', t,
      raw: {
        source: 'pointermove', pointerType: e.pointerType, x: e.clientX, y: e.clientY,
        speedPxS: k.speed, accelPxS2: k.accel, jerkPxS3: k.jerk,
      },
    });
  }, { passive: true });

  window.addEventListener('pointerdown', (e) => {
    k.down = true;
    // A touch has no hover, so the stroke starts here: anchor position, zero velocity.
    if (!k.active || e.pointerType !== 'mouse') {
      k.vx = 0; k.vy = 0; k.speed = 0; k.accel = 0; k.jerk = 0;
    }
    k.x = e.clientX;
    k.y = e.clientY;
    k.t = e.timeStamp;
    k.active = true;
    k.pointerType = e.pointerType;
    bus.emit({
      ch: 'input', type: 'pointerdown', label: `PTR DOWN ${e.pointerType.toUpperCase()}`,
      // Touch coordinates are fractional; the readout rounds, raw keeps them exact.
      readout: `DOWN ${Math.round(e.clientX)},${Math.round(e.clientY)}`, value: 1, unit: '', t: e.timeStamp,
      raw: { source: 'pointerdown', pointerType: e.pointerType, x: e.clientX, y: e.clientY, button: e.button, pressure: e.pressure },
    });
  }, { passive: true });

  // A lifted finger or pen is gone; a mouse is still hovering.
  const up = (e) => {
    k.down = false;
    if (e.pointerType !== 'mouse') k.active = false;
  };
  window.addEventListener('pointerup', up, { passive: true });
  window.addEventListener('pointercancel', up, { passive: true });
  // pointerleave does not bubble and never reaches window; the root element gets it
  // when the pointer leaves the viewport.
  document.documentElement.addEventListener('pointerleave', () => { k.active = false; }, { passive: true });

  window.addEventListener('wheel', (e) => {
    const scale = e.deltaMode === 1 ? CONFIG.LINE_PX : e.deltaMode === 2 ? window.innerHeight : 1;
    wheelAcc += e.deltaY * scale;
    if (!bus.ready('wheel')) return;
    const d = Math.round(wheelAcc);
    wheelAcc = 0;
    bus.emit({
      ch: 'input', type: 'wheel', label: `WHEEL ${d > 0 ? '+' : ''}${d}PX`, readout: `WHEEL ${d}PX`,
      value: d, unit: 'px', t: e.timeStamp,
      raw: { source: 'wheel', deltaY: e.deltaY, deltaX: e.deltaX, deltaMode: e.deltaMode, accumulatedPx: d },
    });
  }, { passive: true });

  return null;
}
