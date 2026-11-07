# Progress

## Status
- **Done:** M1 look and skeleton, M2 real signal bus
- **Next:** M3, particles and conduits driven by the bus

## M2: real signal bus (done)
- `js/signals/bus.js`: one bus. Pooled 512-slot event history, per-type throttle (throttled counts are kept and shown in the debug log), per-channel status: `waiting`, `live`, `fallback`, `unsupported`, `error`.
- Event shape: `{seq, ch, type, label, readout, value, unit, t, fault, raw}`. `raw` is a plain snapshot (`PerformanceEntry.toJSON()` with DOM nodes reduced to names), so tooltips in M6 can show it later.
- One module per source: `frame`, `longtask`, `paint` (FP/FCP, LCP, layout-shift/CLS), `resource`, `interaction` (Event Timing, falling back to pointer timestamps), `heap`, `ping`, `pointer` (velocity/accel/jerk + press + wheel), `mutation`, `device`, `visibility`.
- Rings now show the latest real readout per channel. Unsupported channels show **N/A**, the ring is drawn as a bare Graphite circle with no ticks, and the device panel carries one footnote: "N/A = NOT EXPOSED BY THIS BROWSER".
- Top-right device panel: CPU threads, device memory, real DPR (and the capped render DPR), viewport, network type + RTT.
- `?debug` in the URL shows a status table and the latest 36 events. It is `data-self`, so the mutation source ignores it.
- `ping.txt` added; the page declares an empty favicon so browsers do not make a stray `/favicon.ico` request.

### Checks run (Playwright: Chromium 156, Firefox 157, WebKit 27.2)
- **Chromium:** every channel live: frame, paint (FP/FCP/LCP/CLS), resource, interaction, heap, ping, input, mutation, device. A 120 ms `setTimeout` busy loop produced `LONGTASK 120MS` plus a `FRAME DROP`.
- **Firefox and WebKit:** longtask = N/A, heap = N/A, layout-shift listed as not exposed (paint stays live through FP/FCP/LCP), device memory and network = N/A. Everything else is live.
- Zero console errors or warnings in all three engines. M1 checks re-run: 60 fps, DPR cap, resize all still pass.

## M1: look and skeleton (done)
- Full-screen canvas with a fixed-timestep loop (1/120 s step, accumulator, 0.25 s clamp), resize handling, DPR capped at 2, DPR-change watcher, pause on hidden tab.
- Layers: pre-rendered grid (phased through the core, rulers, corner brackets), procedural kinetic type, 8 channel rings, hexagonal core, channel label spine, top-left identity and session clock.
- Already live (real data): the **FRAME** ring is a radial histogram of the last 240 rAF deltas, and its label shows the smoothed frame time. The **SESSION** clock is `performance.now()`.
- Every other channel shows an em dash until M2 wires a real source to it.

### Checks run (Playwright, headless Chromium)
- 1440x900, 1280x720 @2x, 390x844 @3x, 844x390 @3x, live resize to 1024x700, 1920x1080 and 800x1000, reduced motion.
- Canvas backing size always equals viewport x min(DPR, 2): 390x844 @3x gives 780x1688.
- Frame deltas over 3 s: mean 16.67 ms, p95 16.7 ms, max 16.8 ms, at both desktop and mobile sizes.
- Zero console errors or warnings.

## Design decisions
- **Palette:** Void `#000000`, Graphite `#1F1D1B`, Ash `#7E776F`, Bone `#ECE5D8`, Sodium `#FF9E1B`, Fault `#FF2B3A`. Sodium is used **only for live data** and Fault **only for faults** (dropped frames now; long tasks and errors later), so colour itself says what is real.
- **Display type** is a 6x10 block-cell face drawn in code (`js/render/type.js`), with columns merged and scanline gaps between rows. That gives the same heavy condensed look on every OS with no font download. Labels use the system monospace stack.
- **Layout:** on wide screens the core sits at 58% of the width so the type owns the left field. Below 760 px the type becomes a top band and the ring system centres in the space beneath.
- **Labels** sit on each ring at 12 o'clock and knock out the line under them, forming one vertical spine. The core is the HEAP channel. Ring order, inner to outer: interaction, frame, longtask, paint/LCP/CLS, DOM mutation, pointer/wheel, ping, resource.
- **Kinetic type words** are about the machine (TELEMETRY, RUNTIME, OBSERVER, SELF). No personal info appears outside `config.js`.
- **FRAME readout** is an exponential moving average (alpha 0.08) of real rAF deltas, refreshed 5 times a second so it is readable.
- **Reduced motion:** decorative rotation and scroll run at 25% speed, and the type shimmer is off.

- **N/A display:** rings show a short "N/A"; the full sentence appears once as a footnote under the device panel (it was too long for the label spine on phones).
- **Interaction channel** reports one event per real interaction (`interactionId`), not every hover entry. Event Timing only reports events of 16 ms or more, by spec, so quick taps may not appear there; the input channel still records every press.
- **Ping is excluded from the resource channel** so one request is not shown as two events.
- **Heap:** Chromium quantises `performance.memory` (headless reported exactly 10,000,000 bytes). It is shown as reported, with a note in the channel status.
- **Mutations:** the canvas resize (`CANVAS[width]`, `CANVAS[height]`) and the back-link `href` at boot are counted, because they are real DOM changes. Only `data-self` nodes are ignored.

## Known issues
- Headless frame timing is idealised. The 60 fps check still needs a look in a real Chrome window on a mid-range laptop.
- Visibility events are wired but not covered by automated tests, because headless browsers do not fire `visibilitychange`. Check by switching tabs with `?debug` open.
- Test harness note: Chrome does not count DevTools `evaluate()` calls as long tasks; trigger test long tasks from a `setTimeout` inside the page.
- Dev note: Playwright needs `--no-proxy-server` (Chromium) and `network.proxy.type = 0` (Firefox) in this environment to reach the local server.

## Next steps (M3)
- Pooled particle system with a hard cap, fed by bus events. Each particle carries a copy of its event (label + raw).
- Conduits: vector paths from the screen edge (resource), core (heap) and rings to the label spine. Particles travel along them.
- Monospace labels on particles showing the real event label. No decorative particle ever carries a label.
- Core size follows the real heap where exposed. Long tasks give a red burst.
