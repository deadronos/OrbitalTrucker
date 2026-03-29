import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import { DoubleSide, Mesh } from 'three'

import {
  buildOrbitPoints,
  getHeliocentricPositionAu,
} from '../orbital-mechanics'
import { INITIAL_SIMULATED_DATE } from '../simulation/types'
import { SOLAR_BODIES } from '../solar-data'

export type BodyRefs = {
  mesh: Mesh | null
  ring: Mesh | null
}

function OrbitPath({
  body,
  orbitEpoch,
}: {
  body: (typeof SOLAR_BODIES)[number]
  orbitEpoch: Date
}) {
  const points = useMemo(() => {
    const orbitPoints = buildOrbitPoints(body, orbitEpoch)
    return orbitPoints.length > 0
      ? [...orbitPoints, orbitPoints[0].clone()]
      : orbitPoints
  }, [body, orbitEpoch])

  return (
    <Line
      color={body.orbitColor}
      depthWrite={false}
      lineWidth={1}
      opacity={body.name === 'Pluto' ? 0.3 : 0.45}
      points={points}
      transparent
    />
  )
}

type SolarBodiesProps = {
  orbitEpoch: Date
  bodyMeshRefs: React.MutableRefObject<Record<string, BodyRefs>>
}

/**
 * Renders a mesh for each solar body and its orbit path. The `bodyMeshRefs`
 * ref is populated with mesh references so the scene orchestrator can update
 * body positions imperatively each frame.
 */
export function SolarBodies({ orbitEpoch, bodyMeshRefs }: SolarBodiesProps) {
  const initialRenderDate = useMemo(() => new Date(INITIAL_SIMULATED_DATE), [])

  return (
    <>
      {SOLAR_BODIES.map((body) => {
        const initialPosition = getHeliocentricPositionAu(
          body,
          initialRenderDate,
        )

        return (
          <group key={body.name}>
            <OrbitPath body={body} orbitEpoch={orbitEpoch} />

            <mesh
              position={initialPosition}
              ref={(node) => {
                bodyMeshRefs.current[body.name] = {
                  mesh: node,
                  ring: bodyMeshRefs.current[body.name]?.ring ?? null,
                }
              }}
            >
              <sphereGeometry args={[body.displayRadiusAu, 32, 16]} />
              <meshPhongMaterial
                color={body.color}
                emissive={body.color}
                emissiveIntensity={0.12}
                shininess={30}
              />

              {body.name === 'Saturn' ? (
                <mesh
                  ref={(node) => {
                    bodyMeshRefs.current[body.name] = {
                      mesh: bodyMeshRefs.current[body.name]?.mesh ?? null,
                      ring: node,
                    }
                  }}
                >
                  <ringGeometry
                    args={[
                      body.displayRadiusAu * 1.5,
                      body.displayRadiusAu * 2.4,
                      64,
                    ]}
                  />
                  <meshBasicMaterial
                    color="#d8cc9a"
                    opacity={0.46}
                    side={DoubleSide}
                    transparent
                  />
                </mesh>
              ) : null}
            </mesh>
          </group>
        )
      })}
    </>
  )
}
