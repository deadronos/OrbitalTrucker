import { Vector3 } from 'three'

export type TrajectoryPlan = {
  /** Normalized unit vector pointing from ship toward the selected target. */
  directionToTarget: Vector3
  /**
   * Angle in degrees between the ship's current forward heading and the
   * straight-line direction to the target (0 = on course, 180 = flying away).
   */
  bearingAngleDeg: number
  /** Straight-line distance from ship to target in AU. */
  distanceAu: number
  /**
   * Estimated travel time in days at the current constant speed along the
   * straight-line course. Null when speed is below the minimum threshold.
   */
  etaDays: number | null
}

const SECONDS_PER_DAY = 86_400

/** Minimum ship speed (AU/s) required to produce a meaningful ETA. */
const MIN_SPEED_AU_PER_SEC = 1e-9

/**
 * Pure function: computes a straight-line trajectory plan from the ship's
 * current position toward the selected target.
 *
 * All positions are in AU (Astronomical Units).
 *
 * @param shipPosition     - Ship position in AU.
 * @param targetPosition   - Target body position in AU.
 * @param shipForward      - Normalized forward direction vector of the ship.
 * @param shipSpeedAuPerSec - Current ship speed in AU per second.
 */
export function planRoute(
  shipPosition: Vector3,
  targetPosition: Vector3,
  shipForward: Vector3,
  shipSpeedAuPerSec: number,
): TrajectoryPlan {
  const delta = new Vector3().subVectors(targetPosition, shipPosition)
  const distanceAu = delta.length()

  const directionToTarget =
    distanceAu > 0 ? delta.clone().normalize() : new Vector3(1, 0, 0)

  const cosAngle = Math.max(-1, Math.min(1, shipForward.dot(directionToTarget)))
  const bearingAngleDeg = (Math.acos(cosAngle) * 180) / Math.PI

  const etaDays =
    shipSpeedAuPerSec >= MIN_SPEED_AU_PER_SEC
      ? distanceAu / shipSpeedAuPerSec / SECONDS_PER_DAY
      : null

  return { directionToTarget, bearingAngleDeg, distanceAu, etaDays }
}

/**
 * Converts a normalized direction vector to yaw and pitch angles that match
 * the YXZ Euler convention used by the ship physics system.
 *
 * Key constraint (derived from Three.js quaternion application):
 *   forward = new Vector3(1, 0, 0).applyQuaternion(Euler(pitch, yaw, 0, 'YXZ'))
 *           = [cos(yaw), 0, -sin(yaw)]
 *
 * The forward vector lies entirely in the XZ plane regardless of pitch.
 * Pitch controls the visual tilt of the ship body (and thus the local
 * right/up axes used for A/D and Q/E thrust) but does not affect W/S thrust.
 *
 * This function therefore:
 *   - Sets yaw so the forward (XZ) direction points toward the target.
 *   - Sets pitch to the elevation angle so the ship visually faces the target.
 *
 * @returns yaw in radians (−π to π) and pitch in radians (−π/2 to π/2).
 */
export function directionToYawPitch(direction: Vector3): {
  yaw: number
  pitch: number
} {
  const d = direction.clone().normalize()

  // Yaw: rotate in XZ plane so forward = [cos(yaw), 0, -sin(yaw)]
  // points toward the XZ projection of the desired direction.
  const yaw = Math.atan2(-d.z, d.x)

  // Pitch: visual elevation angle to show the target is above/below the
  // ecliptic plane. Positive pitch tilts the ship's body toward +Y.
  const horizontalLength = Math.sqrt(d.x * d.x + d.z * d.z)
  const pitch = Math.atan2(d.y, horizontalLength)

  return { yaw, pitch }
}
