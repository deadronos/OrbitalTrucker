# ADR 001: Use a heliocentric solar-system sandbox as the first playable experience

- **Status:** Accepted
- **Date:** 2026-03-29

## Context

The first milestone needed to prove that `OrbitalTrucker` could communicate the fantasy of piloting a cargo freighter through the real solar system without waiting for final art, mission systems, or a complete simulation stack.

A narrow but compelling slice was needed:

- the player should be able to move through 3D space immediately
- the space should feel recognizably like the real solar system
- planets should be placed at meaningful relative distances
- the prototype should leave room for future cargo, travel, and mission systems

## Decision

The first playable implementation is a **heliocentric solar-system map** centered on the Sun.

The playable space includes:

- the Sun
- Mercury through Neptune
- Pluto as a dwarf-planet waypoint
- a player-controlled placeholder cargo freighter

The prototype treats the current build as a navigation sandbox rather than a mission-driven game loop.

## Consequences

### Positive

- immediately demonstrates the project's core fantasy and scale
- gives future systems a clear spatial foundation
- supports incremental upgrades without replacing the whole prototype
- makes target selection and travel distance legible early in development

### Negative

- there is not yet an economic or cargo gameplay loop
- the current experience is exploratory rather than objective-driven
- a heliocentric-only view omits local detail such as moons, lanes, and stations

## Follow-up

Later iterations can layer in freight contracts, orbital destinations, local-space transitions, and route-planning systems on top of this sandbox.
