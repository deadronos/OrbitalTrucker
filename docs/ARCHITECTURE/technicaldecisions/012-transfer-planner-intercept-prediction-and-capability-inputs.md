# ADR 012: Transfer planner with intercept prediction and capability-aware inputs

- **Status:** Accepted
- **Date:** 2026-03-30
- **Related:** ADR 011 (destination catalog, moon ephemerides, transfer planning, and autonomous guidance)

## Context

ADR 011 established that straight-line aiming at a destination's current
position could no longer be the source of truth for navigation. The prototype
already supports:

- a destination catalog that can resolve planets, moons, colonies, and stations
  at arbitrary simulation dates
- a visible ship with persistent position and velocity
- HUD telemetry and route-line visuals that consume a planner output

What the code still lacked was a planning layer that could answer the question
"where should the ship aim if the destination will move before arrival?"

That gap mattered in three ways:

- **Scene visuals** were still drawing a line to the target's current position,
  which becomes misleading for long transfers.
- **HUD state** could only report a straight-line ETA/bearing to the current
  target snapshot, not to a predicted intercept.
- **Future autonomous guidance** needed a pure module that could be called every
  frame without depending on React or Three.js scene state.

The transfer planner also needed an explicit seam for future equipment systems.
Even before engines, computers, or cargo loadouts exist in the UI, the planner
API must already accept ship capability inputs so later upgrades can influence
planning behavior without forcing a public API rewrite.

## Decision

### 1. Add a dedicated pure module: `src/simulation/transfer-planner.ts`

Transfer planning lives in its own framework-free module. The module accepts:

- current simulation date
- ship position, velocity, and forward direction
- selected destination ID
- a destination-position resolver function that can answer "where is this
  destination at date X?"
- ship capability inputs that affect planning assumptions

It returns one planner result that is suitable for three consumers:

- **scene visuals**: an aim point for route lines and future intercept markers
- **HUD state**: planner status, range, bearing, and ETA
- **guidance systems**: a desired heading vector plus intercept timing data

### 2. Use future-position intercepts as the primary aim mode

When the ship has a meaningful planning speed, the planner should not stop at
the destination's current position.

Instead, it should:

1. resolve the destination's current position
2. estimate short-horizon target velocity by sampling the resolver forward in
   time
3. solve a constant-speed intercept against that estimated motion
4. refine the candidate by re-resolving the destination at the predicted
   arrival date
5. return the refined future position as the planner's aim point when the
   solution converges

If the ship is effectively stationary, the target is unreachable within the
configured planning horizon, or the intercept solver does not converge, the
planner falls back to the destination's current position and reports that state
explicitly.

### 3. Planner results must distinguish current-fix fallback from true intercept planning

The planner result includes a status with three cases:

- `current-position`: aiming at the destination's current resolved position
- `future-intercept`: aiming at a predicted future destination position
- `no-solution`: no future intercept could be validated, so the planner falls
  back to the current position

This status is important because the route line, HUD copy, and future guidance
logic need to know whether they are following a real intercept plan or a safe
fallback.

### 4. Ship capability inputs are part of the planner contract now

The planner accepts a capability object even though the current prototype only
uses a small subset of it.

The first supported inputs are:

- assumed cruise speed override
- minimum speed threshold for meaningful planning
- target-velocity sampling interval
- intercept lookahead horizon
- iteration limit and convergence tolerance

This keeps the planner ready for future ship computers, engine upgrades, or
cargo/loadout effects without tying those systems to the initial UI.

### 5. Existing straight-line helpers remain low-level math, not the architectural source of truth

`src/simulation/trajectory.ts` still provides reusable vector math such as
bearing and yaw/pitch conversion, but it is no longer the module that owns
destination planning decisions.

The transfer planner may reuse those helpers internally after it has already
chosen an aim point. The architectural boundary is:

- `trajectory.ts`: math for "given two points, what is the bearing/direction?"
- `transfer-planner.ts`: logic for "which point should the ship aim at?"

### 6. Current scene integration should consume planner output immediately

The initial implementation should not leave the transfer planner unused.
`SimulatorCanvas`, telemetry reporting, and the orient-to-target action should
all consume planner output so the running prototype reflects the new navigation
architecture before autonomous guidance lands.

## Consequences

### Positive

- Long-haul routes can aim at a predicted future target position instead of a
  stale current snapshot.
- The planner is unit-testable with mocked destination resolvers, making
  retargeting and intercept scenarios easy to validate.
- HUD and scene state now share the same planner output rather than each
  recomputing their own navigation assumptions.
- Capability-aware inputs create a clean seam for future equipment systems.

### Negative

- Intercept quality depends on the sampled-motion approximation and is not yet a
  full orbital-transfer solver.
- The route line and current destination marker may intentionally describe
  slightly different concepts: current destination location versus planned aim
  point.
- The planner introduces more structured output and therefore more integration
  work in telemetry and UI layers.

## Follow-up

- Feed the planner result into a dedicated autonomous-guidance hook.
- Add explicit intercept markers or future-position ghosts in the scene.
- Let ship-computer quality and engine loadouts tune planning assumptions.
- Replace sampled intercept prediction with higher-fidelity transfer logic once
  the flight model demands it.
