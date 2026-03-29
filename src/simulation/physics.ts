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

/** Maximum pitch angle in radians (shared with pointer-input clamping). */
export const PITCH_LIMIT_RAD = 1.35

// Physics constants
/** Normal linear thrust in AU s⁻² (F/m). */
export const THRUST_NORMAL_AU_PER_S2 = 0.000016
/** Boosted linear thrust in AU s⁻² when Shift is held. */
export const THRUST_BOOST_AU_PER_S2 = 0.00006
/** Normal rotational acceleration in rad s⁻². */
export const ANGULAR_THRUST_RAD_PER_S2 = 0.3
/** Boosted rotational acceleration in rad s⁻² when Shift is held. */
export const ANGULAR_THRUST_BOOST_RAD_PER_S2 = 0.6
/** Decay coefficient applied per-second when kill-velocity (Space) is held. */
export const TRANSLATION_BRAKE_FACTOR = 2.8
/** Decay coefficient applied per-second when kill-rotation (R) is held. */
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

export function shipControlsFromKeys(
  keysDown: ReadonlySet<string>,
): ShipControlInput {
  return {
    forward: Number(keysDown.has('KeyW')) - Number(keysDown.has('KeyS')),
    right: Number(keysDown.has('KeyD')) - Number(keysDown.has('KeyA')),
    up: Number(keysDown.has('KeyE')) - Number(keysDown.has('KeyQ')),
    yaw:
      Number(keysDown.has('ArrowLeft')) - Number(keysDown.has('ArrowRight')),
    pitch: Number(keysDown.has('ArrowUp')) - Number(keysDown.has('ArrowDown')),
    boost: keysDown.has('Shift'),
    brakeTranslation: keysDown.has('Space'),
    brakeRotation: keysDown.has('KeyR'),
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
 *   brakeTranslation → retro-thrust decays speed at TRANSLATION_BRAKE_FACTOR/s
 *   brakeRotation    → retro-spin decays angular velocity at ROTATION_BRAKE_FACTOR/s
 *
 * Mutates state.position, state.velocity, state.yaw, state.pitch, and
 * state.angularVelocity in place.
 * Returns the ship orientation derived from the updated yaw/pitch.
 */
export function stepShipPhysics(
  state: ShipState,
  controlsOrKeys: ShipControlInput | ReadonlySet<string>,
  deltaSec: number,
): ShipOrientation {
  const controls = normalizeShipControls(controlsOrKeys)
  const { quaternion, forward, right, up } = getShipOrientationFromAngles(
    state.yaw,
    state.pitch,
  )

  // ── Linear thrust ────────────────────────────────────────────────────────
  const thrustPower = controls.boost
    ? THRUST_BOOST_AU_PER_S2
    : THRUST_NORMAL_AU_PER_S2
  const acceleration = new Vector3()

  if (controls.forward !== 0)
    acceleration.addScaledVector(forward, controls.forward)
  if (controls.right !== 0) acceleration.addScaledVector(right, controls.right)
  if (controls.up !== 0) acceleration.addScaledVector(up, controls.up)

  if (acceleration.lengthSq() > 0) {
    acceleration.normalize().multiplyScalar(thrustPower)
    state.velocity.addScaledVector(acceleration, deltaSec)
  }

  // Kill velocity: hold Space to fire retro-thrusters and brake translation.
  // There is no passive drag — velocity persists without active thrust.
  if (controls.brakeTranslation) {
    state.velocity.multiplyScalar(
      Math.max(0, 1 - deltaSec * TRANSLATION_BRAKE_FACTOR),
    )
  }

  // ── Rotational thrust (arrow keys) ───────────────────────────────────────
  const angularThrust = controls.boost
    ? ANGULAR_THRUST_BOOST_RAD_PER_S2
    : ANGULAR_THRUST_RAD_PER_S2
  const hasRotationInput = controls.yaw !== 0 || controls.pitch !== 0

  state.angularVelocity.yaw += controls.yaw * angularThrust * deltaSec
  state.angularVelocity.pitch += controls.pitch * angularThrust * deltaSec

  // Kill rotation: hold R to fire rotational retro-thrusters.
  if (controls.brakeRotation) {
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

function normalizeShipControls(
  controlsOrKeys: ShipControlInput | ReadonlySet<string>,
): ShipControlInput {
  if (!isShipControlInput(controlsOrKeys)) {
    return normalizeShipControls(shipControlsFromKeys(controlsOrKeys))
  }

  return {
    forward: clampAxis(controlsOrKeys.forward),
    right: clampAxis(controlsOrKeys.right),
    up: clampAxis(controlsOrKeys.up),
    yaw: clampAxis(controlsOrKeys.yaw),
    pitch: clampAxis(controlsOrKeys.pitch),
    boost: controlsOrKeys.boost,
    brakeTranslation: controlsOrKeys.brakeTranslation,
    brakeRotation: controlsOrKeys.brakeRotation,
  }
}

function clampAxis(value: number): number {
  return Math.max(-1, Math.min(1, value))
}

function isShipControlInput(
  value: ShipControlInput | ReadonlySet<string>,
): value is ShipControlInput {
  return 'forward' in value
}
