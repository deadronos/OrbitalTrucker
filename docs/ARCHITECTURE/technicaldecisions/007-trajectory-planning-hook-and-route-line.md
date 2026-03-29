# ADR 007: Trajectory planning hook and route-line scene component

- **Status:** Superseded by [ADR 011](./011-location-catalog-moons-and-transfer-planning.md)
- **Date:** 2026-03-29

## Context

Game ADR 003 introduced the trajectory planning and assisted navigation feature. This ADR records the technical decisions made to implement it while staying consistent with the existing architecture (ADR 005: split R3F scene into hooks and components).

## Decision

### New module: `src/simulation/trajectory.ts`

All trajectory mathematics live in a pure, framework-free module. It exports:

- **`planRoute(shipPosition, targetPosition, shipForward, shipSpeedAuPerSec)`** — returns a `TrajectoryPlan` record containing the normalized direction to the target, bearing angle in degrees (0–180), straight-line distance in AU, and ETA in days (or `null` when speed is below a minimum threshold).
- **`directionToYawPitch(direction)`** — converts a unit vector into the yaw/pitch pair used by the ship physics system (YXZ Euler convention, forward = +X at yaw = 0, pitch = 0).

Keeping these functions pure makes them straightforward to unit-test without a Three.js rendering context.

### New scene component: `src/scene/TrajectoryLine.tsx`

A lightweight R3F component that declares a `<line>` element with a two-point `<bufferGeometry>`. Endpoints are updated imperatively each frame by the scene orchestrator via a forwarded ref (the same ref pattern used by `TargetMarker`). The component does not own any frame-update logic.

### Changes to `SimulatorCanvas` (orchestrator)

The main `useFrame` callback in `SceneContents` already computes `selectedTargetPosition`. The trajectory plan is computed there each frame by calling `planRoute` and the result is:

1. Written into the `TrajectoryLine` buffer geometry so the course line stays current.
2. Passed alongside the existing metrics arguments to `useSimulationMetrics`.

Auto-orient is implemented by tracking an `autoOrientTrigger` integer prop. When the prop value changes (incremented by pressing `T` or clicking the button), a `useEffect` fires, reads the current body positions from `bodyPositionsRef`, computes the direction via `directionToYawPitch`, and writes the new yaw/pitch directly into `shipStateRef.current`. The next frame picks up the changed orientation automatically.

### Changes to `useSimulationMetrics`

The `report` callback accepts two additional arguments — `targetBearingDeg` and `etaDays` — and forwards them into the `SimulationMetrics` object emitted to the React side.

### Changes to `SimulationMetrics` type

Two fields are appended:

- `targetBearingDeg: number` — angle between ship heading and target (0–180).
- `etaDays: number | null` — ETA in days, null when stationary.

`INITIAL_METRICS` is updated with sensible defaults (`targetBearingDeg: 0`, `etaDays: null`).

### New formatter: `formatEtaDays`

Formats the nullable days value as a human-readable string: hours for sub-day ETAs, days for sub-year, years for longer journeys, and an em-dash when the ship is stationary.

### UI additions

- `MetricsPanel` shows two new readouts: _Bearing to target_ and _ETA (straight-line)_.
- `ControlPanel` adds a `T` key hint to the controls list and an _Orient to target_ button below the target chips.

## Consequences

### Positive

- No new hook layer is needed; trajectory logic slots into the existing `useFrame` orchestrator.
- Pure simulation module is easy to test and completely decoupled from React.
- The imperative ref pattern for the course line is consistent with `TargetMarker`.
- Auto-orient writes directly to `shipStateRef`, avoiding extra React state and render cycles.

### Negative

- The `autoOrientTrigger` integer prop is a minor workaround to drive a Three.js-side action from a React key event without lifting the ship state into React. A future event-bus or command-queue abstraction could replace it.
- Computing `planRoute` every frame is cheap (a handful of vector operations) but it is unconditionally called even when no target is selected or the ship is stationary.
