// Audio controller: unlocks on the first user gesture (browser rule), owns mute
// (button + M key, remembered per viewer), and suspends while the tab is hidden.
// No AudioContext exists until a gesture: the page is silent until then.
import { createEngine } from './audio-engine.js';

const CONFIG = {
  ENERGY_HZ: 20,         // how often energy is pushed to the graph; ramps fill the gaps
  SUSPEND_AFTER_MS: 300, // let the duck ramp reach silence before suspending
  STORE_KEY: 'monolith.muted',
};

function readMuted() {
  try { return localStorage.getItem(CONFIG.STORE_KEY) === '1'; } catch { return false; }
}
function writeMuted(m) {
  try { localStorage.setItem(CONFIG.STORE_KEY, m ? '1' : '0'); } catch { /* storage blocked: fine */ }
}

export function createAudio(button) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const st = { ctx: null, engine: null, muted: readMuted(), supported: !!AC };
  let nextEnergy = 0;
  let suspendTimer = 0;

  function render() {
    if (!button) return;
    if (!st.supported) {
      button.textContent = 'Sound N/A';
      button.disabled = true;
      button.title = 'Web Audio is not available in this browser';
      return;
    }
    button.textContent = st.muted ? 'Sound off (M)' : 'Sound on (M)';
    button.setAttribute('aria-pressed', st.muted ? 'false' : 'true');
  }

  function unlock() {
    if (!st.supported || st.ctx) return;
    try {
      st.ctx = new AC();
      st.engine = createEngine(st.ctx);
      if (st.muted) st.engine.setMuted(true, st.ctx.currentTime);
      st.engine.start(st.ctx.currentTime + 0.02);
      if (st.ctx.state === 'suspended') st.ctx.resume();
    } catch (err) {
      // Kept for the debug log; the viewer just sees "Sound N/A".
      st.error = String(err && err.message || err);
      st.supported = false;
      st.ctx = null;
      st.engine = null;
      render();
    }
  }

  function toggle() {
    if (!st.supported) return;
    st.muted = !st.muted;
    writeMuted(st.muted);
    if (st.engine) st.engine.setMuted(st.muted, st.ctx.currentTime);
    render();
  }

  // Gestures that browsers accept as user activation.
  const gesture = () => unlock();
  for (const type of ['pointerdown', 'pointerup', 'keydown', 'click', 'touchend']) {
    window.addEventListener(type, gesture, { capture: true, passive: true });
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'm' || e.key === 'M') toggle();
  });
  if (button) button.addEventListener('click', toggle);

  document.addEventListener('visibilitychange', () => {
    if (!st.ctx) return;
    clearTimeout(suspendTimer);
    if (document.hidden) {
      st.engine.duck(st.ctx.currentTime);
      suspendTimer = setTimeout(() => { if (document.hidden) st.ctx.suspend(); }, CONFIG.SUSPEND_AFTER_MS);
    } else {
      st.ctx.resume().then(() => st.engine.unduck(st.ctx.currentTime));
    }
  });

  function live() {
    return st.engine && st.ctx.state === 'running' && !st.muted;
  }

  return {
    state: st,
    // Called every frame; pushes to the graph at ENERGY_HZ.
    update(energy, now) {
      if (!st.engine || now < nextEnergy) return;
      nextEnergy = now + 1000 / CONFIG.ENERGY_HZ;
      st.engine.setEnergy(energy, st.ctx.currentTime);
    },
    thud() { if (live()) st.engine.thud(st.ctx.currentTime); },
    tick() { if (live()) st.engine.tick(st.ctx.currentTime); },
    click() { if (live()) st.engine.click(st.ctx.currentTime); },
    render,
  };
}
