# ADR 003: Introduce trajectory planning and assisted navigation

- **Status:** Superseded by [ADR 005](./005-shift-to-autonomous-space-trucking.md)
- **Date:** 2026-03-29

## Context

After the arcade inertial flight model landed (ADR 002), interplanetary travel was possible in principle but not in practice for most players. The distances between planets are enormous: flying from Earth to Mars at prototype thrust levels with no guidance takes real concentration and trial-and-error. Players had no way to know:

- which direction to fly to reach a selected target
- how long the journey would take at current speed
- how far off-course their heading was

The target-selection system and HUD already existed, so there was a clear place to surface navigation information without restructuring the app.

## Decision

Add a straight-line trajectory planning and assisted navigation layer on top of the existing flight model. The feature consists of four parts:

1. **Course line** — a visual line drawn from the ship to the currently selected target body each frame, giving an immediate spatial reference for the route.
2. **Bearing readout** — the angle (in degrees) between the ship's current forward heading and the straight-line direction to the target. Zero means the ship is aimed directly at the target.
3. **ETA readout** — estimated travel time in hours, days, or years assuming constant current speed along the straight-line course.
4. **Orient-to-target command** — pressing `T` (or clicking the _Orient to target_ button) instantly rotates the ship to face the selected target. This removes the manual yaw/pitch search that is especially frustrating when the target is behind the ship.

Navigation is intentionally simplified:

- Routes are straight lines, not Hohmann transfer orbits or gravity-assist trajectories. This matches the existing arcade flight model and is honest about the prototype's scope.
- The ETA assumes constant speed; it does not account for required deceleration, thrust limits, or target body motion.
- The system is additive: free flight is still fully available, and the course line can be ignored entirely.

## Consequences

### Positive

- Players can see exactly where to fly the moment they select a target.
- Bearing and ETA make long-haul trips legible and rewarding rather than disorienting.
- Orient-to-target makes the ship immediately useful even after target switching or time warp.
- The implementation stays in the existing hook and scene component system (ADR 005) with no new architectural layer.

### Negative

- Straight-line routes ignore planet motion; a target 5 AU away will not be at the same position when the ship arrives.
- ETA can become misleadingly small at high time-warp speeds because speed is measured in real-time AU/s, not simulation-corrected values.
- The course line passes through other bodies; a visual de-emphasis pass may be needed later.

## Follow-up

- Replace the straight-line course with a Hohmann or patched-conic transfer orbit once the simulation has enough fidelity to make those meaningful.
- Add a maneuver-node system that lets players plan burns in advance and execute them automatically.
- Introduce a per-target travel log that records departure date, arrival date, and cargo carried.
