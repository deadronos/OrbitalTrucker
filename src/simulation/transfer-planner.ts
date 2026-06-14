import { Vector3 } from 'three'

import { planRoute } from './trajectory'

export type TransferPlannerStatus =
  | 'current-position'
  | 'future-intercept'
  | 'intercept-overrun'
  | 'lead-chase'
  | 'no-solution'

export type ShipCapabilities = {
  /**
   * Optional planner-only cruise speed assumption. Future engines or ship
   * computers can override this without changing the live physics state.
   */
  assumedCruiseSpeedAuPerSec?: number
  /** Minimum speed required before ETA and intercept solving are meaningful. */
  minimumPlanningSpeedAuPerSec: number
  /** Sample interval used to estimate the target's short-horizon velocity. */
  targetVelocitySampleSeconds: number
  /** Maximum time horizon the planner is allowed to search. */
  maxInterceptLookaheadDays: number
  /** Maximum refinement passes after the initial intercept estimate. */
  maxInterceptIterations: number
  /** Acceptable change between successive intercept times. */
  interceptConvergenceSeconds: number
  /**
   * Distance (AU) at and above which lead-pursuit is fully active in
   * the guidance layer. Below this, the planner's static aim dominates.
   */
  leadPursuitFullScaleAu: number
}

export type TransferPlannerInputs = {
  date: Date
  shipPosition: Vector3
  shipVelocity: Vector3
  shipForward: Vector3
  destinationId: string
  resolveDestinationPosition: (destinationId: string, date: Date) => Vector3
  shipCapabilities?: Partial<ShipCapabilities>
}

export type TransferPlannerResult = {
  destinationId: string
  status: TransferPlannerStatus
  destination: {
    currentPosition: Vector3
    predictedPosition: Vector3
    predictedDate: Date | null
    estimatedVelocityAuPerSec: Vector3
  }
  guidance: {
    aimPosition: Vector3
    direction: Vector3
    bearingAngleDeg: number
    /**
     * The target's instantaneous heliocentric velocity at the predicted
     * intercept time (or at `date` when the planner is in
     * `current-position` mode). Computed as a 1-second forward
     * difference on the curve-resolver.
     */
    requiredArrivalVelocity: Vector3
  }
  travel: {
    currentDistanceAu: number
    plannedDistanceAu: number
    etaDays: number | null
    interceptTimeSeconds: number | null
    targetMotionDuringInterceptAu: number
    planningSpeedAuPerSec: number
  }
  solver: {
    iterations: number
    solutionErrorSeconds: number | null
  }
}

const SECONDS_PER_DAY = 86_400
const MIN_TARGET_MOTION_AU = 1e-9
const QUADRATIC_EPSILON = 1e-12

export const DEFAULT_SHIP_CAPABILITIES: ShipCapabilities = {
  minimumPlanningSpeedAuPerSec: 1e-9,
  targetVelocitySampleSeconds: 21_600,
  maxInterceptLookaheadDays: 365 * 5,
  maxInterceptIterations: 5,
  interceptConvergenceSeconds: 1,
  leadPursuitFullScaleAu: 0.05,
}

