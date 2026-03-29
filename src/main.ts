import './style.css'

import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  GridHelper,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineLoop,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  Quaternion,
  RingGeometry,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  SRGBColorSpace,
  ACESFilmicToneMapping,
} from 'three'

import { buildOrbitPoints, getHeliocentricPositionAu } from './orbital-mechanics'
import {
  ASTRONOMICAL_UNIT_KM,
  SOLAR_BODIES,
  SUN,
  type SolarBodyDefinition,
} from './solar-data'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App container was not found.')
}

const bodyButtons = [SUN.name, ...SOLAR_BODIES.map((body) => body.name)]
  .map(
    (name) =>
      `<button class="target-chip" type="button" data-body="${name}">${name}</button>`,
  )
  .join('')

const bodyFacts = SOLAR_BODIES.map(
  (body) => `
    <li>
      <span class="legend-name">${body.name}</span>
      <span>${body.elements.semiMajorAxisAu.base.toFixed(3)} AU</span>
      <span>${Math.round(body.orbitalPeriodDays).toLocaleString()} d</span>
    </li>
  `,
).join('')

app.innerHTML = `
  <div class="sim-shell">
    <canvas id="sim-canvas" aria-label="OrbitalTrucker solar system simulator"></canvas>

    <div class="overlay">
      <section class="panel intro-panel">
        <p class="eyebrow">OrbitalTrucker / prototype</p>
        <h1>Freighter bridge</h1>
        <p>
          Fly a placeholder cargo freighter through a heliocentric map with the Sun, all major planets,
          and Pluto using Keplerian orbital elements at realistic solar-system distances.
        </p>
        <p class="muted">
          Planetary positions update from low-precision J2000 elements. Distances are to scale in AU; body sizes are intentionally exaggerated so you can actually see them without a telescope and a prayer.
        </p>
      </section>

      <section class="panel metrics-panel">
        <div class="metrics-grid">
          <div>
            <span class="label">Simulated date</span>
            <strong id="metric-date">—</strong>
          </div>
          <div>
            <span class="label">Time warp</span>
            <strong id="metric-time-warp">—</strong>
          </div>
          <div>
            <span class="label">Ship speed</span>
            <strong id="metric-speed">—</strong>
          </div>
          <div>
            <span class="label">Heliocentric radius</span>
            <strong id="metric-sun-distance">—</strong>
          </div>
          <div>
            <span class="label">Target</span>
            <strong id="metric-target">—</strong>
          </div>
          <div>
            <span class="label">Range to target</span>
            <strong id="metric-target-distance">—</strong>
          </div>
        </div>

        <div class="controls-row">
          <button id="slower-time" type="button">Slower time</button>
          <button id="pause-time" type="button">Pause / resume</button>
          <button id="faster-time" type="button">Faster time</button>
        </div>
      </section>

      <section class="panel controls-panel">
        <h2>Flight controls</h2>
        <ul>
          <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> thrust forward / strafe</li>
          <li><kbd>Q</kbd><kbd>E</kbd> vertical thrusters</li>
          <li><kbd>Shift</kbd> boost</li>
          <li><kbd>Space</kbd> emergency dampeners</li>
          <li><kbd>Drag</kbd> rotate heading</li>
          <li><kbd>Wheel</kbd> chase camera zoom</li>
          <li><kbd>[</kbd> <kbd>]</kbd> adjust time warp</li>
        </ul>

        <h2>Target tracking</h2>
        <div class="target-list">${bodyButtons}</div>
      </section>

      <section class="panel legend-panel">
        <h2>Orbital reference</h2>
        <p class="muted">Semi-major axis and sidereal period for the bodies currently rendered.</p>
        <ul class="legend-list">${bodyFacts}</ul>
      </section>
    </div>
  </div>
`

const canvas = document.querySelector<HTMLCanvasElement>('#sim-canvas')

if (!canvas) {
  throw new Error('Simulation canvas was not created.')
}

