import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Quaternion, Vector3 } from 'three'

import {
  createIdleShipControls,
  createInitialShipState,
  stepShipPhysics,
  type ShipControlInput,
  type ShipState,
} from '../simulation/physics'

export type ShipPhysicsRefs = {
  shipStateRef: React.RefObject<ShipState>
  shipRef: React.RefObject<Group | null>
  forwardRef: React.RefObject<Vector3>
  rightRef: React.RefObject<Vector3>
  upRef: React.RefObject<Vector3>
  shipQuaternionRef: React.RefObject<Quaternion>
}

/**
 * Manages ship physics each frame. Reads the current command input, calls
 * `stepShipPhysics`, and updates the ship mesh position and rotation.
 *
 * Returns refs that the camera hook and scene orchestrator can read.
 */
export function useShipPhysics(
  controlInputRef: React.RefObject<ShipControlInput>,
): ShipPhysicsRefs {
  const shipStateRef = useRef<ShipState>(createInitialShipState())
  const shipRef = useRef<Group>(null)
  const forwardRef = useRef(new Vector3())
  const rightRef = useRef(new Vector3())
  const upRef = useRef(new Vector3())
  const shipQuaternionRef = useRef(new Quaternion())

  useFrame((_, delta) => {
    const realDelta = Math.min(delta, 0.05)
    const result = stepShipPhysics(
      shipStateRef.current,
      controlInputRef.current ?? createIdleShipControls(),
      realDelta,
    )

    shipQuaternionRef.current.copy(result.quaternion)
    forwardRef.current.copy(result.forward)
    rightRef.current.copy(result.right)
    upRef.current.copy(result.up)

    shipRef.current?.setRotationFromQuaternion(result.quaternion)
    shipRef.current?.position.copy(shipStateRef.current.position)
  }, -1)

  return {
    shipStateRef,
    shipRef,
    forwardRef,
    rightRef,
    upRef,
    shipQuaternionRef,
  }
}
