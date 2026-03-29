import { Euler, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { directionToYawPitch, planRoute } from '../../src/simulation/trajectory'

describe('planRoute', () => {
  it('returns the correct direction to a target directly ahead', () => {
    const shipPosition = new Vector3(0, 0, 0)
    const targetPosition = new Vector3(5, 0, 0)
    const shipForward = new Vector3(1, 0, 0)

    const plan = planRoute(shipPosition, targetPosition, shipForward, 0)

    expect(plan.directionToTarget.x).toBeCloseTo(1)
    expect(plan.directionToTarget.y).toBeCloseTo(0)
    expect(plan.directionToTarget.z).toBeCloseTo(0)
    expect(plan.bearingAngleDeg).toBeCloseTo(0)
    expect(plan.distanceAu).toBeCloseTo(5)
  })

  it('returns 180° bearing when ship faces away from the target', () => {
    const shipPosition = new Vector3(0, 0, 0)
    const targetPosition = new Vector3(1, 0, 0)
    const shipForward = new Vector3(-1, 0, 0) // pointing away

    const plan = planRoute(shipPosition, targetPosition, shipForward, 0)

    expect(plan.bearingAngleDeg).toBeCloseTo(180)
  })

  it('returns 90° bearing when ship points perpendicular to the target', () => {
    const shipPosition = new Vector3(0, 0, 0)
    const targetPosition = new Vector3(1, 0, 0)
    const shipForward = new Vector3(0, 1, 0) // perpendicular

    const plan = planRoute(shipPosition, targetPosition, shipForward, 0)

    expect(plan.bearingAngleDeg).toBeCloseTo(90)
  })

  it('returns null ETA when ship is stationary', () => {
    const plan = planRoute(
      new Vector3(0, 0, 0),
      new Vector3(1, 0, 0),
      new Vector3(1, 0, 0),
      0,
    )

    expect(plan.etaDays).toBeNull()
  })

  it('computes ETA correctly for a known speed and distance', () => {
    // distance = 1 AU, speed = 1 AU/s → 1 second → 1/86400 days
    const plan = planRoute(
      new Vector3(0, 0, 0),
      new Vector3(1, 0, 0),
      new Vector3(1, 0, 0),
      1, // 1 AU/s
    )

    expect(plan.etaDays).not.toBeNull()
    expect(plan.etaDays).toBeCloseTo(1 / 86_400)
  })

  it('returns a safe fallback direction when ship is on top of the target', () => {
    const plan = planRoute(
      new Vector3(1, 1, 1),
      new Vector3(1, 1, 1), // same position
      new Vector3(1, 0, 0),
      0,
    )

    // Should not throw; direction falls back to +X
    expect(plan.directionToTarget.length()).toBeCloseTo(1)
    expect(plan.distanceAu).toBe(0)
  })

  it('does not mutate the input vectors', () => {
    const shipPosition = new Vector3(0, 0, 0)
    const targetPosition = new Vector3(3, 0, 0)
    const shipForward = new Vector3(1, 0, 0)

    const origShip = shipPosition.clone()
    const origTarget = targetPosition.clone()
    const origForward = shipForward.clone()

    planRoute(shipPosition, targetPosition, shipForward, 0.5)

    expect(shipPosition).toEqual(origShip)
    expect(targetPosition).toEqual(origTarget)
    expect(shipForward).toEqual(origForward)
  })
})

describe('directionToYawPitch', () => {
  it('returns yaw=0 pitch=0 for the +X forward direction', () => {
    const { yaw, pitch } = directionToYawPitch(new Vector3(1, 0, 0))

    expect(yaw).toBeCloseTo(0)
    expect(pitch).toBeCloseTo(0)
  })

  it('returns yaw=−π/2 for the +Z direction (matching initial ship heading)', () => {
    // forward = [cos(yaw), 0, -sin(yaw)]; for [0,0,1]: -sin(yaw)=1 → yaw=-π/2
    const { yaw, pitch } = directionToYawPitch(new Vector3(0, 0, 1))

    expect(yaw).toBeCloseTo(-Math.PI / 2)
    expect(pitch).toBeCloseTo(0)
  })

  it('returns positive pitch for an upward-angled direction', () => {
    // direction [1, 1, 0] has elevation angle atan2(1, 1) = π/4 > 0
    const direction = new Vector3(1, 1, 0).normalize()
    const { pitch } = directionToYawPitch(direction)

    expect(pitch).toBeCloseTo(Math.PI / 4)
    expect(pitch).toBeGreaterThan(0)
  })

  it('returns pitch in range (−π/2, π/2)', () => {
    const { pitch: pitchUp } = directionToYawPitch(new Vector3(0, 1, 0))
    const { pitch: pitchDown } = directionToYawPitch(new Vector3(0, -1, 0))

    expect(Math.abs(pitchUp)).toBeLessThanOrEqual(Math.PI / 2 + 1e-6)
    expect(Math.abs(pitchDown)).toBeLessThanOrEqual(Math.PI / 2 + 1e-6)
  })

  it('sets yaw so the forward XZ projection points toward the target direction', () => {
    // forward = [cos(yaw), 0, -sin(yaw)] lies in XZ regardless of pitch.
    // The yaw should align the forward with the XZ projection of the direction.
    const original = new Vector3(0.6, 0.3, -0.7).normalize()
    const { yaw } = directionToYawPitch(original)

    const q = new Quaternion().setFromEuler(new Euler(0, yaw, 0, 'YXZ'))
    const forward = new Vector3(1, 0, 0).applyQuaternion(q)

    // The XZ-normalised direction of 'original' should match 'forward'
    const xzLen = Math.sqrt(original.x ** 2 + original.z ** 2)
    expect(forward.x).toBeCloseTo(original.x / xzLen, 4)
    expect(forward.z).toBeCloseTo(original.z / xzLen, 4)
  })
})
