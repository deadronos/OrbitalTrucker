import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { planTransfer, type TransferPlannerStatus } from '../../src/simulation/transfer-planner'

const BASE_DATE = new Date('2026-03-30T00:00:00.000Z')

describe('planTransfer', () => {
  it('falls back to the current position for stationary targets', () => {
    const plan = planTransfer({
      date: BASE_DATE,
      shipPosition: new Vector3(0, 0, 0),
      shipVelocity: new Vector3(2, 0, 0),
      shipForward: new Vector3(1, 0, 0),
      destinationId: 'stationary',
      resolveDestinationPosition: () => new Vector3(12, 0, 0),
    })

    expect(plan.status).toBe('current-position')
    expect(plan.guidance.aimPosition.x).toBeCloseTo(12)
    expect(plan.travel.currentDistanceAu).toBeCloseTo(12)
    expect(plan.travel.plannedDistanceAu).toBeCloseTo(12)
    expect(plan.travel.interceptTimeSeconds).toBeCloseTo(6)
  })

  it('predicts a future intercept for a linearly moving target', () => {
    const plan = planTransfer({
      date: BASE_DATE,
      shipPosition: new Vector3(0, 0, 0),
      shipVelocity: new Vector3(2, 0, 0),
      shipForward: new Vector3(1, 0, 0),
      destinationId: 'runner',
      resolveDestinationPosition: createLinearResolver({
        runner: {
          start: new Vector3(10, 0, 0),
          velocity: new Vector3(1, 0, 0),
        },
      }),
      shipCapabilities: {
        targetVelocitySampleSeconds: 1,
        maxInterceptIterations: 4,
        interceptConvergenceSeconds: 1e-6,
      },
    })

    expect(plan.status).toBe('future-intercept')
    expect(plan.travel.interceptTimeSeconds).toBeCloseTo(10, 5)
    expect(plan.destination.predictedPosition.x).toBeCloseTo(20, 5)
    expect(plan.guidance.aimPosition.x).toBeCloseTo(20, 5)
    expect(plan.travel.targetMotionDuringInterceptAu).toBeCloseTo(10, 5)
  })

  it('uses capability-provided cruise speed when the ship is currently stationary', () => {
    const plan = planTransfer({
      date: BASE_DATE,
      shipPosition: new Vector3(0, 0, 0),
      shipVelocity: new Vector3(0, 0, 0),
      shipForward: new Vector3(1, 0, 0),
      destinationId: 'runner',
      resolveDestinationPosition: createLinearResolver({
        runner: {
          start: new Vector3(10, 0, 0),
          velocity: new Vector3(1, 0, 0),
        },
      }),
      shipCapabilities: {
        assumedCruiseSpeedAuPerSec: 2,
        targetVelocitySampleSeconds: 1,
        maxInterceptIterations: 4,
        interceptConvergenceSeconds: 1e-6,
      },
    })

    expect(plan.status).toBe('future-intercept')
    expect(plan.travel.planningSpeedAuPerSec).toBeCloseTo(2)
    expect(plan.travel.etaDays).not.toBeNull()
  })

  it('falls back when the target outruns the ship', () => {
    const plan = planTransfer({
      date: BASE_DATE,
      shipPosition: new Vector3(0, 0, 0),
      shipVelocity: new Vector3(1, 0, 0),
      shipForward: new Vector3(1, 0, 0),
      destinationId: 'unreachable',
      resolveDestinationPosition: createLinearResolver({
        unreachable: {
          start: new Vector3(10, 0, 0),
          velocity: new Vector3(2, 0, 0),
        },
      }),
      shipCapabilities: {
        targetVelocitySampleSeconds: 1,
      },
    })

    // Under the 5-state model (issue #52), an outrunnable target
    // produces `lead-chase`: the planner returns a lead-pursuit aim
    // computed from the current position and the target's estimated
    // velocity, rather than `no-solution` which is reserved for cases
    // where no aim can be produced at all.
    expect(plan.status).toBe('lead-chase')
    expect(plan.guidance.aimPosition.x).toBeGreaterThan(10)
    expect(plan.travel.interceptTimeSeconds).not.toBeNull()
    expect(plan.travel.etaDays).not.toBeNull()
  })

  it('reports the target velocity at the predicted intercept time', () => {
    const plan = planTransfer({
      date: BASE_DATE,
      shipPosition: new Vector3(0, 0, 0),
      shipVelocity: new Vector3(2, 0, 0),
      shipForward: new Vector3(1, 0, 0),
      destinationId: 'runner',
      resolveDestinationPosition: createLinearResolver({
        runner: {
          start: new Vector3(10, 0, 0),
          velocity: new Vector3(1, 0, 0),
        },
      }),
      shipCapabilities: {
        targetVelocitySampleSeconds: 1,
        maxInterceptIterations: 4,
        interceptConvergenceSeconds: 1e-6,
      },
    })

    expect(plan.status).toBe('future-intercept')
    expect(plan.guidance.requiredArrivalVelocity.x).toBeCloseTo(1, 6)
    expect(plan.guidance.requiredArrivalVelocity.y).toBeCloseTo(0, 6)
    expect(plan.guidance.requiredArrivalVelocity.z).toBeCloseTo(0, 6)
  })

  it('reports intercept-overrun when the lookahead horizon is exceeded with a last-usable candidate', () => {
    // Use a tight lookahead horizon (~432 s) and a fast circular
    // orbit so the curve-resolved iteration's refinement of the
    // candidate time pushes the candidate past the horizon on the
    // second iteration. The last-usable candidate (iteration 1) is
    // then reported as `intercept-overrun`.
    //
    // The ship is placed OUTSIDE the target's orbit so the target's
    // curved path actually takes it further from the ship than the
    // constant-velocity chord predicts, allowing the curve-resolved
    // iteration's next candidate to exceed the horizon.
    const resolver = createCircularOrbitResolver('mars', 1.52, 0.05, 0)
    const plan = planTransfer({
      date: BASE_DATE,
      shipPosition: new Vector3(2.0, 0, 0),
      shipVelocity: new Vector3(0, 0, 0),
      shipForward: new Vector3(1, 0, 0),
      destinationId: 'mars',
      resolveDestinationPosition: resolver,
      shipCapabilities: {
        assumedCruiseSpeedAuPerSec: 0.003, // seed ≈ 160 s, < horizon
        targetVelocitySampleSeconds: 1,
        maxInterceptLookaheadDays: 0.005, // ~432 s
        maxInterceptIterations: 4,
        interceptConvergenceSeconds: 1e-6,
      },
    })

    expect(plan.status).toBe('intercept-overrun')
    expect(plan.guidance.aimPosition.x).not.toBe(0)
    expect(plan.destination.predictedDate).not.toBeNull()
  })

  it('reports lead-chase when the quadratic seed has no valid root', () => {
    const plan = planTransfer({
      date: BASE_DATE,
      shipPosition: new Vector3(0, 0, 0),
      shipVelocity: new Vector3(0.1, 0, 0),
      shipForward: new Vector3(1, 0, 0),
      destinationId: 'jumper',
      resolveDestinationPosition: createLinearResolver({
        jumper: {
          start: new Vector3(0.05, 0, 0),
          velocity: new Vector3(1e6, 0, 0), // astronomical
        },
      }),
      shipCapabilities: {
        targetVelocitySampleSeconds: 1,
        maxInterceptIterations: 1,
        interceptConvergenceSeconds: 1e-6,
      },
    })

    expect(plan.status).toBe('lead-chase')
    expect(plan.guidance.aimPosition.x).toBeGreaterThan(0.05)
  })

  it('converges on a circular-orbit target using the curve-resolver directly', () => {
    // Mars-like orbit: ~1.52 AU radius, ~687 day period, phase at 0.
    const resolver = createCircularOrbitResolver('mars', 1.52, 687, 0)
    const plan = planTransfer({
      date: BASE_DATE,
      shipPosition: new Vector3(1.04, 0, 0), // Earth-ish
      shipVelocity: new Vector3(0, 0, 0),
      shipForward: new Vector3(1, 0, 0),
      destinationId: 'mars',
      resolveDestinationPosition: resolver,
      shipCapabilities: {
        assumedCruiseSpeedAuPerSec: 0.001, // 1 mAU/s, ~86 AU/day
        targetVelocitySampleSeconds: 1,
        maxInterceptIterations: 8,
        interceptConvergenceSeconds: 0.5,
      },
    })

    expect(plan.status).toBe('future-intercept')
    expect(plan.destination.predictedDate).not.toBeNull()
    if (plan.destination.predictedDate) {
      // The predicted position must be on the curve at the predicted
      // date, not the constant-velocity extrapolation.
      const curvePositionAtPredicted = resolver(
        'mars',
        plan.destination.predictedDate,
      )
      expect(
        plan.destination.predictedPosition.distanceTo(curvePositionAtPredicted),
      ).toBeLessThan(1e-6)
    }
  })

  it('retargets to a different intercept solution when the destination changes', () => {
    const resolveDestinationPosition = createLinearResolver({
      near: {
        start: new Vector3(10, 0, 0),
        velocity: new Vector3(1, 0, 0),
      },
      high: {
        start: new Vector3(0, 10, 0),
        velocity: new Vector3(0, 1, 0),
      },
    })

    const nearPlan = planTransfer({
      date: BASE_DATE,
      shipPosition: new Vector3(0, 0, 0),
      shipVelocity: new Vector3(2, 0, 0),
      shipForward: new Vector3(1, 0, 0),
      destinationId: 'near',
      resolveDestinationPosition,
      shipCapabilities: {
        targetVelocitySampleSeconds: 1,
        maxInterceptIterations: 4,
        interceptConvergenceSeconds: 1e-6,
      },
    })
    const highPlan = planTransfer({
      date: BASE_DATE,
      shipPosition: new Vector3(0, 0, 0),
      shipVelocity: new Vector3(0, 2, 0),
      shipForward: new Vector3(1, 0, 0),
      destinationId: 'high',
      resolveDestinationPosition,
      shipCapabilities: {
        targetVelocitySampleSeconds: 1,
        maxInterceptIterations: 4,
        interceptConvergenceSeconds: 1e-6,
      },
    })

    expect(nearPlan.status).toBe('future-intercept')
    expect(highPlan.status).toBe('future-intercept')
    expect(nearPlan.guidance.direction.x).toBeGreaterThan(0.99)
    expect(highPlan.guidance.direction.y).toBeGreaterThan(0.99)
    expect(nearPlan.guidance.aimPosition.x).not.toBeCloseTo(
      highPlan.guidance.aimPosition.x,
    )
    expect(nearPlan.guidance.aimPosition.y).not.toBeCloseTo(
      highPlan.guidance.aimPosition.y,
    )
  })

  it('exposes the five-state status enum to consumers', () => {
    // Compile-time check: this assignment must compile if and only if
    // every member of the enum is present in TransferPlannerStatus.
    const _status: TransferPlannerStatus[] = [
      'current-position',
      'future-intercept',
      'intercept-overrun',
      'lead-chase',
      'no-solution',
    ]
    expect(_status).toHaveLength(5)
  })
})

function createLinearResolver(
  targets: Record<string, { start: Vector3; velocity: Vector3 }>,
): (destinationId: string, date: Date) => Vector3 {
  return (destinationId, date) => {
    const target = targets[destinationId]

    if (!target) {
      return new Vector3(0, 0, 0)
    }

    const elapsedSeconds = (date.getTime() - BASE_DATE.getTime()) / 1000

    return target.start.clone().addScaledVector(target.velocity, elapsedSeconds)
  }
}

function createCircularOrbitResolver(
  destinationId: string,
  radiusAu: number,
  periodDays: number,
  phaseRad: number,
): (id: string, date: Date) => Vector3 {
  const angularSpeed = (2 * Math.PI) / (periodDays * 86_400)
  return (id, date) => {
    if (id !== destinationId) return new Vector3(0, 0, 0)
    const elapsedSeconds = (date.getTime() - BASE_DATE.getTime()) / 1000
    const angle = phaseRad + angularSpeed * elapsedSeconds
    return new Vector3(
      Math.cos(angle) * radiusAu,
      0,
      Math.sin(angle) * radiusAu,
    )
  }
}
