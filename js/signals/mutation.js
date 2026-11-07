// Real DOM mutations, batched per window. Nodes inside [data-self] (debug log,
// raw stream, tooltip) are ignored: they change because we render events, and
// counting them would make every event cause another event.
import { STATUS } from './bus.js';

const CONFIG = {
  WINDOW_MS: 250,     // records are summed over this window into one event
  MAX_TARGETS: 6,     // distinct target names kept in the raw snapshot
};

function isSelf(node) {
  const el = node && (node.nodeType === 1 ? node : node.parentElement);
  return !!(el && el.closest && el.closest('[data-self]'));
}

function allSelf(list) {
  if (!list || list.length === 0) return true;
  for (let i = 0; i < list.length; i++) if (!isSelf(list[i])) return false;
  return true;
}

export function startMutation(bus) {
  if (typeof MutationObserver !== 'function') {
    bus.setStatus('mutation', STATUS.UNSUPPORTED, 'MutationObserver not exposed');
    return null;
  }
  bus.setStatus('mutation', STATUS.WAITING, '');

  const tally = { childList: 0, attributes: 0, characterData: 0 };
  const targets = [];
  let total = 0;
  let timer = 0;
  let firstT = 0;

  function flush() {
    timer = 0;
    if (!total) return;
    bus.emit({
      ch: 'mutation', type: 'mutation',
      label: `DOM MUTATION ${total}`, readout: `${total} CHANGE${total === 1 ? '' : 'S'}`,
      value: total, unit: 'records', t: firstT,
      raw: { source: 'MutationObserver', records: total, childList: tally.childList, attributes: tally.attributes, characterData: tally.characterData, targets: targets.slice() },
    });
    total = 0;
    tally.childList = tally.attributes = tally.characterData = 0;
    targets.length = 0;
  }

  const mo = new MutationObserver((records) => {
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (isSelf(r.target)) continue;
      if (r.type === 'childList' && allSelf(r.addedNodes) && allSelf(r.removedNodes)) continue;
      if (!total) firstT = performance.now();
      total++;
      tally[r.type]++;
      const el = r.target.nodeType === 1 ? r.target : r.target.parentElement;
      const name = el ? el.nodeName + (r.attributeName ? `[${r.attributeName}]` : '') : '#text';
      if (targets.length < CONFIG.MAX_TARGETS && !targets.includes(name)) targets.push(name);
    }
    if (total && !timer) timer = setTimeout(flush, CONFIG.WINDOW_MS);
  });
  mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  return null;
}
