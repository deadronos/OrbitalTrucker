# ADR 010: Extract `useBodyPositions` and `useAutoOrient` hooks from `SceneContents`

- **Status:** Accepted
- **Date:** 2026-03-29

## Context

`SimulatorCanvas.tsx` exports `SimulatorCanvas`, which wraps the R3F `<Canvas>`
element. Inside it, an unexported function component named `SceneContents` must
run inside a canvas context (to call `useThree`, `useFrame`, etc.). This ADR
refers to `SceneContents` throughout because it is the component that calls
hooks and registers frame callbacks.

ADR 005 split `SceneContents` from a ~520-line monolith into a thin
orchestrator (~180 lines) plus dedicated hooks and scene sub-components.
After that split, two behavioural concerns remained inlined in the
orchestrator:

1. **Body position updates** — a `for` loop inside `SceneContents.useFrame`
   called `getHeliocentricPositionAu` for each of the nine solar bodies,
   copied positions into mesh refs, applied per-body rotation, and wrote
   the latest positions into a shared `bodyPositionsRef` map.

2. **Auto-orient** — a `useEffect` block watched `autoOrientTrigger`, computed
   the direction from the ship to the selected target, and mutated
   `shipStateRef.yaw` and `shipStateRef.pitch` to face the ship toward it.

These two concerns are unrelated to each other and to the remaining
orchestrator logic (target marker, trajectory line, metrics reporting).
Leaving them inlined made `SceneContents` harder to read and would make it
harder to replace or test either concern independently.

## Decision

### 1. `useBodyPositions` (`src/hooks/useBodyPositions.ts`)

Owns both the body mesh refs and the per-frame body transform update loop.

**Signature:**
```ts
function useBodyPositions(
  simulatedDateRef: React.RefObject<Date>,
): {
  bodyMeshRefs: React.MutableRefObject<Record<string, BodyRefs>>
  bodyPositionsRef: React.RefObject<Map<string, Vector3>>
}
```

- Creates `bodyMeshRefs` internally with `useRef` so it owns the ref rather
  than taking it as a hook argument. This avoids mutating caller-owned data,
  which satisfies the `react-hooks/immutability` ESLint rule.
- Registers a single `useFrame` that iterates `SOLAR_BODIES`, calls
  `getHeliocentricPositionAu(body, date)`, copies the result into each body's
  mesh position, applies per-body axial rotation and Saturn's ring tilt, and
  writes the latest position into its own `bodyPositionsRef` map.
- Returns both `bodyMeshRefs` (passed to `<SolarBodies>` so the scene
  component can populate it) and `bodyPositionsRef` (read by the orchestrator
  for target tracking and metrics).
- Must be registered after `useTimeSimulation` so its `useFrame` fires after
  the simulated date has been advanced for the current tick.

### 2. `useAutoOrient` (`src/hooks/useAutoOrient.ts`)

Owns the auto-orient behaviour (the "T" key / orient-to-target button).

**Signature:**
```ts
function useAutoOrient(
  autoOrientTrigger: number,
  selectedBodyNameRef: React.RefObject<string>,
  shipStateRef: React.RefObject<ShipState>,
  bodyPositionsRef: React.RefObject<Map<string, Vector3>>,
): void
```

- Uses a `useEffect` that fires whenever `autoOrientTrigger` changes.
- Reads the current target position from `bodyPositionsRef` (or the origin for
  the Sun), computes the yaw and pitch needed to face that direction using
  `directionToYawPitch`, and mutates `shipStateRef` directly (no React
  re-render).
- Uses the exported `PITCH_LIMIT_RAD` constant from `simulation/physics.ts`
  instead of a hard-coded literal.

### 3. Updated `SceneContents`

`SceneContents` in `SimulatorCanvas.tsx` now calls both new hooks. It no longer
owns `bodyMeshRefs` directly; instead, `useBodyPositions` returns it along with
`bodyPositionsRef`, and `SceneContents` passes `bodyMeshRefs` into `<SolarBodies>`.

Its single remaining `useFrame` is narrowed to three responsibilities:

1. Positioning and orienting the target selection ring.
2. Updating the trajectory line geometry endpoints.
3. Throttled metrics reporting.

The body position update loop and auto-orient effect are no longer inlined.

## Consequences

### Positive

- `SceneContents` shrinks from ~180 to ~140 lines with each responsibility
  clearly labelled.
- `useBodyPositions` can be inspected or mocked independently of the camera
  and ship physics hooks.
- `useAutoOrient` isolates the only place in the codebase that mutates ship
  attitude from outside the physics step, making it easy to find and reason
  about.
- `PITCH_LIMIT_RAD` is now used consistently across `physics.ts`,
  `useAutoOrient.ts`, and any future hook that needs the same clamp — no
  duplicated magic numbers.

### Negative

- The number of hook call-sites in `SceneContents` increases by two, and the
  ordering constraints (time → body positions; body positions → orchestrator
  frame) must be documented and maintained.
- `bodyPositionsRef` is now returned by `useBodyPositions` rather than owned
  directly by `SceneContents`, adding one more indirection to trace when
  debugging target tracking.

## Follow-up

- If the target-marker and trajectory-line logic grows, they can be extracted
  into `useTargetMarker` and `useTrajectoryLine` hooks following the same
  pattern.
- The `useBodyPositions` hook could eventually accept a `bodies` array
  parameter instead of reading the module-level `SOLAR_BODIES` constant,
  making it unit-testable without mocking the solar data module.
