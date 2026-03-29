import { Euler, Quaternion, Vector3 } from 'three'

export type ShipState = {
  position: Vector3
  velocity: Vector3
  yaw: number
  pitch: number
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

export function createInitialShipState(): ShipState {
  return {
    position: new Vector3(...INITIAL_SHIP_POSITION),
    velocity: new Vector3(0, 0, 0),
    yaw: -Math.PI / 2,
    pitch: -0.08,
    chaseDistance: 0.19,
  }
}

/**
 * Pure function: advances ship physics by one time step.
 * Mutates state.position and state.velocity in place.
 * Returns the ship orientation derived from the current yaw/pitch.
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

  const thrustPower = keysDown.has('Shift') ? 0.00006 : 0.000016
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

  if (keysDown.has('Space')) {
    state.velocity.multiplyScalar(Math.max(0, 1 - deltaSec * 2.8))
  } else {
    state.velocity.multiplyScalar(0.999)
  }

  state.position.addScaledVector(state.velocity, deltaSec)

  return { quaternion, forward, right, up }
}