const metricDate = document.querySelector<HTMLElement>('#metric-date')!
const metricTimeWarp = document.querySelector<HTMLElement>('#metric-time-warp')!
const metricSpeed = document.querySelector<HTMLElement>('#metric-speed')!
const metricSunDistance = document.querySelector<HTMLElement>('#metric-sun-distance')!
const metricTarget = document.querySelector<HTMLElement>('#metric-target')!
const metricTargetDistance = document.querySelector<HTMLElement>('#metric-target-distance')!
const targetChipElements = Array.from(
  document.querySelectorAll<HTMLButtonElement>('.target-chip'),
)
const slowerTimeButton = document.querySelector<HTMLButtonElement>('#slower-time')!
const pauseTimeButton = document.querySelector<HTMLButtonElement>('#pause-time')!
const fasterTimeButton = document.querySelector<HTMLButtonElement>('#faster-time')!

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  logarithmicDepthBuffer: true,
})

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = SRGBColorSpace
renderer.toneMapping = ACESFilmicToneMapping

const scene = new Scene()
scene.background = new Color('#020409')

const camera = new PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.00001, 8_000)

const ambientLight = new AmbientLight('#7f95bd', 0.22)
scene.add(ambientLight)

const sunLight = new PointLight('#ffe7b3', 5.6, 0, 2)
scene.add(sunLight)

const grid = new GridHelper(120, 24, '#31506d', '#18283b')
grid.material.transparent = true
grid.material.opacity = 0.22
scene.add(grid)

const starGeometry = new BufferGeometry()
const starCount = 5_000
const starPositions = new Float32Array(starCount * 3)

for (let index = 0; index < starCount; index += 1) {
  const radius = 150 + Math.random() * 3_200
  const theta = Math.random() * Math.PI * 2
  const phi = Math.acos(2 * Math.random() - 1)
  const sinPhi = Math.sin(phi)
  const offset = index * 3

  starPositions[offset] = radius * sinPhi * Math.cos(theta)
  starPositions[offset + 1] = radius * Math.cos(phi)
  starPositions[offset + 2] = radius * sinPhi * Math.sin(theta)
}

starGeometry.setAttribute('position', new Float32BufferAttribute(starPositions, 3))

const stars = new Points(
  starGeometry,
  new PointsMaterial({
    color: '#d7e5ff',
    size: 0.9,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.85,
  }),
)
scene.add(stars)

const sunMesh = new Mesh(
  new SphereGeometry(SUN.displayRadiusAu, 48, 24),
  new MeshPhongMaterial({
    color: SUN.color,
    emissive: SUN.color,
    emissiveIntensity: 1.3,
    shininess: 5,
  }),
)
scene.add(sunMesh)

const corona = new Mesh(
  new RingGeometry(SUN.displayRadiusAu * 1.05, SUN.displayRadiusAu * 1.65, 96),
  new MeshBasicMaterial({
    color: '#ffbf66',
    side: DoubleSide,
    transparent: true,
    opacity: 0.22,
  }),
)
corona.rotation.x = Math.PI / 2
scene.add(corona)

const ship = new Group()
const shipScaleAu = 0.0048

const hull = new Mesh(
  new BoxGeometry(1.6, 0.55, 0.75),
  new MeshPhongMaterial({ color: '#b7c6d8', shininess: 80 }),
)

const bridge = new Mesh(
  new BoxGeometry(0.72, 0.3, 0.38),
  new MeshPhongMaterial({ color: '#6ec2ff', emissive: '#0d2d4f', emissiveIntensity: 0.4 }),
)
bridge.position.set(0, 0.28, 0)

const nose = new Mesh(
  new CylinderGeometry(0.02, 0.34, 0.9, 4),
  new MeshPhongMaterial({ color: '#d9a76d', shininess: 40 }),
)
nose.rotation.z = Math.PI / 2
nose.position.x = 1.05

