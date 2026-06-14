# Fix #52: Intercept Aim Honors Real Orbital Mechanics — Design

> **For agentic workers:** This is the design spec for issue #52. The
> implementation plan that follows this spec lives in
> `docs/superpowers/plans/2026-06-14-fix-52-intercept-aim-real-orbital-mechanics.md`.

**Issue:** #52 — Autonomous guidance misses because intercept aim is treated as a static target

**Goal:** Make the autonomous navigation stack converge on destinations that
move along realistic Keplerian orbits, with HUD-visible planner state, while
preserving the existing pure-planner / pure-guidance seam.

**Architecture (one paragraph):** The transfer planner keeps its current
pure-module shape, but replaces its single-shot constant-velocity sample with
an iterative re-solve that calls the destination's curve-resolver on each
pass. The guidance layer gains a distance-based blend that smoothly
transitions from "aim at the planner's static intercept fix" to "lead the
target using its current velocity × remaining time" as the ship nears
arrival. The planner's status enum grows from three to five values so the
HUD can describe the new chase-and-lead fall-back distinctly from a real
intercept. All changes are additive to the public planner/guidance types
unless the change is the *fix* itself, in which case the field is repurposed
in the same task.

**Tech Stack:** TypeScript, Vitest, React Three Fiber, Three.js, the
existing `keplerian.ts` / `vsop87.ts` resolvers, and the existing
`resolveLocationPosition` curve-resolver in `src/world/locations.ts`.

---

## Background

Issue #52 enumerates three concrete defects in the navigation stack:

1. `planTransfer` samples the destination's velocity once at
   `date + 21_600 s` and treats that as constant for the rest of the
   transit. For an interplanetary transfer the destination is on a curved
   orbit, so the constant-velocity assumption drifts well before arrival.
2. `computeAutonomousGuidance` derives `desiredDirection` from
   `planner.guidance.direction`, which is the straight-line vector from the
   ship to the static aim point. There is no term that corrects this
   heading for the ship's own velocity or for the destination's motion
   past the planner's predicted arrival.
3. When the solver cannot converge, the planner returns
   `aimPosition = currentPosition` and status `no-solution`. The ship is
   then asked to chase the destination's *current* position forever with
   no HUD visibility into this state.

The fix touches only `src/simulation/transfer-planner.ts`,
`src/simulation/autonomous-guidance.ts`, the formatter and the
`ControlPanel` narrative in the components, plus new and updated tests. The
ephemeris resolvers and physics backend are unchanged.

## Decisions

### 1. Planner: iterative curve-resolved intercept

The planner keeps its iterative re-solve loop but, on each iteration,
**calls `resolveDestinationPosition(destinationId, candidateDate)`** instead
of using a fixed sample velocity. This is the same resolver the rest of the
codebase uses for destination positions, so the iteration converges on a
position the destination will *actually* occupy at `candidateDate`. The
existing `estimatedVelocityAuPerSec` field stays as a *display* field (it
tells the HUD how fast the target is moving), but the solver no longer
depends on it.

The planner still falls back to the destination's current position when
the ship's planning speed is below `minimumPlanningSpeedAuPerSec`, but
this is now the only path that yields `current-position`. The solver
output — when it converges — always produces a curve-resolved
`predictedPosition`, so `future-intercept` and the new
`lead-chase`/`intercept-overrun` statuses all have a meaningful
`predictedPosition` to report.

### 2. Planner: new `requiredArrivalVelocity` field

The planner result gains a new field:

```ts
guidance: {
  aimPosition: Vector3
  direction: Vector3
  bearingAngleDeg: number
  /** Target's heliocentric velocity at predictedDate (or at `date` if not yet solved). */
  requiredArrivalVelocity: Vector3
}
```

`requiredArrivalVelocity` is computed as
`resolveDestinationPosition(id, predictedDate + 1s).sub(resolveDestinationPosition(id, predictedDate)).divideScalar(1)`
when a predicted date exists, otherwise as a one-second forward
difference from the current date. This is the *exact* instantaneous
velocity of the target on its curve, not a sampled average. The guidance
layer uses it for lead-pursuit; the HUD *does not* show it (it is a
guidance-internal signal).

### 3. Planner status grows from 3 to 5

The status enum becomes:

```ts
export type TransferPlannerStatus =
  | 'current-position'   // ship is too slow for planning; aim at current
  | 'future-intercept'   // solver converged on a curve-resolved intercept
  | 'intercept-overrun'  // target is outrunnable, but the planner still
                         // returns the last converged fix and a status
                         // that drives the lead-chase blend in guidance
  | 'lead-chase'         // solver could not converge at all; aim at
                         // currentPosition + currentVelocity * eta
  | 'no-solution'        // retained as a strict error state: no eta, no
                         // aim, and guidance uses idle controls. (See §4.)
```

Semantics:

- `current-position` — unchanged. Used when the ship is effectively
  stationary (planning speed below `minimumPlanningSpeedAuPerSec`) or the
  target does not move meaningfully over the transit.
- `future-intercept` — the solver converged. `predictedPosition` is on the
  destination's curve at `predictedDate`. `aimPosition` is that
  `predictedPosition`. HUD copy: "Future intercept".
- `intercept-overrun` — the solver determined the target can outrun the
  ship, but the planner *still* returns the last valid iteration's
  `predictedPosition` and `requiredArrivalVelocity`. HUD copy:
  "Intercept overrun". The guidance layer uses the live lead-pursuit
  blend, so the ship visibly chases without going into a static-point
  dead end.
- `lead-chase` — the solver did not converge within the iteration limit
  and there is no usable last iteration. The planner falls back to
  `aimPosition = currentPosition + requiredArrivalVelocity * etaEstimate`
  and `etaEstimate` is the naive range/speed ratio. HUD copy: "Lead
  chase".
- `no-solution` — retained as a strict error state for the case where the
  planner cannot produce *anything* (e.g. zero-velocity ship with a
  high-velocity target, where even the lead-pursuit aim is meaningless).
  In this state `predictedDate`, `interceptTimeSeconds`, and
  `etaDays` are all `null`, `aimPosition` is the destination's current
  position, and the guidance layer is expected to issue idle controls
  (the existing braking phase handles this naturally because the
  distance is closing faster than the planning speed can match).

This replaces the original 3-state enum and explicitly fixes the
"degenerate chase" complaint in the issue: the player now sees one of
three distinct labels for non-intercept behavior (`Intercept overrun`,
`Lead chase`, or the historical `Fallback` for `no-solution`), and the
guidance layer is no longer asked to chase a static point in any of them.

### 4. Guidance: distance-based lead-pursuit blend

`computeAutonomousGuidance` gains a new internal computation:

```ts
const targetMotionAu =
  plannerResult.travel.targetMotionDuringInterceptAu
const leadWeight = clamp(targetMotionAu / 0.05, 0, 1) // 0 at <0.05 AU motion, 1 at >=0.05 AU
const liveLeadPosition = target.currentPosition
  .clone()
  .addScaledVector(plannerResult.guidance.requiredArrivalVelocity, remainingTimeSeconds)
const blendedAim = plannerResult.guidance.aimPosition
  .clone()
  .lerp(liveLeadPosition, leadWeight)
const effectiveDesiredDirection = blendedAim.sub(shipState.position).normalize()
```

`targetMotionDuringInterceptAu` is the planner's existing field that
already measures how much the target is going to move over the transit;
a small target motion (< 0.05 AU) means lead-pursuit buys nothing and
the planner's static aim is fine. A large target motion (interplanetary
scale) means the live lead dominates and the ship's heading tracks the
target's *current* velocity. The blend is smooth, no per-frame wobble.

The 0.05 AU threshold is exposed as a capability input:

```ts
shipCapabilities: {
  ...
  /** Distance (AU) at and above which lead-pursuit is fully active. */
  leadPursuitFullScaleAu: number
}
```

`DEFAULT_SHIP_CAPABILITIES` adds `leadPursuitFullScaleAu: 0.05`.

For the `intercept-overrun` and `lead-chase` planner statuses, guidance
forces `leadWeight = 1` and skips the planner's static aim entirely,
because in those cases the planner's `aimPosition` is either stale or
the lead is the *only* useful signal. The HUD copy already tells the
player they are in a chase, so the visual change (no intercept marker,
no static ring) is consistent.

### 5. HUD changes

- The `MetricsPanel` already shows `Planner status` and `Target drift`;
  no new fields are added to the metrics contract.
