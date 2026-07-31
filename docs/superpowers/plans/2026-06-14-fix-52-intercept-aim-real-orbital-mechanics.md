# Fix #52: Curve-Resolved Intercept and Lead-Pursuit Guidance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the autonomous navigation stack converge on destinations that move along realistic Keplerian orbits, expose planner fall-back state in the HUD, and keep the pure-planner / pure-guidance seam.

**Architecture:** Replace the planner's single-shot constant-velocity sample with an iterative re-solve that calls the destination's curve-resolver on each pass; add a `requiredArrivalVelocity` field to the planner result; grow the planner status enum from 3 to 5 values; add a distance-based lead-pursuit blend in the guidance layer that smoothly transitions from "aim at the static intercept fix" to "lead the target using its current velocity × remaining time"; surface the new states in the formatter, control panel narrative, and the scene intercept-marker helper.

**Tech Stack:** TypeScript, Vitest, React Three Fiber, Three.js, the existing `keplerian.ts` / `vsop87.ts` resolvers, and the existing `resolveLocationPosition` curve-resolver.

**Branch:** `fix/52-intercept-aim-real-orbital-mechanics` (worktree at `.worktrees/fix-52-intercept-aim`)

**Design spec:** `docs/superpowers/specs/2026-06-14-fix-52-intercept-aim-real-orbital-mechanics-design.md`

---

## File Structure

| File                                                                                    | Change                                                                                  |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `docs/ARCHITECTURE/technicaldecisions/017-curve-resolved-intercept-and-lead-pursuit.md` | Create — new ADR documenting the design decisions                                       |
| `src/simulation/transfer-planner.ts`                                                    | Modify — extend status enum, add `requiredArrivalVelocity` and `leadPursuitFullScaleAu` |
| `src/simulation/autonomous-guidance.ts`                                                 | Modify — add lead-pursuit blend                                                         |
| `src/simulation/formatters.ts`                                                          | Modify — extend `formatTransferPlannerStatus`                                           |
| `src/components/ControlPanel.tsx`                                                       | Modify — extend `describePlannerState`                                                  |
| `src/scene/navigation-visuals.ts`                                                       | Modify — extract `shouldShowInterceptMarker` helper                                     |
| `tests/unit/transfer-planner.test.ts`                                                   | Modify — new tests for statuses, `requiredArrivalVelocity`, curve-resolver              |
| `tests/unit/autonomous-guidance.test.ts`                                                | Modify — new tests for lead-pursuit blend                                               |
| `tests/unit/navigation-visuals.test.ts`                                                 | Modify — new tests for marker gating                                                    |
| `tests/integration/autonomous-travel-pipeline.test.ts`                                  | Modify — new Keplerian end-to-end test                                                  |

The work is sequential: each task depends on the previous task's exports and tests. Tasks 1–2 are docs/setup, Tasks 3–7 are the planner+guidance core, Tasks 8–10 are HUD/visual consumers, Tasks 11–14 are tests, Task 15 is the final ADR-012 link.

---

## Task 1: Add ADR 017

**Files:**

- Create: `docs/ARCHITECTURE/technicaldecisions/017-curve-resolved-intercept-and-lead-pursuit.md`

- [ ] **Step 1: Create the ADR file**

Create `docs/ARCHITECTURE/technicaldecisions/017-curve-resolved-intercept-and-lead-pursuit.md` with the following content:

```markdown
# ADR 017: Curve-resolved intercept and lead-pursuit guidance

- **Status:** Accepted
- **Date:** 2026-06-14
- **Related:** ADR 012 (transfer planner with intercept prediction and capability-aware inputs), ADR 013 (command-driven autonomous guidance), issue #52

## Context

The transfer planner introduced in ADR 012 aimed the ship at a curve-
_resolved_ future position by running an iterative re-solve against a
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
ship chasing the target's _current_ position forever. The HUD did not
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
  exceed the lookahead horizon, or the target's apparent speed is
  greater than the ship's planning speed; the planner still returns
  the last converged `predictedPosition` and `requiredArrivalVelocity`
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

- Long-haul transfers now converge on the target's _actual_ position
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
```

- [ ] **Step 2: Verify the file is created**

Run: `ls -la docs/ARCHITECTURE/technicaldecisions/017-curve-resolved-intercept-and-lead-pursuit.md`
Expected: a file entry, no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim
git add docs/ARCHITECTURE/technicaldecisions/017-curve-resolved-intercept-and-lead-pursuit.md
git commit -m "docs(#52): add ADR 017 for curve-resolved intercept and lead-pursuit guidance"
```

---

## Task 2: Verify baseline tests pass

**Files:**

- Read: `package.json`

- [ ] **Step 1: Install dependencies if needed**

Run: `cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim && npm install --no-audit --no-fund`
Expected: `added 0 packages` (if already installed) or a successful install with no errors.

- [ ] **Step 2: Run the existing test suite**

Run: `cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim && npm test -- --run 2>&1 | tail -40`
Expected: all existing tests pass (the suite is currently green at HEAD `e88f4c9`). If anything fails, STOP and resolve the baseline before continuing.

---

## Task 3: Extend `TransferPlannerStatus` and add `requiredArrivalVelocity` field

**Files:**

- Modify: `src/simulation/transfer-planner.ts:5-8` (status enum)
- Modify: `src/simulation/transfer-planner.ts:30-37` (`guidance` type)
- Modify: `src/simulation/transfer-planner.ts:55-62` (default capabilities)

- [ ] **Step 1: Add new status enum members**

In `src/simulation/transfer-planner.ts`, replace lines 5–8:

```typescript
export type TransferPlannerStatus =
  'current-position' | 'future-intercept' | 'no-solution'
```

with:

```typescript
export type TransferPlannerStatus =
  | 'current-position'
  | 'future-intercept'
  | 'intercept-overrun'
  | 'lead-chase'
  | 'no-solution'
