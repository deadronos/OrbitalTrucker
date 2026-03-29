import { Line, Stars } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ACESFilmicToneMapping,
  Color,
  DoubleSide,
  Euler,
  GridHelper,
  Group,
  MathUtils,
  Mesh,
  Quaternion,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from 'three'

import {
  buildOrbitPoints,
  getHeliocentricPositionAu,
} from '../orbital-mechanics'
import { TIME_WARP_STEPS, type SimulationMetrics } from '../simulation/types'
import { ASTRONOMICAL_UNIT_KM, SOLAR_BODIES, SUN } from '../solar-data'

export type SimulatorCanvasProps = {
  selectedBodyName: string
  timeWarpIndex: number
  timePaused: boolean
  onMetricsChange: (metrics: SimulationMetrics) => void
}

type BodyRefs = {
  mesh: Mesh | null
  ring: Mesh | null
}

const SHIP_SCALE_AU = 0.0048
const INITIAL_SHIP_POSITION = [1.04, 0.012, 0.02] as const
const INITIAL_SIMULATED_DATE = new Date('2026-03-29T00:00:00.000Z')

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

function SceneContents({
  selectedBodyName,
  timePaused,
  timeWarpIndex,
  onMetricsChange,
}: SimulatorCanvasProps) {
  const { camera, gl } = useThree()
  const bodyRefs = useRef<Record<string, BodyRefs>>({})
  const sunRef = useRef<Mesh>(null)
  const coronaRef = useRef<Mesh>(null)
  const shipRef = useRef<Group>(null)
  const targetMarkerRef = useRef<Mesh>(null)
  const selectedBodyNameRef = useRef(selectedBodyName)
  const timeWarpIndexRef = useRef(timeWarpIndex)
  const timePausedRef = useRef(timePaused)
  const onMetricsChangeRef = useRef(onMetricsChange)
  const shipStateRef = useRef({
    position: new Vector3(...INITIAL_SHIP_POSITION),
    velocity: new Vector3(0, 0, 0),
    yaw: -Math.PI / 2,
    pitch: -0.08,
    chaseDistance: 0.19,
  })
  const keyStateRef = useRef<Set<string>>(new Set())
  const pointerStateRef = useRef({
    active: false,
    last: new Vector2(),
  })
  const simulatedDateRef = useRef(new Date(INITIAL_SIMULATED_DATE))
  const metricsAccumulatorRef = useRef(0)
  const orbitAccumulatorRef = useRef(0)
  const forward = useRef(new Vector3())
  const right = useRef(new Vector3())
  const up = useRef(new Vector3())
  const shipQuaternion = useRef(new Quaternion())
  const lookEuler = useRef(new Euler(0, 0, 0, 'YXZ'))
  const cameraOffset = useRef(new Vector3())
  const lookTarget = useRef(new Vector3())
  const zeroVector = useMemo(() => new Vector3(0, 0, 0), [])
  const [orbitEpoch, setOrbitEpoch] = useState(
    () => new Date(INITIAL_SIMULATED_DATE),
  )
  const initialRenderDate = useMemo(() => new Date(INITIAL_SIMULATED_DATE), [])

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

  useEffect(() => {
    selectedBodyNameRef.current = selectedBodyName
  }, [selectedBodyName])

  useEffect(() => {
    timeWarpIndexRef.current = timeWarpIndex
  }, [timeWarpIndex])

  useEffect(() => {
    timePausedRef.current = timePaused
  }, [timePaused])

  useEffect(() => {
    onMetricsChangeRef.current = onMetricsChange
  }, [onMetricsChange])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      keyStateRef.current.add(event.code)
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      keyStateRef.current.delete(event.code)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useEffect(() => {
    const domElement = gl.domElement

    const handlePointerDown = (event: PointerEvent) => {
      pointerStateRef.current.active = true
      pointerStateRef.current.last.set(event.clientX, event.clientY)
      domElement.setPointerCapture(event.pointerId)
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!pointerStateRef.current.active) {
        return
      }

      const deltaX = event.clientX - pointerStateRef.current.last.x
      const deltaY = event.clientY - pointerStateRef.current.last.y
      const shipState = shipStateRef.current

      shipState.yaw -= deltaX * 0.005
      shipState.pitch = MathUtils.clamp(
        shipState.pitch - deltaY * 0.0035,
        -1.35,
        1.35,
      )
      pointerStateRef.current.last.set(event.clientX, event.clientY)
    }

    const handlePointerUp = (event: PointerEvent) => {
      pointerStateRef.current.active = false
      domElement.releasePointerCapture(event.pointerId)
    }

    const handlePointerLeave = () => {
      pointerStateRef.current.active = false
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      shipStateRef.current.chaseDistance = MathUtils.clamp(
        shipStateRef.current.chaseDistance + event.deltaY * 0.00025,
        0.04,
        1.2,
      )
    }

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault()
    }

    domElement.addEventListener('pointerdown', handlePointerDown)
    domElement.addEventListener('pointermove', handlePointerMove)
    domElement.addEventListener('pointerup', handlePointerUp)
    domElement.addEventListener('pointerleave', handlePointerLeave)
    domElement.addEventListener('wheel', handleWheel, { passive: false })
    domElement.addEventListener('contextmenu', handleContextMenu)

    return () => {
      domElement.removeEventListener('pointerdown', handlePointerDown)
      domElement.removeEventListener('pointermove', handlePointerMove)
      domElement.removeEventListener('pointerup', handlePointerUp)
      domElement.removeEventListener('pointerleave', handlePointerLeave)
      domElement.removeEventListener('wheel', handleWheel)
      domElement.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [gl])

  useFrame((_, delta) => {
    const realDeltaSeconds = Math.min(delta, 0.05)
    const simulatedDate = simulatedDateRef.current
    const warpDaysPerSecond = timePausedRef.current
      ? 0
      : TIME_WARP_STEPS[timeWarpIndexRef.current]

    if (warpDaysPerSecond > 0) {
      simulatedDate.setTime(
        simulatedDate.getTime() +
          realDeltaSeconds * warpDaysPerSecond * 86_400_000,
      )
      orbitAccumulatorRef.current += realDeltaSeconds * warpDaysPerSecond

      if (orbitAccumulatorRef.current >= 7) {
        orbitAccumulatorRef.current = 0
        setOrbitEpoch(new Date(simulatedDate))
      }
    }

    const bodyPositions = new Map<string, Vector3>()

    for (const body of SOLAR_BODIES) {
      const position = getHeliocentricPositionAu(body, simulatedDate)
      const refs = bodyRefs.current[body.name]

      refs?.mesh?.position.copy(position)
      if (refs?.mesh) {
        refs.mesh.rotation.y += 0.0025
      }
      if (refs?.ring) {
        refs.ring.rotation.x = Math.PI / 2.35
      }

      bodyPositions.set(body.name, position)
    }

    const shipState = shipStateRef.current
    lookEuler.current.set(shipState.pitch, shipState.yaw, 0)
    shipQuaternion.current.setFromEuler(lookEuler.current)
    shipRef.current?.setRotationFromQuaternion(shipQuaternion.current)

    forward.current.set(1, 0, 0).applyQuaternion(shipQuaternion.current)
    right.current.set(0, 0, -1).applyQuaternion(shipQuaternion.current)
    up.current.set(0, 1, 0).applyQuaternion(shipQuaternion.current)

    const acceleration = new Vector3()
    const thrustPower = keyStateRef.current.has('Shift') ? 0.00006 : 0.000016

    if (keyStateRef.current.has('KeyW')) acceleration.add(forward.current)
    if (keyStateRef.current.has('KeyS'))
      acceleration.addScaledVector(forward.current, -1)
    if (keyStateRef.current.has('KeyD')) acceleration.add(right.current)
    if (keyStateRef.current.has('KeyA'))
      acceleration.addScaledVector(right.current, -1)
    if (keyStateRef.current.has('KeyE')) acceleration.add(up.current)
    if (keyStateRef.current.has('KeyQ'))
      acceleration.addScaledVector(up.current, -1)

    if (acceleration.lengthSq() > 0) {
      acceleration.normalize().multiplyScalar(thrustPower)
      shipState.velocity.addScaledVector(acceleration, realDeltaSeconds)
    }

    if (keyStateRef.current.has('Space')) {
      shipState.velocity.multiplyScalar(Math.max(0, 1 - realDeltaSeconds * 2.8))
    } else {
      shipState.velocity.multiplyScalar(0.999)
    }

    shipState.position.addScaledVector(shipState.velocity, realDeltaSeconds)
    shipRef.current?.position.copy(shipState.position)

    cameraOffset.current
      .copy(forward.current)
      .multiplyScalar(-shipState.chaseDistance)
      .addScaledVector(up.current, shipState.chaseDistance * 0.3)

    camera.position.copy(shipState.position).add(cameraOffset.current)
    lookTarget.current
      .copy(shipState.position)
      .addScaledVector(forward.current, shipState.chaseDistance * 1.6)
    camera.lookAt(lookTarget.current)

    const selectedTargetPosition =
      selectedBodyNameRef.current === SUN.name
        ? zeroVector
        : (bodyPositions.get(selectedBodyNameRef.current) ?? zeroVector)
    const targetVisual = SOLAR_BODIES.find(
      (body) => body.name === selectedBodyNameRef.current,
    )

    targetMarkerRef.current?.position.copy(selectedTargetPosition)
    targetMarkerRef.current?.lookAt(camera.position)
    targetMarkerRef.current?.scale.setScalar(
      targetVisual
        ? targetVisual.displayRadiusAu * 7
        : SUN.displayRadiusAu * 1.7,
    )

    if (sunRef.current) {
      sunRef.current.rotation.y += realDeltaSeconds * 0.08
    }
    if (coronaRef.current) {
      coronaRef.current.rotation.z += realDeltaSeconds * 0.03
    }

    metricsAccumulatorRef.current += realDeltaSeconds

    if (metricsAccumulatorRef.current >= 0.1) {
      metricsAccumulatorRef.current = 0
      onMetricsChangeRef.current({
        simulatedDate: new Date(simulatedDate),
        shipSpeedKmPerSecond:
          shipState.velocity.length() * ASTRONOMICAL_UNIT_KM,
        heliocentricDistanceAu: shipState.position.length(),
        targetDistanceAu: shipState.position.distanceTo(selectedTargetPosition),
      })
    }
  })

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
                bodyRefs.current[body.name] = {
                  mesh: node,
                  ring: bodyRefs.current[body.name]?.ring ?? null,
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
                    bodyRefs.current[body.name] = {
                      mesh: bodyRefs.current[body.name]?.mesh ?? null,
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

      <mesh ref={targetMarkerRef}>
        <ringGeometry args={[0.12, 0.16, 64]} />
        <meshBasicMaterial
          color="#9fe0ff"
          opacity={0.86}
          side={DoubleSide}
          transparent
        />
      </mesh>

      <group
        position={INITIAL_SHIP_POSITION}
        ref={shipRef}
        scale={SHIP_SCALE_AU}
      >
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
    </>
  )
}

export function SimulatorCanvas(props: SimulatorCanvasProps) {
  return (
    <Canvas
      camera={{
        fov: 58,
        near: 0.00001,
        far: 8000,
        position: [0.85, 0.1, 0.25],
      }}
      className="sim-canvas"
      dpr={[1, 2]}
      frameloop="always"
      gl={{ antialias: true, logarithmicDepthBuffer: true }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = SRGBColorSpace
        gl.toneMapping = ACESFilmicToneMapping
        gl.setClearColor(new Color('#020409'))
      }}
    >
      <SceneContents {...props} />
    </Canvas>
  )
}
