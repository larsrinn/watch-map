# Critical Review: watch-map

## 1. CORRECTNESS BUGS

### ~~1a. `haversine` duplicated 3 times with no shared module~~ ✅ RESOLVED
- ~~`gpxParser.ts:14`, `mapMatcher.ts:30`, `TrackStatsScreen.tsx:9`~~
- ~~Not just a DRY concern — if one copy is ever fixed/changed, the others silently diverge. This is a latent correctness risk.~~
- **Fix applied:** Extracted to shared `src/geo.ts` utility, all consumers (including test files) now import from there. Tests added in `src/geo.test.ts`.

### ~~1b. `formatDistance` duplicated with *different logic*~~ ✅ RESOLVED
- ~~`App.tsx:22` uses a 3-tier format (m / 2-decimal km / 1-decimal km) with `toLocaleString`.~~
- ~~`TrackStatsScreen.tsx:27` uses a 2-tier format (m / 2-decimal km) with `toFixed`.~~
- ~~These will produce inconsistent display for the same distance.~~
- **Fix applied:** Extracted to shared `src/geo.ts` (3-tier format with `toLocaleString`). Both `App.tsx` and `TrackStatsScreen.tsx` now import from there. Tests added in `src/geo.test.ts`.

### ~~1c. Walked path records every GPS fix — unbounded array growth~~ ✅ RESOLVED
- ~~`App.tsx:251`: every `watchPosition` callback appends to `walkedPath`, then the entire array is serialized to `localStorage` (`App.tsx:258`).~~
- ~~On a multi-hour hike with 1 Hz GPS, that's ~10k+ points. `JSON.stringify` + `localStorage.setItem` on every single fix will cause increasing jank and eventually hit the ~5 MB `localStorage` quota, silently losing data.~~
- **Fix applied:** (a) Renamed `walkedPath` → `recordedPath` (app isn't walking-only). (b) Added min-distance filter (5m) via `shouldRecordPoint()` in `geo.ts` — skips GPS fixes too close to the last recorded point, capping array growth. (c) Debounced `localStorage` writes to every 30s (with flush on `beforeunload` and effect cleanup). Tests added in `geo.test.ts`.

### ~~1d. `distToNextTurn` computed in `gpxParser.ts` but never used~~ ✅ RESOLVED
- ~~`gpxParser.ts:60-68` builds the `distToNextTurn` array and returns it in `ParsedGpx`, but no consumer ever reads it. The navigation distance is computed independently in `mapMatcher.ts`. Dead code.~~
- **Fix applied:** Removed `distToNextTurn` from `ParsedGpx` interface, deleted the computation, removed unused `haversine` import, and cleaned up related tests.

### ~~1e. Elevation gain has no smoothing — GPS altitude noise inflates the number~~ ✅ RESOLVED
- ~~`TrackStatsScreen.tsx:63-69`: raw GPS altitude deltas are summed. Consumer GPS altitude jitters by 5-20m between fixes, so this will wildly overcount elevation gain.~~
- **Fix applied:** Extracted `elevationGain()` to shared `src/geo.ts` with a minimum-delta threshold (default 3m) that filters GPS noise. Only altitude changes ≥ threshold are counted; small jitter is ignored. Tests added in `geo.test.ts`.

---

## 2. ARCHITECTURE ISSUES

### ~~2a. God component — `App.tsx` holds all state and logic~~ ✅ RESOLVED
- ~~~420 lines. Map state, tracking state, settings, sleep/wake, GPX loading, export, preloading, keyboard/touch/pointer handlers, timers — all in one component.~~
- ~~Every state change (e.g. the 1-second clock tick at line 244) causes the full component tree's dependency closures to be re-evaluated.~~
- **Fix applied:** Extracted five custom hooks: `useSleepWake` (sleep/wake state, timer, haptic), `useMapInteraction` (zoom, pan, follow mode, pointer/wheel handlers), `useTrackRecording` (recording state, min-distance filter, localStorage persistence, export), `useScreenNavigation` (screen index, keyboard/swipe navigation), `useNavigation` (GPX loading, preloading, position/navigation state). App.tsx is now a thin shell (~170 lines) wiring hooks together. Tests added for all five hooks.

### ~~2b. `MapView` re-renders on every position update, re-projects every track point~~ ✅ RESOLVED
- ~~`renderTrack` (line 145) maps *all* `trackPoints` and *all* `walkedPath` points through `latLonPx` on every render. For a 5,000-point GPX plus a growing walked path, this is O(n) on every GPS fix.~~
- **Fix applied:** Memoized world-pixel projections via `useMemo` (keyed on `zoom` + data identity). Center offset is now applied via SVG `<g transform="translate(...)">` instead of baking into each point — position changes only update the transform (O(1)), not re-project all points. Tests added in `MapView.test.tsx`.

### ~~2c. Tile cache eviction runs on every cache miss~~ ✅ RESOLVED
- ~~`MapView.tsx:91-93`: sorts all 150+ entries on every new tile load to evict 30%. Sorting is O(n log n) per tile miss.~~
- **Fix applied:** Extracted a generic `LruCache` class (`src/LruCache.ts`) backed by Map insertion order. On access, entries are moved to the end; eviction removes from the front in O(1). MapView's tile cache now uses `LruCache` instead of manual sort-and-slice. Tests added in `LruCache.test.ts`.

### ~~2d. No error boundary~~ ✅ RESOLVED
- ~~A parsing error in a malformed GPX, or a runtime error in map rendering, will crash the entire app with no recovery.~~
- **Fix applied:** Added `ErrorBoundary` class component (`src/components/ErrorBoundary.tsx`) wrapping `MapView` in `App.tsx`. Shows a fallback UI with a retry button on crash. Supports custom fallback via prop. Tests added in `ErrorBoundary.test.tsx`.

---

## 3. PERFORMANCE ISSUES

### ~~3a. `localStorage` write on every GPS fix~~ ✅ RESOLVED
- ~~As noted above, `JSON.stringify` of a growing array on every position update is expensive and synchronous — it blocks the main thread.~~
- **Fix applied:** Debounced to every 30 seconds via `setInterval` + ref, with flush on `beforeunload` and effect cleanup (see 1c fix).

### ~~3b. Global search in `mapMatcher.updatePosition`~~ ✅ RESOLVED
- ~~`mapMatcher.ts:108-116`: iterates *all* track points to find the global best on every fix. For a 10,000-point track, that's 10k haversine calls per second.~~
- **Fix applied:** Built a grid-based spatial index at construction time (0.01° cells ≈ ~1km). Global nearest-point search now only checks the 9 neighboring grid cells instead of all N track points. Tests added in `mapMatcher.test.ts`.

### ~~3c. `renderKey` hack forces full MapView re-render~~ ✅ RESOLVED
- ~~`MapView.tsx:86`: `setRenderKey(k => k + 1)` on every tile load triggers a state change, which re-renders the entire MapView including all SVG path projections. This means loading 50 tiles = 50 complete re-renders.~~
- **Fix applied:** Extracted tile rendering into a separate `TileLayer` component (`memo`-wrapped) so that `renderKey` state changes only re-render the tile layer — SVG track and position rendering are no longer affected by tile loads. Tests added in `MapView.test.tsx`.

---

## 4. ROBUSTNESS / EDGE CASES

### ~~4a. GPX export: no XML escaping~~ ✅ RESOLVED
- ~~`gpxExport.ts:13-14`: `trackName` is interpolated directly into XML. A name containing `<` or `&` produces invalid GPX.~~
- **Fix applied:** Added `escapeXml` helper in `gpxExport.ts` that escapes `&`, `<`, `>`, `"`, `'`. Tests added in `gpxExport.test.ts`.

### ~~4b. GPX parser: no validation~~ ✅ RESOLVED
- ~~`gpxParser.ts:40-42`: `parseFloat(pt.getAttribute('lat')!)` — the `!` asserts non-null, but a malformed file without `lat`/`lon` attributes will produce `NaN` coordinates that silently propagate through the entire system.~~
- **Fix applied:** Replaced `map` with `reduce` that filters out points where `lat` or `lon` is missing or `NaN`. Removed non-null assertions. Tests added in `gpxParser.test.ts`.

### ~~4c. Service Worker has no cache size limit~~ ✅ RESOLVED
- ~~`sw.js`: every fetched tile is cached forever. On a device with limited storage (a watch!), this will eventually fill the cache.~~
- **Fix applied:** Added `trimCache` eviction to `sw.js` with a 500-tile max. Eviction runs every 50 tile writes and on service worker activation. Oldest entries (by Cache API insertion order) are deleted first. Also cleans up stale tile cache versions on activate. Tests added in `sw.test.ts`.

### ~~4d. `usePosition` depends on `trackPoints` array identity for effect re-runs~~ ✅ RESOLVED
- ~~`usePosition.ts:38,61`: `useEffect` depends on `trackPoints`. But `App.tsx:66` creates `gpxData?.trackPoints ?? []` — the fallback `[]` creates a new array on every render, restarting the GPS watcher repeatedly when no GPX is loaded.~~
- **Fix applied:** Module-level constants `EMPTY_TRACK_POINTS` and `EMPTY_TURNS` in App.tsx; GPS tracking effect in usePosition.ts now uses `[]` deps (watcher starts once on mount, reads matcher via ref).

---

## 5. MINOR / STYLE

| Issue | Location | Note | Status |
|---|---|---|---|
| ~~`_failed` property added via type assertion hack~~ | ~~`MapView.tsx:87,126`~~ | ~~Use a `Map<string, 'loading'\|'loaded'\|'failed'>` instead~~ | ✅ RESOLVED — `TileEntry.failed` boolean replaces type assertion hack |
| ~~`void renderKey` to "use" a variable~~ | ~~`MapView.tsx:141`~~ | ~~Fragile — move `renderKey` into the dependency array comment or restructure~~ | ✅ RESOLVED — `renderKey` used as `Fragment key` to trigger re-renders |
| ~~Inline styles on every button~~ | ~~`ControlScreen.tsx`, `App.tsx`~~ | ~~Use CSS classes for maintainability~~ | ✅ RESOLVED — Extracted reusable `Button` component with CSS variant classes (`primary`, `success`, `danger`, `neutral`) |
| ~~Mixed German/English UI labels~~ | ~~Throughout~~ | ~~Inconsistent UX — pick one language~~ | ✅ RESOLVED — All UI labels translated to German |
| ~~`cacheSize` state in MapView only used for display~~ | ~~`MapView.tsx:70,96`~~ | ~~Updating state on every tile miss causes unnecessary re-renders~~ | ✅ RESOLVED — Removed empty `cache-ind` div and unused CSS rule |

---

## Summary of Priority

| Priority | Issue | Impact |
|---|---|---|
| ~~**High**~~ | ~~Unbounded `walkedPath` + sync `localStorage` on every fix~~ ✅ | ~~App jank/crash on long tracks~~ |
| ~~**High**~~ | ~~O(n) global search per GPS fix in map matcher~~ ✅ | ~~Battery drain, jank on long routes~~ |
| ~~**High**~~ | ~~`[]` fallback creating new array identity, restarting GPS watcher~~ ✅ | ~~GPS watcher restarts every render when no GPX loaded~~ |
| ~~**Medium**~~ | ~~No XML escaping in GPX export~~ ✅ | ~~Corrupted export files~~ |
| ~~**Medium**~~ | ~~Tile `renderKey` re-renders entire MapView per tile load~~ ✅ | ~~Sluggish map during tile loading~~ |
| ~~**Medium**~~ | ~~God component in `App.tsx`~~ ✅ | ~~Maintenance burden, unnecessary re-renders~~ |
| ~~**Medium**~~ | ~~No error boundary~~ ✅ | ~~Unrecoverable crash on bad input~~ |
| ~~**Low**~~ | ~~Duplicate `haversine`/`formatDistance`~~ ✅ (both extracted to `geo.ts`) | ~~Divergence risk~~ |
| ~~**Low**~~ | ~~Unsmoothed elevation gain~~ ✅ | ~~Inaccurate stats~~ |
| ~~**Low**~~ | ~~Unbounded SW tile cache~~ ✅ | ~~Storage exhaustion over time~~ |