const portPod = new Mesh(
  new BoxGeometry(0.7, 0.18, 0.18),
  new MeshPhongMaterial({ color: '#7b8ba1' }),
)
portPod.position.set(-0.2, -0.24, 0.42)

const starboardPod = portPod.clone()
starboardPod.position.z *= -1

const engineGlow = new Mesh(
  new IcosahedronGeometry(0.16, 1),
  new MeshBasicMaterial({ color: '#6ec8ff', transparent: true, opacity: 0.92 }),
)
engineGlow.position.set(-0.98, 0, 0)

ship.add(hull, bridge, nose, portPod, starboardPod, engineGlow)
ship.scale.setScalar(shipScaleAu)
scene.add(ship)

type BodyVisual = {
  definition: SolarBodyDefinition
  mesh: Mesh
  orbitLine: LineLoop
  ring?: Mesh
}

const bodyVisuals = new Map<string, BodyVisual>()

for (const body of SOLAR_BODIES) {
  const mesh = new Mesh(
    new SphereGeometry(body.displayRadiusAu, 32, 16),
    new MeshPhongMaterial({
      color: body.color,
      emissive: body.color,
      emissiveIntensity: 0.12,
      shininess: 30,
    }),
  )

  const orbitLine = new LineLoop(
    new BufferGeometry().setFromPoints(buildOrbitPoints(body, new Date())),
    new LineBasicMaterial({
      color: body.orbitColor,
      transparent: true,
      opacity: body.name === 'Pluto' ? 0.3 : 0.45,
    }),
  )

  scene.add(orbitLine)
  scene.add(mesh)

  const visual: BodyVisual = { definition: body, mesh, orbitLine }

  if (body.name === 'Saturn') {
    const ring = new Mesh(
      new RingGeometry(body.displayRadiusAu * 1.5, body.displayRadiusAu * 2.4, 64),
      new MeshBasicMaterial({
        color: '#d8cc9a',
        side: DoubleSide,
        transparent: true,
        opacity: 0.46,
      }),
    )

    mesh.add(ring)
    visual.ring = ring
  }

  bodyVisuals.set(body.name, visual)
}

const targetMarker = new Mesh(
  new RingGeometry(0.12, 0.16, 64),
  new MeshBasicMaterial({
    color: '#9fe0ff',
    side: DoubleSide,
    transparent: true,
    opacity: 0.86,
  }),
)
scene.add(targetMarker)

const keyState = new Set<string>()
const pointerState = {
  active: false,
  last: new Vector2(),
}

const shipState = {
  position: new Vector3(1.04, 0.012, 0.02),
  velocity: new Vector3(0, 0, 0),
  yaw: -Math.PI / 2,
  pitch: -0.08,
  chaseDistance: 0.19,
}

const forward = new Vector3()
const right = new Vector3()
const up = new Vector3()
const shipQuaternion = new Quaternion()
const lookEuler = new Euler(0, 0, 0, 'YXZ')
const cameraOffset = new Vector3()
const lookTarget = new Vector3()

let simulatedDate = new Date()
let selectedBodyName = 'Earth'
let previousFrameTime = performance.now()
let metricsAccumulator = 0
let orbitsDirty = false
let timePaused = false

const timeWarpSteps = [0.0, 1 / 48, 1 / 12, 0.25, 1, 7, 30, 90]
let timeWarpIndex = 3

function getTimeWarpDaysPerSecond(): number {
  return timePaused ? 0 : timeWarpSteps[timeWarpIndex]
}

function formatDistanceAu(distanceAu: number): string {
  if (distanceAu >= 1) {
    return `${distanceAu.toFixed(2)} AU`
  }

  return `${(distanceAu * ASTRONOMICAL_UNIT_KM / 1_000_000).toFixed(2)} million km`
}

function formatTimeWarp(daysPerSecond: number): string {
  if (daysPerSecond === 0) {
    return 'paused'
  }

  if (daysPerSecond < 1) {
    return `${(daysPerSecond * 24).toFixed(1)} h / s`
  }

  return `${daysPerSecond.toFixed(daysPerSecond >= 10 ? 0 : 1)} d / s`
}

