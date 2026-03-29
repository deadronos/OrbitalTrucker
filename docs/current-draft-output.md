# OrbitalTrucker — current implementation draft

## What changed in this iteration

The original prototype has been ported from an imperative Vite + TypeScript + Three.js entry file into a React-based implementation using React Three Fiber and Drei where that abstraction is helpful.

This migration preserved the current simulator behavior while modernizing the app structure, adding automated verification, and formalizing code-quality tooling.

## Current application snapshot

The app now provides:

- a browser-based 3D heliocentric solar-system simulator
- the Sun, the eight major planets, and Pluto
- realistic orbital spacing in astronomical units (AU)
- placeholder visible geometry for all celestial bodies and the freighter
- low-precision J2000 Keplerian orbital motion for planetary positions
- a flyable placeholder cargo freighter with inertial controls
- a chase camera managed inside the R3F scene loop
- a HUD for date, time warp, ship speed, heliocentric distance, selected target, and target range
- target selection controls for the Sun and all currently rendered bodies
- logarithmic depth buffering for large-scene depth stability
- automated unit, integration, and component tests with Vitest
- linting with ESLint and formatting with Prettier

## Runtime and toolchain

### UI and rendering stack

The runtime stack now uses:

- `react`
- `react-dom`
- `three`
- `@react-three/fiber`
- `@react-three/drei`

### Build and developer tooling

The project currently uses:

- `vite` for local development and production builds
- `typescript` for static typing
- `vitest` for the test runner
- `@testing-library/react` and related helpers for React test coverage
- `eslint` for linting
- `prettier` for formatting

### Current scripts

The repository now exposes these useful scripts:

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`
- `npm run format`
- `npm run format:check`
- `npm test`
- `npm run test:coverage`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:component`

## Structural changes

### React application entry

The app is now mounted through `src/main.tsx` using React DOM's `createRoot` API.

### Top-level composition

`src/App.tsx` now composes the application from React components instead of injecting a large HTML string into the page.

High-level responsibilities are split into:

- app-level UI state in `App.tsx`
- scene rendering and per-frame simulation in `src/components/SimulatorCanvas.tsx`
- panel components for metrics, controls, and legend display
- pure formatting helpers in `src/simulation/formatters.ts`

### Scene implementation

The 3D scene is now rendered through `@react-three/fiber`'s `Canvas`.

The current scene uses:

- React Three Fiber for renderer/camera lifecycle
- Drei `Stars` for the background starfield
- Drei `Line` for orbit path rendering
- direct Three.js math and object manipulation inside the scene loop where it remains the clearest option

This keeps the simulator declarative at the composition level while still using imperative Three.js updates for high-frequency simulation work.

## Simulation model

### Solar-system data

`src/solar-data.ts` remains the source of body definitions, including:

- body names and kinds
- placeholder colors
- real radii in kilometers
- exaggerated display radii in AU
- orbit colors
- sidereal periods
- low-precision orbital element series

### Orbital mechanics

`src/orbital-mechanics.ts` still handles:

1. Julian date conversion
2. time-varying orbital element evaluation
3. Kepler equation solving
4. orbital-plane to heliocentric 3D coordinate conversion
5. orbit sampling for path rendering

The physics model for the planets remains intentionally lightweight but grounded in realistic orbital structure.

### Ship behavior

The player freighter still uses an accessible inertial flight model rather than full gravity-driven mission planning.

Current controls include:

- `W`, `A`, `S`, `D` for forward and lateral thrust
- `Q`, `E` for vertical thrust
- `Shift` for boost
- `Space` for dampening
- drag to rotate heading
- mouse wheel to adjust chase-camera distance
- `[` and `]` to change time warp

## Visual and scaling approach

The current implementation continues to preserve the established scaling rules:

- **distances** are meaningful and represented in AU
- **body sizes** remain exaggerated for playability and readability

That means the app is still best understood as a navigable solar-system map rather than a literal diameter-to-distance physical scale model.

## Current file layout highlights

Important current files include:

- `src/main.tsx` — React entry point
- `src/App.tsx` — top-level app composition and UI state
- `src/components/SimulatorCanvas.tsx` — R3F canvas and scene update loop
- `src/components/MetricsPanel.tsx` — HUD metrics and time controls
- `src/components/ControlPanel.tsx` — flight controls summary and target selection UI
- `src/components/LegendPanel.tsx` — orbital reference panel
- `src/simulation/formatters.ts` — UI display formatting helpers
- `src/simulation/types.ts` — shared simulation/UI types and time-warp constants
- `src/solar-data.ts` — planetary data
- `src/orbital-mechanics.ts` — orbital computation utilities
- `vite.config.ts` — Vite and Vitest configuration
- `eslint.config.mjs` — ESLint configuration
- `.prettierrc.json` — Prettier configuration

## Testing strategy

The repository now includes a Vitest-based test suite organized into three explicit categories:

- `tests/unit` — pure logic tests for formatters and orbital calculations
- `tests/component` — focused React component tests
- `tests/integration` — application-level integration tests for React state wiring

End-to-end tests are intentionally not part of the current setup.

## What was verified in this migration

The current implementation has been verified with:

- `npm run lint`
- `npm test`
- `npm run build`

All of the above passed during this migration.

The production build still emits a non-fatal bundle-size warning, which is acceptable for the current prototype but worth revisiting later with code-splitting or asset strategy changes.

## Known limitations

- ship flight is still gameplay-friendly rather than fully Newtonian
- body meshes are still placeholders
- there are still no missions, cargo systems, stations, or local-space destination gameplay
- orbital calculations are still a practical approximation rather than a high-fidelity ephemeris source
- large-scene rendering works, but bundle size and scene modularization can still be improved further

## Recommended next steps

1. split scene logic further into smaller R3F systems and hooks
2. add GLTF assets and texture pipelines for planets and ships
3. introduce trajectory planning or assisted navigation
4. expand automated test coverage around time controls and scene-side calculations
5. consider code-splitting or lazy-loading for future heavy assets and scene features
