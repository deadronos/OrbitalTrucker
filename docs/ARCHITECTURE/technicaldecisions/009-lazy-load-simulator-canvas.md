# ADR 009: Lazy-load the Simulator Canvas to split the initial bundle

- **Status:** Accepted
- **Date:** 2026-03-29

## Context

OrbitalTrucker's production bundle was a single JavaScript file of roughly
1,160 kB (325 kB gzipped). Every byte of that bundle — React, Three.js,
`@react-three/fiber`, `@react-three/drei`, all scene components, all
simulation hooks, and the VSOP87 ephemeris coefficients — had to download
and execute before the browser could paint anything.

Three.js plus the R3F ecosystem accounts for the overwhelming majority of
that weight (~905 kB uncompressed). Yet the HUD panels (metrics, controls,
legend) are pure React and Tailwind; they do not need Three.js at all.

The Vite build already emitted a warning recommending dynamic imports.

## Decision

### 1. Lazy-load `SimulatorCanvas` with `React.lazy()`

`SimulatorCanvas` is wrapped in `React.lazy()` inside `App.tsx`:

```ts
const SimulatorCanvas = lazy(() => import('./components/SimulatorCanvas'))
```

This turns the entire 3D engine chunk into a dynamic import. The browser
downloads and evaluates it only after the initial React tree has rendered.

`SimulatorCanvas.tsx` gains a `export default SimulatorCanvas` statement so
that `React.lazy()` can resolve it as a default export while the existing
named export (`export function SimulatorCanvas`) is preserved for code that
imports the type or the component by name (e.g. the integration test).

### 2. `Suspense` fallback while the canvas loads

`AppShell` wraps `<SceneComponent>` in a `<Suspense>` boundary:

```tsx
<Suspense fallback={<div className="absolute inset-0 bg-[#020409]" />}>
  <SceneComponent ... />
</Suspense>
```

The fallback is a plain dark `<div>` that matches the app's background
colour (`#020409`). The HUD panels (metrics, controls, legend) are outside
the `Suspense` boundary, so they render and remain interactive while the
canvas downloads.

### 3. Predictable vendor chunks via Vite `manualChunks`

`vite.config.ts` configures `build.rolldownOptions.output.manualChunks` to
separate third-party code into stable, cache-friendly chunks:

| Chunk | Contents |
|---|---|
| `vendor-react` | `react`, `react-dom` |
| `vendor-r3f` | `@react-three/fiber`, `@react-three/drei`, `three` |
| `SimulatorCanvas` | Scene components, hooks, ephemeris, simulation logic |
| `index` | App shell, HUD components, simulation types |

Keeping vendor code in separate chunks means a UI-only change does not
invalidate the cached Three.js download, and vice versa.

## Consequences

### Positive

- **Smaller initial execution payload.** The entry chunk (`index.js`) shrinks
  from 1,160 kB to 43 kB. The browser needs to evaluate only `index.js` and
  `vendor-react.js` (~221 kB combined, ~70 kB gzipped) before painting the
  HUD.
- **Deferred Three.js initialisation.** WebGL context creation and GPU resource
  uploads happen after first paint, not before.
- **Better cache granularity.** Four stable chunks mean updates to app code
  do not bust the cached Three.js / R3F vendor download.
- **HUD stays interactive during load.** The metrics panel, control panel, and
  legend are outside the Suspense boundary and render immediately.
- **`AppShell` remains injectable.** The `SceneComponent` prop still accepts
  any `ComponentType<SimulatorCanvasProps>` (including the lightweight stub
  used in integration tests), so the test strategy from ADR 005 is unchanged.

### Negative

- The total download for a cold visit is unchanged; lazy loading only improves
  _when_ bytes are executed, not how many bytes there are.
- The `AppShellProps` type must accept both `ComponentType` and
  `LazyExoticComponent` to satisfy TypeScript, adding a small amount of
  type-level complexity.
- A brief moment where only the dark fallback `<div>` is visible may be
  noticeable on very slow connections before the canvas chunk arrives.

## Follow-up

- If additional heavy optional features are added (e.g. a star-catalogue
  overlay, audio engine, or post-processing pass), each can be wrapped in its
  own `React.lazy()` import and placed inside a matching `Suspense` boundary.
- The `modulepreload` hints emitted by Vite ensure the browser begins
  downloading the R3F vendor chunk in parallel with the initial React render,
  minimising the perceived latency of the lazy load.
- If the `vendor-r3f` chunk grows large enough to warrant further splitting,
  `manualChunks` can separate `three` from `@react-three/fiber` and
  `@react-three/drei`.