function updateTargetChipState(): void {
  for (const element of targetChipElements) {
    element.classList.toggle('active', element.dataset.body === selectedBodyName)
  }
}

function rebuildOrbitsIfNeeded(): void {
  if (!orbitsDirty) {
    return
  }

  for (const visual of bodyVisuals.values()) {
    visual.orbitLine.geometry.dispose()
    visual.orbitLine.geometry = new BufferGeometry().setFromPoints(
      buildOrbitPoints(visual.definition, simulatedDate),
    )
  }

  orbitsDirty = false
}

function updateBodies(): Map<string, Vector3> {
  const positions = new Map<string, Vector3>()

  for (const visual of bodyVisuals.values()) {
    const position = getHeliocentricPositionAu(visual.definition, simulatedDate)
    visual.mesh.position.copy(position)
    visual.mesh.rotation.y += 0.0025

    if (visual.ring) {
      visual.ring.rotation.x = Math.PI / 2.35
    }

    positions.set(visual.definition.name, position)
  }

  return positions
}

function updateShip(realDeltaSeconds: number): void {
  lookEuler.set(shipState.pitch, shipState.yaw, 0)
  shipQuaternion.setFromEuler(lookEuler)
  ship.setRotationFromQuaternion(shipQuaternion)

  forward.set(1, 0, 0).applyQuaternion(shipQuaternion)
  right.set(0, 0, -1).applyQuaternion(shipQuaternion)
  up.set(0, 1, 0).applyQuaternion(shipQuaternion)

  const acceleration = new Vector3()
  const thrustPower = keyState.has('Shift') ? 0.00006 : 0.000016

  if (keyState.has('KeyW')) acceleration.add(forward)
  if (keyState.has('KeyS')) acceleration.addScaledVector(forward, -1)
  if (keyState.has('KeyD')) acceleration.add(right)
  if (keyState.has('KeyA')) acceleration.addScaledVector(right, -1)
  if (keyState.has('KeyE')) acceleration.add(up)
  if (keyState.has('KeyQ')) acceleration.addScaledVector(up, -1)

  if (acceleration.lengthSq() > 0) {
    acceleration.normalize().multiplyScalar(thrustPower)
    shipState.velocity.addScaledVector(acceleration, realDeltaSeconds)
  }

  if (keyState.has('Space')) {
    shipState.velocity.multiplyScalar(Math.max(0, 1 - realDeltaSeconds * 2.8))
  } else {
    shipState.velocity.multiplyScalar(0.999)
  }

  shipState.position.addScaledVector(shipState.velocity, realDeltaSeconds)
  ship.position.copy(shipState.position)
}

function updateCamera(): void {
  cameraOffset
    .copy(forward)
    .multiplyScalar(-shipState.chaseDistance)
    .addScaledVector(up, shipState.chaseDistance * 0.3)

  camera.position.copy(shipState.position).add(cameraOffset)
  lookTarget.copy(shipState.position).addScaledVector(forward, shipState.chaseDistance * 1.6)
  camera.lookAt(lookTarget)
}

function updateHud(bodyPositions: Map<string, Vector3>): void {
  const shipSpeedKmPerSecond = shipState.velocity.length() * ASTRONOMICAL_UNIT_KM
  const heliocentricDistanceAu = shipState.position.length()
  const targetPosition =
    selectedBodyName === SUN.name
      ? new Vector3(0, 0, 0)
      : bodyPositions.get(selectedBodyName) ?? new Vector3(0, 0, 0)
  const targetDistanceAu = shipState.position.distanceTo(targetPosition)

  metricDate.textContent = simulatedDate.toUTCString().replace('GMT', 'UTC')
  metricTimeWarp.textContent = formatTimeWarp(getTimeWarpDaysPerSecond())
  metricSpeed.textContent = `${shipSpeedKmPerSecond.toFixed(shipSpeedKmPerSecond >= 1000 ? 0 : 1)} km/s`
  metricSunDistance.textContent = formatDistanceAu(heliocentricDistanceAu)
  metricTarget.textContent = selectedBodyName
  metricTargetDistance.textContent = formatDistanceAu(targetDistanceAu)

  targetMarker.position.copy(targetPosition)
  targetMarker.lookAt(camera.position)

  const targetVisual = bodyVisuals.get(selectedBodyName)
  const markerScale = targetVisual ? targetVisual.definition.displayRadiusAu * 7 : SUN.displayRadiusAu * 1.7
  targetMarker.scale.setScalar(markerScale)
}

