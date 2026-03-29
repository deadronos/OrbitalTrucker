# Autonomous travel rewrite plan

## Overview

`OrbitalTrucker` should pivot from a manual-flight prototype into an autonomous space-cargo experience while preserving the heliocentric solar-system simulation, time warp, visible ship, and long-haul travel fantasy.

The intended player fantasy is not "dogfight the ship by hand" but "operate a near/medium-future freight vessel that travels between planets, moons, and colonies while the simulation keeps the solar system alive underneath it."

This rewrite is intentionally ambitious:

- remove manual flying from normal play
- keep the ship physically present in the world
- allow destination changes at any time
- add a richer destination model that supports planets, moons, colonies, and stations
- back Jovian colony destinations with real moon ephemerides
- move beyond the current straight-line target helper toward a transfer-planner-heavy navigation stack
- keep future equipment-slot systems in mind without implementing progression UI yet

Per `AGENTS.md`, implementation work should begin by aligning or creating the relevant ADRs before larger code changes land.

## Goals

- Replace direct player piloting in normal play with autonomous route-following travel.
- Preserve the existing solar-system simulation, orbital motion, time controls, ship visualization, and camera continuity where practical.
- Introduce a destination dropdown that can be changed at any time.
- Make heading and intercept updates autonomous after destination changes.
- Support a near/medium-future setting with colonies on Mars, Earth-adjacent destinations, and selected Jovian-moon destinations.
- Create a structure that can later support ship upgrades such as engines, ship computer, shields, mining gear, and cargo-related modules.

## Non-goals for this rewrite

- Full cargo contracts, economy balancing, or mission chains.
- Full equipment or progression UI.
- Final art/content pass for settlements.
- Perfectly realistic orbital-transfer simulation from day one.

## Product decisions already agreed

- Stay on the `main` branch for planning/docs work.
- Remove manual flying from normal play entirely.
- Reuse the current ship-motion backend where feasible rather than replacing all movement logic immediately.
- Treat this as one coordinated rewrite tracked by one umbrella issue plus phase issues.
- Include real moon ephemerides now so Jovian colony destinations are physically meaningful.
- Use a transfer-planner-heavy approach rather than stopping at the current straight-line route helper.

## Architecture implications

The current prototype already contains several reusable layers:

- simulated time stepping
- heliocentric body motion
- ship presence and camera follow
- route/ETA UI concepts
- target markers and route-line rendering

The most disposable/manual-flight-specific pieces are concentrated in the keyboard, pointer, and piloting HUD layers. That means the rewrite can preserve the orbital world while swapping out the interaction model.

The implementation should start by adding ADRs that document:

1. the gameplay pivot from manual sandbox to autonomous freight travel
2. the technical model for destinations, moon support, transfer planning, and guidance

## Proposed delivery phases

### Phase 0 — ADRs and project framing

Create the documentation foundation before major implementation work:

- gameplay ADR for the autonomous freight loop
- technical ADR for location catalog, moon ephemerides, transfer planning, and autonomous guidance
- clarified v1 colony/moon scope
- explicit acceptance criteria for removing manual flight from normal play

This phase blocks the rest.

### Phase 1 — Destination model expansion

Replace body-name-only targeting with a location catalog that can represent:

- star
- planet
- moon
- colony
- station

The catalog should provide stable IDs, display names, parent relationships, and position resolvers so destinations can be selected uniformly by the UI.

Likely files touched:

- `src/App.tsx`
- `src/world/locations.ts`
- `src/simulation/types.ts`
- `src/components/NavigationPanel.tsx`

### Phase 2 — Moon ephemerides and colony backing data

Add real orbital support for the moons needed by the chosen Jovian colony set so those colonies can be tied to real moving destinations.

This phase should define exactly which moons and colonies are in the first pass to avoid unbounded scope.

Likely files touched:

- `src/world/moons.ts`
- `src/solar-data.ts`
- orbital mechanics helpers
- scene target-resolution code
- unit tests for moon positions

### Phase 3 — Transfer planning engine

Build a pure planning layer richer than the current straight-line helper.

Planner responsibilities should include:

- predicting future target positions
- estimating intercept or transfer candidates
- exposing route metrics for UI
- accepting ship capability inputs so future equipment can affect planning quality/performance

This phase should stay as pure/testable as possible.

Likely files touched:

- `src/simulation/trajectory.ts`
- `src/simulation/transfer-planner.ts`
- `src/simulation/types.ts`
- new unit tests for planner behavior

### Phase 4 — Autonomous ship guidance

Replace normal-play manual piloting with guidance that consumes planner output.

Recommended migration strategy:

- preserve the current ship-motion backend where it still makes sense
- replace player input as the primary control source
- continuously retarget and update heading when the destination changes
- keep camera follow and visible ship motion coherent