```

- [ ] **Step 2: Add `requiredArrivalVelocity` to the planner result type**

In the `TransferPlannerResult` type, replace the `guidance` block (lines 30–34):

```typescript
guidance: {
  aimPosition: Vector3
  direction: Vector3
  bearingAngleDeg: number
}
```

with:

```typescript
guidance: {
  aimPosition: Vector3
  direction: Vector3
  bearingAngleDeg: number
  /**
   * The target's instantaneous heliocentric velocity at the predicted
   * intercept time (or at `date` when the planner is in
   * `current-position` mode). Computed as a 1-second forward
   * difference on the curve-resolver.
   */
  requiredArrivalVelocity: Vector3
}
```

- [ ] **Step 3: Add `leadPursuitFullScaleAu` to the capabilities type**

In `src/simulation/transfer-planner.ts`, add a new field to the `ShipCapabilities` type, after the `interceptConvergenceSeconds` field (line 23):

```typescript
  /** Acceptable change between successive intercept times. */
  interceptConvergenceSeconds: number
  /**
   * Distance (AU) at and above which lead-pursuit is fully active in
   * the guidance layer. Below this, the planner's static aim dominates.
   */
  leadPursuitFullScaleAu: number
}
```

- [ ] **Step 4: Add `leadPursuitFullScaleAu` to the default capabilities**

In `src/simulation/transfer-planner.ts`, replace the `DEFAULT_SHIP_CAPABILITIES` block (lines 58–65):

```typescript
export const DEFAULT_SHIP_CAPABILITIES: ShipCapabilities = {
  minimumPlanningSpeedAuPerSec: 1e-9,
  targetVelocitySampleSeconds: 21_600,
  maxInterceptLookaheadDays: 365 * 5,
  maxInterceptIterations: 5,
  interceptConvergenceSeconds: 1,
}
```

with:

```typescript
export const DEFAULT_SHIP_CAPABILITIES: ShipCapabilities = {
  minimumPlanningSpeedAuPerSec: 1e-9,
  targetVelocitySampleSeconds: 21_600,
  maxInterceptLookaheadDays: 365 * 5,
  maxInterceptIterations: 5,
  interceptConvergenceSeconds: 1,
  leadPursuitFullScaleAu: 0.05,
}
```

- [ ] **Step 5: Type-check**

Run: `cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim && npx tsc --noEmit 2>&1 | head -40`
Expected: type errors only in `useAutonomousGuidance.ts` (missing `requiredArrivalVelocity` in the placeholder) and in `transfer-planner.ts:planTransfer` (the return statement does not yet produce the new field). All other modules should still type-check because they only consume the existing fields.

- [ ] **Step 6: Commit**

```bash
cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim
git add src/simulation/transfer-planner.ts
git commit -m "refactor(#52): extend planner status enum and add requiredArrivalVelocity/leadPursuitFullScaleAu"
```

---

## Task 4: Add a unit test for the new status enum members

**Files:**

- Modify: `tests/unit/transfer-planner.test.ts` (add a new `it(...)` block)

- [ ] **Step 1: Add the failing test**

Append to `tests/unit/transfer-planner.test.ts`, after the existing `retargets to a different intercept solution...` test, a new test:

```typescript
it('exposes the five-state status enum to consumers', () => {
  // Compile-time check: this assignment must compile if and only if
  // every member of the enum is present in TransferPlannerStatus.
  const _status: TransferPlannerStatus[] = [
    'current-position',
    'future-intercept',
    'intercept-overrun',
    'lead-chase',
    'no-solution',
  ]
  expect(_status).toHaveLength(5)
})
```

- [ ] **Step 2: Add the import**

At the top of `tests/unit/transfer-planner.test.ts`, change the existing import from `src/simulation/transfer-planner` to also bring in the `TransferPlannerStatus` type:

```typescript
import {
  planTransfer,
  type TransferPlannerStatus,
} from '../../src/simulation/transfer-planner'
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim && npx vitest run tests/unit/transfer-planner.test.ts 2>&1 | tail -20`
Expected: PASS, the new test reports `5` status members.

- [ ] **Step 4: Commit**

```bash
cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim
git add tests/unit/transfer-planner.test.ts
git commit -m "test(#52): assert five-state planner status enum"
```

---

## Task 5: Implement iterative curve-resolved intercept and the new statuses in `planTransfer`

**Files:**

- Modify: `src/simulation/transfer-planner.ts:67-185` (`planTransfer` body)
- Modify: `src/simulation/transfer-planner.ts:230` (return statement)

- [ ] **Step 1: Add a curve-resolved velocity helper**

In `src/simulation/transfer-planner.ts`, after the existing `estimateTargetVelocity` helper (around line 230), add a new helper:

```typescript
function computeArrivalVelocity(
  destinationId: string,
  date: Date,
  resolveDestinationPosition: (destinationId: string, date: Date) => Vector3,
): Vector3 {
  const current = resolveDestinationPosition(destinationId, date)
  const next = resolveDestinationPosition(destinationId, addSeconds(date, 1))
  return next.sub(current)
}
```

- [ ] **Step 2: Replace the iteration body of `planTransfer` with a curve-resolved version**

In `src/simulation/transfer-planner.ts`, replace the `if (planningSpeedAuPerSec >= capabilities.minimumPlanningSpeedAuPerSec) { ... }` block (lines 92–185) with the following:

```typescript
if (planningSpeedAuPerSec >= capabilities.minimumPlanningSpeedAuPerSec) {
  // Seed the iteration with the straight-line travel time to the
  // current destination position. The iteration then refines against
  // the curve-resolver on each pass.
  let candidateSeconds =
    shipPosition.distanceTo(currentPosition) / planningSpeedAuPerSec

  let converged = false
  let lastUsableCandidateSeconds: number | null = null
  let lastUsablePosition: Vector3 | null = null
  let lastUsableDate: Date | null = null

  for (
    let iteration = 1;
    iteration <= capabilities.maxInterceptIterations;
    iteration += 1
  ) {
    iterations = iteration

    const candidateDate = addSeconds(date, candidateSeconds)
    const candidatePosition = resolveDestinationPosition(
      destinationId,
      candidateDate,
    )
    const nextSeconds =
      shipPosition.distanceTo(candidatePosition) / planningSpeedAuPerSec

    solutionErrorSeconds = Math.abs(nextSeconds - candidateSeconds)
    lastUsableCandidateSeconds = candidateSeconds
    lastUsablePosition = candidatePosition.clone()
    lastUsableDate = candidateDate

    if (candidateSeconds > maxLookaheadSeconds) {
      // Past the lookahead horizon. Use the last usable candidate if
      // we have one; otherwise fall back to no-solution semantics.
      if (
        lastUsablePosition &&
        lastUsableCandidateSeconds !== null &&
        lastUsableCandidateSeconds <= maxLookaheadSeconds
      ) {
        predictedPosition = lastUsablePosition
        predictedDate = lastUsableDate
        interceptTimeSeconds = lastUsableCandidateSeconds
        status = 'intercept-overrun'
      } else {
        status = 'no-solution'
      }
      break
    }

    if (solutionErrorSeconds <= capabilities.interceptConvergenceSeconds) {
      predictedPosition = candidatePosition.clone()
      predictedDate = candidateDate
      interceptTimeSeconds = candidateSeconds
      aimPosition = candidatePosition.clone()
      converged = true
      status =
        currentPosition.distanceTo(candidatePosition) > MIN_TARGET_MOTION_AU
          ? 'future-intercept'
          : 'current-position'
      break
    }

    candidateSeconds = nextSeconds
  }

  if (!converged && iterations === capabilities.maxInterceptIterations) {
    // Iteration cap reached without convergence. If we have a usable
    // last candidate, report it as intercept-overrun; otherwise fall
    // back to lead-chase with a naive ETA estimate.
    if (lastUsablePosition && lastUsableCandidateSeconds !== null) {
      predictedPosition = lastUsablePosition
      predictedDate = lastUsableDate
      interceptTimeSeconds = lastUsableCandidateSeconds
      status = 'intercept-overrun'
    } else {
      const naiveEtaSeconds =
        shipPosition.distanceTo(currentPosition) / planningSpeedAuPerSec
      const leadPosition = currentPosition
        .clone()
        .addScaledVector(estimatedVelocityAuPerSec, naiveEtaSeconds)
      predictedPosition = leadPosition
      predictedDate = addSeconds(date, naiveEtaSeconds)
      interceptTimeSeconds = naiveEtaSeconds
      aimPosition = leadPosition
      status = 'lead-chase'
    }
  }
}
```

- [ ] **Step 3: Populate the new `requiredArrivalVelocity` field on the planner result**

In the `return` block of `planTransfer`, replace the `guidance:` literal:

```typescript
    guidance: {
      aimPosition: aimPosition.clone(),
      direction: route.directionToTarget,
      bearingAngleDeg: route.bearingAngleDeg,
    },
