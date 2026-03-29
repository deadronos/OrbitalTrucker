# ADR 005: Shift normal play to autonomous space trucking

- **Status:** Accepted
- **Date:** 2026-03-30
- **Supersedes:** ADR 003 (trajectory planning and assisted navigation) as the default normal-play travel model

## Context

The prototype so far has treated the ship as something the player flies by
hand, first with arcade-friendly inertial controls (ADR 002) and then with a
more explicitly Newtonian backend (ADR 004). That work proved out several
important foundations:

- a living heliocentric solar-system map
- a visible ship with coherent chase-camera follow
- time warp for long-haul travel
- target selection, route lines, and ETA-style navigation readouts

Those foundations support the fantasy of being a space trucker, but the
moment-to-moment interaction model still pushes the game toward manual piloting.
For long interplanetary trips, the player is still expected to:

- point the ship manually
- maintain or correct heading manually
- manage thrust/braking manually
- treat navigation help as an aid layered on top of hand-flying

That is no longer the intended default fantasy for `OrbitalTrucker`.

The intended fantasy is operating a near/medium-future freight vessel that
travels between planets, moons, colonies, and stations while the solar system
continues moving underneath it. The interesting decisions should come from
where to go, when to retarget, what route state the ship is in, and eventually
what cargo/equipment trade-offs the player accepts, not from continuously
steering the ship like a dogfight craft.

## Decision

### 1. Normal play becomes destination-driven and autonomous

The default gameplay loop shifts from "fly the ship yourself" to
"command the freighter by selecting destinations and monitoring travel."

Normal play will be built around:

- choosing a destination from a destination catalog
- allowing destination changes at any time
- having the ship recompute heading/intercept state after each change
- presenting travel status through navigation/planner telemetry rather than
  piloting controls

### 2. Manual piloting is removed from normal play

Manual thrust-and-steering controls are no longer part of the main shipped play
loop. Existing manual-flight assumptions remain useful as prototype history and
may remain available for debugging or development tooling, but they are not the
source of truth for the player-facing design going forward.

This means the old assumptions from the prototype are explicitly no longer the
default model:

- the player is not expected to fly the ship continuously with keyboard/mouse
- route helpers are not optional overlays on top of hand flight; navigation
  planning becomes the primary mode of play
- the HUD should stop centering control hints and start centering destination,
  route, and travel-state information

ADR 004's Newtonian motion equations can still survive as an implementation
detail underneath guidance, but they no longer define the normal-play
interaction loop by themselves.

### 3. Preserve the orbital-world fantasy

The shift to autonomous travel does **not** mean reducing the simulation to a
menu-only abstraction. Normal play should preserve:

- the heliocentric map and moving bodies
- a physically present ship that can still be seen traveling through space
- chase-camera continuity where practical
- time warp as the main way to compress long trips

The player is still operating a ship in a simulated solar system; they are just
operating it at the level of destination and travel management instead of raw
manual steering.

### 4. First-pass destination scope is intentionally curated

The first implementation pass must support a limited but coherent freight
network instead of trying to model every plausible settlement at once.

#### Earth sphere

- Earth remains a selectable major body.
- One Earth-orbit logistics station is in scope.
- One Moon-anchored destination (colony or logistics outpost) is in scope.
- One Earth-Moon transfer-hub destination is in scope.

#### Mars sphere

- Mars remains a selectable major body.
- One Mars surface colony is in scope.
- One Mars-orbit logistics station is in scope.

#### Jovian support network

- Jupiter remains a contextual major body for navigation.
- First-pass colony support is limited to destinations anchored to:
  - Callisto
  - Ganymede
  - Europa
- Io is explicitly out of scope for v1 to keep moon support, travel design, and
  colony content bounded.

The exact settlement names can evolve during content work, but the source of
truth for v1 is that the autonomous-travel rewrite must cover Earth-adjacent
destinations, Mars destinations, and a curated Jovian support network centered
on Callisto, Ganymede, and Europa.

### 5. Downstream implementation should treat these as acceptance gates

The rewrite is not complete until:

- manual piloting is removed from normal play
- destination changes can happen at any time
- the ship autonomously updates heading/intercept state after retargeting
- colonies/stations behave as real destinations rather than flavor text
- the HUD and telemetry describe autonomous travel rather than hand controls

## Consequences

### Positive

- The core fantasy becomes much closer to "space trucker" than "spaceflight
  sandbox."
- Future cargo, scheduling, planner-quality, and ship-equipment systems now
  have a clear home in the design.
- Destination changes, route monitoring, and time-warped long-haul travel
  become central features instead of side-effects of the flight model.
- The rewrite can preserve the existing orbital world and visible ship instead
  of discarding the current prototype entirely.

### Negative

- Players who enjoy direct piloting lose that as the default shipped mode.
- The UI, telemetry, and scene logic all need significant rework because they
  currently assume that the player is actively steering.
- Destination scope must stay curated; otherwise moons, colonies, and stations
  will explode into a content problem before the navigation loop is stable.

## Follow-up

- Add a location catalog ADR and implementation that supports planets, moons,
  colonies, and stations uniformly.
- Add moon ephemerides for the selected Moon/Jovian destinations needed by the
  first-pass freight network.
- Replace the straight-line route helper with a transfer-planning layer that
  can drive autonomous guidance.
- Rewrite the HUD and telemetry around destination selection and planner state.