function animate(now: number): void {
  const realDeltaSeconds = Math.min((now - previousFrameTime) / 1000, 0.05)
  previousFrameTime = now

  const warpDaysPerSecond = getTimeWarpDaysPerSecond()
  if (warpDaysPerSecond > 0) {
    simulatedDate = new Date(simulatedDate.getTime() + realDeltaSeconds * warpDaysPerSecond * 86_400_000)
    metricsAccumulator += realDeltaSeconds * warpDaysPerSecond

    if (metricsAccumulator >= 7) {
      metricsAccumulator = 0
      orbitsDirty = true
    }
  }

  rebuildOrbitsIfNeeded()
  const bodyPositions = updateBodies()
  updateShip(realDeltaSeconds)
  updateCamera()
  updateHud(bodyPositions)

  sunMesh.rotation.y += realDeltaSeconds * 0.08
  corona.rotation.z += realDeltaSeconds * 0.03
  stars.rotation.y += realDeltaSeconds * 0.002

  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}

function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
}

window.addEventListener('resize', resize)

window.addEventListener('keydown', (event) => {
  if (event.code === 'BracketLeft') {
    timeWarpIndex = Math.max(0, timeWarpIndex - 1)
    timePaused = false
  } else if (event.code === 'BracketRight') {
    timeWarpIndex = Math.min(timeWarpSteps.length - 1, timeWarpIndex + 1)
    timePaused = false
  }

  keyState.add(event.code)
})

window.addEventListener('keyup', (event) => {
  keyState.delete(event.code)
})

canvas.addEventListener('pointerdown', (event) => {
  pointerState.active = true
  pointerState.last.set(event.clientX, event.clientY)
  canvas.setPointerCapture(event.pointerId)
})

canvas.addEventListener('pointermove', (event) => {
  if (!pointerState.active) {
    return
  }

  const deltaX = event.clientX - pointerState.last.x
  const deltaY = event.clientY - pointerState.last.y

  shipState.yaw -= deltaX * 0.005
  shipState.pitch = MathUtils.clamp(shipState.pitch - deltaY * 0.0035, -1.35, 1.35)
  pointerState.last.set(event.clientX, event.clientY)
})

canvas.addEventListener('pointerup', (event) => {
  pointerState.active = false
  canvas.releasePointerCapture(event.pointerId)
})

canvas.addEventListener('pointerleave', () => {
  pointerState.active = false
})

canvas.addEventListener('wheel', (event) => {
  event.preventDefault()
  shipState.chaseDistance = MathUtils.clamp(shipState.chaseDistance + event.deltaY * 0.00025, 0.04, 1.2)
})

canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault()
})

for (const chip of targetChipElements) {
  chip.addEventListener('click', () => {
    selectedBodyName = chip.dataset.body ?? SUN.name
    updateTargetChipState()
  })
}

slowerTimeButton.addEventListener('click', () => {
  timeWarpIndex = Math.max(0, timeWarpIndex - 1)
  timePaused = false
})

pauseTimeButton.addEventListener('click', () => {
  timePaused = !timePaused
})

fasterTimeButton.addEventListener('click', () => {
  timeWarpIndex = Math.min(timeWarpSteps.length - 1, timeWarpIndex + 1)
  timePaused = false
})

updateTargetChipState()
resize()
requestAnimationFrame(animate)