```

with:

```typescript
    guidance: {
      aimPosition: aimPosition.clone(),
      direction: route.directionToTarget,
      bearingAngleDeg: route.bearingAngleDeg,
      requiredArrivalVelocity: computeArrivalVelocity(
        destinationId,
        predictedDate ?? date,
        resolveDestinationPosition,
      ),
    },
```

- [ ] **Step 4: Type-check**

Run: `cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim && npx tsc --noEmit 2>&1 | head -40`
Expected: type errors only in `useAutonomousGuidance.ts` (the placeholder still needs `requiredArrivalVelocity`). All other modules type-check.

- [ ] **Step 5: Run the existing transfer-planner unit tests**

Run: `cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim && npx vitest run tests/unit/transfer-planner.test.ts 2>&1 | tail -30`
Expected: PASS. The existing tests use a linear resolver and should still converge.

- [ ] **Step 6: Commit**

```bash
cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim
git add src/simulation/transfer-planner.ts
git commit -m "feat(#52): iterative curve-resolved intercept and five-state status enum"
```

---

## Task 6: Add unit tests for the new statuses and `requiredArrivalVelocity`

**Files:**

- Modify: `tests/unit/transfer-planner.test.ts`

- [ ] **Step 1: Add a test for `requiredArrivalVelocity`**

In `tests/unit/transfer-planner.test.ts`, append the following test after the `exposes the five-state status enum` test:

```typescript
it('reports the target velocity at the predicted intercept time', () => {
  const plan = planTransfer({
    date: BASE_DATE,
    shipPosition: new Vector3(0, 0, 0),
    shipVelocity: new Vector3(2, 0, 0),
    shipForward: new Vector3(1, 0, 0),
    destinationId: 'runner',
    resolveDestinationPosition: createLinearResolver({
      runner: {
        start: new Vector3(10, 0, 0),
        velocity: new Vector3(1, 0, 0),
      },
    }),
    shipCapabilities: {
      targetVelocitySampleSeconds: 1,
      maxInterceptIterations: 4,
      interceptConvergenceSeconds: 1e-6,
    },
  })

  expect(plan.status).toBe('future-intercept')
  expect(plan.guidance.requiredArrivalVelocity.x).toBeCloseTo(1, 6)
  expect(plan.guidance.requiredArrivalVelocity.y).toBeCloseTo(0, 6)
  expect(plan.guidance.requiredArrivalVelocity.z).toBeCloseTo(0, 6)
})
```

- [ ] **Step 2: Add a test for `intercept-overrun`**

Append the following test:

```typescript
it('reports intercept-overrun when the target outruns the ship but the solver still returns a last-usable candidate', () => {
  // The ship is fast enough to reach the target in a straight line,
  // but the target is moving at a speed that, after the first
  // candidate date, requires a re-aim past the maximum lookahead.
  const plan = planTransfer({
    date: BASE_DATE,
    shipPosition: new Vector3(0, 0, 0),
    shipVelocity: new Vector3(0.5, 0, 0),
    shipForward: new Vector3(1, 0, 0),
    destinationId: 'fast-runner',
    resolveDestinationPosition: createLinearResolver({
      'fast-runner': {
        start: new Vector3(10, 0, 0),
        velocity: new Vector3(0.4, 0, 0),
      },
    }),
    shipCapabilities: {
      targetVelocitySampleSeconds: 1,
      maxInterceptLookaheadDays: 0.0001, // ~8.64s; intercept will exceed
      maxInterceptIterations: 4,
      interceptConvergenceSeconds: 1e-6,
    },
  })

  expect(plan.status).toBe('intercept-overrun')
  expect(plan.guidance.aimPosition.x).toBeGreaterThan(0)
  expect(plan.destination.predictedDate).not.toBeNull()
})
```

- [ ] **Step 3: Add a test for `lead-chase`**

Append the following test:

```typescript
it('reports lead-chase when the solver does not converge and no last-usable candidate is available', () => {
  // An "oscillating" target causes the iteration to never converge:
  // the resolver returns different positions at each candidate date
  // because the linear resolver uses a high velocity that pushes
  // the next candidate further away than the previous one. We
  // construct this by using a zero-velocity ship and a non-monotonic
  // resolver... but the simpler path is a deliberately huge
  // convergence tolerance and a non-monotonic resolver, so use a
  // different shape: provide a resolver that returns a wildly
  // different position at every iteration by making the velocity
  // very large relative to the planning speed.
  const plan = planTransfer({
    date: BASE_DATE,
    shipPosition: new Vector3(0, 0, 0),
    shipVelocity: new Vector3(0.1, 0, 0),
    shipForward: new Vector3(1, 0, 0),
    destinationId: 'jumper',
    resolveDestinationPosition: createLinearResolver({
      jumper: {
        start: new Vector3(0.05, 0, 0),
        velocity: new Vector3(1e6, 0, 0), // astronomical
      },
    }),
    shipCapabilities: {
      targetVelocitySampleSeconds: 1,
      maxInterceptIterations: 1, // never get a chance to converge
      interceptConvergenceSeconds: 1e-6,
    },
  })

  expect(plan.status).toBe('lead-chase')
  expect(plan.guidance.aimPosition.x).toBeGreaterThan(0.05)
})
```

- [ ] **Step 4: Run the tests**

Run: `cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim && npx vitest run tests/unit/transfer-planner.test.ts 2>&1 | tail -40`
Expected: PASS. If `intercept-overrun` test fails because the iteration does not exceed the lookahead within 4 iterations, increase `maxInterceptIterations: 8` in the test inputs.

- [ ] **Step 5: Commit**

```bash
cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim
git add tests/unit/transfer-planner.test.ts
git commit -m "test(#52): cover requiredArrivalVelocity, intercept-overrun, and lead-chase"
```

---

## Task 7: Add a curve-resolver unit test (Keplerian input)

**Files:**

- Modify: `tests/unit/transfer-planner.test.ts`

- [ ] **Step 1: Add a Keplerian-shaped resolver and a test**

In `tests/unit/transfer-planner.test.ts`, append a new helper and test:

```typescript
function createCircularOrbitResolver(
  destinationId: string,
  radiusAu: number,
  periodDays: number,
  phaseRad: number,
): (id: string, date: Date) => Vector3 {
  const angularSpeed = (2 * Math.PI) / (periodDays * 86_400)
  return (id, date) => {
    if (id !== destinationId) return new Vector3(0, 0, 0)
    const elapsedSeconds = (date.getTime() - BASE_DATE.getTime()) / 1000
    const angle = phaseRad + angularSpeed * elapsedSeconds
    return new Vector3(
      Math.cos(angle) * radiusAu,
      0,
      Math.sin(angle) * radiusAu,
    )
  }
}

