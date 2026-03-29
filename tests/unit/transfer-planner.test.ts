import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { planTransfer } from '../../src/simulation/transfer-planner'

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

    expect(plan.status).toBe('no-solution')
    expect(plan.guidance.aimPosition.x).toBeCloseTo(10)
    expect(plan.travel.interceptTimeSeconds).toBeNull()
    expect(plan.travel.etaDays).toBeCloseTo(10 / 86_400)
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
