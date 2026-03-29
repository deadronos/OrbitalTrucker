# ADR 002: Use arcade-friendly inertial flight for the prototype ship

- **Status:** Accepted
- **Date:** 2026-03-29

## Context

A realistic interplanetary simulation can become hard to control very quickly, especially before the project has:

- instrument panels
- autopilot
- maneuver planning tools
- tutorialization
- visual references for burns and trajectories

The prototype still needed to feel like piloting a freighter rather than simply moving a free camera.

## Decision

The player ship uses a lightweight inertial flight model with direct thrust inputs and dampening assistance.

Current behavior includes:

- directional thrust on `W`, `A`, `S`, `D`, `Q`, and `E`
- optional boost via `Shift`
- rapid velocity reduction via `Space`
- mouse-driven yaw/pitch steering
- a third-person chase camera with zoom

This is intentionally more accessible than a full orbital mechanics flight model.

## Consequences

### Positive

- fast to understand and easy to test
- feels closer to flying a ship than moving a debug camera
- keeps the prototype fun while other systems are still placeholders
- avoids blocking development on full spacecraft guidance systems

### Negative

- ship motion is not yet physically accurate for deep-space burns or gravity assists
- future transition to more simulation-heavy travel may require additional UI and controls
- current speed and dampening are tuned for usability rather than realism

## Follow-up

A later version can add optional assist modes, autopilot, transfer planning, and deeper Newtonian flight while keeping this mode as an accessibility or prototype option.
