import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { DoubleSide, Mesh } from 'three'

import { SUN } from '../solar-data'

/**
 * Renders the sun sphere and corona ring. Rotates both independently each
 * frame as a purely cosmetic effect.
 */
export function SunMesh() {
  const sunRef = useRef<Mesh>(null)
  const coronaRef = useRef<Mesh>(null)

  useFrame((_, delta) => {
    const realDelta = Math.min(delta, 0.05)

    if (sunRef.current) {
      sunRef.current.rotation.y += realDelta * 0.08
    }

    if (coronaRef.current) {
      coronaRef.current.rotation.z += realDelta * 0.03
    }
  })

  return (
    <>
      <mesh ref={sunRef}>
        <sphereGeometry args={[SUN.displayRadiusAu, 48, 24]} />
        <meshPhongMaterial
          color={SUN.color}
          emissive={SUN.color}
          emissiveIntensity={1.3}
          shininess={5}
        />
      </mesh>

      <mesh ref={coronaRef} rotation-x={Math.PI / 2}>
        <ringGeometry
          args={[SUN.displayRadiusAu * 1.05, SUN.displayRadiusAu * 1.65, 96]}
        />
        <meshBasicMaterial
          color="#ffbf66"
          opacity={0.22}
          side={DoubleSide}
          transparent
        />
      </mesh>
    </>
  )
}
