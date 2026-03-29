import {
  formatAutonomousPhase,
  formatTimeWarp,
  formatTransferPlannerStatus,
} from '../simulation/formatters'
import type { SimulationMetrics } from '../simulation/types'
import {
  formatLocationKind,
  getLocationParent,
  type LocationDefinition,
} from '../world/locations'
import { Card } from './ui/card'

type ControlPanelProps = {
  destinations: readonly LocationDefinition[]
  metrics: SimulationMetrics
  selectedLocationId: string
  timeWarpDaysPerSecond: number
  onSelectLocation: (locationId: string) => void
}

export function ControlPanel({
  destinations,
  metrics,
  selectedLocationId,
  timeWarpDaysPerSecond,
  onSelectLocation,
}: ControlPanelProps) {
  const selectedLocation =
    destinations.find((location) => location.id === selectedLocationId) ??
    destinations[0]
  const selectedParent = selectedLocation
    ? getLocationParent(selectedLocation)
    : undefined
  const destinationGroups = groupDestinations(destinations)

  return (
    <Card className="pointer-events-auto border-white/10 bg-slate-950/55 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-slate-50">
          Navigation
        </h2>
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
          live route
        </span>
      </div>

      <div className="mt-3 rounded-2xl border border-cyan-300/15 bg-cyan-400/10 px-3 py-3">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-100/85">
          Destination-driven bridge
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-200">
          Choose a destination and the freighter will retarget, reacquire
          course, and keep updating the trip plan as the system moves.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusPill
            label={`Autonomy: ${formatAutonomousPhase(metrics.autonomousPhase)}`}
          />
          <StatusPill
            label={`Planner: ${formatTransferPlannerStatus(metrics.plannerStatus)}`}
          />
          <StatusPill label={`Sim: ${formatTimeWarp(timeWarpDaysPerSecond)}`} />
        </div>
      </div>

      <div className="mt-4">
        <label
          className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400"
          htmlFor="destination-select"
        >
          Current destination
        </label>
        <select
          className="mt-2 w-full rounded-2xl border border-cyan-300/20 bg-white/[0.05] px-3 py-2.5 text-sm text-slate-50 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
          data-testid="destination-select"
          id="destination-select"
          onChange={(event) => {
            onSelectLocation(event.target.value)
          }}
          value={selectedLocationId}
        >
          {destinationGroups.map(([groupName, locations]) => (
            <optgroup key={groupName} label={groupName}>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name} ({formatLocationKind(location.kind)})
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {selectedLocation ? (
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
              Destination summary
            </p>
            <p className="mt-2 text-sm font-medium text-slate-50">
              {selectedLocation.name}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-300">
              {selectedLocation.group} ·{' '}
              {formatLocationKind(selectedLocation.kind)}
              {selectedParent ? ` · Parent: ${selectedParent.name}` : ''}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Destination changes apply immediately and the flight computer will
              transition between course acquisition, cruise, braking, and
              arrival without manual steering prompts.
            </p>
          </div>
        ) : null}
      </div>
    </Card>
  )
}

type StatusPillProps = {
  label: string
}

function StatusPill({ label }: StatusPillProps) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-slate-100">
      {label}
    </span>
  )
}

function groupDestinations(destinations: readonly LocationDefinition[]) {
  const groups = new Map<string, LocationDefinition[]>()

  for (const destination of destinations) {
    const group = groups.get(destination.group)

    if (group) {
      group.push(destination)
      continue
    }

    groups.set(destination.group, [destination])
  }

  return Array.from(groups.entries())
}
