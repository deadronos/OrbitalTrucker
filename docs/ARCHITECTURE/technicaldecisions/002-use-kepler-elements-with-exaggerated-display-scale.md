# ADR 002: Use Keplerian orbital elements with exaggerated body display sizes

- **Status:** Accepted
- **Date:** 2026-03-29

## Context

The prototype needed to represent the real solar system in a way that was both credible and readable.

A strictly literal rendering of both distance and body size would make most planets too small to see at useful map scales. At the same time, simple circular toy orbits would undercut the goal of representing the actual solar system.

## Decision

The current implementation uses two complementary rules:

1. **Orbital distances and positions** are derived from low-precision J2000 Keplerian element series.
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
- the orbital model is an approximation, not a research-grade ephemeris
- orbit lines are periodically rebuilt rather than backed by a more advanced simulation cache

## Follow-up

Future upgrades may separate simulation units from render units more formally, add higher-fidelity ephemerides, and introduce level-of-detail or local-space transitions for close approaches.
