# ADR 011: Destination catalog, moon ephemerides, transfer planning, and autonomous guidance

- **Status:** Accepted
- **Date:** 2026-03-30
- **Supersedes:** ADR 007 (trajectory planning hook and route-line scene component) as the default navigation architecture

## Context

The current prototype navigation stack was designed for body-to-body manual
flight. Its core assumptions are:

- the UI selects a raw body name such as `Earth` or `Mars`
- selectable targets are limited to the existing solar-body list
- route planning is a straight-line helper from the ship's current position to
  the target's current position
- auto-orient is a one-shot command layered on top of manual piloting
- scene telemetry is mostly descriptive of current target geometry, not of a
  higher-level travel plan

Those assumptions are adequate for a manual-flight prototype, but they do not
scale to the new normal-play model from ADR 005. Autonomous space trucking
needs a navigation architecture that can represent destinations beyond planets,
predict moving targets, and drive the ship continuously after retargeting.

## Decision

### 1. Replace body-name targeting with a destination catalog

Normal-play navigation will select a stable destination ID, not a raw solar-body
name.

The catalog should live in a dedicated world/navigation module (for example
`src/world/locations.ts`) and define a uniform record for each selectable
destination:

- stable ID
- display name
- destination kind: star, planet, moon, colony, or station
- parent relationship where applicable
- enough metadata to resolve the destination's position at a given simulation
  time

This lets the UI, planner, and scene all reason about destinations through one
shared abstraction instead of hard-coding separate behavior for "body targets"
versus future colonies/stations.

### 2. Model colonies and stations as anchored destinations

Colonies and stations are not independent celestial mechanics bodies.

Instead, they are destinations anchored to a parent body or moon:

- a colony can be anchored to a planet or moon
- an orbital station can be anchored to a planet, moon, or transfer point
- a transfer hub can be anchored to a major system relationship such as the
  Earth-Moon corridor

Mechanically, this means their positions are derived from the motion of their
anchor body plus a local offset/resolution rule. That preserves a coherent
moving world without requiring every colony/station to own a separate
high-fidelity ephemeris implementation.

### 3. Add moon ephemerides only for the curated first-pass network

Moon support is added where it unlocks real destinations for the first freight
network rather than as an open-ended "all moons" project.

The first-pass moon-backed destination scope is:

- Earth's Moon for the Earth-adjacent destination set
- Callisto
- Ganymede
- Europa

Mars destinations in v1 do **not** require Phobos/Deimos support; they can be
anchored directly to Mars. Io remains out of scope in v1.

This creates a bounded ephemeris target: add the moons needed for the chosen
network, prove the architecture, then expand later only if new destinations
justify it.

### 4. Introduce a pure transfer-planning layer

The current straight-line helper in `src/simulation/trajectory.ts` is no longer
the architectural source of truth for route computation.

Autonomous travel should add a pure planning module (for example
`src/simulation/transfer-planner.ts`) that accepts:

- current simulation date
- ship position/velocity/state
- selected destination
- destination-resolution services
- ship capability inputs that can later vary by equipment/loadout

It should return a planner result rich enough to drive both the HUD and the
guidance layer, including at minimum:

- resolved destination snapshot
- predicted intercept/transfer target
- desired heading or burn direction
- route distance/time estimates
- planner status or confidence flags

The planner should stay framework-free and testable in isolation. Rendering and
React hooks consume planner output; they do not own the core transfer logic.

### 5. Autonomous guidance becomes the primary ship-control source

Normal-play ship motion should be driven by a dedicated guidance layer (for
example `useAutonomousGuidance`) that consumes planner output and issues motion
commands into the existing ship-motion backend.

Its responsibilities include:

- reacting to destination changes
- continuously recomputing heading/intercept state as the target moves
- deciding when the ship is acquiring, cruising, braking, or arriving
- keeping the visible ship and camera behavior coherent while autonomy is in
  control

Existing manual-flight hooks and input handlers are no longer the primary
control path for normal play. Where the current Newtonian backend remains
useful, guidance should reuse it rather than bypass it with teleports or pure
UI-state transitions.

### 6. Scene and HUD consume planner/guidance state, not raw target geometry

The scene and React UI should stop treating "currently selected target body" as
the main navigation primitive.

Instead:

- destination selectors operate on catalog entries
- HUD panels show destination, route, intercept, and travel-state information
- route lines/markers reflect planner output rather than only a straight line to
  the target's current position
- telemetry reports guidance/planner state instead of manual-control hints

## V1 network scope

The navigation architecture must support this first-pass network without special
case UI or planner logic:

| Region         | Required support                                                                           |
| -------------- | ------------------------------------------------------------------------------------------ |
| Earth sphere   | Earth, one Earth-orbit station, one Moon-anchored destination, one Earth-Moon transfer hub |
| Mars sphere    | Mars, one Mars colony, one Mars-orbit station                                              |
| Jovian support | Colony/outpost destinations anchored to Callisto, Ganymede, and Europa                     |

Specific colony names can change later, but these mechanical anchors are the
source of truth for the initial implementation scope.

## Consequences

### Positive

- The UI, planner, and scene all gain a single shared destination model.
- Colonies and stations become first-class moving destinations rather than
  ad-hoc labels tied to planets.
- Moon ephemeris work stays bounded to the destinations that actually matter for
  v1.
- The transfer planner becomes a pure seam where future ship upgrades or
  navigation-computer quality can affect travel behavior without being welded to
  HUD code.
- Autonomous guidance can reuse the existing ship-motion backend instead of
  throwing away visible ship travel.

### Negative

- This introduces several new boundaries at once: location resolution, moon
  ephemerides, planning, and guidance.
- Straight-line ETA/bearing helpers become legacy scaffolding and must be kept
  from quietly remaining the real navigation logic.
- Anchored-destination rules need careful documentation so colony/station
  positions remain predictable and debuggable.

## Follow-up

- Implement the destination catalog and move the UI off raw body-name strings.
- Add bounded moon ephemerides for the Moon, Callisto, Ganymede, and Europa.
- Build the transfer planner as a pure module with dedicated unit tests.
- Replace normal-play manual input with guidance-driven ship control.
- Update route visuals, telemetry, and tests so they reflect planner/guidance
  state instead of the old manual-flight assumptions.
