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
    <section className="panel legend-panel">
      <h2>Orbital reference</h2>
      <p className="muted">
        Semi-major axis and sidereal period for the bodies currently rendered.
      </p>
      <ul className="legend-list">
        {bodies.map((body) => (
          <li key={body.name}>
            <span className="legend-name">{body.name}</span>
            <span>{body.semiMajorAxisAu.toFixed(3)} AU</span>
            <span>{Math.round(body.orbitalPeriodDays).toLocaleString()} d</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
