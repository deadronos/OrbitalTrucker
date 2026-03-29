import { Euler, MathUtils, Quaternion, Vector3 } from 'three'

export type ShipState = {
  position: Vector3
  velocity: Vector3
  yaw: number
  pitch: number
  /** Rotational velocity in rad/s applied by thruster inputs (arrow keys). */
  angularVelocity: { yaw: number; pitch: number }
  /**
   * When true the flight computer auto-damps angular velocity whenever no
   * rotation thruster input is active (rotation assist / stability control).
   */
  rotationAssist: boolean
  chaseDistance: number
}

export type ShipOrientation = {
  quaternion: Quaternion
  forward: Vector3
  right: Vector3
  up: Vector3
}

export const INITIAL_SHIP_POSITION = [1.04, 0.012, 0.02] as const
export const SHIP_SCALE_AU = 0.0048

/** Maximum pitch angle in radians (shared with pointer-input clamping). */
export const PITCH_LIMIT_RAD = 1.35

// Physics constants
/** Normal linear thrust in AU s⁻² (F/m). */
const THRUST_NORMAL = 0.000016
/** Boosted linear thrust in AU s⁻² when Shift is held. */
const THRUST_BOOST = 0.00006
/** Normal rotational acceleration in rad s⁻². */
const ANGULAR_THRUST_RAD_PER_S2 = 0.3
/** Boosted rotational acceleration in rad s⁻² when Shift is held. */
const ANGULAR_THRUST_BOOST_RAD_PER_S2 = 0.6
/** Decay coefficient applied per-second when kill-velocity (Space) is held. */
const TRANSLATION_BRAKE_FACTOR = 2.8
/** Decay coefficient applied per-second when kill-rotation (R) is held. */
const ROTATION_BRAKE_FACTOR = 5.0
/** Decay coefficient applied per-second by the rotation-assist computer. */
const ROTATION_ASSIST_FACTOR = 3.0

export function createInitialShipState(): ShipState {
  return {
    position: new Vector3(...INITIAL_SHIP_POSITION),
    velocity: new Vector3(0, 0, 0),
    yaw: -Math.PI / 2,
    pitch: -0.08,
    angularVelocity: { yaw: 0, pitch: 0 },
    rotationAssist: true,
    chaseDistance: 0.19,
  }
}

/**
 * Pure function: advances ship physics by one time step using a Newtonian
 * model (no passive drag; velocity persists until actively countered).
 *
 * Linear motion (F = ma):
 *   velocity += normalize(thrustDir) × thrustPower × Δt
 *   position += velocity × Δt
 *
 * Rotational motion:
 *   angularVelocity += angularThrust × Δt  (arrow keys)
 *   yaw/pitch       += angularVelocity × Δt
 *
 * Assist modes:
 *   Space → kill velocity (retro-thrust, decays at TRANSLATION_BRAKE_FACTOR/s)
 *   R     → kill rotation (retro-spin,  decays at ROTATION_BRAKE_FACTOR/s)
 *   F     → toggle rotationAssist (handled by caller via keydown edge detection)
 *
 * Mutates state.position, state.velocity, state.yaw, state.pitch, and
 * state.angularVelocity in place.
 * Returns the ship orientation derived from the updated yaw/pitch.
 */
export function stepShipPhysics(
  state: ShipState,
  keysDown: ReadonlySet<string>,
  deltaSec: number,
): ShipOrientation {
  const lookEuler = new Euler(state.pitch, state.yaw, 0, 'YXZ')
  const quaternion = new Quaternion().setFromEuler(lookEuler)

  const forward = new Vector3(1, 0, 0).applyQuaternion(quaternion)
  const right = new Vector3(0, 0, -1).applyQuaternion(quaternion)
  const up = new Vector3(0, 1, 0).applyQuaternion(quaternion)

  // ── Linear thrust ────────────────────────────────────────────────────────
  const thrustPower = keysDown.has('Shift') ? THRUST_BOOST : THRUST_NORMAL
  const acceleration = new Vector3()

  if (keysDown.has('KeyW')) acceleration.add(forward)
  if (keysDown.has('KeyS')) acceleration.addScaledVector(forward, -1)
  if (keysDown.has('KeyD')) acceleration.add(right)
  if (keysDown.has('KeyA')) acceleration.addScaledVector(right, -1)
  if (keysDown.has('KeyE')) acceleration.add(up)
  if (keysDown.has('KeyQ')) acceleration.addScaledVector(up, -1)

  if (acceleration.lengthSq() > 0) {
    acceleration.normalize().multiplyScalar(thrustPower)
    state.velocity.addScaledVector(acceleration, deltaSec)
  }

  // Kill velocity: hold Space to fire retro-thrusters and brake translation.
  // There is no passive drag — velocity persists without active thrust.
  if (keysDown.has('Space')) {
    state.velocity.multiplyScalar(
      Math.max(0, 1 - deltaSec * TRANSLATION_BRAKE_FACTOR),
    )
  }

  // ── Rotational thrust (arrow keys) ───────────────────────────────────────
  const angularThrust = keysDown.has('Shift')
    ? ANGULAR_THRUST_BOOST_RAD_PER_S2
    : ANGULAR_THRUST_RAD_PER_S2
  const hasRotationInput =
    keysDown.has('ArrowLeft') ||
    keysDown.has('ArrowRight') ||
    keysDown.has('ArrowUp') ||
    keysDown.has('ArrowDown')

  if (keysDown.has('ArrowLeft'))
    state.angularVelocity.yaw += angularThrust * deltaSec
  if (keysDown.has('ArrowRight'))
    state.angularVelocity.yaw -= angularThrust * deltaSec
  if (keysDown.has('ArrowUp'))
    state.angularVelocity.pitch += angularThrust * deltaSec
  if (keysDown.has('ArrowDown'))
    state.angularVelocity.pitch -= angularThrust * deltaSec

  // Kill rotation: hold R to fire rotational retro-thrusters.
  if (keysDown.has('KeyR')) {
    const brakeFactor = Math.max(0, 1 - deltaSec * ROTATION_BRAKE_FACTOR)
    state.angularVelocity.yaw *= brakeFactor
    state.angularVelocity.pitch *= brakeFactor
  }

  // Rotation assist: when enabled, auto-damps angular velocity while the pilot
  // is not actively rotating via thrusters.
  if (state.rotationAssist && !hasRotationInput) {
    const assistFactor = Math.max(0, 1 - deltaSec * ROTATION_ASSIST_FACTOR)
    state.angularVelocity.yaw *= assistFactor
    state.angularVelocity.pitch *= assistFactor
  }

  // Integrate angular velocity into attitude.
  state.yaw += state.angularVelocity.yaw * deltaSec
  state.pitch = MathUtils.clamp(
    state.pitch + state.angularVelocity.pitch * deltaSec,
    -PITCH_LIMIT_RAD,
    PITCH_LIMIT_RAD,
  )

  state.position.addScaledVector(state.velocity, deltaSec)

  return { quaternion, forward, right, up }
}