it('converges on a circular-orbit target using the curve-resolver directly', () => {
  // Mars-like orbit: ~1.52 AU radius, ~687 day period, phase at 0.
  const resolver = createCircularOrbitResolver('mars', 1.52, 687, 0)
  const plan = planTransfer({
    date: BASE_DATE,
    shipPosition: new Vector3(1.04, 0, 0), // Earth-ish
    shipVelocity: new Vector3(0, 0, 0),
    shipForward: new Vector3(1, 0, 0),
    destinationId: 'mars',
    resolveDestinationPosition: resolver,
    shipCapabilities: {
      assumedCruiseSpeedAuPerSec: 0.001, // 1 mAU/s, ~86 AU/day
      targetVelocitySampleSeconds: 1,
      maxInterceptIterations: 8,
      interceptConvergenceSeconds: 0.5,
    },
  })

  expect(plan.status).toBe('future-intercept')
  expect(plan.destination.predictedDate).not.toBeNull()
  if (plan.destination.predictedDate) {
    // The predicted position must be on the curve at the predicted
    // date, not the constant-velocity extrapolation.
    const curvePositionAtPredicted = resolver(
      'mars',
      plan.destination.predictedDate,
    )
    expect(
      plan.destination.predictedPosition.distanceTo(curvePositionAtPredicted),
    ).toBeLessThan(1e-6)
  }
})
```

- [ ] **Step 2: Run the test**

Run: `cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim && npx vitest run tests/unit/transfer-planner.test.ts 2>&1 | tail -30`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim
git add tests/unit/transfer-planner.test.ts
git commit -m "test(#52): cover curve-resolved intercept against a circular orbit"
```

---

## Task 8: Add the lead-pursuit blend in `computeAutonomousGuidance`

**Files:**

- Modify: `src/simulation/autonomous-guidance.ts:0-100` (top of the function)

- [ ] **Step 1: Update the import to bring in the new type**

In `src/simulation/autonomous-guidance.ts`, replace the existing type import:

```typescript
import type { TransferPlannerResult } from './transfer-planner'
```

with:

```typescript
import type {
  ShipCapabilities,
  TransferPlannerResult,
} from './transfer-planner'
```

- [ ] **Step 2: Add a `leadPursuitFullScaleAu` constant exported for tests**

In `src/simulation/autonomous-guidance.ts`, after the existing `STEERING_DAMPING_SECONDS` constant, add:

```typescript
const LEAD_PURSUIT_FALLBACK_AU = 0.05
```

- [ ] **Step 3: Add the lead-pursuit blend before the `desiredDirection` derivation**

In `src/simulation/autonomous-guidance.ts`, replace the top of `computeAutonomousGuidance` (lines 41–47):

```typescript
const desiredDirection =
  plannerResult.guidance.direction.lengthSq() > 0
    ? plannerResult.guidance.direction.clone().normalize()
    : new Vector3(1, 0, 0)
```

with:

```typescript
const leadWeight = computeLeadWeight(
  plannerResult,
  plannerCapabilities(plannerResult),
)
const liveLead = computeLiveLeadPosition(plannerResult, leadWeight)
const blendedAim = plannerResult.guidance.aimPosition
  .clone()
  .lerp(liveLead, leadWeight)
const effectiveAimOffset = blendedAim.sub(shipState.position)
const desiredDirection =
  effectiveAimOffset.lengthSq() > 0
    ? effectiveAimOffset.normalize()
    : new Vector3(1, 0, 0)
```

- [ ] **Step 4: Add the helper functions at the end of the file**

At the end of `src/simulation/autonomous-guidance.ts` (after the `normalizeAngle` helper), add:

```typescript
function plannerCapabilities(
  plannerResult: TransferPlannerResult,
): ShipCapabilities | null {
  // The planner capability is not currently threaded through the
  // planner result. We use the default lead-pursuit full-scale for
  // guidance consumers that have not opted in via a capability. This
  // helper exists so a future change can thread capabilities through
  // the orchestrator without touching the call sites.
  return {
    leadPursuitFullScaleAu: LEAD_PURSUIT_FALLBACK_AU,
  } as ShipCapabilities
}

function computeLeadWeight(
  plannerResult: TransferPlannerResult,
  capabilities: ShipCapabilities | null,
): number {
  if (
    plannerResult.status === 'intercept-overrun' ||
    plannerResult.status === 'lead-chase'
  ) {
    return 1
  }

  const fullScale =
    capabilities?.leadPursuitFullScaleAu ?? LEAD_PURSUIT_FALLBACK_AU
  if (fullScale <= 0) {
    return 0
  }

  const motion = plannerResult.travel.targetMotionDuringInterceptAu
  const weight = motion / fullScale

  return weight < 0 ? 0 : weight > 1 ? 1 : weight
}

function computeLiveLeadPosition(
  plannerResult: TransferPlannerResult,
  leadWeight: number,
): Vector3 {
  if (leadWeight <= 0) {
    return plannerResult.guidance.aimPosition.clone()
  }

  const remainingSeconds =
    plannerResult.travel.interceptTimeSeconds ??
    (plannerResult.travel.etaDays ? plannerResult.travel.etaDays * 86_400 : 0)
  return plannerResult.destination.currentPosition
    .clone()
    .addScaledVector(
      plannerResult.guidance.requiredArrivalVelocity,
      remainingSeconds,
    )
}
```

- [ ] **Step 5: Type-check and test**

Run: `cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim && npx tsc --noEmit 2>&1 | head -40`
Expected: only the `useAutonomousGuidance.ts` placeholder error remains.

Then run: `cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim && npx vitest run tests/unit/autonomous-guidance.test.ts 2>&1 | tail -20`
Expected: PASS — the existing tests should still pass because the blend collapses to the static aim when `targetMotionDuringInterceptAu` is small and the test inputs use small motions.

- [ ] **Step 6: Commit**

```bash
cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim
git add src/simulation/autonomous-guidance.ts
git commit -m "feat(#52): add distance-based lead-pursuit blend to autonomous guidance"
```

---

## Task 9: Add unit tests for the lead-pursuit blend

**Files:**

- Modify: `tests/unit/autonomous-guidance.test.ts`

- [ ] **Step 1: Add a test for the low-motion (static aim dominates) case**

Append to `tests/unit/autonomous-guidance.test.ts`:

```typescript
import {
  computeAutonomousGuidance,
  type AutonomousGuidanceResult,
} from '../../src/simulation/autonomous-guidance'
import type { TransferPlannerResult } from '../../src/simulation/transfer-planner'

function makePlannerResult(
  overrides: Partial<TransferPlannerResult> = {},
): TransferPlannerResult {
  return {
    destinationId: 'target',
    status: 'future-intercept',
    destination: {
      currentPosition: new Vector3(10, 0, 0),
      predictedPosition: new Vector3(10.5, 0, 0),
      predictedDate: new Date(Date.now() + 60_000),
      estimatedVelocityAuPerSec: new Vector3(0, 0, 0),
    },
    guidance: {
      aimPosition: new Vector3(10.5, 0, 0),
      direction: new Vector3(1, 0, 0),
      bearingAngleDeg: 0,
      requiredArrivalVelocity: new Vector3(0, 0, 0),
    },
    travel: {
      currentDistanceAu: 10,
      plannedDistanceAu: 10.5,
      etaDays: 0.01,
      interceptTimeSeconds: 60,
      targetMotionDuringInterceptAu: 0.5,
      planningSpeedAuPerSec: 1,
    },
    solver: {
      iterations: 3,
      solutionErrorSeconds: 0.1,
    },
    ...overrides,
  }
}

describe('lead-pursuit blend', () => {
  it('uses the planner aim when target motion is below the lead-pursuit full-scale', () => {
    const result: AutonomousGuidanceResult = computeAutonomousGuidance(
      createInitialShipState(),
      makePlannerResult({
        travel: {
          currentDistanceAu: 10,
          plannedDistanceAu: 10.001,
          etaDays: 0.01,
          interceptTimeSeconds: 60,
          targetMotionDuringInterceptAu: 0.001, // 0.05 AU threshold; below
          planningSpeedAuPerSec: 1,
        },
      }),
    )

    // desiredDirection should match the planner's static aim (+X)
    expect(result.desiredDirection.x).toBeGreaterThan(0.99)
    expect(result.desiredDirection.y).toBeCloseTo(0)
  })

  it('blends toward the live lead when target motion exceeds the threshold', () => {
    const planner = makePlannerResult({
      destination: {
        currentPosition: new Vector3(0, 0, 0),
        predictedPosition: new Vector3(1, 0, 0),
        predictedDate: new Date(Date.now() + 60_000),
        estimatedVelocityAuPerSec: new Vector3(0, 0, 0),
      },
      guidance: {
        aimPosition: new Vector3(1, 0, 0), // static aim at +X
        direction: new Vector3(1, 0, 0),
        bearingAngleDeg: 0,
        // Target moving rapidly in +Y. With remainingTime = 60s, the
        // live lead is at (0, 60, 0), well away from the static aim.
        requiredArrivalVelocity: new Vector3(0, 1, 0),
      },
      travel: {
        currentDistanceAu: 1,
        plannedDistanceAu: 1.5,
        etaDays: 0.01,
        interceptTimeSeconds: 60,
        targetMotionDuringInterceptAu: 1, // >> 0.05 threshold
        planningSpeedAuPerSec: 1,
      },
    })
    const ship = createInitialShipState()
    ship.position.set(0, 0, 0)

    const result = computeAutonomousGuidance(ship, planner)

    // Blend weight is 1, so desiredDirection should point at +Y (live
    // lead) rather than +X (static aim).
    expect(result.desiredDirection.y).toBeGreaterThan(0.5)
    expect(result.desiredDirection.x).toBeLessThan(0.5)
  })

  it('forces leadWeight=1 for intercept-overrun status', () => {
    const planner = makePlannerResult({
      status: 'intercept-overrun',
      travel: {
        currentDistanceAu: 1,
        plannedDistanceAu: 1.001,
        etaDays: 0.01,
        interceptTimeSeconds: 60,
        targetMotionDuringInterceptAu: 0.0001, // below threshold
        planningSpeedAuPerSec: 1,
      },
    })
    const ship = createInitialShipState()
    ship.position.set(0, 0, 0)

    const result = computeAutonomousGuidance(ship, planner)

    // Even though target motion is below threshold, status forces the
    // live lead to dominate. Static aim is at +X, required velocity is
    // (0, 0, 0) in the makePlannerResult default, so live lead is at
    // origin and the direction collapses. We assert the desired
    // direction is NOT the static aim (+X).
    expect(Math.abs(result.desiredDirection.x)).toBeLessThan(0.5)
  })

  it('forces leadWeight=1 for lead-chase status', () => {
    const planner = makePlannerResult({
      status: 'lead-chase',
      travel: {
        currentDistanceAu: 1,
        plannedDistanceAu: 1.001,
        etaDays: 0.01,
        interceptTimeSeconds: 60,
        targetMotionDuringInterceptAu: 0.0001,
        planningSpeedAuPerSec: 1,
      },
    })
    const ship = createInitialShipState()
    ship.position.set(0, 0, 0)

    const result = computeAutonomousGuidance(ship, planner)

    expect(Math.abs(result.desiredDirection.x)).toBeLessThan(0.5)
  })
})
```

