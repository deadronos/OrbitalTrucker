import { Vector3 } from 'three'

import { getHeliocentricPositionAu } from '../orbital-mechanics'
import { SOLAR_BODIES, SUN } from '../solar-data'

type Vector3Tuple = readonly [number, number, number]

export type LocationKind =
  | 'star'
  | 'planet'
  | 'dwarf-planet'
  | 'moon'
  | 'colony'
  | 'station'

export type LocationPositionSource =
  | { type: 'origin' }
  | { type: 'solar-body'; bodyName: string }
  | {
      type: 'anchored-offset'
      anchorLocationId: string
      offsetAu: Vector3Tuple
    }

export type LocationDefinition = {
  id: string
  name: string
  group: string
  kind: LocationKind
  parentId?: string
  markerScaleAu: number
  position: LocationPositionSource
}

export type SolarBodyPositionResolver = (
  bodyName: string,
  date: Date,
) => Vector3

export type LocationPositionContext = {
  date: Date
  resolveSolarBodyPosition: SolarBodyPositionResolver
}

const STATIC_OFFSETS_AU = {
  moon: 0.00257,
  europa: 0.00449,
  ganymede: 0.00715,
  callisto: 0.01258,
} as const

const SOLAR_BODY_MARKER_SCALES = new Map(
  SOLAR_BODIES.map((body) => [body.name, body.displayRadiusAu]),
)

const SOLAR_BODY_LOCATIONS: LocationDefinition[] = [
  {
    id: 'sun',
    name: SUN.name,
    group: 'Heliocentric bodies',
    kind: 'star',
    markerScaleAu: SUN.displayRadiusAu,
    position: { type: 'origin' },
  },
  ...SOLAR_BODIES.map((body) => ({
    id: body.name.toLowerCase(),
    name: body.name,
    group: 'Heliocentric bodies',
    kind: body.kind,
    parentId: 'sun',
    markerScaleAu: body.displayRadiusAu,
    position: { type: 'solar-body', bodyName: body.name } as const,
  })),
]

export const LOCATION_CATALOG: readonly LocationDefinition[] = [
  ...SOLAR_BODY_LOCATIONS,
  {
    id: 'moon',
    name: 'Moon',
    group: 'Earth sphere',
    kind: 'moon',
    parentId: 'earth',
    markerScaleAu: 0.0032,
    position: {
      type: 'anchored-offset',
      anchorLocationId: 'earth',
      offsetAu: [STATIC_OFFSETS_AU.moon, 0, 0],
    },
  },
  {
    id: 'earth-orbit-freight-ring',
    name: 'Earth Orbit Freight Ring',
    group: 'Earth sphere',
    kind: 'station',
    parentId: 'earth',
    markerScaleAu: 0.0024,
    position: {
      type: 'anchored-offset',
      anchorLocationId: 'earth',
      offsetAu: [0.00018, 0.00004, 0],
    },
  },
  {
    id: 'luna-logistics-base',
    name: 'Luna Logistics Base',
    group: 'Earth sphere',
    kind: 'colony',
    parentId: 'moon',
    markerScaleAu: 0.0021,
    position: {
      type: 'anchored-offset',
      anchorLocationId: 'moon',
      offsetAu: [0, 0.00005, 0],
    },
  },
  {
    id: 'cislunar-transfer-station',
    name: 'Cislunar Transfer Station',
    group: 'Earth sphere',
    kind: 'station',
    parentId: 'earth',
    markerScaleAu: 0.0022,
    position: {
      type: 'anchored-offset',
      anchorLocationId: 'earth',
      offsetAu: [0.0013, -0.00005, 0],
    },
  },
  {
    id: 'mars-prime-colony',
    name: 'Mars Prime Colony',
    group: 'Mars sphere',
    kind: 'colony',
    parentId: 'mars',
    markerScaleAu: 0.0022,
    position: {
      type: 'anchored-offset',
      anchorLocationId: 'mars',
      offsetAu: [0.00005, 0.00002, 0],
    },
  },
  {
    id: 'mars-high-port',
    name: 'Mars High Port',
    group: 'Mars sphere',
    kind: 'station',
    parentId: 'mars',
    markerScaleAu: 0.0023,
    position: {
      type: 'anchored-offset',
      anchorLocationId: 'mars',
      offsetAu: [0.00014, 0.00002, 0],
    },
  },
  {
    id: 'europa',
    name: 'Europa',
    group: 'Jovian support',
    kind: 'moon',
    parentId: 'jupiter',
    markerScaleAu: 0.0027,
    position: {
      type: 'anchored-offset',
      anchorLocationId: 'jupiter',
      offsetAu: [STATIC_OFFSETS_AU.europa, 0, 0],
    },
  },
  {
    id: 'europa-research-dock',
    name: 'Europa Research Dock',
    group: 'Jovian support',
    kind: 'station',
    parentId: 'europa',
    markerScaleAu: 0.002,
    position: {
      type: 'anchored-offset',
      anchorLocationId: 'europa',
      offsetAu: [0, 0.00006, 0],
    },
  },
  {
    id: 'ganymede',
    name: 'Ganymede',
    group: 'Jovian support',
    kind: 'moon',
    parentId: 'jupiter',
    markerScaleAu: 0.003,
    position: {
      type: 'anchored-offset',
      anchorLocationId: 'jupiter',
      offsetAu: [STATIC_OFFSETS_AU.ganymede, 0, 0],
    },
  },
  {
    id: 'ganymede-transfer-yard',
    name: 'Ganymede Transfer Yard',
    group: 'Jovian support',
    kind: 'station',
    parentId: 'ganymede',
    markerScaleAu: 0.0021,
    position: {
      type: 'anchored-offset',
      anchorLocationId: 'ganymede',
      offsetAu: [0.00003, 0.00005, 0],
    },
  },
  {
    id: 'callisto',
    name: 'Callisto',
    group: 'Jovian support',
    kind: 'moon',
    parentId: 'jupiter',
    markerScaleAu: 0.0031,
    position: {
      type: 'anchored-offset',
      anchorLocationId: 'jupiter',
      offsetAu: [STATIC_OFFSETS_AU.callisto, 0, 0],
    },
  },
  {
    id: 'callisto-freight-depot',
    name: 'Callisto Freight Depot',
    group: 'Jovian support',
    kind: 'colony',
    parentId: 'callisto',
    markerScaleAu: 0.0021,
    position: {
      type: 'anchored-offset',
      anchorLocationId: 'callisto',
      offsetAu: [0, 0.00008, 0],
    },
  },
] as const