Likely files touched:

- `src/components/SimulatorCanvas.tsx`
- `src/hooks/useShipPhysics.ts`
- `src/hooks/useAutoOrient.ts`
- `src/hooks/useAutonomousGuidance.ts`

### Phase 5 — Navigation UI rewrite

Replace the current control-focused HUD with destination-driven navigation UI.

Required capabilities:

- destination dropdown
- change destination any time
- display current destination
- display planner/intercept/travel status
- remove manual control hints from the main HUD

Likely files touched:

- `src/components/ControlPanel.tsx` or replacement
- `src/components/NavigationPanel.tsx`
- `src/components/MetricsPanel.tsx`
- `tests/component/ControlPanel.test.tsx` or replacement tests

### Phase 6 — Visuals, telemetry, and test updates

Align the scene and telemetry with autonomous travel:

- route lines and markers should reflect planner output, not only current target position
- telemetry should describe destination, intercept, travel state, and autonomous navigation status
- update unit/component/integration tests to remove manual-flight assumptions

Likely files touched:

- `src/scene/TargetMarker.tsx`
- `src/scene/TrajectoryLine.tsx`
- `src/scene/InterceptMarker.tsx`
- `src/components/MetricsPanel.tsx`
- `tests/integration/App.test.tsx`
- planner and physics test suites

## Candidate files and modules

- `docs/ARCHITECTURE/gamedecisions/005-shift-to-autonomous-space-trucking.md`
- `docs/ARCHITECTURE/technicaldecisions/011-location-catalog-moons-and-transfer-planning.md`
- `src/App.tsx`
- `src/components/SimulatorCanvas.tsx`
- `src/components/MetricsPanel.tsx`
- `src/components/ControlPanel.tsx`
- `src/components/NavigationPanel.tsx`
- `src/hooks/useShipPhysics.ts`
- `src/hooks/useAutonomousGuidance.ts`
- `src/simulation/trajectory.ts`
- `src/simulation/transfer-planner.ts`
- `src/simulation/types.ts`
- `src/world/locations.ts`
- `src/world/moons.ts`
- `src/scene/TargetMarker.tsx`
- `src/scene/TrajectoryLine.tsx`
- `src/scene/InterceptMarker.tsx`
- `tests/unit/transfer-planner.test.ts`
- `tests/integration/App.test.tsx`

## GitHub tracking structure

This rewrite should be tracked with one umbrella issue and phase issues beneath it.

### Umbrella issue

**Title:** `Rewrite prototype into autonomous freight navigation loop`

Purpose:

- track the full pivot from manual flight to autonomous freight travel
- keep architecture, implementation, and test work connected
- make dependencies explicit

### Child issues

1. `ADR: document autonomous space-trucking pivot and technical architecture`
2. `Add destination catalog for planets, moons, colonies, and stations`
3. `Add moon ephemerides to support Jovian colony destinations`
4. `Build transfer planning engine for future-position intercepts`
5. `Replace manual flight with autonomous ship guidance`
6. `Replace control HUD with destination-driven navigation UI`
7. `Update route visuals, telemetry, and tests for autonomous navigation`

## Dependency order

Recommended dependency flow:

1. ADR issue
2. destination catalog
3. moon ephemerides
4. transfer planner
5. autonomous guidance
6. navigation UI
7. visuals/telemetry/tests

This is still one coordinated rewrite, but the issue breakdown keeps review and progress legible.

## Verification strategy

### Documentation

- ADRs clearly explain the gameplay pivot and technical architecture.
- Moon and colony scope is explicitly defined.

### Unit tests

- location resolution across planets, moons, and colonies
- moon position prediction
- transfer/intercept planning
- retargeting behavior
- ship motion backend behavior under autonomous guidance

### Component/integration tests

- destination dropdown behavior
- planner and HUD state updates
- destination changes during travel
- stable time warp behavior while replanning
- removal of normal-play manual-control assumptions

### Manual verification

- changing destination mid-travel updates heading and intercept
- route markers and lines remain coherent
- colony destinations tied to Jovian moons move correctly over time
- the ship remains visible and understandable as an autonomous freighter rather than a player-flyable avatar

## Risks and open questions

- A single coordinated rewrite is higher risk than a staged feature rollout.
- Jovian moon coverage must stay curated to avoid exploding scope.
- Colony content/naming may need a separate design pass after core mechanics are in place.
- The transfer planner should be ambitious without becoming a forever-project before any playable result lands.

## Future extensibility

The rewrite should leave room for ship systems that modify travel behavior later, such as:

- engines
- ship computer / navigation stack
- shields
- cargo gear
- mining equipment

These do not need a UI now, but planner and guidance code should be structured so ship capabilities can be injected later instead of hardcoded into HUD logic.
