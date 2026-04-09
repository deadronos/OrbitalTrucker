import { MathUtils, Vector3 } from 'three'

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
const APPROACH_TAPER_START_RATIO = 0.45
const BRAKE_ENTRY_RATIO = 0.8
const BRAKE_EXIT_RATIO = 0.45
const STEERING_DEADZONE_RAD = 0.015
const STEERING_FULL_SCALE_RAD = 0.35
const STEERING_DAMPING_SECONDS = 1.2

export function computeAutonomousGuidance(
  shipState: ShipState,
  plannerResult: TransferPlannerResult,
  previousPhase?: AutonomousGuidancePhase,
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
  const alignmentErrorDeg = MathUtils.radToDeg(
    getGuidanceAlignmentErrorRad(
      shipState.yaw,
      shipState.pitch,
      desiredDirection,
    ),
  )
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
    previousPhase,
    speedAuPerSec,
  })
  const controls = createIdleShipControls()

  controls.yaw = scaleSteeringError(
    yawErrorRad - shipState.angularVelocity.yaw * STEERING_DAMPING_SECONDS,
  )
  controls.pitch = scaleSteeringError(
    pitchErrorRad - shipState.angularVelocity.pitch * STEERING_DAMPING_SECONDS,
  )

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
    const approachThrottle = getApproachThrottle(
      brakingDistanceAu,
      plannerResult.travel.plannedDistanceAu,
    )

    controls.forward =
      clampPositive(forward.dot(desiredDirection)) * approachThrottle
    controls.right = dampedAxis(right.dot(desiredDirection)) * approachThrottle
    controls.up = dampedAxis(up.dot(desiredDirection)) * approachThrottle
    controls.boost =
      plannerResult.travel.plannedDistanceAu > 0.5 &&
      alignmentErrorDeg < 4 &&
      approachThrottle > 0.95
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

function getGuidanceAlignmentErrorRad(
  yaw: number,
  pitch: number,
  desiredDirection: Vector3,
): number {
  const currentHeading = headingFromYawPitch(yaw, pitch)
  const cosAngle = Math.max(
    -1,
    Math.min(1, currentHeading.dot(desiredDirection)),
  )

  return Math.acos(cosAngle)
}

function headingFromYawPitch(yaw: number, pitch: number): Vector3 {
  const cosPitch = Math.cos(pitch)

  return new Vector3(
    Math.cos(yaw) * cosPitch,
    Math.sin(pitch),
    -Math.sin(yaw) * cosPitch,
  ).normalize()
}

function selectGuidancePhase({
  alignmentErrorDeg,
  arrivalDistanceAu,
  brakingDistanceAu,
  plannedDistanceAu,
  previousPhase,
  speedAuPerSec,
}: {
  alignmentErrorDeg: number
  arrivalDistanceAu: number
  brakingDistanceAu: number
  plannedDistanceAu: number
  previousPhase?: AutonomousGuidancePhase
  speedAuPerSec: number
}): AutonomousGuidancePhase {
  if (
    plannedDistanceAu <= arrivalDistanceAu &&
    speedAuPerSec <= ARRIVAL_SPEED_AU_PER_SEC
  ) {
    return 'arrived'
  }

  const shouldEnterBraking =
    brakingDistanceAu >= plannedDistanceAu * BRAKE_ENTRY_RATIO ||
    (alignmentErrorDeg >= ALIGNMENT_BRAKE_WINDOW_DEG &&
      speedAuPerSec > TURN_BRAKE_SPEED_AU_PER_SEC)
  const shouldHoldBraking =
    previousPhase === 'braking' &&
    brakingDistanceAu >= plannedDistanceAu * BRAKE_EXIT_RATIO

  if (shouldEnterBraking || shouldHoldBraking) {
    return 'braking'
  }

  if (alignmentErrorDeg > ALIGNMENT_THRUST_WINDOW_DEG) {
    return 'acquiring'
  }

  return 'cruising'
}

function getApproachThrottle(
  brakingDistanceAu: number,
  plannedDistanceAu: number,
): number {
  if (plannedDistanceAu <= 0) {
    return 0
  }

  const stopRatio = brakingDistanceAu / plannedDistanceAu

  if (stopRatio <= APPROACH_TAPER_START_RATIO) {
    return 1
  }

  if (stopRatio >= BRAKE_ENTRY_RATIO) {
    return 0
  }

  return (
    1 -
    MathUtils.smoothstep(
      stopRatio,
      APPROACH_TAPER_START_RATIO,
      BRAKE_ENTRY_RATIO,
    )
  )
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
