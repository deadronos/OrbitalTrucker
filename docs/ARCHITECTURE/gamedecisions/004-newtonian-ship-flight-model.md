# ADR 004: Newtonian ship flight model

- **Status:** Accepted
- **Date:** 2026-03-29
- **Supersedes:** ADR 002 (arcade-friendly inertial flight)

## Context

ADR 002 established a deliberately simplified, arcade-friendly flight model to
keep early prototyping accessible. That model has two physics shortcuts that
diverge from realistic deep-space flight:

1. **Passive velocity damping** — velocity silently decays by 0.1 % per frame
   (`velocity × 0.999`), giving the ship invisible drag that does not exist in
   a vacuum.
2. **Immediate yaw/pitch** — mouse input overwrites orientation angles directly
   with no notion of rotational momentum, so there is no concept of angular
   velocity or the energy cost of stopping a spin.

The next iteration of OrbitalTrucker must feel closer to a Newtonian space
freighter, satisfying the acceptance criteria from the tracked issue:

- ship movement governed by a documented physics model, not arcade dampening
- clear controls and assist modes for translation, rotation, and braking
- new flight behaviour verified by unit tests

## Physics model

### Linear (translational) motion

Newton's second law governs all thrust:

```
Δv = (F / m) × Δt
```

In engine units `F/m` collapses to a single `thrustPower` scalar
(`0.000016 AU s⁻²` normal, `0.00006 AU s⁻²` boosted). The ship's velocity
is updated each frame:

```
velocity += normalize(thrustDirection) × thrustPower × Δt
position += velocity × Δt
```

**There is no passive drag.** Once the ship is moving, it continues at constant
velocity until the pilot fires retro-thrusters or uses the kill-velocity assist.

### Rotational motion

The ship carries an angular velocity vector `{ yaw, pitch }` measured in
radians per second. Arrow-key inputs apply angular acceleration
(`ANGULAR_THRUST_RAD_PER_S2`) each frame:

```
angularVelocity.yaw   += ±ANGULAR_THRUST_RAD_PER_S2 × Δt   (← → keys)
angularVelocity.pitch += ±ANGULAR_THRUST_RAD_PER_S2 × Δt   (↑ ↓ keys)
```

The accumulated angular velocity is then integrated into the ship's attitude:

```
yaw   += angularVelocity.yaw   × Δt
pitch += angularVelocity.pitch × Δt          (clamped to ±PITCH_LIMIT_RAD)
```

Mouse drag continues to apply direct yaw/pitch deltas (an attitude-hold
control surface, like a reaction-control system joystick) without affecting
`angularVelocity`.

### Assist modes

| Mode | Trigger | Behaviour |
|------|---------|-----------|
| **Kill velocity** | `Space` (hold) | Fires retro-thrusters; velocity decays toward zero at `TRANSLATION_BRAKE_FACTOR × Δt` per frame |
| **Kill rotation** | `R` (hold) | Fires rotational retro-thrusters; angular velocity decays at `ROTATION_BRAKE_FACTOR × Δt` per frame |
| **Rotation assist** | `F` (toggle) | When on (default), auto-damps angular velocity whenever no arrow-key rotation input is active; emulates a stability-control computer |

## Control scheme

| Key(s) | Action |
|--------|--------|
| `W` / `S` | Forward / backward thrust |
| `A` / `D` | Left / right strafe thrust |
| `Q` / `E` | Up / down vertical thrust |
| `Shift` | Boost (3.75 × thrust and angular acceleration) |
| `←` / `→` | Yaw left / right (rotational thruster) |
| `↑` / `↓` | Pitch up / down (rotational thruster) |
| Mouse drag | Direct attitude (yaw / pitch) control |
| `Space` | Kill velocity (hold to brake) |
| `R` | Kill rotation (hold to stop spin) |
| `F` | Toggle rotation assist on / off |
| `T` | Orient to selected target |
| `[` / `]` | Time warp speed |
| Scroll wheel | Chase-camera zoom |

## Consequences

### Positive

- Ship motion is now governed by documented, testable physics equations.
- Removing passive drag means long burns produce realistic coasting — a core
  Newtonian spaceflight behaviour.
- Rotation assist (on by default) keeps the model accessible while the toggle
  lets players opt into full Newtonian rotation.
- Pure functions in `physics.ts` remain easy to unit-test in isolation.

### Negative

- Without passive drag, the pilot must actively brake to stop. New players may
  find this initially disorienting.
- Arrow-key rotation adds a second steering mechanism alongside mouse drag;
  the dual input modes require clear documentation.

## Follow-up

- Add a HUD indicator for rotation-assist state so pilots can see which mode is
  active.
- Consider adding a translation-assist toggle that re-introduces configurable
  linear damping for players who prefer it.
- Long-term: integrate gravitational forces from bodies into the velocity step
  so that unpowered coasting follows proper Keplerian trajectories.
