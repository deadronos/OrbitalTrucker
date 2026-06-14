import { Euler, MathUtils, Quaternion, Vector3 } from 'three'

export type ShipState = {
  position: Vector3
  velocity: Vector3
  yaw: number
  pitch: number
  /** Rotational velocity in rad/s applied by guidance steering commands. */
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

export type ShipControlInput = {
  forward: number
  right: number
  up: number
  yaw: number
  pitch: number
  boost: boolean
  brakeTranslation: boolean
  brakeRotation: boolean
}

export const INITIAL_SHIP_POSITION = [1.04, 0.012, 0.02] as const
export const SHIP_SCALE_AU = 0.0048

/** Maximum pitch angle in radians. */
export const PITCH_LIMIT_RAD = 1.35

// Physics constants
/** Normal linear thrust in AU s⁻² (F/m). */
export const THRUST_NORMAL_AU_PER_S2 = 0.000016
/** Boosted linear thrust in AU s⁻² when the guidance layer requests boost. */
export const THRUST_BOOST_AU_PER_S2 = 0.00006
/** Normal rotational acceleration in rad s⁻². */
export const ANGULAR_THRUST_RAD_PER_S2 = 0.3
/** Boosted rotational acceleration in rad s⁻² when the guidance layer requests boost. */
export const ANGULAR_THRUST_BOOST_RAD_PER_S2 = 0.6
/** Decay coefficient applied per-second when the guidance layer requests a translational brake. */
export const TRANSLATION_BRAKE_FACTOR = 2.8
/** Decay coefficient applied per-second when the guidance layer requests a rotational brake. */
export const ROTATION_BRAKE_FACTOR = 5.0
/** Decay coefficient applied per-second by the rotation-assist computer. */
export const ROTATION_ASSIST_FACTOR = 3.0

export function createIdleShipControls(): ShipControlInput {
  return {
    forward: 0,
    right: 0,
    up: 0,
    yaw: 0,
    pitch: 0,
    boost: false,
    brakeTranslation: false,
    brakeRotation: false,
  }
}

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

export function getShipOrientationFromAngles(
  yaw: number,
  pitch: number,
): ShipOrientation {
  const lookEuler = new Euler(pitch, yaw, 0, 'YXZ')
  const quaternion = new Quaternion().setFromEuler(lookEuler)
  const forward = new Vector3(1, 0, 0).applyQuaternion(quaternion)
  const right = new Vector3(0, 0, -1).applyQuaternion(quaternion)
  const up = new Vector3(0, 1, 0).applyQuaternion(quaternion)

  return { quaternion, forward, right, up }
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
 *   angularVelocity += angularThrust × Δt  (from controls.yaw / controls.pitch)
 *   yaw/pitch       += angularVelocity × Δt
 *
 * Assist modes:
 *   brakeTranslation → retro-thrust decays speed at TRANSLATION_BRAKE_FACTOR/s
 *   brakeRotation    → retro-spin decays angular velocity at ROTATION_BRAKE_FACTOR/s
 *
 * The control input is a command object produced by the guidance layer (see
 * `computeAutonomousGuidance`); the physics engine no longer reads keyboard
 * state directly. See ADR 013.
 *
 * Mutates state.position, state.velocity, state.yaw, state.pitch, and
 * state.angularVelocity in place.
 * Returns the ship orientation derived from the updated yaw/pitch.
 */
export function stepShipPhysics(
  state: ShipState,
  controls: ShipControlInput,
  deltaSec: number,
): ShipOrientation {
  const forwardAxis = clampAxis(controls.forward)
  const rightAxis = clampAxis(controls.right)
  const upAxis = clampAxis(controls.up)
  const yawAxis = clampAxis(controls.yaw)
  const pitchAxis = clampAxis(controls.pitch)
  const { forward, right, up } = getShipOrientationFromAngles(
    state.yaw,
    state.pitch,
  )

  // ── Linear thrust ────────────────────────────────────────────────────────
  const thrustPower = controls.boost
    ? THRUST_BOOST_AU_PER_S2
    : THRUST_NORMAL_AU_PER_S2
  const acceleration = new Vector3()

  if (forwardAxis !== 0) acceleration.addScaledVector(forward, forwardAxis)
  if (rightAxis !== 0) acceleration.addScaledVector(right, rightAxis)
  if (upAxis !== 0) acceleration.addScaledVector(up, upAxis)

  if (acceleration.lengthSq() > 0) {
    acceleration.normalize().multiplyScalar(thrustPower)
    state.velocity.addScaledVector(acceleration, deltaSec)
  }

  // Translation brake: requested by the guidance layer near arrival or during
  // emergency stops. There is no passive drag — velocity persists without
  // active braking.
  if (controls.brakeTranslation) {
    state.velocity.multiplyScalar(
      Math.max(0, 1 - deltaSec * TRANSLATION_BRAKE_FACTOR),
    )
  }

  // ── Rotational thrust (guidance steering commands) ──────────────────────
  const angularThrust = controls.boost
    ? ANGULAR_THRUST_BOOST_RAD_PER_S2
    : ANGULAR_THRUST_RAD_PER_S2
  const hasRotationInput = yawAxis !== 0 || pitchAxis !== 0

  state.angularVelocity.yaw += yawAxis * angularThrust * deltaSec
  state.angularVelocity.pitch += pitchAxis * angularThrust * deltaSec

  // Rotation brake: requested by the guidance layer once alignment error
  // settles near zero.
  if (controls.brakeRotation) {
    const brakeFactor = Math.max(0, 1 - deltaSec * ROTATION_BRAKE_FACTOR)
    state.angularVelocity.yaw *= brakeFactor
    state.angularVelocity.pitch *= brakeFactor
  }

  // Rotation assist: when enabled, auto-damps angular velocity while no
  // steering command is active (stability control).
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

  return getShipOrientationFromAngles(state.yaw, state.pitch)
}

function clampAxis(value: number): number {
  return Math.max(-1, Math.min(1, value))
}
