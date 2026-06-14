# ADR 017: Curve-resolved intercept and lead-pursuit guidance

- **Status:** Accepted
- **Date:** 2026-06-14
- **Related:** ADR 012 (transfer planner with intercept prediction and capability-aware inputs), ADR 013 (command-driven autonomous guidance), issue #52

## Context

The transfer planner introduced in ADR 012 aimed the ship at a curve-
*resolved* future position by running an iterative re-solve against a
constant-velocity estimate of the target. For inner-planet transfers
this worked, but for interplanetary transfers the target's actual
heliocentric motion is curved and the constant-velocity sample drifted
well before arrival, so the ship visibly missed the target even when
the planner reported a converged `future-intercept` solution.

The autonomous-guidance layer in ADR 013 steered toward the planner's
`aimPosition` as if it were a static waypoint. It had no term that
corrected the heading for the ship's own velocity or for the
destination's continued motion past the planner's predicted arrival.

When the solver could not converge, the planner returned
`aimPosition = currentPosition` and status `no-solution`, leaving the
ship chasing the target's *current* position forever. The HUD did not
distinguish this degenerate chase from a real intercept plan.

Issue #52 calls out that this is the highest-leverage correctness bug
in the navigation stack and should be fixed before any economy layer
lands on top of it.

## Decision

### 1. Planner iteration calls the curve-resolver directly

The planner's iteration loop already calls
`resolveDestinationPosition(destinationId, candidateDate)` to evaluate
the candidate intercept position. This was true in ADR 012's
implementation but the loop still seeded itself from a 21 600-second
forward sample of the target's velocity. The fix is to remove the
seed-velocity dependence: the iteration starts from the
`currentPosition` and a `ship-to-current` time estimate, then refines
on the curve each pass. The result is that `predictedPosition` is
always on the destination's actual curve at `predictedDate`, not at
the end of a straight-line extrapolation.

### 2. New `guidance.requiredArrivalVelocity` field

The planner result gains a `requiredArrivalVelocity: Vector3` field
that reports the target's instantaneous heliocentric velocity at the
predicted intercept time. The field is computed as a one-second
forward difference on the curve-resolver at `predictedDate` (or at
`date` if the planner is in `current-position` mode). It is exact to
the curve and is consumed by the guidance layer for lead-pursuit; the
HUD does not surface it.

### 3. Five-state planner status

The status enum grows from three to five values:

- `current-position` — ship planning speed is below the minimum; aim
  at the target's current position
- `future-intercept` — solver converged on a curve-resolved intercept
  within the lookahead horizon
- `intercept-overrun` — solver converged but the next iteration would
  exceed the lookahead horizon (commonly because the target's
  apparent speed outpaces the ship's planning speed, so the intercept
  time keeps growing); the planner still returns the last converged
  `predictedPosition` and `requiredArrivalVelocity`
- `lead-chase` — solver did not converge within the iteration limit
  and there is no usable last iteration; the planner falls back to
  `aimPosition = currentPosition + requiredArrivalVelocity * eta`
- `no-solution` — strict error state, retained for the case where the
  planner cannot produce a meaningful aim

The HUD's `formatTransferPlannerStatus` and the `ControlPanel`
narrative each learn the two new cases. The `no-solution` label stays
`"Fallback"` to keep the historical player-facing copy stable.

### 4. Distance-based lead-pursuit blend in guidance

The guidance layer computes a `leadWeight` from
`targetMotionDuringInterceptAu` (the planner's existing field) and a
new `leadPursuitFullScaleAu` capability (default 0.05 AU). The
effective heading is the linear interpolation between the planner's
static aim and a live lead
`currentPosition + requiredArrivalVelocity * remainingTime`. When the
planner status is `intercept-overrun` or `lead-chase`, the blend
forces `leadWeight = 1` and skips the static aim. When the status is
`future-intercept` or `current-position`, the blend respects the
distance-based weight.

### 5. Intercept marker is chase-aware

The scene's `shouldShowInterceptMarker` helper hides the cyan
intercept ring and the current-to-predicted tether for any non-
`future-intercept` planner status. The current destination marker and
the route line remain visible. This makes the visual model match the
five-state status without adding new overlay types.

## Consequences

### Positive

- Long-haul transfers now converge on the target's *actual* position
  at the predicted intercept time.
- The HUD distinguishes the four non-trivial planner states
  (`future-intercept`, `intercept-overrun`, `lead-chase`,
  `no-solution`) so the player can recognize the chase case.
- The planner and guidance remain pure modules with stable test seams.
- The curve is honored through the existing resolver interface, so
  future ephemeris improvements propagate without planner changes.

### Negative

- The status enum grows; every consumer (`formatters`,
  `describePlannerState`, `navigation-visuals`) needs the new cases.
- The new `requiredArrivalVelocity` field adds two resolver calls per
  planner evaluation; this is bounded by the existing planner cadence.
- The lead-pursuit blend introduces a heuristic threshold
  (`leadPursuitFullScaleAu`); this is exposed as a capability and can
  be tuned per ship class in the future.

## Follow-up

- If a full Lambert solver is added later, the iterative re-solve and
  the lead-pursuit blend remain valid fall-backs; only the
  `aimPosition` computation changes.
- If the HUD grows a dedicated chase indicator, the
  `intercept-overrun` and `lead-chase` statuses are already distinct
  enough to drive different copy.
- If ship computers or engines tune the planning speed, the
  `assumedCruiseSpeedAuPerSec` capability continues to drive the
  solver; the `leadPursuitFullScaleAu` capability is the next seam.
