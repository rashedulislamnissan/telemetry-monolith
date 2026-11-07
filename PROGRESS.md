# Progress

## Status
- **Done:** all milestones M1-M7. **Live:** https://rashedulislamnissan.github.io/telemetry-monolith/
- **Repo:** https://github.com/rashedulislamnissan/telemetry-monolith (public, Pages from `main` / root)
- **Open items (by hand):** record `docs/demo.gif`; check in real Safari and on a real phone; listen to the audio.

## Deploy (done)
- Public repo created with the GitHub CLI; Pages enabled from `main` / root; first build `built`.
- `CLAUDE.md` and `monolith.md` (private planning files) are git-ignored and were removed from the whole history before the first push; they remain on disk. The original history is kept only in the local branch `backup/pre-public-history` (never pushed). Delete it with `git branch -D backup/pre-public-history` once it is not needed.
- **Live check** (Chromium desktop + phone @3x, Firefox, WebKit, against the real URL):
  - 0 console errors and 0 HTTP errors; all 38 files load via relative paths under `/telemetry-monolith/`.
  - Ping to the real host 11-17 ms.
  - Caption visible by 11 s; back-link goes to the portfolio; particles = bus events.
  - Expected N/A for longtask and heap in Firefox/WebKit.

## M7: polish and resilience (done locally)
- **Owner details:** `config.js` now holds the owner's name, role, portfolio URL and repo URL, taken from the **visible** text of https://nissan-portfolio.pages.dev/. Its `<title>`/meta tags carry an older role line and were not used. The back-link has a title naming the owner. README rewritten for GitHub visitors (live link, how it works, controls, GIF placeholder, credits).
- **Adaptive quality** (`js/quality.js`): watches the real smoothed frame time.
  - **Step down:** after 1.5 s over 22 ms it drops a level. The four levels lower render DPR 2 → 1.5 → 1.25 → 1, particle cap 160 → 110 → 70 → 45 and label cap 28 → 20 → 14 → 10, turn off the type shimmer, then turn off the conduit dash flow.
  - **Step up:** after 6 s under 18 ms. A drop within 20 s of a restore doubles the next restore wait (max 60 s).
  - The device panel shows the true render scale, e.g. `2.00 (RENDER 1.00)`.
- **Label piles fixed:** in the load burst (~40 files, 0.03 s apart) labels stacked into an unreadable block. A label is now skipped when it would overlap the last one drawn on the same conduit; the particle still shows and still carries its data for hover.
- **Fallbacks:** `<script nomodule>` message for browsers without ES modules (the existing ones cover no Canvas 2D and boot errors). `.nojekyll` added for GitHub Pages.

### Checks run
- **Adaptive (Chromium @2x, CDP CPU throttle 12x):** level 0 → 1 → 2 → 3 within 10 s (canvas 2880 → 2160 → 1800 → 1440 px wide). Throttle removed: back to level 0 in 24 s, frames 16.7 ms. No errors.
- **Hidden tab** (visibility overridden in-page, then `visibilitychange` dispatched): frame, ping and heap event counts frozen for 3 s while hidden; all resume when visible.
- **No Canvas 2D** (`getContext` returns null): fallback message shown, no errors.
- **Soak, Chromium, 11 min** (audio running, mouse loops, wheel, clicks, sampled every 30 s after forced GC):
  - JS heap 1.82 MB at 30 s, 1.95 MB at 2 min, 2.00 MB at 11 min: it warms up and then is flat (+0.05 MB over the last 9 min).
  - DOM nodes 113-119 (the debug text node swapping), listeners 24, documents 1, steady throughout.
  - 4,574 events, 0 dropped, quality level 0 throughout, 0 console errors.
- **Soak, Firefox and WebKit, 2.5 min each:** 0 errors, DOM stable at ~50 elements, 0 dropped (962 and 1,017 events).
- **Final regressions:**
  - M1: sizes, DPR cap, resize.
  - M3: label audit (0 mismatches, spawned = bus).
  - M4: 0 frames over 25 ms in all three engines, touch included.
  - M5: silent before a gesture; mute persists.
  - M6: tooltip = `performance.getEntriesByName()` field for field; caption 0 at 7 s and 1 at 10 s.
