import { Stars } from '@react-three/drei'
import { useMemo } from 'react'
import { GridHelper } from 'three'

/**
 * Renders the static scene environment: background colour, ambient and point
 * lights, the star field, and the reference grid.
 */
export function SceneBackground() {
  const grid = useMemo(() => {
    const helper = new GridHelper(120, 24, '#31506d', '#18283b')
    const materials = Array.isArray(helper.material)
      ? helper.material
      : [helper.material]

    for (const material of materials) {
      material.transparent = true
      material.opacity = 0.22
    }

    return helper
  }, [])

  return (
    <>
      <color args={['#020409']} attach="background" />
      <ambientLight color="#7f95bd" intensity={0.22} />
      <pointLight
        color="#ffe7b3"
        decay={2}
        intensity={5.6}
        position={[0, 0, 0]}
      />
      <primitive object={grid} />
      <Stars
        count={5000}
        depth={3500}
        factor={7}
        fade
        radius={1800}
        saturation={0}
        speed={0.2}
      />
    </>
  )
}
