import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Vector3 } from 'three'

import type { ShipState } from '../simulation/physics'

/**
 * Drives the chase camera to follow the ship each frame.
 * Must be registered after `useShipPhysics` so its `useFrame` fires after
 * ship orientation has been updated for the current tick.
 */
export function useCameraFollow(
  shipStateRef: React.RefObject<ShipState>,
  forwardRef: React.RefObject<Vector3>,
  upRef: React.RefObject<Vector3>,
): void {
  const cameraOffset = useRef(new Vector3())
  const lookTarget = useRef(new Vector3())

  useFrame(({ camera }) => {
    const shipState = shipStateRef.current
    const forward = forwardRef.current
    const up = upRef.current

    cameraOffset.current
      .copy(forward)
      .multiplyScalar(-shipState.chaseDistance)
      .addScaledVector(up, shipState.chaseDistance * 0.3)

    camera.position.copy(shipState.position).add(cameraOffset.current)
    lookTarget.current
      .copy(shipState.position)
      .addScaledVector(forward, shipState.chaseDistance * 1.6)
    camera.lookAt(lookTarget.current)
  })
}
