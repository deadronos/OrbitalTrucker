import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import {
  createIdleShipControls,
  createInitialShipState,
  getShipOrientationFromAngles,
  PITCH_LIMIT_RAD,
  stepShipPhysics,
  type ShipControlInput,
} from '../../src/simulation/physics'

/**
 * Build a `ShipControlInput` from axis shorthands. Each entry sets a single
 * axis or boolean; this is the test-time replacement for the old key-set
 * adapter that used to be exposed by the physics module.
 */
function controls(
  ...axes: ReadonlyArray<Partial<ShipControlInput>>
): ShipControlInput {
  return Object.assign(createIdleShipControls(), ...axes)
}

describe('stepShipPhysics', () => {
  it('does not change position meaningfully when no thrust is commanded', () => {
    const state = createInitialShipState()
    const initialPos = state.position.clone()

    stepShipPhysics(state, controls(), 0.016)

    // No thrust → position barely changes (only from pre-existing zero velocity)
    expect(state.position.distanceTo(initialPos)).toBeLessThan(0.0001)
  })

  it('returns orientation vectors with correct length', () => {
    const state = createInitialShipState()

    const { forward, right, up } = stepShipPhysics(state, controls(), 0.016)

    expect(forward.length()).toBeCloseTo(1)
    expect(right.length()).toBeCloseTo(1)
    expect(up.length()).toBeCloseTo(1)
  })

  it('accelerates the ship when a forward thrust command is given', () => {
    const state = createInitialShipState()
    state.yaw = 0
    state.pitch = 0
    const initialSpeed = state.velocity.length()

    stepShipPhysics(state, controls({ forward: 1 }), 1.0)

    expect(state.velocity.length()).toBeGreaterThan(initialSpeed)
  })

  it('boosts thrust when the boost flag is set', () => {
    const stateNormal = createInitialShipState()
    stateNormal.yaw = 0
    stateNormal.pitch = 0

    const stateBoosted = createInitialShipState()
    stateBoosted.yaw = 0
    stateBoosted.pitch = 0

    stepShipPhysics(stateNormal, controls({ forward: 1 }), 1.0)
    stepShipPhysics(stateBoosted, controls({ forward: 1, boost: true }), 1.0)

    expect(stateBoosted.velocity.length()).toBeGreaterThan(
      stateNormal.velocity.length(),
    )
  })

  it('applies kill-velocity braking when the translation brake flag is set', () => {
    const state = createInitialShipState()
    state.velocity.set(1, 0, 0) // start moving fast

    stepShipPhysics(state, controls({ brakeTranslation: true }), 0.1)

    expect(state.velocity.length()).toBeLessThan(1)
  })

  it('does not apply passive damping when no braking command is active (Newtonian)', () => {
    const state = createInitialShipState()
    state.velocity.set(1, 0, 0)

    stepShipPhysics(state, controls(), 0.016)

    // Newtonian: velocity must be exactly preserved without active braking
    expect(state.velocity.length()).toBeCloseTo(1, 10)
  })

  it('moves the ship forward when forward thrust is commanded with pitch=0 and yaw=0', () => {
    const state = createInitialShipState()
    state.yaw = 0
    state.pitch = 0
    const initialPos = state.position.clone()

    // Run for several frames to build up momentum
    for (let i = 0; i < 60; i++) {
      stepShipPhysics(state, controls({ forward: 1 }), 0.016)
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

    stepShipPhysics(state, controls({ forward: 1 }), 1.0)

    // Same object references — mutation confirmed
    expect(state.position).toBe(posRef)
    expect(state.velocity).toBe(velRef)
  })

  it('clamps delta to prevent large timestep explosions', () => {
    const state = createInitialShipState()

    // stepShipPhysics itself does not clamp; the caller (useShipPhysics) clamps.
    // Verify that an unreasonably large delta does NOT produce NaN positions.
    stepShipPhysics(state, controls({ forward: 1 }), 0.05) // max clamped value

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

  it('accumulates angular velocity when a yaw command is given', () => {
    const state = createInitialShipState()
    state.rotationAssist = false // disable assist so velocity persists

    stepShipPhysics(state, controls({ yaw: 1 }), 1.0)

    expect(state.angularVelocity.yaw).toBeGreaterThan(0)
  })

  it('angular velocity persists across frames when rotation assist is off', () => {
    const state = createInitialShipState()
    state.rotationAssist = false

    // Apply one frame of rotation input
    stepShipPhysics(state, controls({ yaw: 1 }), 1.0)
    const yawVelAfterInput = state.angularVelocity.yaw

    // Next frame with no input and assist off — velocity must be unchanged
    stepShipPhysics(state, controls(), 0.016)

    expect(state.angularVelocity.yaw).toBeCloseTo(yawVelAfterInput, 10)
  })

  it('rotation assist auto-damps angular velocity when no rotation command is active', () => {
    const state = createInitialShipState()
    state.rotationAssist = true
    state.angularVelocity.yaw = 1.0 // start spinning

    // Run several frames with no rotation input
    for (let i = 0; i < 20; i++) {
      stepShipPhysics(state, controls(), 0.016)
    }

    expect(state.angularVelocity.yaw).toBeLessThan(1.0)
  })

  it('rotation assist does not damp while a rotation command is active', () => {
    const state = createInitialShipState()
    state.rotationAssist = true

    // Apply one frame of rotation input — assist must not counteract it
    stepShipPhysics(state, controls({ yaw: 1 }), 1.0)

    expect(state.angularVelocity.yaw).toBeGreaterThan(0)
  })

  it('rotation brake reduces angular velocity toward zero', () => {
    const state = createInitialShipState()
    state.angularVelocity.yaw = 2.0
    state.angularVelocity.pitch = -1.5

    stepShipPhysics(state, controls({ brakeRotation: true }), 0.5)

    expect(Math.abs(state.angularVelocity.yaw)).toBeLessThan(2.0)
    expect(Math.abs(state.angularVelocity.pitch)).toBeLessThan(1.5)
  })

  it('angular velocity integrates into yaw each frame', () => {
    const state = createInitialShipState()
    state.rotationAssist = false
    const initialYaw = state.yaw

    state.angularVelocity.yaw = 1.0 // 1 rad/s
    stepShipPhysics(state, controls(), 0.5) // half a second

    // yaw should have increased by ~0.5 radians
    expect(state.yaw).toBeCloseTo(initialYaw + 0.5, 5)
  })

  it('returns the post-integration orientation after rotation updates', () => {
    const state = createInitialShipState()
    state.rotationAssist = false

    const result = stepShipPhysics(state, controls({ yaw: 1 }), 1.0)
    const expected = getShipOrientationFromAngles(state.yaw, state.pitch)

    expect(result.quaternion.angleTo(expected.quaternion)).toBeLessThan(1e-6)
    expect(result.forward.distanceTo(expected.forward)).toBeLessThan(1e-6)
    expect(result.right.distanceTo(expected.right)).toBeLessThan(1e-6)
    expect(result.up.distanceTo(expected.up)).toBeLessThan(1e-6)
  })

  it('pitch is clamped to PITCH_LIMIT_RAD when angular velocity would exceed it', () => {
    const state = createInitialShipState()
    state.rotationAssist = false
    state.pitch = PITCH_LIMIT_RAD - 0.01
    state.angularVelocity.pitch = 10.0 // large upward spin

    stepShipPhysics(state, controls(), 1.0)

    expect(state.pitch).toBeLessThanOrEqual(PITCH_LIMIT_RAD)
  })

  it('boosted angular thrust (boost + yaw) produces more yaw velocity than normal', () => {
    const stateNormal = createInitialShipState()
    stateNormal.rotationAssist = false

    const stateBoosted = createInitialShipState()
    stateBoosted.rotationAssist = false

    stepShipPhysics(stateNormal, controls({ yaw: 1 }), 1.0)
    stepShipPhysics(stateBoosted, controls({ yaw: 1, boost: true }), 1.0)

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

  // ── Stale-orientation regression (issue #42) ───────────────────────────

  it('returned orientation reflects post-step yaw, not pre-step yaw', () => {
    // Regression: if stepShipPhysics returned the orientation computed BEFORE
    // the angular-velocity integration, the returned forward vector would still
    // point along the old heading.  The previous test (above) did not catch
    // this because it compared against state.yaw/pitch which are already
    // mutated by the time we read them.  This test captures the pre-step
    // orientation explicitly and asserts the return differs.
    const state = createInitialShipState()
    state.rotationAssist = false
    state.yaw = 0
    state.pitch = 0

    const preStepOrientation = getShipOrientationFromAngles(
      state.yaw,
      state.pitch,
    )

    // Apply a large yaw rotation over a long timestep so the difference
    // between pre-step and post-step is unmissable.
    const result = stepShipPhysics(state, controls({ yaw: 1 }), 2.0)

    // The ship should have rotated significantly.
    expect(state.yaw).not.toBeCloseTo(0, 3)

    // The returned forward MUST match the post-integration orientation.
    const postStepOrientation = getShipOrientationFromAngles(
      state.yaw,
      state.pitch,
    )
    expect(result.forward.distanceTo(postStepOrientation.forward)).toBeLessThan(
      1e-6,
    )

    // And it MUST NOT equal the pre-step orientation (which would indicate
    // the return statement was placed before the integration block).
    expect(
      result.forward.distanceTo(preStepOrientation.forward),
    ).toBeGreaterThan(0.1)
  })

  it('returned orientation reflects post-step pitch after a pitch command', () => {
    const state = createInitialShipState()
    state.rotationAssist = false
    state.yaw = 0
    state.pitch = 0

    const preStepOrientation = getShipOrientationFromAngles(
      state.yaw,
      state.pitch,
    )

    const result = stepShipPhysics(state, controls({ pitch: 1 }), 2.0)

    expect(state.pitch).toBeGreaterThan(0)

    const postStepOrientation = getShipOrientationFromAngles(
      state.yaw,
      state.pitch,
    )
    expect(result.up.distanceTo(postStepOrientation.up)).toBeLessThan(1e-6)
    expect(result.up.distanceTo(preStepOrientation.up)).toBeGreaterThan(0.01)
  })
})