- `formatTransferPlannerStatus` learns the two new cases:
  - `intercept-overrun` → `"Intercept overrun"`
  - `lead-chase` → `"Lead chase"`
  - `no-solution` keeps `"Fallback"` so existing player-facing copy
    doesn't shift for the error case.
- `describePlannerState` in `ControlPanel.tsx` learns the two new cases:
  - `intercept-overrun` → `"The target outruns the ship; the planner is leading the live target instead of a static fix."`
  - `lead-chase` → `"The planner could not converge; the ship is leading the target using its current velocity."`
- `buildNavigationVisualState` in `src/scene/navigation-visuals.ts`
  changes the gating predicate from
  `plannerResult.status === 'future-intercept'` to a new helper
  `shouldShowInterceptMarker(plannerResult)` that returns `true` for
  `future-intercept` and `false` for everything else. This means the
  cyan intercept ring and the "tether" between the current and predicted
  positions only show for genuine intercepts, not for chases.

### 6. ADR update

A new ADR is created at
`docs/ARCHITECTURE/technicaldecisions/017-curve-resolved-intercept-and-lead-pursuit.md`.
It supersedes the iterative-intercept recipe in ADR 012 and the
"guidance uses planner output continuously" rule in ADR 013, and links
back to the issue.

## Components and File Layout

The work fits in the existing file layout. New code is added next to its
caller; no new files are created in `src/simulation/` or `src/components/`.
The new ADR is a new file under `docs/ARCHITECTURE/technicaldecisions/`.

| File | Change |
| --- | --- |
| `src/simulation/transfer-planner.ts` | Add `requiredArrivalVelocity` to `TransferPlannerResult.guidance`. Add `intercept-overrun` and `lead-chase` to the status enum. Replace the constant-velocity assumption in the iteration loop with curve-resolved iteration. Add `leadPursuitFullScaleAu` to `ShipCapabilities` and `DEFAULT_SHIP_CAPABILITIES`. |
| `src/simulation/autonomous-guidance.ts` | Compute `leadWeight` from `targetMotionDuringInterceptAu` and the capability threshold. Blend the aim point with the live lead. Force `leadWeight = 1` for `intercept-overrun` and `lead-chase`. |
| `src/simulation/formatters.ts` | Extend `formatTransferPlannerStatus` to cover the two new cases. |
| `src/components/ControlPanel.tsx` | Extend `describePlannerState` to cover the two new cases. |
| `src/scene/navigation-visuals.ts` | Replace the inline `status === 'future-intercept'` predicate with a named helper `shouldShowInterceptMarker` so the marker logic is testable and the chase states do not show a stale ring. |
| `docs/ARCHITECTURE/technicaldecisions/017-curve-resolved-intercept-and-lead-pursuit.md` | New ADR documenting the decisions above. |
| `tests/unit/transfer-planner.test.ts` | Add tests for the new statuses, the new `requiredArrivalVelocity` field, and a curve-resolver test (Keplerian resolver) showing the solver converges on the actual curve. |
| `tests/unit/autonomous-guidance.test.ts` | Add tests for the lead-pursuit blend: low-motion uses static aim, high-motion uses live lead, and `intercept-overrun` / `lead-chase` force `leadWeight = 1`. |
| `tests/unit/navigation-visuals.test.ts` | Add tests that the intercept marker is hidden for chase statuses. |
| `tests/integration/autonomous-travel-pipeline.test.ts` | Add an end-to-end test that drives the ship at a destination whose position comes from a Keplerian resolver and asserts the ship converges to within the existing arrival tolerance, not just that `phase === 'arrived'` for a static resolver. |

Each unit-test file change is small and additive. The integration test
reuses the existing pipeline harness.

## Data Flow (per frame)

1. `useAutonomousGuidance` calls `planTransfer` with the current ship
   state, date, and destination.
2. `planTransfer`:
   - resolves the destination at `date` → `currentPosition`
   - if planning speed is below threshold → returns `current-position`
   - else runs the iterative re-solve, each pass calling
     `resolveDestinationPosition(id, candidateDate)` on the destination's
     curve, updating `interceptTimeSeconds` as
     `shipPosition.distanceTo(candidatePosition) / planningSpeed`
   - if the iteration converges → `future-intercept` with the
     curve-resolved `predictedPosition`
   - if the iteration converges but the next iteration would put the
     intercept past the lookahead horizon → `intercept-overrun` with the
     last converged `predictedPosition`
   - if the iteration never converges → `lead-chase` with
     `predictedPosition = currentPosition + requiredArrivalVelocity * etaEstimate`
   - in all cases, `requiredArrivalVelocity` is computed from a
     one-second forward difference at `predictedDate ?? date`
