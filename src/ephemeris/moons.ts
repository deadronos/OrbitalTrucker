import { Vector3 } from 'three'

import { ASTRONOMICAL_UNIT_KM } from '../solar-data'

const J2000_EPOCH = new Date('2000-01-01T12:00:00.000Z')
const DEG_TO_RAD = Math.PI / 180
const TAU = Math.PI * 2
const EQUATORIAL_TO_ECLIPTIC_OBLIQUITY_RAD = 23.43928 * DEG_TO_RAD

export type MoonEphemerisId = 'moon' | 'europa' | 'ganymede' | 'callisto'

type ParentBodyPositionResolver = (bodyName: string, date: Date) => Vector3

type ReferenceFrame =
  | { type: 'ecliptic' }
  | {
      type: 'laplace'
      poleRightAscensionDeg: number
      poleDeclinationDeg: number
    }

type MoonEphemerisDefinition = {
  id: MoonEphemerisId
  name: string
  parentBodyName: string
  semiMajorAxisKm: number
  eccentricity: number
  inclinationDeg: number
  longitudeOfAscendingNodeDeg: number
  argumentOfPeriapsisDeg: number
  meanAnomalyDegAtEpoch: number
  orbitalPeriodDays: number
  referenceFrame: ReferenceFrame
}

type ReferenceBasis = {
  xAxis: Vector3
  yAxis: Vector3
  zAxis: Vector3
}

const JOVIAN_LAPLACE_PLANE = {
  type: 'laplace',
  poleRightAscensionDeg: 268.1,
  poleDeclinationDeg: 64.5,
} as const satisfies ReferenceFrame

const MOON_EPHEMERIDES: readonly MoonEphemerisDefinition[] = [
  {
    id: 'moon',
    name: 'Moon',
    parentBodyName: 'Earth',
    semiMajorAxisKm: 384_400,
    eccentricity: 0.0554,
    argumentOfPeriapsisDeg: 318.15,
    meanAnomalyDegAtEpoch: 135.27,
    inclinationDeg: 5.16,
    longitudeOfAscendingNodeDeg: 125.08,
    orbitalPeriodDays: 27.322,
    referenceFrame: { type: 'ecliptic' },
  },
  {
    id: 'europa',
    name: 'Europa',
    parentBodyName: 'Jupiter',
    semiMajorAxisKm: 671_100,
    eccentricity: 0.009,
    argumentOfPeriapsisDeg: 45.0,
    meanAnomalyDegAtEpoch: 345.4,
    inclinationDeg: 0.5,
    longitudeOfAscendingNodeDeg: 184.0,
    orbitalPeriodDays: 3.525463,
    referenceFrame: JOVIAN_LAPLACE_PLANE,
  },
  {
    id: 'ganymede',
    name: 'Ganymede',
    parentBodyName: 'Jupiter',
    semiMajorAxisKm: 1_070_400,
    eccentricity: 0.001,
    argumentOfPeriapsisDeg: 198.3,
    meanAnomalyDegAtEpoch: 324.8,
    inclinationDeg: 0.2,
    longitudeOfAscendingNodeDeg: 58.5,
    orbitalPeriodDays: 7.155588,
    referenceFrame: {
      type: 'laplace',
      poleRightAscensionDeg: 268.2,
      poleDeclinationDeg: 64.6,
    },
  },
  {
    id: 'callisto',
    name: 'Callisto',
    parentBodyName: 'Jupiter',
    semiMajorAxisKm: 1_882_700,
    eccentricity: 0.007,
    argumentOfPeriapsisDeg: 43.8,
    meanAnomalyDegAtEpoch: 87.4,
    inclinationDeg: 0.3,
    longitudeOfAscendingNodeDeg: 309.1,
    orbitalPeriodDays: 16.69044,
    referenceFrame: {
      type: 'laplace',
      poleRightAscensionDeg: 268.7,
      poleDeclinationDeg: 64.8,
    },
  },
] as const

const MOON_BY_ID = new Map(
  MOON_EPHEMERIDES.map((definition) => [definition.id, definition]),
)

export function isMoonEphemerisId(value: string): value is MoonEphemerisId {
  return MOON_BY_ID.has(value as MoonEphemerisId)
}

export function getMoonEphemerisDefinition(
  moonId: MoonEphemerisId,
): MoonEphemerisDefinition {
  const definition = MOON_BY_ID.get(moonId)

  if (!definition) {
    throw new Error(`Unknown moon ephemeris id: ${moonId}`)
  }

  return definition
}

