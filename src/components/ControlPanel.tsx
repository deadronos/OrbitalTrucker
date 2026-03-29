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
    <section className="panel controls-panel">
      <h2>Flight controls</h2>
      <ul>
        <li>
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd> thrust forward / strafe
        </li>
        <li>
          <kbd>Q</kbd>
          <kbd>E</kbd> vertical thrusters
        </li>
        <li>
          <kbd>Shift</kbd> boost
        </li>
        <li>
          <kbd>Space</kbd> emergency dampeners
        </li>
        <li>Drag to rotate heading</li>
        <li>Wheel to adjust chase camera zoom</li>
        <li>
          <kbd>[</kbd>
          <kbd>]</kbd> adjust time warp
        </li>
        <li>
          <kbd>T</kbd> orient to target
        </li>
      </ul>

      <h2>Target tracking</h2>
      <div className="target-list">
        {targetNames.map((targetName) => (
          <button
            className={
              targetName === selectedBodyName
                ? 'target-chip active'
                : 'target-chip'
            }
            data-testid={`target-${targetName.toLowerCase()}`}
            key={targetName}
            onClick={() => {
              onSelectBody(targetName)
            }}
            type="button"
          >
            {targetName}
          </button>
        ))}
      </div>

      <div className="controls-row">
        <button onClick={onOrientToTarget} type="button">
          Orient to target
        </button>
      </div>
    </section>
  )
}