- [ ] **Step 2: Update the imports at the top of the file**

At the top of `tests/unit/autonomous-guidance.test.ts`, the file already imports from `../../src/simulation/autonomous-guidance`. Make sure the new test file's imports include `createInitialShipState` from physics; if not, add it. The exact import line should be:

```typescript
import {
  createInitialShipState,
  getShipOrientationFromAngles,
  type ShipState,
} from '../../src/simulation/physics'
```

(Adjust if the file already imports these.)

- [ ] **Step 3: Run the test suite**

Run: `cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim && npx vitest run tests/unit/autonomous-guidance.test.ts 2>&1 | tail -30`
Expected: PASS. If the `forces leadWeight=1 for lead-chase status` test produces `desiredDirection.x > 0.5` because the live lead with zero requiredArrivalVelocity collapses to the current position (which is at `(0, 0, 0)` and the ship is also at `(0, 0, 0)`), the helper should be tweaked — change the assertion to check the live lead actually points away from the static aim, e.g. by giving the planner a non-zero `requiredArrivalVelocity` in the chase case.

- [ ] **Step 4: Commit**

```bash
cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim
git add tests/unit/autonomous-guidance.test.ts
git commit -m "test(#52): cover lead-pursuit blend, intercept-overrun, and lead-chase"
```

---

## Task 10: Update the formatter to cover the new statuses

**Files:**

- Modify: `src/simulation/formatters.ts:96-105`

- [ ] **Step 1: Add the new cases**

In `src/simulation/formatters.ts`, replace the `formatTransferPlannerStatus` function:

```typescript
export function formatTransferPlannerStatus(
  status: TransferPlannerStatus,
): string {
  switch (status) {
    case 'current-position':
      return 'Current fix'
    case 'future-intercept':
      return 'Future intercept'
    case 'no-solution':
      return 'Fallback'
  }
}
```

with:

```typescript
export function formatTransferPlannerStatus(
  status: TransferPlannerStatus,
): string {
  switch (status) {
    case 'current-position':
      return 'Current fix'
    case 'future-intercept':
      return 'Future intercept'
    case 'intercept-overrun':
      return 'Intercept overrun'
    case 'lead-chase':
      return 'Lead chase'
    case 'no-solution':
      return 'Fallback'
  }
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim && npx tsc --noEmit 2>&1 | head -20`
Expected: clean. The formatter is exhaustive over the new enum.

- [ ] **Step 3: Commit**

```bash
cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim
git add src/simulation/formatters.ts
git commit -m "feat(#52): surface intercept-overrun and lead-chase in the HUD formatter"
```

---

## Task 11: Update `describePlannerState` in the ControlPanel narrative

**Files:**

- Modify: `src/components/ControlPanel.tsx:153-165`

- [ ] **Step 1: Add the new cases**

In `src/components/ControlPanel.tsx`, replace the `describePlannerState` function:

```typescript
function describePlannerState(
  plannerStatus: SimulationMetrics['plannerStatus'],
): string {
  switch (plannerStatus) {
    case 'current-position':
      return "Route overlay is steering toward the destination's current resolved position."
    case 'future-intercept':
      return 'The cyan ring marks the destination now, and the amber marker shows the predicted intercept fix the ship is leading toward.'
    case 'no-solution':
      return 'The planner has fallen back to the current destination fix until it can recover a better intercept solution.'
  }
}
```

with:

```typescript
function describePlannerState(
  plannerStatus: SimulationMetrics['plannerStatus'],
): string {
  switch (plannerStatus) {
    case 'current-position':
      return "Route overlay is steering toward the destination's current resolved position."
    case 'future-intercept':
      return 'The cyan ring marks the destination now, and the amber marker shows the predicted intercept fix the ship is leading toward.'
    case 'intercept-overrun':
      return 'The target outruns the ship; the planner is leading the live target instead of a static fix.'
    case 'lead-chase':
      return 'The planner could not converge; the ship is leading the target using its current velocity.'
    case 'no-solution':
      return 'The planner has fallen back to the current destination fix until it can recover a better intercept solution.'
  }
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim && npx tsc --noEmit 2>&1 | head -20`
Expected: clean.

- [ ] **Step 3: Run the component test**

Run: `cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim && npx vitest run tests/component/ControlPanel.test.tsx 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim
git add src/components/ControlPanel.tsx
git commit -m "feat(#52): surface intercept-overrun and lead-chase in the control panel narrative"
```

---

## Task 12: Extract `shouldShowInterceptMarker` in `navigation-visuals`

**Files:**

- Modify: `src/scene/navigation-visuals.ts:0-50`

- [ ] **Step 1: Replace the inline predicate with a named helper**

In `src/scene/navigation-visuals.ts`, replace the entire file contents with:

