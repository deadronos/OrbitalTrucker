type LegendBody = {
  name: string
  semiMajorAxisAu: number
  orbitalPeriodDays: number
}

type LegendPanelProps = {
  bodies: LegendBody[]
}

export function LegendPanel({ bodies }: LegendPanelProps) {
  return (
    <section className="pointer-events-auto rounded-3xl border border-white/10 bg-slate-950/55 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-slate-50">
          Orbital reference
        </h2>
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
          data
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-300">
        Semi-major axis and sidereal period for the bodies currently rendered.
      </p>
      <ul className="mt-3 max-h-52 space-y-1 overflow-y-auto pr-1">
        {bodies.map((body) => (
          <li
            className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-200"
            key={body.name}
          >
            <span className="font-medium text-slate-50">{body.name}</span>
            <span className="tabular-nums text-slate-300">
              {body.semiMajorAxisAu.toFixed(3)} AU
            </span>
            <span className="tabular-nums text-slate-300">
              {Math.round(body.orbitalPeriodDays).toLocaleString()} d
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
