// Design tokens shared by every renderer. Mirrors the CSS custom properties.
// Sodium is reserved for live data and Fault for long tasks and errors,
// so colour itself tells the viewer what is real.
export const PALETTE = Object.freeze({
  void: '#000000',     // pure black so additive light reads as emission
  graphite: '#1F1D1B', // grid lines, unlit structure, N/A rings
  ash: '#7E776F',      // secondary labels
  bone: '#ECE5D8',     // primary structure and labels
  sodium: '#FF9E1B',   // live data only
  fault: '#FF2B3A',    // long tasks, dropped frames, errors only
});

export const MONO_STACK =
  'ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

// Build font strings on resize only; never per frame.
export function monoFont(px, weight = 400) {
  return `${weight} ${px}px ${MONO_STACK}`;
}

export const TAU = Math.PI * 2;
