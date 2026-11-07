// Adaptive quality. Watches the real smoothed frame time; when the page cannot hold its
// frame rate it steps down a level (render scale, particle and label caps, decorative
// detail) instead of stuttering, and steps back up once frames are healthy again.

const CONFIG = {
  LEVELS: [
    { dpr: 2, particles: 160, labels: 28, shimmer: true, flow: true },
    { dpr: 1.5, particles: 110, labels: 20, shimmer: false, flow: true },
    { dpr: 1.25, particles: 70, labels: 14, shimmer: false, flow: false },
    { dpr: 1, particles: 45, labels: 10, shimmer: false, flow: false },
  ],
  SLOW_MS: 22,          // smoothed frame time above this is struggling (below ~45 fps)
  FAST_MS: 18,          // below this is healthy (60 Hz runs at 16.7)
  DEGRADE_AFTER: 1.5,   // s of struggling before stepping down
  RESTORE_AFTER: 6,     // s of health before stepping back up; slower than degrading on purpose
  SETTLE: 2,            // s ignored after any change; the change itself (a resize) costs a frame
  BACKOFF: 2,           // a step down soon after a restore doubles the restore wait
  RECENT: 20,           // s; "soon after a restore"
  RESTORE_MAX: 60,      // s cap on the restore wait
};

export function createQuality() {
  const st = {
    level: 0,
    settings: CONFIG.LEVELS[0],
    slowFor: 0,
    fastFor: 0,
    settle: CONFIG.SETTLE,
    restoreWait: CONFIG.RESTORE_AFTER,
    sinceRestore: Infinity,
    changes: 0,
  };

  function set(level) {
    st.level = level;
    st.settings = CONFIG.LEVELS[level];
    st.slowFor = 0;
    st.fastFor = 0;
    st.settle = CONFIG.SETTLE;
    st.changes++;
  }

  // dt in seconds of real time, frameMs = smoothed frame time. Returns true on a change.
  function update(dt, frameMs) {
    if (st.settle > 0) {
      st.settle -= dt;
      return false;
    }
    if (frameMs > CONFIG.SLOW_MS) {
      st.slowFor += dt;
      st.fastFor = 0;
    } else if (frameMs < CONFIG.FAST_MS) {
      st.fastFor += dt;
      st.slowFor = 0;
    } else {
      st.slowFor = 0;
      st.fastFor = 0;
    }

    st.sinceRestore += dt;
    if (st.slowFor >= CONFIG.DEGRADE_AFTER && st.level < CONFIG.LEVELS.length - 1) {
      // Dropping again soon after a restore means the restore was premature: wait longer next time.
      if (st.sinceRestore < CONFIG.RECENT && st.restoreWait < CONFIG.RESTORE_MAX) st.restoreWait *= CONFIG.BACKOFF;
      set(st.level + 1);
      return true;
    }
    if (st.fastFor >= st.restoreWait && st.level > 0) {
      set(st.level - 1);
      st.sinceRestore = 0;
      return true;
    }
    return false;
  }

  return { state: st, update, levels: CONFIG.LEVELS.length };
}