export function planTransfer({
  date,
  shipPosition,
  shipVelocity,
  shipForward,
  destinationId,
  resolveDestinationPosition,
  shipCapabilities,
}: TransferPlannerInputs): TransferPlannerResult {
  const capabilities = {
    ...DEFAULT_SHIP_CAPABILITIES,
    ...shipCapabilities,
  }
  const planningSpeedAuPerSec =
    shipCapabilities?.assumedCruiseSpeedAuPerSec ?? shipVelocity.length()
  // Clone immediately — the resolver may return a shared Vector3 from
  // the bodyPositions Map that gets mutated between calls.
  const currentPosition = resolveDestinationPosition(destinationId, date).clone()
  const currentDistanceAu = shipPosition.distanceTo(currentPosition)
  const estimatedVelocityAuPerSec = estimateTargetVelocity(
    destinationId,
    date,
    resolveDestinationPosition,
    capabilities.targetVelocitySampleSeconds,
  )
  const maxLookaheadSeconds =
    capabilities.maxInterceptLookaheadDays * SECONDS_PER_DAY

  let status: TransferPlannerStatus = 'current-position'
  let aimPosition = currentPosition.clone()
  let predictedPosition = currentPosition.clone()
  let predictedDate: Date | null = null
  let interceptTimeSeconds: number | null = null
  let iterations = 0
  let solutionErrorSeconds: number | null = null

  if (planningSpeedAuPerSec >= capabilities.minimumPlanningSpeedAuPerSec) {
    // Seed the iteration with the closed-form quadratic solution under
    // the constant-velocity assumption. The curve-resolved iteration
    // then refines against the actual curve, correcting for curvature.
    const seedSeconds = solveConstantSpeedInterceptTime(
      shipPosition,
      currentPosition,
      estimatedVelocityAuPerSec,
      planningSpeedAuPerSec,
      maxLookaheadSeconds,
    )

    if (seedSeconds === null) {
      // No real constant-speed root exists. Treat as lead-chase: still
      // produce a lead-chase fallback so the ship has a heading.
      const naiveEtaSeconds = shipPosition.distanceTo(currentPosition) /
        planningSpeedAuPerSec
      const leadPosition = currentPosition.clone().addScaledVector(
        estimatedVelocityAuPerSec,
        naiveEtaSeconds,
      )
      predictedPosition = leadPosition
      predictedDate = addSeconds(date, naiveEtaSeconds)
      interceptTimeSeconds = naiveEtaSeconds
      aimPosition = leadPosition
      status = 'lead-chase'
    } else {
      let candidateSeconds = seedSeconds
      let converged = false
      let lastUsableCandidateSeconds: number | null = candidateSeconds
      let lastUsablePosition: Vector3 | null = resolveDestinationPosition(
        destinationId,
        addSeconds(date, candidateSeconds),
      )
      let lastUsableDate: Date | null = addSeconds(date, candidateSeconds)

      for (
        let iteration = 1;
        iteration <= capabilities.maxInterceptIterations;
        iteration += 1
      ) {
        iterations = iteration

        const candidateDate = addSeconds(date, candidateSeconds)
        const candidatePosition = resolveDestinationPosition(
          destinationId,
          candidateDate,
        )
        const nextSeconds = shipPosition.distanceTo(candidatePosition) /
          planningSpeedAuPerSec

        solutionErrorSeconds = Math.abs(nextSeconds - candidateSeconds)
        if (candidateSeconds > maxLookaheadSeconds) {
          if (lastUsablePosition && lastUsableCandidateSeconds !== null &&
              lastUsableCandidateSeconds <= maxLookaheadSeconds) {
            predictedPosition = lastUsablePosition
            predictedDate = lastUsableDate
            interceptTimeSeconds = lastUsableCandidateSeconds
            aimPosition = lastUsablePosition.clone()
            status = 'intercept-overrun'
          } else {
            status = 'no-solution'
          }
          break
        }

        if (solutionErrorSeconds <= capabilities.interceptConvergenceSeconds) {
          predictedPosition = candidatePosition.clone()
          predictedDate = candidateDate
          interceptTimeSeconds = candidateSeconds
          aimPosition = candidatePosition.clone()
          converged = true
          status =
            currentPosition.distanceTo(candidatePosition) > MIN_TARGET_MOTION_AU
              ? 'future-intercept'
              : 'current-position'
          break
        }

        lastUsableCandidateSeconds = candidateSeconds
        lastUsablePosition = candidatePosition.clone()
        lastUsableDate = candidateDate
        candidateSeconds = nextSeconds
      }

      if (!converged && iterations === capabilities.maxInterceptIterations) {
        if (lastUsablePosition && lastUsableCandidateSeconds !== null) {
          predictedPosition = lastUsablePosition
          predictedDate = lastUsableDate
          interceptTimeSeconds = lastUsableCandidateSeconds
          aimPosition = lastUsablePosition.clone()
          status = 'intercept-overrun'
        } else {
          status = 'no-solution'
        }
      }
    }
  }

  if (planningSpeedAuPerSec < capabilities.minimumPlanningSpeedAuPerSec) {
    predictedPosition = currentPosition.clone()
  }

  const route = planRoute(
    shipPosition,
    aimPosition,
    shipForward,
    planningSpeedAuPerSec,
  )

  return {
    destinationId,
    status,
    destination: {
      currentPosition: currentPosition.clone(),
      predictedPosition: predictedPosition.clone(),
      predictedDate: predictedDate ? new Date(predictedDate) : null,
      estimatedVelocityAuPerSec,
    },
    guidance: {
      aimPosition: aimPosition.clone(),
      direction: route.directionToTarget,
      bearingAngleDeg: route.bearingAngleDeg,
      requiredArrivalVelocity: computeArrivalVelocity(
        destinationId,
        predictedDate ?? date,
        resolveDestinationPosition,
      ),
    },
    travel: {
      currentDistanceAu,
      plannedDistanceAu: route.distanceAu,
      etaDays: route.etaDays,
      interceptTimeSeconds,
      targetMotionDuringInterceptAu: currentPosition.distanceTo(aimPosition),
      planningSpeedAuPerSec,
    },
    solver: {
      iterations,
      solutionErrorSeconds,
    },
  }
}