3. `planTransfer` returns the result; the existing
   `buildNavigationVisualState` consumes it for scene overlays; the
   existing `useSimulationMetrics` consumes it for HUD fields.
4. `computeAutonomousGuidance` reads `aimPosition`,
   `requiredArrivalVelocity`, and `targetMotionDuringInterceptAu`,
   computes `leadWeight`, blends the aim, and produces the control
   command as before.

## Error Handling

- `no-solution` is the strict error case. The existing
  `getApproachThrottle` and `selectGuidancePhase` already handle
  `etaDays === null` and `interceptTimeSeconds === null` by entering
  the `braking` / `arrived` phase; we verify this in the new unit
  tests and make no behavioral change there.
- The iterative solver keeps the existing
  `capabilities.maxInterceptIterations` cap. The new behavior is that
  when the cap is reached *and* the error is below tolerance, we report
  `future-intercept`; when the cap is reached *and* the error is still
  above tolerance, we report `intercept-overrun` if we have a valid
  last iteration, otherwise `lead-chase`. This is a strict refinement
  of the existing "did not converge → `no-solution`" path.
- The resolver can throw if a destination ID is unknown. The planner
  lets the resolver's error propagate (existing behavior). The new
  statuses do not change this.

## Testing

The acceptance criteria from issue #52 are:

1. The autonomous guidance stack converges on a destination that is
   moving along a realistic Keplerian orbit, not just a static position.
2. The planner's `status`, `predictedDate`, and
   `targetMotionDuringInterceptAu` are visible in the HUD while in
   transit, so the player can tell when the planner has fallen back to
   `current-position` or `no-solution` mode.
3. At least one integration test exercises the moving-target case
   end-to-end and would fail with the current code.
4. ADR 012 is updated if the planner/guidance split changes, so the
   docs stay the source of truth per `AGENTS.md`.

The plan addresses these directly:

- (1) and (3) → new integration test
  `tests/integration/autonomous-travel-pipeline.test.ts` that uses a
  Keplerian resolver (via the real `resolveLocationPosition` with the
  existing test ephemeris) as the destination resolver. The test runs
  the full `planTransfer → computeAutonomousGuidance → stepShipPhysics`
  loop and asserts the ship reaches the destination's *current*
  position at the end of the run, with `phase === 'arrived'`. The test
  must fail against the current code, where the constant-velocity
  assumption makes the planner report a stale `predictedPosition` and
  the ship overshoots.
- (2) → no code change required; the HUD already shows `Planner status`,
  `ETA`, and `Target drift`. The new statuses and the
  `formatTransferPlannerStatus` extension make the existing UI surface
  the new states without re-laying-out the panel.
- (4) → ADR 017 is created as part of the work.

Unit test additions are scoped to each modified module and follow the
existing Vitest conventions. No new testing infrastructure.

## Out of Scope

- Replacing the destination-resolver interface (e.g. with a real Lambert
  solver). The current resolver *is* the curve; the iterative re-solve
  gets the right answer against that curve.
- A proper flight-management system (autopilot, station-keeping, etc.).
  The four guidance phases stay as they are.
- Changes to the HUD layout, the bundle budget work, or the freight
  contract loop. The new statuses do not change the public planner API
  in a way that breaks the freight loop.
- Any change to the physics backend, the scene, or the camera.

## Self-Review Notes

- No placeholders. Each component change has a one-paragraph "what
  changes" specification that is enough to implement against.
- Internal consistency: the same five-status enum is referenced from
  the planner, the formatter, the control panel narrative, and the
  visual marker helper. The same `requiredArrivalVelocity` field is
  referenced from the planner and the guidance. The same
  `leadPursuitFullScaleAu` capability is referenced from the default
  constants, the guidance computation, and the test.
- Scope: the change is bounded to the navigation stack and the docs
  that describe it. The freight loop, bundle budget, and asset work
  are explicitly out of scope.
- Ambiguity: the five-status enum semantics are spelled out for each
  case, including what the planner returns in `aimPosition` and what
  the guidance does with it.
