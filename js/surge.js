// Surge: how hard the machine is being driven, from real input only.
// Cursor speed, wheel deltas and presses raise `energy`; it decays when input stops.
// Renderers read it to bend beams, spin rings and (M5) push the hum. It is never shown
// as a number: the real numbers live in the gauges and the input channel.
import { kinematics } from './signals/pointer.js';

const CONFIG = {
  STALE_MS: 70,          // no pointermove for this long = the cursor is still (speed 0, not stale)
  SPEED_FULL: 3000,      // px/s that reads as full energy (log scale below it)
  RISE: 14,              // per second, energy attack
  FALL: 1.6,             // per second, energy release
  WHEEL_ENERGY: 0.0012,  // energy per px of wheel
  WHEEL_SPIN: 0.004,     // rad/s of extra ring spin per px of wheel
  SPIN_MAX: 6,           // rad/s cap on wheel spin
  SPIN_DECAY: 1.4,       // per second
  PRESS_ENERGY: 0.45,
  BEND_BASE: 0.18,       // share of the way a conduit's control point leans to a resting cursor
  BEND_ENERGY: 0.5,      // extra lean at full energy
  BEND_EASE: 7,          // per second, how fast bends follow
};

export function createSurge() {
  const s = {
    energy: 0,
    spin: 0,           // rad/s, signed; wheel down = clockwise
    bend: 0,           // 0..1 lean of conduits toward the cursor
    present: false,    // a pointer is over the page (mouse hover or finger down)
    moving: false,
    x: 0, y: 0, vx: 0, vy: 0,
    speed: 0, accel: 0, jerk: 0, // real kinematics; 0 when the cursor is still
  };

  function onWheel(px) {
    s.spin = Math.max(-CONFIG.SPIN_MAX, Math.min(CONFIG.SPIN_MAX, s.spin + px * CONFIG.WHEEL_SPIN));
    s.energy = Math.min(1, s.energy + Math.abs(px) * CONFIG.WHEEL_ENERGY);
  }

  function onPress() {
    s.energy = Math.min(1, s.energy + CONFIG.PRESS_ENERGY);
  }

  function update(dt, motion) {
    const k = kinematics;
    const age = performance.now() - k.t;
    s.present = k.active;
    s.moving = k.active && age < CONFIG.STALE_MS;
    s.x = k.x;
    s.y = k.y;
    // The cursor stopped: real velocity is zero, whatever the last event said.
    s.speed = s.moving ? k.speed : 0;
    s.accel = s.moving ? k.accel : 0;
    s.jerk = s.moving ? k.jerk : 0;
    s.vx = s.moving ? k.vx : 0;
    s.vy = s.moving ? k.vy : 0;

    const target = Math.min(1, Math.log1p(s.speed) / Math.log1p(CONFIG.SPEED_FULL));
    if (target > s.energy) s.energy += (target - s.energy) * (1 - Math.exp(-CONFIG.RISE * dt));
    else s.energy = Math.max(target, s.energy * Math.exp(-CONFIG.FALL * dt));

    s.spin *= Math.exp(-CONFIG.SPIN_DECAY * dt);

    const bendTarget = s.present ? (CONFIG.BEND_BASE + CONFIG.BEND_ENERGY * s.energy) * motion : 0;
    s.bend += (bendTarget - s.bend) * (1 - Math.exp(-CONFIG.BEND_EASE * dt));
  }

  return { state: s, update, onWheel, onPress };
}