const LOCATION_BY_ID = new Map(
  LOCATION_CATALOG.map((location) => [location.id, location]),
)

const SOLAR_BODY_BY_NAME = new Map(
  SOLAR_BODIES.map((body) => [body.name, body]),
)

export const DEFAULT_LOCATION_ID = 'earth'

export function getLocationById(
  locationId: string,
): LocationDefinition | undefined {
  return LOCATION_BY_ID.get(locationId)
}

export function getLocationCatalog(): readonly LocationDefinition[] {
  return LOCATION_CATALOG
}

export function getLocationParent(
  location: LocationDefinition,
): LocationDefinition | undefined {
  return location.parentId ? getLocationById(location.parentId) : undefined
}

export function formatLocationKind(kind: LocationKind): string {
  switch (kind) {
    case 'star':
      return 'Star'
    case 'planet':
      return 'Planet'
    case 'dwarf-planet':
      return 'Dwarf planet'
    case 'moon':
      return 'Moon'
    case 'colony':
      return 'Colony'
    case 'station':
      return 'Station'
  }
}

export function getLocationMarkerScaleAu(locationId: string): number {
  const location = getLocationById(locationId)

  if (!location) {
    return SUN.displayRadiusAu
  }

  return location.markerScaleAu
}

export function createEphemerisSolarBodyResolver(): SolarBodyPositionResolver {
  return (bodyName, date) => {
    if (bodyName === SUN.name) {
      return new Vector3(0, 0, 0)
    }

    const body = SOLAR_BODY_BY_NAME.get(bodyName)
    return body ? getHeliocentricPositionAu(body, date) : new Vector3(0, 0, 0)
  }
}

export function resolveLocationPosition(
  locationId: string,
  context: LocationPositionContext,
): Vector3 {
  const location = getLocationById(locationId)

  if (!location) {
    return new Vector3(0, 0, 0)
  }

  return resolveLocation(location, context)
}

function resolveLocation(
  location: LocationDefinition,
  context: LocationPositionContext,
): Vector3 {
  switch (location.position.type) {
    case 'origin':
      return new Vector3(0, 0, 0)

    case 'solar-body':
      return context.resolveSolarBodyPosition(
        location.position.bodyName,
        context.date,
      )

    case 'anchored-offset': {
      const anchorPosition = resolveLocationPosition(
        location.position.anchorLocationId,
        context,
      )

      return anchorPosition
        .clone()
        .add(tupleToVector3(location.position.offsetAu))
    }
  }
}

function tupleToVector3(values: Vector3Tuple): Vector3 {
  return new Vector3(values[0], values[1], values[2])
}

export function getSolarBodyMarkerScaleAu(bodyName: string): number {
  return SOLAR_BODY_MARKER_SCALES.get(bodyName) ?? SUN.displayRadiusAu
}
