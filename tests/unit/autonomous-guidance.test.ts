import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { computeAutonomousGuidance } from '../../src/simulation/autonomous-guidance'
import {
  createInitialShipState,
  getShipOrientationFromAngles,
  stepShipPhysics,
} from '../../src/simulation/physics'
import { planTransfer, type TransferPlannerResult } from '../../src/simulation/transfer-planner'

describe('computeAutonomousGuidance', () => {
  it('acquires heading before applying cruise thrust', () => {
    const state = createInitialShipState()
    state.yaw = 0
    state.pitch = 0

    const guidance = computeAutonomousGuidance(
      state,
      createPlan(new Vector3(0, 0, -1), 90, 1),
    )

    expect(guidance.phase).toBe('acquiring')
    expect(guidance.controls.forward).toBe(0)
    expect(guidance.controls.yaw).toBeGreaterThan(0)
  })

  it('cruises forward once aligned with the planner course', () => {
    const state = createInitialShipState()
    state.yaw = 0
    state.pitch = 0

    const guidance = computeAutonomousGuidance(
      state,
      createPlan(new Vector3(1, 0, 0), 0, 1.5),
    )

    expect(guidance.phase).toBe('cruising')
    expect(guidance.controls.forward).toBeGreaterThan(0.9)
    expect(guidance.controls.brakeTranslation).toBe(false)
  })

  it('treats pitch-aligned elevated targets as cruise-ready', () => {
    const state = createInitialShipState()
    state.yaw = 0
    state.pitch = Math.PI / 4

    const guidance = computeAutonomousGuidance(
      state,
      createPlan(new Vector3(1, 1, 0), 45, 1.5),
    )

    expect(guidance.phase).toBe('cruising')
    expect(guidance.alignmentErrorDeg).toBeLessThan(0.001)
    expect(guidance.controls.forward).toBeGreaterThan(0.49)
    expect(guidance.controls.up).toBeGreaterThan(0.49)
  })

  it('tapers cruise thrust as stopping distance approaches remaining range', () => {
    const state = createInitialShipState()
    state.yaw = 0
    state.pitch = 0
    state.velocity.set(Math.sqrt(2 * 0.000016 * 0.6), 0, 0)

    const guidance = computeAutonomousGuidance(
      state,
      createPlan(new Vector3(1, 0, 0), 0, 1),
    )

    expect(guidance.phase).toBe('cruising')
    expect(guidance.controls.forward).toBeGreaterThan(0)
    expect(guidance.controls.forward).toBeLessThan(0.7)
    expect(guidance.controls.brakeTranslation).toBe(false)
  })

  it('switches to braking when the ship is moving too fast for the remaining range', () => {
    const state = createInitialShipState()
    state.yaw = 0
    state.pitch = 0
    state.velocity.set(0.00003, 0, 0)

    const guidance = computeAutonomousGuidance(
      state,
      createPlan(new Vector3(1, 0, 0), 0, 0.00002),
    )

    expect(guidance.phase).toBe('braking')
    expect(guidance.controls.brakeTranslation).toBe(true)
  })

  it('holds station once effectively arrived', () => {
    const state = createInitialShipState()
    state.yaw = 0
    state.pitch = 0
    state.velocity.set(1e-7, 0, 0)

    const guidance = computeAutonomousGuidance(
      state,
      createPlan(new Vector3(1, 0, 0), 0, 0.0004),
    )

    expect(guidance.phase).toBe('arrived')
    expect(guidance.controls.brakeTranslation).toBe(true)
    expect(guidance.controls.brakeRotation).toBe(true)
  })

  it('changes steering command when the destination changes', () => {
    const state = createInitialShipState()
    state.yaw = 0
    state.pitch = 0

    const initialGuidance = computeAutonomousGuidance(
      state,
      createPlan(new Vector3(1, 0, 0), 0, 1),
    )
    const retargetedGuidance = computeAutonomousGuidance(
      state,
      createPlan(new Vector3(0, 0, -1), 90, 1),
    )

    expect(initialGuidance.controls.yaw).toBe(0)
    expect(retargetedGuidance.controls.yaw).toBeGreaterThan(0)
  })
})

