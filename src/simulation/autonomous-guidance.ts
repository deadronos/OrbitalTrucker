import { Vector3 } from 'three'

import {
  createIdleShipControls,
  getShipOrientationFromAngles,
  THRUST_NORMAL_AU_PER_S2,
  type ShipControlInput,
  type ShipState,
} from './physics'
import { directionToYawPitch } from './trajectory'
import type { TransferPlannerResult } from './transfer-planner'

export type AutonomousGuidancePhase =
  | 'acquiring'
  | 'cruising'
  | 'braking'
  | 'arrived'

export type AutonomousGuidanceResult = {
  phase: AutonomousGuidancePhase
  controls: ShipControlInput
  desiredDirection: Vector3
  desiredYaw: number
  desiredPitch: number
  yawErrorRad: number
  pitchErrorRad: number
  alignmentErrorDeg: number
  brakingDistanceAu: number
  closingSpeedAuPerSec: number
}

const ALIGNMENT_THRUST_WINDOW_DEG = 12
const ALIGNMENT_BRAKE_WINDOW_DEG = 30
const ARRIVAL_DISTANCE_AU = 0.001
const ARRIVAL_SPEED_AU_PER_SEC = 4e-6
const TURN_BRAKE_SPEED_AU_PER_SEC = 2e-6
const STEERING_DEADZONE_RAD = 0.015
const STEERING_FULL_SCALE_RAD = 0.35

export function computeAutonomousGuidance(
  shipState: ShipState,
  plannerResult: TransferPlannerResult,
): AutonomousGuidanceResult {
  const desiredDirection =
    plannerResult.guidance.direction.lengthSq() > 0
      ? plannerResult.guidance.direction.clone().normalize()
      : new Vector3(1, 0, 0)
  const { forward, right, up } = getShipOrientationFromAngles(
    shipState.yaw,
    shipState.pitch,
  )
  const { yaw: desiredYaw, pitch: desiredPitch } =
    directionToYawPitch(desiredDirection)
  const yawErrorRad = normalizeAngle(desiredYaw - shipState.yaw)
  const pitchErrorRad = desiredPitch - shipState.pitch
  const alignmentErrorDeg = plannerResult.guidance.bearingAngleDeg
  const speedAuPerSec = shipState.velocity.length()
  const closingSpeedAuPerSec = shipState.velocity.dot(desiredDirection)
  const brakingDistanceAu =
    closingSpeedAuPerSec > 0
      ? (closingSpeedAuPerSec * closingSpeedAuPerSec) /
        (2 * THRUST_NORMAL_AU_PER_S2)
      : 0
  const arrivalDistanceAu = Math.max(
    ARRIVAL_DISTANCE_AU,
    Math.min(0.01, plannerResult.travel.plannedDistanceAu * 0.1),
  )
  const phase = selectGuidancePhase({
    alignmentErrorDeg,
    arrivalDistanceAu,
    brakingDistanceAu,
    plannedDistanceAu: plannerResult.travel.plannedDistanceAu,
    speedAuPerSec,
  })
  const controls = createIdleShipControls()

  controls.yaw = scaleSteeringError(yawErrorRad)
  controls.pitch = scaleSteeringError(pitchErrorRad)

  if (phase === 'arrived') {
    controls.brakeTranslation = true
    controls.brakeRotation = true
  } else if (phase === 'braking') {
    controls.brakeTranslation = true
    controls.brakeRotation =
      Math.abs(yawErrorRad) < STEERING_DEADZONE_RAD &&
      Math.abs(pitchErrorRad) < STEERING_DEADZONE_RAD
  } else if (phase === 'acquiring') {
    controls.brakeTranslation =
      speedAuPerSec > TURN_BRAKE_SPEED_AU_PER_SEC &&
      alignmentErrorDeg >= ALIGNMENT_BRAKE_WINDOW_DEG
  } else {
    controls.forward = clampPositive(forward.dot(desiredDirection))
    controls.right = dampedAxis(right.dot(desiredDirection))
    controls.up = dampedAxis(up.dot(desiredDirection))
    controls.boost =
      plannerResult.travel.plannedDistanceAu > 0.5 && alignmentErrorDeg < 4
  }

  return {
    phase,
    controls,
    desiredDirection,
    desiredYaw,
    desiredPitch,
    yawErrorRad,
    pitchErrorRad,
    alignmentErrorDeg,
    brakingDistanceAu,
    closingSpeedAuPerSec,
  }
}

function selectGuidancePhase({
  alignmentErrorDeg,
  arrivalDistanceAu,
  brakingDistanceAu,
  plannedDistanceAu,
  speedAuPerSec,
}: {
  alignmentErrorDeg: number
  arrivalDistanceAu: number
  brakingDistanceAu: number
  plannedDistanceAu: number
  speedAuPerSec: number
}): AutonomousGuidancePhase {
  if (
    plannedDistanceAu <= arrivalDistanceAu &&
    speedAuPerSec <= ARRIVAL_SPEED_AU_PER_SEC
  ) {
    return 'arrived'
  }

  if (
    brakingDistanceAu * 1.25 >= plannedDistanceAu ||
    (alignmentErrorDeg >= ALIGNMENT_BRAKE_WINDOW_DEG &&
      speedAuPerSec > TURN_BRAKE_SPEED_AU_PER_SEC)
  ) {
    return 'braking'
  }

  if (alignmentErrorDeg > ALIGNMENT_THRUST_WINDOW_DEG) {
    return 'acquiring'
  }

  return 'cruising'
}

function scaleSteeringError(errorRad: number): number {
  const magnitude = Math.abs(errorRad)

  if (magnitude <= STEERING_DEADZONE_RAD) {
    return 0
  }

  return (
    Math.sign(errorRad) *
    Math.min(1, magnitude / STEERING_FULL_SCALE_RAD)
  )
}

function dampedAxis(value: number): number {
  if (Math.abs(value) < 0.08) {
    return 0
  }

  return Math.max(-0.75, Math.min(0.75, value))
}

function clampPositive(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function normalizeAngle(angle: number): number {
  let normalized = angle

  while (normalized > Math.PI) {
    normalized -= Math.PI * 2
  }

  while (normalized < -Math.PI) {
    normalized += Math.PI * 2
  }

  return normalized
}
