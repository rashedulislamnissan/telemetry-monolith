// Real frame timing from requestAnimationFrame deltas.
// History lives in a fixed ring buffer so recording a frame never allocates.

const CONFIG = {
  HISTORY: 240,   // frames kept; one tick each on the FRAME ring (4 s at 60 Hz)
  SMOOTH: 0.08,   // EMA factor for the readout; higher reacts faster but flickers
};

export class FrameClock {
  constructor() {
    this.size = CONFIG.HISTORY;
    this.hist = new Float32Array(CONFIG.HISTORY);
    this.head = 0;      // next slot to write
    this.count = 0;     // filled slots, up to size
    this.last = 0;      // previous rAF timestamp; 0 = no baseline yet
    this.smoothed = 0;  // EMA of frame time in ms
    this.latest = 0;
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
    return d;
  }

  reset() {
    this.last = 0;
  }
}
