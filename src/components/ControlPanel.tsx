import {
  formatLocationKind,
  getLocationParent,
  type LocationDefinition,
} from '../world/locations'
import { Button } from './ui/button'
import { Card } from './ui/card'

type ControlPanelProps = {
  destinations: readonly LocationDefinition[]
  selectedLocationId: string
  onSelectLocation: (locationId: string) => void
  onOrientToTarget: () => void
}

export function ControlPanel({
  destinations,
  selectedLocationId,
  onSelectLocation,
  onOrientToTarget,
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
          Controls
        </h2>
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
          compact
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <ControlHint keys={['W', 'A', 'S', 'D']} label="Thrust / strafe" />
        <ControlHint keys={['Q', 'E']} label="Vertical thrusters" />
        <ControlHint keys={['Shift']} label="Boost" />
        <ControlHint keys={['Space']} label="Kill velocity" />
        <ControlHint keys={['←', '→', '↑', '↓']} label="Rotation thrusters" />
        <ControlHint keys={['R']} label="Kill rotation" />
        <ControlHint keys={['F']} label="Toggle rotation assist" />
        <ControlHint keys={['Drag']} label="Rotate heading" />
        <ControlHint keys={['Wheel']} label="Chase zoom" />
        <ControlHint keys={['[', ']']} label="Time warp" />
        <ControlHint keys={['T']} label="Target orient" />
      </div>

      <div className="mt-4">
        <label
          className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400"
          htmlFor="destination-select"
        >
          Destination
        </label>
        <select
          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
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
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <p className="text-sm font-medium text-slate-50">
              {selectedLocation.name}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-300">
              {formatLocationKind(selectedLocation.kind)}
              {selectedParent ? ` · Parent: ${selectedParent.name}` : ''}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        <Button onClick={onOrientToTarget} size="sm" variant="secondary">
          Orient to target
        </Button>
      </div>
    </Card>
  )
}

type ControlHintProps = {
  keys: string[]
  label: string
}

function ControlHint({ keys, label }: ControlHintProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {keys.map((key) => (
          <kbd
            className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-white/10 bg-white/10 px-1.5 text-[10px] font-medium text-slate-50 shadow-sm"
            key={key}
          >
            {key}
          </kbd>
        ))}
      </div>
      <p className="mt-1.5 text-xs leading-5 text-slate-300">{label}</p>
    </div>
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
