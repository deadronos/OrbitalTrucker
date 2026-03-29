# ADR 015: Planner-aware route visuals and intercept telemetry

- **Status:** Accepted
- **Date:** 2026-03-30
- **Related:** ADR 012 (transfer planner with intercept prediction and capability-aware inputs), ADR 013 (command-driven autonomous guidance for normal-play ship control), ADR 014 (destination-driven navigation HUD for autonomous travel)

## Context

The autonomous-navigation rewrite now computes richer route facts than the
scene and HUD currently communicate:

- the transfer planner resolves both the destination's current position and a
  predicted future intercept position
- the guidance layer steers toward the planner's aim point, not always the
  destination's current marker
- telemetry already reports planner status, ETA, and destination drift

Even with those systems in place, the final player-facing pass was still
missing one important piece of legibility:

- the scene only showed one destination ring and one generic course line
- future-intercept plans were therefore hard to distinguish from current-fix
  plans at a glance
- the HUD did not surface the predicted intercept fix time directly

Issue #28 requires closing that gap so route visuals, telemetry, and tests all
describe the same autonomous-navigation model.

## Decision

### 1. Route visuals must distinguish current destination position from planned intercept aim

When the planner reports `future-intercept`, the scene should show:

- the destination's current resolved position
- the planner's predicted intercept fix
- the ship-to-aim course line used by the guidance layer
- a short tether between current destination position and predicted intercept
  fix so destination drift is visible

When the planner is using `current-position` or `no-solution`, the scene keeps a
single destination marker and the drift tether stays hidden.

This preserves the current lightweight scene style while making the planner's
actual decision legible.

### 2. The HUD should expose the intercept fix timestamp when it exists

Planner telemetry already reports whether the ship is using a future intercept.
The HUD should also surface the predicted intercept fix date when the planner
has one. That gives the player a concrete answer to "when is the ship aiming to
meet the moving destination?" without exposing low-level solver internals.

If the planner does not have a future intercept, that field may remain hidden.

### 3. Planner status copy should explain the overlay model in player language

The destination panel should describe planner state in terms of the running
trip:

- current-fix plans steer toward the destination's live position
- future-intercept plans lead the target and should explain the current-marker
  versus intercept-marker split
- fallback plans steer toward the current fix until a better intercept is
  available

This keeps the destination-first HUD aligned with the scene overlays.

### 4. Add tests around the planner-aware overlay state and telemetry

The final autonomous-navigation pass should add or update tests that verify:

- future-intercept plans produce distinct visual state from current-fix plans
- intercept telemetry is surfaced when present
- component and integration coverage continues to describe autonomous travel
  rather than manual-flight assumptions

## Consequences

### Positive

- Scene overlays finally match the planner model rather than approximating it.
- Players can tell the difference between "where the destination is now" and
  "where the ship is aiming to meet it."
- Telemetry becomes more actionable during long-haul autonomous trips.

### Negative

- The scene orchestration layer now manages a second marker and a second route
  line.
- The metrics contract grows slightly to include the intercept fix timestamp.

## Follow-up

- If the planner later supports higher-fidelity transfer solutions, keep the
  same visual vocabulary of current position, intercept fix, and route state.
- If debug/manual navigation tools return, keep their overlays visually
  separate from the normal autonomous-travel presentation.
