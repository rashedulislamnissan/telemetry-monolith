// Real frame timing from requestAnimationFrame deltas.
// History lives in a fixed ring buffer so recording a frame never allocates.

const CONFIG = {
  HISTORY: 240,      // frames kept; one tick each on the FRAME ring (4 s at 60 Hz)
  SMOOTH: 0.08,      // EMA factor for the readout; higher reacts faster but flickers
  SAMPLE_MS: 500,    // how often a smoothed FRAME event goes to the bus
  DROP_MS: 25,       // ~1.5x the 60 Hz budget; slower frames are reported as drops
};

export const FRAME_DROP_MS = CONFIG.DROP_MS;

export class FrameClock {
  constructor() {
    this.size = CONFIG.HISTORY;
    this.hist = new Float32Array(CONFIG.HISTORY);
    this.head = 0;      // next slot to write
    this.count = 0;     // filled slots, up to size
    this.last = 0;      // previous rAF timestamp; 0 = no baseline yet
    this.smoothed = 0;  // EMA of frame time in ms
    this.latest = 0;
    this.bus = null;
    this.nextSample = 0;
  }

  attach(bus) {
    this.bus = bus;
  }

  // Returns the delta in ms, or 0 on the first frame after a reset
  // (a tab thaw is a gap, not a slow frame, so it must not be recorded).
  tick(now) {
    if (this.last === 0) {
      this.last = now;
      return 0;
    }
    const d = now - this.last;
    this.last = now;
    this.latest = d;
    this.hist[this.head] = d;
    this.head = (this.head + 1) % this.size;
    if (this.count < this.size) this.count++;
    this.smoothed = this.smoothed === 0 ? d : this.smoothed + (d - this.smoothed) * CONFIG.SMOOTH;
    if (this.bus) this.report(d, now);
    return d;
  }

  report(d, now) {
    const bus = this.bus;
    if (d > CONFIG.DROP_MS && bus.ready('drop', now)) {
      const ms = d.toFixed(1);
      bus.emit({
        ch: 'frame', type: 'drop', label: `FRAME DROP ${ms}MS`, readout: `${ms}MS`,
        value: d, unit: 'ms', t: now, fault: true,
        raw: { source: 'requestAnimationFrame', deltaMs: d, budgetMs: CONFIG.DROP_MS, timestamp: now },
      });
    }
    if (now >= this.nextSample) {
      this.nextSample = now + CONFIG.SAMPLE_MS;
      // Two decimals: real frames jitter by hundredths (16.65, 16.71...); one decimal
      // rounds that away and makes a live reading look frozen.
      const ms = this.smoothed.toFixed(2);
      bus.emit({
        ch: 'frame', type: 'frame', label: `FRAME ${ms}MS`, readout: `${ms}MS`,
        value: this.smoothed, unit: 'ms', t: now,
        raw: { source: 'requestAnimationFrame', smoothedMs: this.smoothed, lastDeltaMs: d, ema: CONFIG.SMOOTH, timestamp: now },
      });
    }
  }

  reset() {
    this.last = 0;
  }
}
