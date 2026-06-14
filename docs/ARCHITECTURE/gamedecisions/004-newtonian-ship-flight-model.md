# ADR 004: Newtonian ship flight model

- **Status:** Accepted
- **Date:** 2026-03-29
- **Last updated:** 2026-06-14
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

```text
Δv = (F / m) × Δt
```

In engine units `F/m` collapses to a single `thrustPower` scalar
(`0.000016 AU s⁻²` normal, `0.00006 AU s⁻²` boosted). The ship's velocity
is updated each frame:

```text
velocity += normalize(thrustDirection) × thrustPower × Δt
position += velocity × Δt
```

**There is no passive drag.** Once the ship is moving, it continues at constant
velocity until the pilot fires retro-thrusters or uses the kill-velocity assist.

### Rotational motion

The ship carries an angular velocity vector `{ yaw, pitch }` measured in
radians per second. Guidance commands on `ShipControlInput.yaw` and
`ShipControlInput.pitch` apply angular acceleration
(`ANGULAR_THRUST_RAD_PER_S2`) each frame:

```text
angularVelocity.yaw   += ShipControlInput.yaw   × ANGULAR_THRUST_RAD_PER_S2 × Δt
angularVelocity.pitch += ShipControlInput.pitch × ANGULAR_THRUST_RAD_PER_S2 × Δt
```

The accumulated angular velocity is then integrated into the ship's attitude:

```text
yaw   += angularVelocity.yaw   × Δt
pitch += angularVelocity.pitch × Δt          (clamped to ±PITCH_LIMIT_RAD)
```

### Assist modes

| Mode | Trigger | Behaviour |
|------|---------|-----------|
| **Kill velocity** | `ShipControlInput.brakeTranslation = true` | Fires retro-thrusters; velocity decays toward zero at `TRANSLATION_BRAKE_FACTOR × Δt` per frame |
| **Kill rotation** | `ShipControlInput.brakeRotation = true` | Fires rotational retro-thrusters; angular velocity decays at `ROTATION_BRAKE_FACTOR × Δt` per frame |
| **Rotation assist** | `ShipState.rotationAssist = true` (default) | When on, auto-damps angular velocity whenever no yaw/pitch command is active; emulates a stability-control computer |

## Control scheme

The Newtonian flight model is driven by a `ShipControlInput` command object
produced by the guidance layer (see [ADR 013](../technicaldecisions/013-command-driven-autonomous-guidance.md)).
The physics engine itself has no key bindings; the values below are
**thrust intent fields** on the command object and are populated by
`computeAutonomousGuidance`, not by the keyboard.

| `ShipControlInput` field | Meaning |
|--------------------------|---------|
| `forward` / `right` / `up` | Linear thrust intent on the ship-local axes, range `[-1, 1]` |
| `yaw` / `pitch` | Rotational thrust intent, range `[-1, 1]` |
| `boost` | When `true`, linear and rotational thrust use the boosted scalars |
| `brakeTranslation` | When `true`, retro-thrusters decay linear velocity |
| `brakeRotation` | When `true`, retro-thrusters decay angular velocity |

The only retained player-facing input is the time-warp keys (`[` / `]`) bound
in `App.tsx`; all other manual piloting was removed in issue #47.

## Consequences

### Positive

- Ship motion is now governed by documented, testable physics equations.
- Removing passive drag means long burns produce realistic coasting — a core
  Newtonian spaceflight behaviour.
- Rotation assist (on by default) keeps the model accessible while the toggle
  lets players opt into full Newtonian rotation.
- Pure functions in `physics.ts` remain easy to unit-test in isolation.

### Negative

- Without passive drag, the guidance layer must request a translational brake
  near arrival; otherwise the ship coasts. New players do not see this
  directly, but the guidance heuristics that decide when to brake become part
  of the visible ship behaviour.

## Follow-up

- Add a HUD indicator for rotation-assist state so pilots can see which mode is
  active.
- Consider adding a translation-assist toggle that re-introduces configurable
  linear damping for players who prefer it.
- Long-term: integrate gravitational forces from bodies into the velocity step
  so that unpowered coasting follows proper Keplerian trajectories.
