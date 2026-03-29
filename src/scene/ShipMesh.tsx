import { forwardRef } from 'react'
import { Group } from 'three'

import { INITIAL_SHIP_POSITION, SHIP_SCALE_AU } from '../simulation/physics'

/**
 * Player ship geometry. Position and rotation are driven imperatively each
 * frame by `useShipPhysics` via the forwarded `Group` ref.
 */
export const ShipMesh = forwardRef<Group>(function ShipMesh(_, ref) {
  return (
    <group position={INITIAL_SHIP_POSITION} ref={ref} scale={SHIP_SCALE_AU}>
      <mesh>
        <boxGeometry args={[1.6, 0.55, 0.75]} />
        <meshPhongMaterial color="#b7c6d8" shininess={80} />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[0.72, 0.3, 0.38]} />
        <meshPhongMaterial
          color="#6ec2ff"
          emissive="#0d2d4f"
          emissiveIntensity={0.4}
        />
      </mesh>
      <mesh position={[1.05, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.34, 0.9, 4]} />
        <meshPhongMaterial color="#d9a76d" shininess={40} />
      </mesh>
      <mesh position={[-0.2, -0.24, 0.42]}>
        <boxGeometry args={[0.7, 0.18, 0.18]} />
        <meshPhongMaterial color="#7b8ba1" />
      </mesh>
      <mesh position={[-0.2, -0.24, -0.42]}>
        <boxGeometry args={[0.7, 0.18, 0.18]} />
        <meshPhongMaterial color="#7b8ba1" />
      </mesh>
      <mesh position={[-0.98, 0, 0]}>
        <icosahedronGeometry args={[0.16, 1]} />
        <meshBasicMaterial color="#6ec8ff" opacity={0.92} transparent />
      </mesh>
    </group>
  )
})