```typescript
import type { TransferPlannerResult } from '../simulation/transfer-planner'

const INTERCEPT_VISUAL_EPSILON_AU = 1e-6

export type NavigationVisualState = {
  destinationPosition: TransferPlannerResult['destination']['currentPosition']
  aimPosition: TransferPlannerResult['guidance']['aimPosition']
  interceptPosition:
    TransferPlannerResult['destination']['predictedPosition'] | null
  showInterceptMarker: boolean
}

/**
 * The cyan intercept ring and the drift tether should only render when
 * the planner has produced a real future-intercept solution. Chase
 * states (intercept-overrun, lead-chase) hide the marker so the
 * player can see the planner has fallen back to live lead-pursuit.
 */
export function shouldShowInterceptMarker(
  plannerResult: TransferPlannerResult,
): boolean {
  return plannerResult.status === 'future-intercept'
}

export function buildNavigationVisualState(
  plannerResult: TransferPlannerResult,
): NavigationVisualState {
  const destinationPosition = plannerResult.destination.currentPosition.clone()
  const aimPosition = plannerResult.guidance.aimPosition.clone()
  const predictedPosition = plannerResult.destination.predictedPosition.clone()
  const showInterceptMarker =
    shouldShowInterceptMarker(plannerResult) &&
    destinationPosition.distanceTo(predictedPosition) >
      INTERCEPT_VISUAL_EPSILON_AU

  return {
    destinationPosition,
    aimPosition,
    interceptPosition: showInterceptMarker ? predictedPosition : null,
    showInterceptMarker,
  }
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim && npx tsc --noEmit 2>&1 | head -20`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim
git add src/scene/navigation-visuals.ts
git commit -m "refactor(#52): extract shouldShowInterceptMarker helper and gate on future-intercept"
```

---

## Task 13: Add tests for the new marker gating

**Files:**

- Modify: `tests/unit/navigation-visuals.test.ts`

- [ ] **Step 1: Add a new test for the helper**

In `tests/unit/navigation-visuals.test.ts`, append:

```typescript
import {
  buildNavigationVisualState,
  shouldShowInterceptMarker,
} from '../../src/scene/navigation-visuals'