export function getMoonRelativePositionAu(
  moonId: MoonEphemerisId,
  date: Date,
): Vector3 {
  const definition = getMoonEphemerisDefinition(moonId)
  const basis = buildReferenceBasis(definition.referenceFrame)
  const elapsedDays = (date.getTime() - J2000_EPOCH.getTime()) / 86_400_000
  const meanAnomalyRad = normalizeRadians(
    definition.meanAnomalyDegAtEpoch * DEG_TO_RAD +
      (elapsedDays / definition.orbitalPeriodDays) * TAU,
  )
  const eccentricAnomalyRad = solveKepler(
    meanAnomalyRad,
    definition.eccentricity,
  )
  const trueAnomalyRad =
    2 *
    Math.atan2(
      Math.sqrt(1 + definition.eccentricity) *
        Math.sin(eccentricAnomalyRad / 2),
      Math.sqrt(1 - definition.eccentricity) *
        Math.cos(eccentricAnomalyRad / 2),
    )
  const orbitalRadiusAu =
    (definition.semiMajorAxisKm / ASTRONOMICAL_UNIT_KM) *
    (1 - definition.eccentricity * Math.cos(eccentricAnomalyRad))
  const longitudeOfAscendingNodeRad =
    definition.longitudeOfAscendingNodeDeg * DEG_TO_RAD
  const inclinationRad = definition.inclinationDeg * DEG_TO_RAD
  const argumentOfLatitudeRad =
    definition.argumentOfPeriapsisDeg * DEG_TO_RAD + trueAnomalyRad
  const x =
    orbitalRadiusAu *
    (Math.cos(longitudeOfAscendingNodeRad) * Math.cos(argumentOfLatitudeRad) -
      Math.sin(longitudeOfAscendingNodeRad) *
        Math.sin(argumentOfLatitudeRad) *
        Math.cos(inclinationRad))
  const y =
    orbitalRadiusAu *
    (Math.sin(longitudeOfAscendingNodeRad) * Math.cos(argumentOfLatitudeRad) +
      Math.cos(longitudeOfAscendingNodeRad) *
        Math.sin(argumentOfLatitudeRad) *
        Math.cos(inclinationRad))
  const z =
    orbitalRadiusAu * Math.sin(argumentOfLatitudeRad) * Math.sin(inclinationRad)

  return new Vector3()
    .addScaledVector(basis.xAxis, x)
    .addScaledVector(basis.yAxis, y)
    .addScaledVector(basis.zAxis, z)
}

export function getMoonHeliocentricPositionAu(
  moonId: MoonEphemerisId,
  date: Date,
  resolveParentBodyPosition: ParentBodyPositionResolver,
): Vector3 {
  const definition = getMoonEphemerisDefinition(moonId)
  const parentPosition = resolveParentBodyPosition(
    definition.parentBodyName,
    date,
  )

  return parentPosition.clone().add(getMoonRelativePositionAu(moonId, date))
}

function buildReferenceBasis(referenceFrame: ReferenceFrame): ReferenceBasis {
  if (referenceFrame.type === 'ecliptic') {
    return {
      xAxis: new Vector3(1, 0, 0),
      yAxis: new Vector3(0, 0, 1),
      zAxis: new Vector3(0, 1, 0),
    }
  }

  const poleEquatorial = buildEquatorialPoleVector(
    referenceFrame.poleRightAscensionDeg,
    referenceFrame.poleDeclinationDeg,
  )
  const equatorialNorth = new Vector3(0, 0, 1)
  const ascendingNodeEquatorial = new Vector3()
    .crossVectors(equatorialNorth, poleEquatorial)
    .normalize()
  const inPlaneYEquatorial = new Vector3()
    .crossVectors(poleEquatorial, ascendingNodeEquatorial)
    .normalize()

  return {
    xAxis: equatorialToThreeEcliptic(ascendingNodeEquatorial),
    yAxis: equatorialToThreeEcliptic(inPlaneYEquatorial),
    zAxis: equatorialToThreeEcliptic(poleEquatorial),
  }
}

function buildEquatorialPoleVector(
  rightAscensionDeg: number,
  declinationDeg: number,
): Vector3 {
  const rightAscensionRad = rightAscensionDeg * DEG_TO_RAD
  const declinationRad = declinationDeg * DEG_TO_RAD
  const cosDeclination = Math.cos(declinationRad)

  return new Vector3(
    cosDeclination * Math.cos(rightAscensionRad),
    cosDeclination * Math.sin(rightAscensionRad),
    Math.sin(declinationRad),
  )
}

function equatorialToThreeEcliptic(vector: Vector3): Vector3 {
  const x = vector.x
  const y =
    vector.y * Math.cos(EQUATORIAL_TO_ECLIPTIC_OBLIQUITY_RAD) +
    vector.z * Math.sin(EQUATORIAL_TO_ECLIPTIC_OBLIQUITY_RAD)
  const z =
    -vector.y * Math.sin(EQUATORIAL_TO_ECLIPTIC_OBLIQUITY_RAD) +
    vector.z * Math.cos(EQUATORIAL_TO_ECLIPTIC_OBLIQUITY_RAD)

  return new Vector3(x, z, y)
}

function normalizeRadians(value: number): number {
  const wrapped = value % TAU
  return wrapped < 0 ? wrapped + TAU : wrapped
}

function solveKepler(meanAnomalyRad: number, eccentricity: number): number {
  let eccentricAnomalyRad = meanAnomalyRad

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const delta =
      (eccentricAnomalyRad -
        eccentricity * Math.sin(eccentricAnomalyRad) -
        meanAnomalyRad) /
      (1 - eccentricity * Math.cos(eccentricAnomalyRad))

    eccentricAnomalyRad -= delta

    if (Math.abs(delta) < 1e-8) {
      break
    }
  }

  return eccentricAnomalyRad
}
