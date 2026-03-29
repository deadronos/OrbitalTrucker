# ADR 013: Command-driven autonomous guidance for normal-play ship control

- **Status:** Accepted
- **Date:** 2026-03-30
- **Related:** ADR 005 (shift normal play to autonomous space trucking), ADR 011 (destination catalog, moon ephemerides, transfer planning, and autonomous guidance), ADR 012 (transfer planner with intercept prediction and capability-aware inputs)

## Context

ADR 005 and ADR 011 already established that normal play should no longer be
manual piloting. The prototype, however, still routes ship motion through
keyboard and pointer input hooks:

- `W/A/S/D/Q/E` thrust and strafe
- pointer drag for heading changes
- one-shot orient-to-target commands layered on top of manual flight

That leaves a mismatch between the documented game loop and the running game:

- destination selection exists, but it does not actually drive ship control
- planner output exists, but it is only used for route visuals and telemetry
- the Newtonian backend still expects "pilot inputs" instead of ship-computer
  commands

Issue #26 requires closing that mismatch without losing the visible ship motion,
camera follow, and existing physics backend that made the prototype legible.

## Decision

### 1. Normal-play ship control becomes command-driven

The ship-motion backend keeps its Newtonian integration, but it no longer takes
keyboard state as the primary control input. Instead it accepts a normalized
control-command object describing the ship computer's intended actions:

- forward / lateral / vertical thrust intent
- yaw and pitch steering intent
- boost intent
- translational brake intent
- rotational brake intent

Keyboard mappings may still exist as legacy helpers for tests or debugging, but
they are not the normal-play control source.

### 2. Add a pure autonomous-guidance module ahead of the physics backend

Normal-play autonomy lives in a dedicated pure module that consumes:

- the current ship state
- current ship orientation vectors
- the current transfer-planner result

It returns:

- a guidance phase
- the command object to feed into the physics backend
- alignment / braking facts that explain why that command was chosen

Keeping this logic pure makes it easy to regression-test destination changes and
guidance behavior without involving React, Three.js, or frame-loop timing.

### 3. Guidance uses planner output continuously, not as a one-shot orient action

The autonomous-guidance layer recomputes every frame from the current planner
result. It is responsible for:

- turning toward the planner's desired heading
- withholding or reducing forward thrust while badly misaligned
- braking when arrival or overshoot risk becomes meaningful
- resuming cruise when the route is aligned again after retargeting

This replaces the old "press a button to snap-orient toward target" model as
the default travel behavior.

### 4. Guidance phases must stay legible and modest

The first implementation pass should use a small set of explicit phases that
match the current prototype's needs:

- `acquiring` for turning onto the new course
- `cruising` for thrusting along the planned route
- `braking` for reducing velocity near arrival or overshoot
- `arrived` for holding position once close enough and slow enough

This is intentionally not a full autopilot/flight-management simulation. The
goal is dependable, understandable guidance behavior that keeps the ship visibly
moving through the existing scene.

### 5. Normal-play UI stops advertising manual piloting

The HUD and control panel should no longer present keyboard-flight hints as the
main interaction model. The player-facing normal-play controls are:

- choosing a destination
- monitoring route/planner telemetry
- managing time warp

Any retained developer-only manual controls remain outside the normal-play UX.

## Consequences

### Positive

- The running prototype now matches the autonomous-travel ADRs instead of only
  gesturing toward them.
- Planner output becomes operationally meaningful because it directly drives the
  ship.
- The ship remains a visible object under Newtonian motion rather than a
  teleported icon or a menu-only abstraction.
- Guidance logic gains a stable pure seam for regression tests.

### Negative

- The physics backend must now maintain two concepts: command inputs and the
  legacy key-to-command mapping used by old tests or debug tooling.
- Guidance tuning introduces heuristic thresholds for turn acquisition,
  braking, and arrival.
- Some prototype-era controls and UI affordances become intentionally unused in
  shipped normal play.

## Follow-up

- Expose guidance phase in telemetry once the HUD needs more explicit travel
  state language.
- Add higher-fidelity arrival and station-approach behavior when local freight
  gameplay becomes deeper.
- Keep any future manual/debug controls explicitly separated from normal-play
  command-driven autonomy.