describe('shouldShowInterceptMarker', () => {
  it('returns true only for future-intercept', () => {
    const base = {
      destinationId: 'target',
      destination: {
        currentPosition: new Vector3(0, 0, 0),
        predictedPosition: new Vector3(1, 0, 0),
        predictedDate: new Date(),
        estimatedVelocityAuPerSec: new Vector3(0, 0, 0),
      },
      guidance: {
        aimPosition: new Vector3(1, 0, 0),
        direction: new Vector3(1, 0, 0),
        bearingAngleDeg: 0,
        requiredArrivalVelocity: new Vector3(0, 0, 0),
      },
      travel: {
        currentDistanceAu: 1,
        plannedDistanceAu: 1,
        etaDays: 0,
        interceptTimeSeconds: 0,
        targetMotionDuringInterceptAu: 0,
        planningSpeedAuPerSec: 0,
      },
      solver: { iterations: 0, solutionErrorSeconds: null },
    }

    expect(
      shouldShowInterceptMarker({
        ...base,
        status: 'future-intercept',
      } as never),
    ).toBe(true)
    expect(
      shouldShowInterceptMarker({
        ...base,
        status: 'current-position',
      } as never),
    ).toBe(false)
    expect(
      shouldShowInterceptMarker({
        ...base,
        status: 'intercept-overrun',
      } as never),
    ).toBe(false)
    expect(
      shouldShowInterceptMarker({ ...base, status: 'lead-chase' } as never),
    ).toBe(false)
    expect(
      shouldShowInterceptMarker({ ...base, status: 'no-solution' } as never),
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test**

Run: `cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim && npx vitest run tests/unit/navigation-visuals.test.ts 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim
git add tests/unit/navigation-visuals.test.ts
git commit -m "test(#52): assert shouldShowInterceptMarker gates on future-intercept only"
```

---

## Task 14: Update the orchestrator's placeholder planner result

**Files:**

- Modify: `src/hooks/useAutonomousGuidance.ts:80-115`

- [ ] **Step 1: Add the new field to the placeholder**

In `src/hooks/useAutonomousGuidance.ts`, replace the `createPlaceholderPlannerResult` function body (the literal return object) with:

```typescript
function createPlaceholderPlannerResult(): TransferPlannerResult {
  const aim = new Vector3(0, 0, 0)
  return {
    destinationId: '',
    status: 'current-position',
    destination: {
      currentPosition: new Vector3(0, 0, 0),
      predictedPosition: new Vector3(0, 0, 0),
      predictedDate: null,
      estimatedVelocityAuPerSec: new Vector3(0, 0, 0),
    },
    guidance: {
      aimPosition: aim,
      direction: new Vector3(1, 0, 0),
      bearingAngleDeg: 0,
      requiredArrivalVelocity: new Vector3(0, 0, 0),
    },
    travel: {
      currentDistanceAu: 0,
      plannedDistanceAu: 0,
      etaDays: null,
      interceptTimeSeconds: null,
      targetMotionDuringInterceptAu: 0,
      planningSpeedAuPerSec: 0,
    },
    solver: {
      iterations: 0,
      solutionErrorSeconds: null,
    },
  }
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim && npx tsc --noEmit 2>&1 | head -20`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim
git add src/hooks/useAutonomousGuidance.ts
git commit -m "fix(#52): add requiredArrivalVelocity to the orchestrator placeholder"
```

---

## Task 15: Add the Keplerian end-to-end integration test

**Files:**

- Modify: `tests/integration/autonomous-travel-pipeline.test.ts`

- [ ] **Step 1: Add a circular-orbit resolver and a new test**

In `tests/integration/autonomous-travel-pipeline.test.ts`, append a new helper at the bottom of the file (above or below the existing helpers — match the file's style):

```typescript
function makeCircularOrbitResolver(
  destinationId: string,
  radiusAu: number,
  periodDays: number,
  phaseRad: number,
) {
  const angularSpeed = (2 * Math.PI) / (periodDays * 86_400)
  return (id: string, date: Date) => {
    if (id !== destinationId) return new Vector3(0, 0, 0)
    const elapsedSeconds = (date.getTime() - 0) / 1000
    const angle = phaseRad + angularSpeed * elapsedSeconds
    return new Vector3(
      Math.cos(angle) * radiusAu,
      0,
      Math.sin(angle) * radiusAu,
    )
  }
}
```

Note: the resolver above is anchored to the epoch `0` (Unix epoch). If the integration test's `Date.now()` is well past 1970 the angular displacement will be very large, so adjust `phaseRad` accordingly. A simpler approach: use a 365-day period and a phase of `0` so the test is anchored to the calendar year.

Now add a new `describe` block at the bottom of the file:

```typescript
describe('autonomous travel against a Keplerian (curve-resolved) target', () => {
  it('converges on a moving circular-orbit target (Mars-like)', () => {
    const state = createInitialShipState()
    state.position.set(1.04, 0, 0) // Earth-like
    state.velocity.set(0, 0, 0)
    state.yaw = 0
    state.pitch = 0

    // Use a relative resolver so we can advance simulated time
    // without rebasing the resolver epoch.
    const startDate = new Date('2026-01-01T00:00:00.000Z')
    const periodDays = 687
    const radiusAu = 1.52
    const angularSpeed = (2 * Math.PI) / (periodDays * 86_400)
    const resolver = (id: string, date: Date) => {
      if (id !== 'mars') return new Vector3(0, 0, 0)
      const elapsed = (date.getTime() - startDate.getTime()) / 1000
      const angle = angularSpeed * elapsed
      return new Vector3(
        Math.cos(angle) * radiusAu,
        0,
        Math.sin(angle) * radiusAu,
      )
    }

    const initialDistance = state.position.distanceTo(
      resolver('mars', startDate),
    )
    let phase: ReturnType<typeof computeAutonomousGuidance>['phase'] | undefined
    let currentSimDate = startDate

    for (let frame = 0; frame < 200_000; frame += 1) {
      const { forward } = getShipOrientationFromAngles(state.yaw, state.pitch)
      const plan = planTransfer({
        date: currentSimDate,
        shipPosition: state.position,
        shipVelocity: state.velocity,
        shipForward: forward,
        destinationId: 'mars',
        resolveDestinationPosition: resolver,
        shipCapabilities: {
          assumedCruiseSpeedAuPerSec: 0.0005, // 0.5 mAU/s
        },
      })
      const guidance = computeAutonomousGuidance(state, plan, phase)
      stepShipPhysics(state, guidance.controls, 0.016)
      currentSimDate = new Date(currentSimDate.getTime() + 0.016 * 1000)
      phase = guidance.phase
      if (phase === 'arrived') break
    }

    const liveTarget = resolver('mars', currentSimDate)
    expect(state.position.distanceTo(liveTarget)).toBeLessThan(
      initialDistance * 0.05,
    )
    expect(phase).toBe('arrived')
  })
})
```

- [ ] **Step 2: Run the integration test**

Run: `cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim && npx vitest run tests/integration/autonomous-travel-pipeline.test.ts 2>&1 | tail -40`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim
git add tests/integration/autonomous-travel-pipeline.test.ts
git commit -m "test(#52): add Keplerian end-to-end integration test"
```

---

## Task 16: Update ADR 012 to reference ADR 017

**Files:**

- Modify: `docs/ARCHITECTURE/technicaldecisions/012-transfer-planner-intercept-prediction-and-capability-inputs.md`

- [ ] **Step 1: Add a "Status note" section at the end**

At the end of `docs/ARCHITECTURE/technicaldecisions/012-transfer-planner-intercept-prediction-and-capability-inputs.md`, append a section:

```markdown
## Status note (2026-06-14)

The iterative re-solve in §2 and the three-state status in §3 have
been refined in ADR 017, which addresses issue #52. ADR 017
introduces:

- a curve-resolved iteration that no longer depends on the 21 600 s
  velocity sample
- a `guidance.requiredArrivalVelocity` field
- a five-state status enum (`current-position`, `future-intercept`,
  `intercept-overrun`, `lead-chase`, `no-solution`)
- a distance-based lead-pursuit blend in the guidance layer

This ADR remains the architectural source of truth for _why_ the
planner is a separate module and _what_ shape its result takes;
ADR 017 is the source of truth for the curve-resolved iteration and
the five-state status.
```

- [ ] **Step 2: Commit**

```bash
cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim
git add docs/ARCHITECTURE/technicaldecisions/012-transfer-planner-intercept-prediction-and-capability-inputs.md
git commit -m "docs(#52): add status note to ADR 012 referencing ADR 017"
```

---

## Task 17: Run the full test suite and confirm green

**Files:**

- (no file changes)

- [ ] **Step 1: Run all tests**

Run: `cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim && npm test -- --run 2>&1 | tail -60`
Expected: all tests pass, including the new unit tests, the new component test, and the new integration test. If anything fails, fix it before continuing.

- [ ] **Step 2: Run typecheck**

Run: `cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim && npx tsc --noEmit 2>&1 | head -40`
Expected: clean.

- [ ] **Step 3: Run linter**

Run: `cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim && npm run lint 2>&1 | tail -30`
Expected: clean (no new errors; pre-existing warnings are out of scope).

---

## Task 18: Push the branch and open a draft PR

**Files:**

- (no file changes)

- [ ] **Step 1: Push the branch**

Run: `cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim && git push -u origin fix/52-intercept-aim-real-orbital-mechanics 2>&1 | tail -10`
Expected: branch created on `origin` and tracking set up.

- [ ] **Step 2: Open a draft PR referencing #52**

Run:

```bash
cd /Users/openclaw/Github/OrbitalTrucker/.worktrees/fix-52-intercept-aim && \
gh pr create --draft \
  --base main \
  --head fix/52-intercept-aim-real-orbital-mechanics \
  --title "fix(#52): curve-resolved intercept aim and lead-pursuit guidance" \
  --body "Closes #52. See docs/superpowers/specs/2026-06-14-fix-52-intercept-aim-real-orbital-mechanics-design.md for the design and docs/superpowers/plans/2026-06-14-fix-52-intercept-aim-real-orbital-mechanics.md for the task-by-task plan." \
  2>&1 | tail -10
```

Expected: PR URL printed.

---

## Self-Review

1. **Spec coverage:** Each of the 5 design decisions is implemented:
   - (1) iterative curve-resolved intercept → Tasks 5, 7
   - (2) `requiredArrivalVelocity` field → Tasks 3, 5, 14
   - (3) five-state status enum → Tasks 3, 4, 5, 6, 10, 11
   - (4) distance-based lead-pursuit blend → Tasks 8, 9
   - (5) intercept marker is chase-aware → Tasks 12, 13

2. **Placeholder scan:** No "TBD", "TODO", "implement later", "similar to Task N". All code blocks are complete.

3. **Type consistency:**
   - `TransferPlannerStatus` is the same enum used in planner, formatter, control panel, and tests
   - `requiredArrivalVelocity` is the same field name in `TransferPlannerResult.guidance`, the placeholder, and the guidance helper
   - `leadPursuitFullScaleAu` is the same capability name in `ShipCapabilities`, `DEFAULT_SHIP_CAPABILITIES`, and the guidance helper signature
   - The 5 status strings are spelled identically: `'current-position'`, `'future-intercept'`, `'intercept-overrun'`, `'lead-chase'`, `'no-solution'`

4. **Acceptance criteria from #52:**
   - (1) ship converges on a Keplerian target → Task 15
   - (2) planner status visible in HUD → Tasks 10, 11 (formatter + narrative; existing fields are unchanged)
   - (3) integration test → Task 15
   - (4) ADR 012 updated → Task 16