- **GitHub Pages limits** checked on docs.github.com: published site up to 1 GB, soft 100 GB/month bandwidth, no commercial hosting. This site is about 200 KB and non-commercial.

## M6: the 10 s reveal (done)
- `js/reveal.js` + DOM in `index.html` (all `data-self`):
  - **Caption:** "Every particle is a real browser event." with a hint ("Hover…" or, on coarse pointers, "Tap any particle to read its raw data.").
  - **Raw event stream:** the newest bus events as one-line raw JSON, prefixed with time and type, refreshed at 4 Hz.
  - Caption and stream fade in together, once, at 8.5 s after navigation start: one orchestrated moment. Reduced motion fades without the slide.
- **Placement:** the empty left field (wide); below the rings (portrait tablets); a tighter left field with a wrapping caption (e.g. 1024x700); the band under the HUD (phones, with stream lines fitted to the room). Checked at 1440x900, 1280x720, 1920x1080, 1024x700, 768x1024, 844x390, 390x844 and 360x640: never over the ring system.
- **Freeze:**
  - **Mouse:** whatever particle is under the cursor freezes, including one drifting into a still cursor; moving 40 px away, Escape, the pointer leaving, or a resize lets it go.
  - **Touch or pen:** a tap freezes the nearest particle within 28 px; a tap elsewhere releases it.
  - A frozen particle holds its exact position (even while its conduit bends), keeps its label, is never recycled from the pool, and gets a highlight ring plus a leader line to its tooltip.
- **Tooltip:** label, channel/type, event number and time, then raw fields with the most telling first (name, entryType, timing, sizes, status…; Resource Timing has 20+ keys). Built with `textContent` only. Placed beside the particle, or above/below it when neither side fits.
- **Fix:** the touch readout showed raw fractional coordinates (`DOWN 182.6209…,564.38…`); it now rounds (raw data keeps exact values).

### Checks run (Chromium, Firefox, WebKit)
- Caption opacity 0 at 7 s and 1 at 10 s in all three engines.
- **Tooltip data matches the browser:** hover-froze a real resource particle (`/css/style.css`) and compared its raw data with `performance.getEntriesByName()`: 0 differing fields across startTime, duration, transferSize, encoded/decodedBodySize, responseEnd and initiatorType. The tooltip text shows those values, in all three engines.
- Frozen particle moved 0 px over 600 ms; moving away releases it and hides the tooltip.
- Stream: all 8 lines map to real bus events by timestamp.
- Touch (Chromium phone via CDP): a tap freezes a particle with the tooltip inside the viewport; a tap on empty space releases it.
- Regressions: M3 audit (0 mismatches, spawned = bus), M4 (0 frames over 25 ms), M5 (silent before gesture, M mutes). No console errors anywhere.

### Note on LCP
- The PAINT/LCP/CLS ring reads **LCP ~8.8 s** after the reveal: the caption is a large text block that first becomes visible at 8.5 s, so Chrome correctly reports it as a new Largest Contentful Paint (any click or key press before then stops LCP reporting). This is real and is left as is. Hiding it (e.g. painting the caption at 1% opacity from load) would be gaming the metric.

## M5: procedural sound (done)
- `js/audio-engine.js`: the graph only. It runs on any BaseAudioContext (live or offline), and every method takes an explicit time so it can be rendered and measured offline.
  - **Hum:** two sawtooths at 55 Hz detuned by 7 cents each way, plus an octave sine, through a resonant lowpass with a 0.11 Hz breathing LFO.
  - **Noise:** looped white noise through a bandpass.
  - **Gear:** a fifth fades in only at high energy.
  - **Energy response:** surge energy opens the filter (200 to 2200 Hz), raises drone and noise, moves the noise band and lifts pitch 4%.
  - **Master:** 0.16 into a compressor.