function estimateTargetVelocity(
  destinationId: string,
  date: Date,
  resolveDestinationPosition: (destinationId: string, date: Date) => Vector3,
  sampleSeconds: number,
): Vector3 {
  if (sampleSeconds <= 0) {
    return new Vector3(0, 0, 0)
  }

  const current = resolveDestinationPosition(destinationId, date).clone()
  const sampled = resolveDestinationPosition(
    destinationId,
    addSeconds(date, sampleSeconds),
  ).clone()

  return sampled.sub(current).divideScalar(sampleSeconds)
}

function computeArrivalVelocity(
  destinationId: string,
  date: Date,
  resolveDestinationPosition: (destinationId: string, date: Date) => Vector3,
): Vector3 {
  const current = resolveDestinationPosition(destinationId, date).clone()
  const next = resolveDestinationPosition(
    destinationId,
    addSeconds(date, 1),
  ).clone()

  return next.sub(current)
}

export function solveConstantSpeedInterceptTime(
  shipPosition: Vector3,
  targetPosition: Vector3,
  targetVelocity: Vector3,
  shipSpeedAuPerSec: number,
  maxLookaheadSeconds: number,
): number | null {
  const relativePosition = new Vector3().subVectors(
    targetPosition,
    shipPosition,
  )

  if (relativePosition.lengthSq() <= QUADRATIC_EPSILON) {
    return 0
  }

  const speedSquared = shipSpeedAuPerSec * shipSpeedAuPerSec
  const a = targetVelocity.lengthSq() - speedSquared
  const b = 2 * relativePosition.dot(targetVelocity)
  const c = relativePosition.lengthSq()

  if (Math.abs(a) <= QUADRATIC_EPSILON) {
    if (Math.abs(b) <= QUADRATIC_EPSILON) {
      return null
    }

    const linearRoot = -c / b
    return isPositiveFiniteWithinHorizon(linearRoot, maxLookaheadSeconds)
      ? linearRoot
      : null
  }

  const discriminant = b * b - 4 * a * c

  if (discriminant < 0) {
    return null
  }

  const sqrtDiscriminant = Math.sqrt(discriminant)
  const roots = [
    (-b - sqrtDiscriminant) / (2 * a),
    (-b + sqrtDiscriminant) / (2 * a),
  ]
    .filter((root) => isPositiveFiniteWithinHorizon(root, maxLookaheadSeconds))
    .sort((left, right) => left - right)

  return roots[0] ?? null
}

function isPositiveFiniteWithinHorizon(
  value: number,
  maxLookaheadSeconds: number,
): boolean {
  return Number.isFinite(value) && value >= 0 && value <= maxLookaheadSeconds
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000)
}
