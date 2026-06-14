export type MissionStatus =
  | 'available'
  | 'active'
  | 'in-transit'
  | 'completed'
  | 'failed'

export type FreightMission = {
  id: string
  title: string
  description: string
  originId: string
  destinationId: string
  cargoLabel: string
  rewardCredits: number
}

export const MISSION_CATALOG: readonly FreightMission[] = [
  {
    id: 'mars-supply-run',
    title: 'Mars Supply Run',
    description:
      'Deliver pressurized habitat modules from the Earth Orbit Freight Ring to Mars High Port. Critical infrastructure for the expanding Mars Prime Colony.',
    originId: 'earth-orbit-freight-ring',
    destinationId: 'mars-high-port',
    cargoLabel: 'Habitat modules',
    rewardCredits: 4200,
  },
  {
    id: 'jovian-outpost-resupply',
    title: 'Jovian Outpost Resupply',
    description:
      'Transport food stores and medical supplies from the Ganymede Transfer Yard to the Callisto Freight Depot. The depot is running low after the last convoy delay.',
    originId: 'ganymede-transfer-yard',
    destinationId: 'callisto-freight-depot',
    cargoLabel: 'Food stores and medical supplies',
    rewardCredits: 6800,
  },
  {
    id: 'lunar-logistics-delivery',
    title: 'Lunar Logistics Delivery',
    description:
      'Haul water ice and electrolysis gear from the Cislunar Transfer Station to Luna Logistics Base. Supports ongoing propellant production at the lunar outpost.',
    originId: 'cislunar-transfer-station',
    destinationId: 'luna-logistics-base',
    cargoLabel: 'Water ice and electrolysis gear',
    rewardCredits: 1800,
  },
]

const MISSION_BY_ID = new Map(
  MISSION_CATALOG.map((mission) => [mission.id, mission]),
)

export function getMissionById(id: string): FreightMission | undefined {
  return MISSION_BY_ID.get(id)
}

export function getMissionCatalog(): readonly FreightMission[] {
  return MISSION_CATALOG
}

export function getMissionAtOrigin(
  mission: FreightMission | undefined,
  selectedLocationId: string,
): boolean {
  return Boolean(mission) && mission!.originId === selectedLocationId
}

export function getMissionAtDestination(
  mission: FreightMission | undefined,
  selectedLocationId: string,
): boolean {
  return Boolean(mission) && mission!.destinationId === selectedLocationId
}

export function isMissionCargoLoaded(
  mission: FreightMission | undefined,
  status: MissionStatus,
): boolean {
  if (!mission) return false
  return status === 'in-transit' || status === 'completed'
}

/**
 * Returns true when an in-transit mission has been delivered: the ship
 * has arrived (autonomousPhase === 'arrived') at the mission's
 * destination. Used by the existing completion banner test and by the
 * App-level reducer (it is the `in-transit → completed` transition).
 */
export function isMissionCompleted(
  mission: FreightMission | undefined,
  autonomousPhase: string,
  selectedLocationId: string,
): boolean {
  if (!mission) return false
  return (
    autonomousPhase === 'arrived' &&
    selectedLocationId === mission.destinationId
  )
}

/**
 * Reducer for the freight mission lifecycle:
 *   available → active → in-transit → completed
 *                          ↘ failed (reserved)
 *
 * The transition rules are:
 * - `active` advances to `in-transit` when the ship is `arrived` at
 *   `mission.originId`.
 * - `in-transit` advances to `completed` when the ship is `arrived` at
 *   `mission.destinationId`.
 * - `completed` and `failed` are terminal: this reducer never auto-
 *   transitions out of them, which keeps the freight board interactive
 *   after delivery.
 * - In every other case the current status is returned unchanged.
 */
export function getNextMissionStatus(
  mission: FreightMission | undefined,
  currentStatus: MissionStatus,
  autonomousPhase: string,
  selectedLocationId: string,
): MissionStatus {
  if (!mission) return currentStatus

  if (currentStatus === 'active') {
    if (
      autonomousPhase === 'arrived' &&
      selectedLocationId === mission.originId
    ) {
      return 'in-transit'
    }
    return 'active'
  }

  if (currentStatus === 'in-transit') {
    if (
      autonomousPhase === 'arrived' &&
      selectedLocationId === mission.destinationId
    ) {
      return 'completed'
    }
    return 'in-transit'
  }

  return currentStatus
}
