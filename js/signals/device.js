// Static device facts for the readout panel. null means "not exposed by this browser".
import { STATUS } from './bus.js';

const CONFIG = {
  RESIZE_DEBOUNCE_MS: 300,
  MAX_RENDER_DPR: 2, // must match main.js; the panel shows both real and render DPR
};

export const device = {
  version: 0,          // bumps on change so the panel rebuilds its strings only then
  threads: null,
  memoryGB: null,
  dpr: 1,
  renderDpr: 1,
  vw: 0,
  vh: 0,
  net: null,           // { effectiveType, rttMs, downlinkMbps, saveData }
};

function read() {
  const nav = navigator;
  device.threads = typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null;
  device.memoryGB = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null;
  device.dpr = window.devicePixelRatio || 1;
  // renderDpr is owned by main.js (cap + adaptive quality); only seed it here.
  if (device.version === 0) device.renderDpr = Math.min(device.dpr, CONFIG.MAX_RENDER_DPR);
  device.vw = window.innerWidth;
  device.vh = window.innerHeight;
  const c = nav.connection;
  device.net = c && typeof c.effectiveType === 'string'
    ? { effectiveType: c.effectiveType, rttMs: c.rtt ?? null, downlinkMbps: c.downlink ?? null, saveData: !!c.saveData }
    : null;
  device.version++;
}

export function startDevice(bus) {
  function update(reason) {
    read();
    bus.emit({
      ch: 'device', type: 'device',
      label: `VIEWPORT ${device.vw}X${device.vh} DPR ${device.dpr}`,
      readout: `${device.vw}X${device.vh}`, value: device.vw * device.vh, unit: 'px',
      raw: {
        reason, hardwareConcurrency: device.threads, deviceMemory: device.memoryGB,
        devicePixelRatio: device.dpr, renderDpr: device.renderDpr,
        innerWidth: device.vw, innerHeight: device.vh, connection: device.net,
      },
    });
  }

  let timer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => update('resize'), CONFIG.RESIZE_DEBOUNCE_MS);
  });
  navigator.connection?.addEventListener?.('change', () => update('connection change'));

  bus.setStatus('device', STATUS.LIVE, '');
  update('boot');
  return null;
}
