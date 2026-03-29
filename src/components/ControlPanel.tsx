import { Button } from './ui/button'
import { Card } from './ui/card'

type ControlPanelProps = {
  selectedBodyName: string
  targetNames: string[]
  onSelectBody: (bodyName: string) => void
  onOrientToTarget: () => void
}

export function ControlPanel({
  selectedBodyName,
  targetNames,
  onSelectBody,
  onOrientToTarget,
}: ControlPanelProps) {
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
        <ControlHint keys={['Space']} label="Dampeners" />
        <ControlHint keys={['Drag']} label="Rotate heading" />
        <ControlHint keys={['Wheel']} label="Chase zoom" />
        <ControlHint keys={['[', ']']} label="Time warp" />
        <ControlHint keys={['T']} label="Target orient" />
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
          Target tracking
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {targetNames.map((targetName) => (
            <Button
              className={
                targetName === selectedBodyName
                  ? 'active min-w-fit'
                  : 'min-w-fit'
              }
              data-testid={`target-${targetName.toLowerCase()}`}
              key={targetName}
              onClick={() => {
                onSelectBody(targetName)
              }}
              size="sm"
              variant={targetName === selectedBodyName ? 'default' : 'outline'}
              type="button"
            >
              {targetName}
            </Button>
          ))}
        </div>
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
