# ADR 002: Use Keplerian orbital elements with exaggerated body display sizes

- **Status:** Superseded by ADR 006 (orbital calculation source), Accepted (display-scale rule)
- **Date:** 2026-03-29
- **Updated:** 2026-03-29

## Context

The prototype needed to represent the real solar system in a way that was both credible and readable.

A strictly literal rendering of both distance and body size would make most planets too small to see at useful map scales. At the same time, simple circular toy orbits would undercut the goal of representing the actual solar system.

## Decision

The implementation uses two complementary rules:

1. **Orbital distances and positions** are computed by an `EphemerisProvider` (see ADR 006).
   The initial provider was a low-precision J2000 Keplerian element series.
   The active provider is now VSOP87D truncated (see ADR 006).
2. **Rendered body sizes** are intentionally exaggerated using hand-chosen `displayRadiusAu` values.

The renderer also enables `logarithmicDepthBuffer` to better support the wide depth range involved in AU-scale scenes.

## Consequences

### Positive

- produces recognizable and meaningfully scaled interplanetary spacing
- allows planets and the ship to remain visible in a playable view
- keeps the orbital computation lightweight enough for real-time browser use
- improves depth stability for a very large 3D scene

### Negative

- visual scale is not physically literal for object diameters
- the orbital model is a truncated series, not a full research-grade ephemeris
- the Keplerian approximation fallback (used for Pluto) is explicitly less accurate
- orbit lines are periodically rebuilt rather than backed by a more advanced simulation cache

## Follow-up

ADR 006 documents the ephemeris provider abstraction that was introduced to make
the simulation source swappable. Future work may introduce level-of-detail or
local-space transitions for close approaches.