describe('autonomous guidance with ship physics', () => {
  it('reduces range to a static destination when guidance commands the backend', () => {
    const state = createInitialShipState()
    state.position.set(0, 0, 0)
    state.velocity.set(0, 0, 0)
    state.yaw = 0
    state.pitch = 0

    const target = new Vector3(0.2, 0, 0)
    const initialDistance = state.position.distanceTo(target)
    let previousPhase: ReturnType<typeof computeAutonomousGuidance>['phase'] | undefined

    for (let step = 0; step < 180; step += 1) {
      const { forward } = getShipOrientationFromAngles(state.yaw, state.pitch)
      const plan = planTransfer({
        date: new Date('2026-03-29T00:00:00.000Z'),
        shipPosition: state.position,
        shipVelocity: state.velocity,
        shipForward: forward,
        destinationId: 'target',
        resolveDestinationPosition: () => target.clone(),
      })
      const guidance = computeAutonomousGuidance(state, plan, previousPhase)
      previousPhase = guidance.phase

      stepShipPhysics(state, guidance.controls, 0.016)
    }

    expect(state.position.distanceTo(target)).toBeLessThan(initialDistance)
  })

  it('reduces range to an elevated destination after turning onto the course', () => {
    const state = createInitialShipState()
    state.position.set(0, 0, 0)
    state.velocity.set(0, 0, 0)
    state.yaw = -Math.PI / 2
    state.pitch = 0

    const target = new Vector3(0.2, 0.05, 0)
    const initialDistance = state.position.distanceTo(target)
    let previousPhase: ReturnType<typeof computeAutonomousGuidance>['phase'] | undefined

    for (let step = 0; step < 720; step += 1) {
      const { forward } = getShipOrientationFromAngles(state.yaw, state.pitch)
      const plan = planTransfer({
        date: new Date('2026-03-29T00:00:00.000Z'),
        shipPosition: state.position,
        shipVelocity: state.velocity,
        shipForward: forward,
        destinationId: 'target',
        resolveDestinationPosition: () => target.clone(),
      })
      const guidance = computeAutonomousGuidance(state, plan, previousPhase)
      previousPhase = guidance.phase

      stepShipPhysics(state, guidance.controls, 0.016)
    }

    expect(state.position.distanceTo(target)).toBeLessThan(initialDistance)
    expect(state.velocity.length()).toBeGreaterThan(0)
  })

  it('approaches a straight-in destination without excessive brake chatter', () => {
    const state = createInitialShipState()
    state.position.set(0, 0, 0)
    state.velocity.set(0, 0, 0)
    state.yaw = 0
    state.pitch = 0

    const target = new Vector3(0.2, 0, 0)
    let previousPhase: ReturnType<typeof computeAutonomousGuidance>['phase'] | undefined
    let cruiseBrakeTransitions = 0
    let arrived = false

    for (let step = 0; step < 20_000; step += 1) {
      const { forward } = getShipOrientationFromAngles(state.yaw, state.pitch)
      const plan = planTransfer({
        date: new Date('2026-03-29T00:00:00.000Z'),
        shipPosition: state.position,
        shipVelocity: state.velocity,
        shipForward: forward,
        destinationId: 'target',
        resolveDestinationPosition: () => target.clone(),
      })
      const guidance = computeAutonomousGuidance(
        state,
        plan,
        previousPhase,
      )

      if (
        previousPhase &&
        previousPhase !== guidance.phase &&
        ((previousPhase === 'cruising' && guidance.phase === 'braking') ||
          (previousPhase === 'braking' && guidance.phase === 'cruising'))
      ) {
        cruiseBrakeTransitions += 1
      }

      previousPhase = guidance.phase

      if (guidance.phase === 'arrived') {
        arrived = true
        break
      }

      stepShipPhysics(state, guidance.controls, 0.016)
    }

    expect(arrived).toBe(true)
    expect(cruiseBrakeTransitions).toBeLessThan(200)
  })
})

function createPlan(
  direction: Vector3,
  bearingAngleDeg: number,
  plannedDistanceAu: number,
): TransferPlannerResult {
  const aimPosition = direction.clone().normalize().multiplyScalar(plannedDistanceAu)

  return {
    destinationId: 'target',
    status: 'future-intercept',
    destination: {
      currentPosition: aimPosition.clone(),
      predictedPosition: aimPosition.clone(),
      predictedDate: new Date('2026-03-30T00:00:00.000Z'),
      estimatedVelocityAuPerSec: new Vector3(0, 0, 0),
    },
    guidance: {
      aimPosition,
      direction: direction.clone().normalize(),
      bearingAngleDeg,
    },
    travel: {
      currentDistanceAu: plannedDistanceAu,
      plannedDistanceAu,
      etaDays: null,
      interceptTimeSeconds: null,
      targetMotionDuringInterceptAu: 0,
      planningSpeedAuPerSec: 0,
    },
    solver: {
      iterations: 1,
      solutionErrorSeconds: null,
    },
  }
}
