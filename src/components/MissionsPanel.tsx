import type { FreightMission, MissionStatus } from '../world/missions'
import { Button } from './ui/button'
import { Card } from './ui/card'

type MissionsPanelProps = {
  missions: readonly FreightMission[]
  activeMissionId: string | null
  missionStatus: MissionStatus
  onAcceptMission: (missionId: string) => void
}

export function MissionsPanel({
  missions,
  activeMissionId,
  missionStatus,
  onAcceptMission,
}: MissionsPanelProps) {
  const activeMission = missions.find((m) => m.id === activeMissionId)

  return (
    <Card className="pointer-events-auto border-white/10 bg-slate-950/55 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-slate-50">
          Freight contracts
        </h2>
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
          cargo board
        </span>
      </div>

      {missionStatus === 'completed' && activeMission ? (
        <div className="mt-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-300">
            Delivery complete
          </p>
          <p className="mt-1 text-sm font-medium text-slate-50">
            {activeMission.title}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-300">
            {activeMission.cargoLabel} delivered to{' '}
            {formatDestinationLabel(activeMission.destinationId)}.
          </p>
          <p className="mt-1 text-xs font-medium text-emerald-300">
            +{activeMission.rewardCredits.toLocaleString()} credits
          </p>
        </div>
      ) : missionStatus === 'active' && activeMission ? (
        <div className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.08] px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-300/90">
            Active contract
          </p>
          <p className="mt-1 text-sm font-medium text-slate-50">
            {activeMission.title}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-300">
            Cargo: {activeMission.cargoLabel}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Deliver to:{' '}
            <span className="text-amber-200/80">
              {formatDestinationLabel(activeMission.destinationId)}
            </span>
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Navigate to the destination and arrive to complete the contract.
          </p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-2">
        {missions.map((mission) => {
          const isActive = mission.id === activeMissionId
          const isDone =
            isActive &&
            (missionStatus === 'completed' || missionStatus === 'failed')
          const canAccept =
            activeMissionId === null || (isActive && missionStatus !== 'active')

          if (isActive && missionStatus === 'active') return null

          return (
            <div
              key={mission.id}
              className={[
                'rounded-2xl border px-3 py-3',
                isDone
                  ? 'border-emerald-400/20 bg-emerald-400/[0.06]'
                  : 'border-white/10 bg-white/[0.04]',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-50">
                    {mission.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {mission.description}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-400">
                    Cargo:{' '}
                    <span className="text-slate-300">{mission.cargoLabel}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Route:{' '}
                    <span className="text-slate-300">
                      {formatDestinationLabel(mission.originId)} →{' '}
                      {formatDestinationLabel(mission.destinationId)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-cyan-300/80">
                    {mission.rewardCredits.toLocaleString()} cr
                  </p>
                </div>
              </div>

              {isDone ? (
                <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-400/80">
                  Delivered ✓
                </p>
              ) : canAccept ? (
                <Button
                  className="mt-2 w-full"
                  data-testid={`accept-mission-${mission.id}`}
                  onClick={() => onAcceptMission(mission.id)}
                  size="sm"
                  variant="secondary"
                >
                  Accept contract
                </Button>
              ) : null}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function formatDestinationLabel(locationId: string): string {
  return locationId
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
