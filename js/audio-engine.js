// Procedural hum: the sound graph only. Works on any BaseAudioContext (live or offline),
// and every method takes an explicit start time, so tests can render it offline and
// measure it. All gain and pitch changes are ramped: nothing ever jumps, so no clicks.

const CONFIG = {
  MASTER: 0.16,          // overall level; the hum sits well under anything else playing
  FADE_IN: 0.6,          // s time constant of the first fade-in
  MUTE_TC: 0.05,         // s time constant for mute/unmute (about 0.25 s to silence)
  ENERGY_TC: 0.12,       // s time constant for activity-driven changes

  BASE_HZ: 55,           // A1
  DETUNE_CENTS: 7,       // between the two saws; slow beating gives the hum its life
  PITCH_RISE: 0.04,      // pitch rises 4% at full energy, like a motor spinning up
  DRONE_IDLE: 0.42,
  DRONE_FULL: 0.62,
  FIFTH_FULL: 0.22,      // the fifth only appears under load: the "high gear"
  CUTOFF_IDLE: 200,      // Hz
  CUTOFF_FULL: 2200,
  FILTER_Q: 5,
  LFO_HZ: 0.11,          // slow breathing of the filter
  LFO_DEPTH: 60,         // Hz
  NOISE_IDLE: 0.012,
  NOISE_FULL: 0.11,
  NOISE_BAND_IDLE: 500,  // Hz, centre of the noise band
  NOISE_BAND_FULL: 2600,

  THUD_GAIN: 0.55,       // long task
  TICK_GAIN: 0.018,      // ping: barely there, a heartbeat
  CLICK_GAIN: 0.14,      // press
};

function noiseBuffer(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export function createEngine(ctx) {
  const master = ctx.createGain();
  master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);

  // Drone: two detuned saws + an octave sine, through a resonant lowpass.
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = CONFIG.CUTOFF_IDLE;
  filter.Q.value = CONFIG.FILTER_Q;
  const drone = ctx.createGain();
  drone.gain.value = CONFIG.DRONE_IDLE;
  filter.connect(drone).connect(master);

  const oscs = [];
  function osc(type, mult, detune, gain) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = CONFIG.BASE_HZ * mult;
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.value = gain;
    o.connect(g).connect(filter);
    oscs.push({ o, mult, g });
    return g;
  }
  osc('sawtooth', 1, -CONFIG.DETUNE_CENTS, 0.5);
  osc('sawtooth', 1, CONFIG.DETUNE_CENTS, 0.5);
  osc('sine', 2, 0, 0.35);
  const fifth = osc('sawtooth', 1.5, 0, 0);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = CONFIG.LFO_HZ;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = CONFIG.LFO_DEPTH;
  lfo.connect(lfoGain).connect(filter.frequency);

  // Noise: looped white noise through a bandpass whose centre rises with energy.
  const noiseBuf = noiseBuffer(ctx, 2);
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = CONFIG.NOISE_BAND_IDLE;
  band.Q.value = 0.8;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = CONFIG.NOISE_IDLE;
  noise.connect(band).connect(noiseGain).connect(master);

  let started = false;
  let muted = false;

  function start(t) {
    if (started) return;
    started = true;
    for (const x of oscs) x.o.start(t);
    lfo.start(t);
    noise.start(t);
    master.gain.setValueAtTime(0, t);
    if (!muted) master.gain.setTargetAtTime(CONFIG.MASTER, t, CONFIG.FADE_IN);
  }

  function setMuted(m, t) {
    muted = m;
    master.gain.setTargetAtTime(m ? 0 : CONFIG.MASTER, t, CONFIG.MUTE_TC);
  }

  // Fast silence before a suspend, so the suspend never cuts a waveform mid-cycle.
  function duck(t) {
    master.gain.setTargetAtTime(0, t, CONFIG.MUTE_TC);
  }
  function unduck(t) {
    if (!muted) master.gain.setTargetAtTime(CONFIG.MASTER, t, CONFIG.MUTE_TC);
  }

  function setEnergy(e, t) {
    const k = Math.max(0, Math.min(1, e));
    const tc = CONFIG.ENERGY_TC;
    filter.frequency.setTargetAtTime(CONFIG.CUTOFF_IDLE + (CONFIG.CUTOFF_FULL - CONFIG.CUTOFF_IDLE) * k * k, t, tc);
    drone.gain.setTargetAtTime(CONFIG.DRONE_IDLE + (CONFIG.DRONE_FULL - CONFIG.DRONE_IDLE) * k, t, tc);
    fifth.gain.setTargetAtTime(CONFIG.FIFTH_FULL * k * k, t, tc);
    noiseGain.gain.setTargetAtTime(CONFIG.NOISE_IDLE + (CONFIG.NOISE_FULL - CONFIG.NOISE_IDLE) * k, t, tc);
    band.frequency.setTargetAtTime(CONFIG.NOISE_BAND_IDLE + (CONFIG.NOISE_BAND_FULL - CONFIG.NOISE_BAND_IDLE) * k, t, tc);
    const rise = 1 + CONFIG.PITCH_RISE * k;
    for (const x of oscs) x.o.frequency.setTargetAtTime(CONFIG.BASE_HZ * x.mult * rise, t, tc);
  }

  // One-shot voice with a ramped envelope: linear attack from 0, exponential release.
  function envelope(node, t, peak, attack, release) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    // tc = release/6: by the stop time (1.5 x release) the voice is at e^-9 of its peak,
    // so stopping the source cannot click.
    g.gain.setTargetAtTime(0, t + attack, release / 6);
    node.connect(g).connect(master);
    return t + attack + release * 1.5;
  }

  // Long task: a low thud that drops in pitch.
  function thud(t) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.3);
    const end = envelope(o, t, CONFIG.THUD_GAIN, 0.012, 0.32);
    o.start(t);
    o.stop(end);
  }

  // Ping: a faint high tick.
  function tick(t) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 1760;
    const end = envelope(o, t, CONFIG.TICK_GAIN, 0.006, 0.06);
    o.start(t);
    o.stop(end);
  }

  // Press: a short burst of high-passed noise.
  function click(t) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2500;
    s.connect(hp);
    const end = envelope(hp, t, CONFIG.CLICK_GAIN, 0.004, 0.08);
    s.start(t, Math.random());
    s.stop(end);
  }

  return { start, setMuted, duck, unduck, setEnergy, thud, tick, click, get started() { return started; } };
}
