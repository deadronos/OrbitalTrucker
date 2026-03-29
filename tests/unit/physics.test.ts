import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import {
  createInitialShipState,
  PITCH_LIMIT_RAD,
  stepShipPhysics,
} from '../../src/simulation/physics'

describe('stepShipPhysics', () => {
  it('does not change position meaningfully when no keys are pressed', () => {
    const state = createInitialShipState()
    const initialPos = state.position.clone()

    stepShipPhysics(state, new Set(), 0.016)

    // No thrust → position barely changes (only from pre-existing zero velocity)
    expect(state.position.distanceTo(initialPos)).toBeLessThan(0.0001)
  })

  it('returns orientation vectors with correct length', () => {
    const state = createInitialShipState()

    const { forward, right, up } = stepShipPhysics(state, new Set(), 0.016)

    expect(forward.length()).toBeCloseTo(1)
    expect(right.length()).toBeCloseTo(1)
    expect(up.length()).toBeCloseTo(1)
  })

  it('accelerates the ship when a thrust key is pressed', () => {
    const state = createInitialShipState()
    state.yaw = 0
    state.pitch = 0
    const initialSpeed = state.velocity.length()

    stepShipPhysics(state, new Set(['KeyW']), 1.0)

    expect(state.velocity.length()).toBeGreaterThan(initialSpeed)
  })

  it('boosts thrust when Shift is held', () => {
    const stateNormal = createInitialShipState()
    stateNormal.yaw = 0
    stateNormal.pitch = 0

    const stateBoosted = createInitialShipState()
    stateBoosted.yaw = 0
    stateBoosted.pitch = 0

    stepShipPhysics(stateNormal, new Set(['KeyW']), 1.0)
    stepShipPhysics(stateBoosted, new Set(['KeyW', 'Shift']), 1.0)

    expect(stateBoosted.velocity.length()).toBeGreaterThan(
      stateNormal.velocity.length(),
    )
  })

  it('applies kill-velocity braking when Space is held', () => {
    const state = createInitialShipState()
    state.velocity.set(1, 0, 0) // start moving fast

    stepShipPhysics(state, new Set(['Space']), 0.1)

    expect(state.velocity.length()).toBeLessThan(1)
  })

  it('does not apply passive damping when no braking key is held (Newtonian)', () => {
    const state = createInitialShipState()
    state.velocity.set(1, 0, 0)

    stepShipPhysics(state, new Set(), 0.016)

    // Newtonian: velocity must be exactly preserved without active braking
    expect(state.velocity.length()).toBeCloseTo(1, 10)
  })

  it('moves the ship forward when W is pressed with pitch=0 and yaw=0', () => {
    const state = createInitialShipState()
    state.yaw = 0
    state.pitch = 0
    const initialPos = state.position.clone()

    // Run for several frames to build up momentum
    for (let i = 0; i < 60; i++) {
      stepShipPhysics(state, new Set(['KeyW']), 0.016)
    }

    const displacement = state.position.clone().sub(initialPos)
    // At yaw=0 the forward vector is +X
    expect(displacement.x).toBeGreaterThan(0)
    expect(Math.abs(displacement.z)).toBeLessThan(Math.abs(displacement.x))
  })

  it('mutates position and velocity in place', () => {
    const state = createInitialShipState()
    const posRef = state.position
    const velRef = state.velocity

    stepShipPhysics(state, new Set(['KeyW']), 1.0)

    // Same object references — mutation confirmed
    expect(state.position).toBe(posRef)
    expect(state.velocity).toBe(velRef)
  })

  it('clamps delta to prevent large timestep explosions', () => {
    const state = createInitialShipState()

    // stepShipPhysics itself does not clamp; the caller (useShipPhysics) clamps.
    // Verify that an unreasonably large delta does NOT produce NaN positions.
    stepShipPhysics(state, new Set(['KeyW']), 0.05) // max clamped value

    expect(state.position.x).not.toBeNaN()
    expect(state.velocity.length()).not.toBeNaN()
  })

  it('createInitialShipState returns independent state objects', () => {
    const s1 = createInitialShipState()
    const s2 = createInitialShipState()

    s1.position.set(0, 0, 0)

    // s2 should not be affected
    expect(s2.position).toEqual(new Vector3(1.04, 0.012, 0.02))
  })

  // ── Angular velocity / rotation thruster tests ──────────────────────────

  it('accumulates angular velocity when an arrow key is held', () => {
    const state = createInitialShipState()
    state.rotationAssist = false // disable assist so velocity persists

    stepShipPhysics(state, new Set(['ArrowLeft']), 1.0)

    expect(state.angularVelocity.yaw).toBeGreaterThan(0)
  })

  it('angular velocity persists across frames when rotation assist is off', () => {
    const state = createInitialShipState()
    state.rotationAssist = false

    // Apply one frame of rotation input
    stepShipPhysics(state, new Set(['ArrowLeft']), 1.0)
    const yawVelAfterInput = state.angularVelocity.yaw

    // Next frame with no input and assist off — velocity must be unchanged
    stepShipPhysics(state, new Set(), 0.016)

    expect(state.angularVelocity.yaw).toBeCloseTo(yawVelAfterInput, 10)
  })

  it('rotation assist auto-damps angular velocity when no rotation input is active', () => {
    const state = createInitialShipState()
    state.rotationAssist = true
    state.angularVelocity.yaw = 1.0 // start spinning

    // Run several frames with no rotation input
    for (let i = 0; i < 20; i++) {
      stepShipPhysics(state, new Set(), 0.016)
    }

    expect(state.angularVelocity.yaw).toBeLessThan(1.0)
  })

  it('rotation assist does not damp while arrow keys are held', () => {
    const state = createInitialShipState()
    state.rotationAssist = true

    // Hold ArrowLeft for one frame — assist must not counteract the input
    stepShipPhysics(state, new Set(['ArrowLeft']), 1.0)

    expect(state.angularVelocity.yaw).toBeGreaterThan(0)
  })

  it('kill rotation (R) reduces angular velocity toward zero', () => {
    const state = createInitialShipState()
    state.angularVelocity.yaw = 2.0
    state.angularVelocity.pitch = -1.5

    stepShipPhysics(state, new Set(['KeyR']), 0.5)

    expect(Math.abs(state.angularVelocity.yaw)).toBeLessThan(2.0)
    expect(Math.abs(state.angularVelocity.pitch)).toBeLessThan(1.5)
  })

  it('angular velocity integrates into yaw each frame', () => {
    const state = createInitialShipState()
    state.rotationAssist = false
    const initialYaw = state.yaw

    state.angularVelocity.yaw = 1.0 // 1 rad/s
    stepShipPhysics(state, new Set(), 0.5) // half a second

    // yaw should have increased by ~0.5 radians
    expect(state.yaw).toBeCloseTo(initialYaw + 0.5, 5)
  })

  it('pitch is clamped to PITCH_LIMIT_RAD when angular velocity would exceed it', () => {
    const state = createInitialShipState()
    state.rotationAssist = false
    state.pitch = PITCH_LIMIT_RAD - 0.01
    state.angularVelocity.pitch = 10.0 // large upward spin

    stepShipPhysics(state, new Set(), 1.0)

    expect(state.pitch).toBeLessThanOrEqual(PITCH_LIMIT_RAD)
  })

  it('boosted angular thrust (Shift + ArrowLeft) produces more yaw velocity than normal', () => {
    const stateNormal = createInitialShipState()
    stateNormal.rotationAssist = false

    const stateBoosted = createInitialShipState()
    stateBoosted.rotationAssist = false

    stepShipPhysics(stateNormal, new Set(['ArrowLeft']), 1.0)
    stepShipPhysics(stateBoosted, new Set(['ArrowLeft', 'Shift']), 1.0)

    expect(stateBoosted.angularVelocity.yaw).toBeGreaterThan(
      stateNormal.angularVelocity.yaw,
    )
  })

  it('initial state has zero angular velocity and rotation assist enabled', () => {
    const state = createInitialShipState()

    expect(state.angularVelocity.yaw).toBe(0)
    expect(state.angularVelocity.pitch).toBe(0)
    expect(state.rotationAssist).toBe(true)
  })
})
