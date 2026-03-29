# ADR 005: Split R3F Scene into Smaller Systems and Hooks

- **Status:** Accepted
- **Date:** 2026-03-29

## Context

ADR 003 adopted React Three Fiber (R3F) and described the intended outcome: "the simulator should be organized into scene components, UI components, hooks, and pure utility modules". The initial migration placed all scene logic — ship physics, keyboard/pointer input, time simulation, body position updates, camera control, and metrics reporting — inside a single `SceneContents` component in `SimulatorCanvas.tsx`.

This monolithic component is hard to reason about, hard to evolve, and hard to test. The per-frame logic is interleaved with JSX rendering in a single 500-line file. Core simulation concepts (ship physics, time stepping) are not exercisable independently of the R3F canvas.

The next step is to fulfil the structural promise made in ADR 003 by splitting `SceneContents` into focused hooks and scene sub-components.

## Decision

The `SimulatorCanvas` scene is split into:

### Pure simulation functions (`src/simulation/`)

- **`physics.ts`** — exports `ShipState`, `createInitialShipState`, and `stepShipPhysics`. This is a dependency-free function that computes one frame of ship physics and returns the resulting orientation vectors. It is fully unit-testable without an R3F canvas.

### R3F hooks (`src/hooks/`)

Each hook owns one concern and may call `useFrame` internally where appropriate.

- **`useKeyboardInput`** — attaches `keydown`/`keyup` listeners to `window`; returns a stable `keyStateRef`.
- **`usePointerInput`** — attaches pointer and wheel listeners to the canvas DOM element; directly mutates the shared `ShipState` ref for `yaw`, `pitch`, and `chaseDistance`.
- **`useShipPhysics`** — calls `stepShipPhysics` every frame via `useFrame`; returns `shipStateRef`, `shipRef` (for the mesh), and orientation refs (`forwardRef`, `rightRef`, `upRef`).
- **`useCameraFollow`** — positions the chase camera every frame, after ship physics have run.
- **`useTimeSimulation`** — advances the simulated date every frame based on the active time-warp step; manages `orbitEpoch` state for orbit path redraws; returns `simulatedDateRef` and `orbitEpoch`.
- **`useSimulationMetrics`** — throttles and emits `SimulationMetrics` updates to the parent React tree at ~10 Hz.

### Scene sub-components (`src/scene/`)

Each component renders one visual concern and has no dependency on other scene components.

- **`SceneBackground`** — ambient/point lights, `<Stars>`, grid helper, and background colour.
- **`SunMesh`** — sun sphere and corona ring; self-contained rotation via its own `useFrame`.
- **`SolarBodies`** — one planet mesh per solar body plus orbit paths; accepts a mutable `bodyMeshRefs` ref so `SceneContents` can imperatively update body positions each frame.
- **`TargetMarker`** — the selection ring that tracks the active navigation target.
- **`ShipMesh`** — the player ship geometry group; exposes its `Group` node via `forwardRef`.

### Thin orchestrator (`SimulatorCanvas.tsx`)

`SceneContents` becomes a thin orchestrator. It:

1. calls each hook in the correct order so that `useFrame` subscriptions fire in the right sequence (time → ship → camera → body positions + metrics),
2. renders the scene sub-components, and
3. owns a single remaining `useFrame` that updates body positions/rotations, drives the target marker, and calls the metrics reporter.

## Consequences

### Positive

- Scene responsibilities are isolated: each hook and component has one clear job.
- Core simulation state is testable without rendering the full scene. `stepShipPhysics` can be imported and exercised in unit tests with real `Vector3` math and no WebGL dependency.
- Hooks can be reused or swapped independently (e.g. replacing `useKeyboardInput` with a gamepad hook later).
- `SimulatorCanvas.tsx` shrinks from ~520 lines to ~150 lines.
- The visible simulator behavior is unchanged.

### Negative

- Inter-hook dependencies (e.g. `useShipPhysics` depends on `keyStateRef` from `useKeyboardInput`) make the hook call order in `SceneContents` matter. This is mitigated by calling hooks in the same order in every render and by the fact that R3F fires `useFrame` subscriptions in registration order.
- Passing `bodyMeshRefs` as a prop into `SolarBodies` is slightly unusual but avoids introducing a context or a separate `useBodyPositions` hook that would need its own mesh-ref injection mechanism.

## Follow-up

If the scene continues to grow, individual hooks could be grouped into dedicated feature modules (e.g. `src/features/flight/`, `src/features/navigation/`). The `stepShipPhysics` function could be extended with unit-testable helpers for other simulation concerns (e.g. orbital insertion, autopilot).
