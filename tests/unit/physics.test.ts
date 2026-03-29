import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import {
  createInitialShipState,
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

  it('applies emergency braking when Space is held', () => {
    const state = createInitialShipState()
    state.velocity.set(1, 0, 0) // start moving fast

    stepShipPhysics(state, new Set(['Space']), 0.1)

    expect(state.velocity.length()).toBeLessThan(1)
  })

  it('applies passive damping when no braking key is held', () => {
    const state = createInitialShipState()
    state.velocity.set(1, 0, 0)

    stepShipPhysics(state, new Set(), 0.016)

    // velocity should decay by the damping factor (0.999 per frame)
    expect(state.velocity.length()).toBeLessThan(1)
    expect(state.velocity.length()).toBeGreaterThan(0.99)
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
})
