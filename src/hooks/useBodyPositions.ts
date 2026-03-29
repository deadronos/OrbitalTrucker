import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Vector3 } from 'three'

import { getHeliocentricPositionAu } from '../orbital-mechanics'
import type { BodyRefs } from '../scene/SolarBodies'
import { SOLAR_BODIES } from '../solar-data'

export type BodyPositionsResult = {
  /**
   * Stable ref to the mesh/ring nodes for each solar body. Pass this to
   * `<SolarBodies bodyMeshRefs={...} />` so the scene component can populate
   * it with Three.js object references.
   */
  bodyMeshRefs: React.MutableRefObject<Record<string, BodyRefs>>
  /**
   * Stable ref to the latest heliocentric position (AU) for each solar body,
   * updated every frame. Read by the scene orchestrator for target tracking
   * and metrics reporting.
   */
  bodyPositionsRef: React.RefObject<Map<string, Vector3>>
}

/**
 * Owns the solar body mesh refs and drives their transforms every frame from
 * the simulated date.
 *
 * By owning `bodyMeshRefs` internally the hook avoids mutating caller-owned
 * refs, which satisfies the react-hooks/immutability lint rule.
 *
 * Must be registered after `useTimeSimulation` so its `useFrame` fires after
 * the simulated date has been advanced for the current tick.
 */
export function useBodyPositions(
  simulatedDateRef: React.RefObject<Date>,
): BodyPositionsResult {
  const bodyMeshRefs = useRef<Record<string, BodyRefs>>({})
  const bodyPositionsRef = useRef<Map<string, Vector3>>(new Map())

  useFrame(() => {
    const date = simulatedDateRef.current

    for (const body of SOLAR_BODIES) {
      const position = getHeliocentricPositionAu(body, date)
      const refs = bodyMeshRefs.current[body.name]

      if (refs?.mesh) {
        refs.mesh.position.copy(position)
        refs.mesh.rotation.y += 0.0025
      }

      if (refs?.ring) {
        refs.ring.rotation.x = Math.PI / 2.35
      }

      bodyPositionsRef.current.set(body.name, position)
    }
  })

  return { bodyMeshRefs, bodyPositionsRef }
}