- **Real-event sounds:** long task = low falling thud; each ping = barely audible 1760 Hz tick; press = short high-passed noise click. Thud and tick fire on particle arrival, so they sync with the visuals.
- **No clicks:** every change is a `setTargetAtTime` or linear ramp. One-shot voices stop only after decaying to e^-9 of peak. Hiding the tab ducks to silence, then suspends after 300 ms; showing it resumes, then ramps up.
- `js/audio.js`: no AudioContext exists until a real gesture (pointerdown/up, keydown, click, touchend), so the page is silent before one. Visible "Sound on (M)" button (`aria-pressed`, `data-self`) and the M key; the preference is saved in localStorage. Without Web Audio the button shows "Sound N/A" and is disabled.
- **Fix in particles:** startup now loads ~37 files, which overflowed the 4 s conduit queue at a fixed 0.12 s spacing (2 resource events dropped). Spacing now tightens as the queue grows (to a 0.03 s floor), so long bursts compress instead of dropping. This also fixes the 4 WebKit phone drops noted in M3.

### Checks run
- **Silent until a gesture** (Chromium with `--autoplay-policy=user-gesture-required`, and Firefox): no AudioContext after load or after hovering; context `running` after the first click.
- **Mute:** M sets muted with label "Sound off (M)" and `aria-pressed=false`; the button unmutes; muted state survives a reload.
- **WebKit (Playwright's Windows build has no Web Audio):** "Sound N/A", disabled, M does nothing, no errors.
- **No clicks or pops (offline render of the real engine):** a pop is a waveform step, so each region's peak second-difference is compared with the steady hum's (which already contains the saw edges). Start 0.01x, energy jump 0.55x, mute 0.88x, unmute 1.21x, thud 1.14x, tick 1.08x, duck 1.14x. A control render with a deliberate hard cut reads **2.51x**, so the detector does catch pops. Peak sample level is 0.157 (no clipping).
- Regressions: M3 audit 0 mismatches and spawned = bus events (0 dropped) in all engines and sizes; M4 0 frames over 25 ms; no console errors anywhere.

## M4: interaction surge (done)
- `js/surge.js`: one `energy` value (0-1) driven only by real input: cursor speed (log scale, full at 3000 px/s), wheel px and presses. Fast attack, ~0.6 s release. Also `spin` (wheel, signed) and `bend`. M5 will read `energy` for the hum.
- Cursor speed counts as 0 once no `pointermove` has arrived for 70 ms, so a still cursor reads 0 rather than its last value.
- **Beams bend:** each conduit's control point leans toward the cursor (more when fast, less when far), capped at 35% of the conduit's length so the curve never folds back. Both ends stay pinned, and particles follow the bend because they ride the same curve.
- **Gauges spike:** VEL / ACC / JERK under the session clock with real values, log-scaled bars and a peak-hold tick.
- **Rings surge:** energy speeds all rings up to 6x; the wheel drives them like a gear train (alternating directions, inner rings faster).
- **Press burst:** a Bone ring and 14 shards at the pointer (decorative response; the press's own particle carries the `PTR DOWN` label). Conduits brighten and their dash flow speeds up with energy.
- Reticle with velocity tail replaces the system cursor on fine pointers (`cursor: none` only under `pointer: fine`).
- Touch: `pointerdown` now anchors a stroke (no hover on touch), and lifting a finger or pen ends presence, so beams relax. Fixed: `pointerleave` was registered on `window`, where it never fires; it is now on the root element.
- Pointer-move events throttled from 100 to 150 ms; at 10/s the input conduit became an unreadable label pile during drags.
- Reduced motion: bend and spin scale by the motion factor (0.25); a press shows a smaller ring and no shards.

### Checks run
- **Mouse (Chromium, Firefox, WebKit):** fast 3-loop circle, 120 moves at 8 ms. Energy peaks at 0.95-0.97, conduits bend up to 201 px, **0 frames over 25 ms** in all three engines (Chromium p95 16.8 ms). Two seconds after stopping, energy is 0.04. Six wheel ticks give ring spin of about 3.5 rad/s.
- **Touch (Chromium phone 390x844 @3x, real touch events via CDP):** the drag produces `pointer:touch` events, energy peaks at 0.77 and bend at 131 px, 0 frames over 25 ms. After lifting, presence is false and bend is 0.
- No console errors in any run. M3 honesty audit re-run: 0 label mismatches, spawned = bus events.

## M3: particles and conduits (done)
- `render/conduits.js`: 10 curved conduits (one per channel plus a `system` one for device/visibility) from the screen edge into each ring at a fixed angle. The top wedge is kept clear for the label spine. On narrow screens the origins lean vertical so side conduits are not stubs. The resting control point (`rx1/ry1`) is stored for M4 to bend toward the cursor.
- `render/particles.js`: pooled (160, hard cap). **Every bus event becomes exactly one particle** carrying a copy of the event (seq, label, raw...). The label drawn is the event's own label, verbatim. Particles entering the same conduit are spaced 0.12 s apart, so load bursts become a stream; a backlog over 4 s is counted as dropped, never faked. Labels are capped at the newest 28, flip sides at screen edges, and fade 0.8 s after landing.
- Arrival reactions (each caused by that particle's real event): ring flash (soft for periodic frame/heap/ping samples, full for discrete events, red for faults); heap sets the core size (session min..max mapped to 0.8-1.2x); interaction pulses the core; long task gives a red shockwave + red core pulse; ping gives a faint amber pulse ring.
- The core glows amber only once real heap data arrives (or on a real pulse); on browsers without `performance.memory` it stays Bone.
- Reduced motion: no shockwaves, half-strength flashes, particles travel at 0.6x speed.

### Checks run (Chromium, Firefox, WebKit; desktop 1440x900 and phone 390x844 @3x)
- **Idle (6 s, no input):** a steady stream in every engine from frame, ping, resource (+ heap in Chromium): 16-22 live particles.
- **Honesty audit:** for every live particle, its label equals the bus event's label for the same seq (0 mismatches), and every particle has raw data (0 missing). Spawned particles = bus events (1:1), with one exception noted below.
- After a 90 ms page long task, pointer moves and a click: longtask (Chromium), interaction, input and frame particles all arrive; zero mismatches.
- 60 fps held in Chromium (p95 16.7-16.8 ms) at both sizes. Zero console errors or warnings in all engines.

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
- Headless WebKit on Windows renders in software and misses frames at 3x DPR. The queue overflow this caused in M3 is fixed (spacing now compresses), but M7's adaptive quality should still lower render cost when frames drop.
- Audio is not covered by any listening test. Check by ear in a real browser: hum level, the thud on a long task (trigger one from devtools with a busy loop), and switching tabs (should fade, not cut).
- Headless frame timing is idealised. The 60 fps check still needs a look in a real Chrome window on a mid-range laptop.
- Visibility events are wired but not covered by automated tests, because headless browsers do not fire `visibilitychange`. Check by switching tabs with `?debug` open.
- Test harness note: Chrome does not count DevTools `evaluate()` calls as long tasks; trigger test long tasks from a `setTimeout` inside the page.
- Dev note: Playwright needs `--no-proxy-server` (Chromium) and `network.proxy.type = 0` (Firefox) in this environment to reach the local server.

## Next steps
- Record the demo GIF (`docs/demo.gif`) and push it.
- Real Safari (macOS/iOS) and real-phone check by hand; listen to the hum.
- Next project in the build order: Tearable Swiss Poster (Netlify).

## Post-launch fix: honest readouts that do not look frozen (owner feedback)
- **Problem:** on an idle page only POINTER/WHEEL and PING changed. Every other ring froze on its last value, and device memory read "8 GB" on a 16 GB machine.
- **Quiet rings now tick:** longtask, interaction, mutation, resource, paint and input show how long they have been quiet once 4 s pass without an event: `NONE FOR 2:31`, `38 FILES, LAST 2:31 AGO`, `LCP 8.79S, 0:05 AGO`, `5 CHANGES, 0:13 AGO`. These are real elapsed times since a real event (or since load).
- **Frame time** shows two decimals (16.66 / 16.67…); one decimal rounded the real jitter away.
- **Device memory** shows `≥8 GB`: `navigator.deviceMemory` is rounded down and capped by the browser for privacy, so it is a lower bound.
- **Heap** shows `≈9.5MB`, and its raw data carries a note: "Rounded and rarely updated by the browser for privacy". Chrome gives pages a coarse, rarely-updated `performance.memory`; precise memory needs cross-origin isolation headers that GitHub Pages cannot send.
- Checked: ring readouts change over 2 s while idle in Chromium, Firefox and WebKit (0 errors); M3 audit (0 mismatches) and M6 tooltip comparison still pass.
