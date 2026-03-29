# ADR 014: Destination-driven navigation HUD for autonomous travel

- **Status:** Accepted
- **Date:** 2026-03-30
- **Related:** ADR 005 (shift normal play to autonomous space trucking), ADR 008 (minimal HUD using Tailwind CSS v4 and shadcn-style components), ADR 011 (destination catalog, moon ephemerides, transfer planning, and autonomous guidance), ADR 013 (command-driven autonomous guidance for normal-play ship control)

## Context

The autonomous-travel work is now in place:

- the player can choose destinations from the destination catalog
- the transfer planner produces live route and intercept data
- the flight computer continuously steers and thrusts without manual piloting

Even with that architecture in place, the main HUD still reads like a generic
telemetry overlay with a secondary route-control form. That creates a mismatch
between the intended game loop and the actual interface:

- destination selection is present, but it is not visually the center of the
  normal-play experience
- planner status and autonomous-guidance state are available, but they are not
  explained as the ship's current travel mode
- time controls exist, but they are not framed as part of supervising an
  autonomous trip

Issue #27 requires the main HUD to stop feeling like a leftover manual-flight
panel and instead feel like the bridge interface for destination-driven freight
operations.

## Decision

### 1. The primary HUD flow becomes destination first, travel state second

The first normal-play question the HUD answers is "where is the freighter going
now?" The second is "how is the flight computer handling that trip?"

That means the main HUD should foreground:

- the current destination
- a dropdown-style destination selector
- immediate confirmation that changing destinations reroutes the ship live

Destination selection is no longer a secondary control surface. It is the main
player command in normal play.

### 2. The destination panel must summarize the selected destination clearly

Selecting a destination should immediately surface enough context for the
player to understand what they picked without reading code or memorizing IDs.

The destination summary should include:

- destination name
- destination type (planet, moon, colony, station, and so on)
- its larger network or parent context when relevant

This keeps the autonomous-travel loop legible even as the catalog grows to
include mixed body, colony, and station entries.

### 3. Travel status must expose both planner mode and autonomous state

The HUD should explicitly distinguish between:

- **planner status**: whether the route is using the current position, a future
  intercept, or a fallback solution
- **autonomous state**: whether the ship is acquiring course, cruising,
  braking, or holding arrival

The player should also see the trip details that explain those states:

- current range
- planned range
- bearing
- ETA
- intercept window when one exists
- how far the target is expected to move during the planned intercept

These details let the UI explain autonomous travel without reintroducing manual
piloting hints.

### 4. Time controls remain part of travel supervision

Time controls stay in the main HUD, but they should be framed as simulation and
voyage supervision rather than as disconnected utility buttons.

The HUD should show:

- the current simulation date
- whether time is paused or advancing
- the active warp rate
- direct slower / pause-or-resume / faster controls

This keeps time management coherent with the new "set destination, monitor
travel, adjust simulation pace" interaction model.

### 5. Manual-orient and manual-flight affordances stay out of normal play

The main HUD must not reintroduce:

- keyboard flight hints
- orient-to-target prompts
- copy that implies the player should hand-fly the ship continuously

Developer or legacy controls may still exist outside the player-facing normal
HUD, but they are not part of the default experience.

## Consequences

### Positive

- The interface finally matches the autonomous-travel ADRs instead of only
  satisfying them in the simulation layer.
- Destination changes become legible, confident actions rather than a hidden
  dropdown behind generic telemetry.
- Planner and guidance state become understandable to players without exposing
  low-level physics controls.

### Negative

- The HUD now depends on a slightly richer metrics contract because the travel
  panel needs autonomous state and intercept facts, not just raw distance and
  speed.
- More destination context on the HUD increases the amount of text that must
  stay balanced against the canvas on smaller screens.

## Follow-up

- If cargo jobs or delivery schedules are added later, extend the same
  destination-first layout with contract context rather than creating a
  separate control HUD.
- If manual/debug flight tools are kept for development, expose them in a
  clearly separate debug surface so normal-play UX stays destination-driven.
