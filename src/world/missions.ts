export type MissionStatus = 'available' | 'active' | 'completed' | 'failed'

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

/**
 * Returns true when an active mission should be marked completed: the ship
 * has arrived (autonomousPhase === 'arrived') at the mission's destination.
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
