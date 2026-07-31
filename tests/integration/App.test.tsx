import { render, screen } from '@testing-library/react'
import { act, useEffect } from 'react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { AppShell } from '../../src/App'
import type { SimulatorCanvasProps } from '../../src/components/SimulatorCanvas'

function StubScene({
  onMetricsChange,
  selectedLocationId,
}: SimulatorCanvasProps) {
  useEffect(() => {
    onMetricsChange({
      simulatedDate: new Date('2026-03-29T12:00:00.000Z'),
      shipSpeedKmPerSecond: 42.4,
      heliocentricDistanceAu: 1.04,
      currentTargetDistanceAu: selectedLocationId === 'pluto' ? 34.95 : 2.03,
      plannedDistanceAu: selectedLocationId === 'pluto' ? 36.4 : 2.08,
      plannerStatus:
        selectedLocationId === 'pluto'
          ? 'future-intercept'
          : 'current-position',
      autonomousPhase:
        selectedLocationId === 'pluto' ? 'cruising' : 'acquiring',
      targetBearingDeg: 45,
      etaDays: selectedLocationId === 'pluto' ? 365 : null,
      interceptTimeSeconds:
        selectedLocationId === 'pluto' ? 100 * 86_400 : null,
      interceptDate:
        selectedLocationId === 'pluto'
          ? new Date('2026-07-07T12:00:00.000Z')
          : null,
      targetMotionDuringInterceptAu: selectedLocationId === 'pluto' ? 1.45 : 0,
    })
  }, [onMetricsChange, selectedLocationId])

  return <div data-testid="stub-scene" />
}

describe('AppShell', () => {
  it('renders scene metrics and reacts to target selection', async () => {
    const user = userEvent.setup()

    render(<AppShell SceneComponent={StubScene} />)

    expect(screen.getByTestId('stub-scene')).toBeInTheDocument()
    expect(screen.getByText('42.4 km/s')).toBeInTheDocument()
    expect(screen.getByText('2.03 AU')).toBeInTheDocument()
    expect(screen.getByText('2.08 AU')).toBeInTheDocument()
    expect(screen.getByText('Acquiring course')).toBeInTheDocument()

    await user.selectOptions(
      screen.getByLabelText('Current destination'),
      'pluto',
    )

    expect(screen.getByText('34.95 AU')).toBeInTheDocument()
    expect(screen.getByText('36.40 AU')).toBeInTheDocument()
    expect(screen.getByText('Future intercept')).toBeInTheDocument()
    expect(screen.getByText('Cruising')).toBeInTheDocument()
    expect(screen.getByText('100.0 d')).toBeInTheDocument()
    expect(screen.getByText('Tue, 07 Jul 2026 12:00 UTC')).toBeInTheDocument()
    expect(screen.getByTestId('destination-select')).toHaveValue('pluto')
  })

  it('lets the player advance to a different contract after delivery', async () => {
    // Regression test for issue #39: after the active contract is marked
    // completed, the player must be able to accept a *different* contract
    // off the freight board without reloading the app.

    type Metrics = Parameters<
      NonNullable<SimulatorCanvasProps['onMetricsChange']>
    >[0]

    let pushMetrics: ((metrics: Metrics) => void) | null = null
    let lastDestination: string | null = null

    function ControllableStubScene({
      onMetricsChange,
      selectedLocationId,
    }: SimulatorCanvasProps) {
      pushMetrics = onMetricsChange
      lastDestination = selectedLocationId
      return <div data-testid="stub-scene" />
    }

    const user = userEvent.setup()
    render(<AppShell SceneComponent={ControllableStubScene} />)

    // Drive initial metrics so the App is fully wired up.
    act(() => {
      pushMetrics?.({
        simulatedDate: new Date('2026-03-29T12:00:00.000Z'),
        shipSpeedKmPerSecond: 42.4,
        heliocentricDistanceAu: 1.04,
        currentTargetDistanceAu: 0.5,
        plannedDistanceAu: 0.5,
        plannerStatus: 'current-position',
        autonomousPhase: 'acquiring',
        targetBearingDeg: 0,
        etaDays: null,
        interceptTimeSeconds: null,
        interceptDate: null,
        targetMotionDuringInterceptAu: 0,
      })
    })

    // Select the mission's destination so the completion check in App matches.
    await user.selectOptions(
      screen.getByLabelText('Current destination'),
      'mars-high-port',
    )
    expect(lastDestination).toBe('mars-high-port')

    // 1. Accept the first contract.
    await user.click(screen.getByTestId('accept-mission-mars-supply-run'))

    // Active contract row is hidden, board is otherwise locked.
    expect(
      screen.queryByTestId('accept-mission-jovian-outpost-resupply'),
    ).toBeNull()
    expect(
      screen.queryByTestId('accept-mission-lunar-logistics-delivery'),
    ).toBeNull()

    // 2. Reroute to the contract's origin and arrive. The new
    //    `active → in-transit` transition is driven by the same
    //    autonomous guidance signal that triggers completion.
    await user.selectOptions(
      screen.getByLabelText('Current destination'),
      'earth-orbit-freight-ring',
    )
    expect(lastDestination).toBe('earth-orbit-freight-ring')
    act(() => {
      pushMetrics?.({
        simulatedDate: new Date('2026-04-05T12:00:00.000Z'),
        shipSpeedKmPerSecond: 0,
        heliocentricDistanceAu: 1.0,
        currentTargetDistanceAu: 0,
        plannedDistanceAu: 0,
        plannerStatus: 'current-position',
        autonomousPhase: 'arrived',
        targetBearingDeg: 0,
        etaDays: 0,
        interceptTimeSeconds: 0,
        interceptDate: new Date('2026-04-05T12:00:00.000Z'),
        targetMotionDuringInterceptAu: 0,
      })
    })
    expect(screen.getByText('Cargo loaded')).toBeInTheDocument()

    // 3. Simulate the autonomous guidance stack reporting 'arrived' at the
    //    mission destination, which is what triggers completion in App.
    await user.selectOptions(
      screen.getByLabelText('Current destination'),
      'mars-high-port',
    )
    act(() => {
      pushMetrics?.({
        simulatedDate: new Date('2026-04-12T12:00:00.000Z'),
        shipSpeedKmPerSecond: 0,
        heliocentricDistanceAu: 1.5,
        currentTargetDistanceAu: 0,
        plannedDistanceAu: 0,
        plannerStatus: 'current-position',
        autonomousPhase: 'arrived',
        targetBearingDeg: 0,
        etaDays: 0,
        interceptTimeSeconds: 0,
        interceptDate: new Date('2026-04-12T12:00:00.000Z'),
        targetMotionDuringInterceptAu: 0,
      })
    })

    // Completion banner appears, delivered mission is marked as done.
    expect(screen.getByText('Delivery complete')).toBeInTheDocument()
    expect(screen.getByText('Delivered ✓')).toBeInTheDocument()

    // 4. The board unlocks and a *different* contract can be accepted.
    const nextAccept = screen.getByTestId(
      'accept-mission-jovian-outpost-resupply',
    )
    await user.click(nextAccept)

    // The new contract is now active (Pickup banner), the completion
    // banner is gone, and the delivered mission remains on the board as
    // a completed row.
    expect(screen.getByText('Pickup')).toBeInTheDocument()
    expect(screen.queryByText('Delivery complete')).toBeNull()
    expect(
      screen.queryByTestId('accept-mission-jovian-outpost-resupply'),
    ).toBeNull()
  })
})

describe('freight contract loop', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    window.localStorage.clear()
  })

  type Metrics = Parameters<
    NonNullable<SimulatorCanvasProps['onMetricsChange']>
  >[0]

  function renderWithController() {
    let pushMetrics: ((metrics: Metrics) => void) | null = null

    function Controller({
      onMetricsChange,
      selectedLocationId: _selectedLocationId,
    }: SimulatorCanvasProps) {
      pushMetrics = onMetricsChange
      void _selectedLocationId
      return null
    }

    const utils = render(<AppShell SceneComponent={Controller} />)
    return {
      ...utils,
      pushMetrics: (override: Partial<Metrics> = {}) => {
        const metrics: Metrics = {
          simulatedDate: new Date('2026-04-12T12:00:00.000Z'),
          shipSpeedKmPerSecond: 0,
          heliocentricDistanceAu: 1.5,
          currentTargetDistanceAu: 0,
          plannedDistanceAu: 0,
          plannerStatus: 'current-position',
          autonomousPhase: 'arrived',
          targetBearingDeg: 0,
          etaDays: 0,
          interceptTimeSeconds: 0,
          interceptDate: new Date('2026-04-12T12:00:00.000Z'),
          targetMotionDuringInterceptAu: 0,
          ...override,
        }
        act(() => {
          pushMetrics?.(metrics)
        })
      },
    }
  }

  it('requires the player to visit the origin before completing a contract', async () => {
    const user = userEvent.setup()
    const { pushMetrics } = renderWithController()

    pushMetrics()

    // 1. Accept the contract.
    await user.click(screen.getByTestId('accept-mission-mars-supply-run'))
    expect(screen.getByText('Pickup')).toBeInTheDocument()
    expect(screen.getByText('Earth Orbit Freight Ring')).toBeInTheDocument()

    // 2. Fly straight to the destination. Completion must not fire.
    await user.selectOptions(
      screen.getByLabelText('Current destination'),
      'mars-high-port',
    )
    pushMetrics({ autonomousPhase: 'arrived' })
    expect(screen.queryByText('Delivery complete')).toBeNull()
    expect(screen.queryByText('Active contract')).toBeNull()
    expect(screen.getByText('Pickup')).toBeInTheDocument()

    // 3. Reroute to the origin and arrive. Cargo should be loaded.
    await user.selectOptions(
      screen.getByLabelText('Current destination'),
      'earth-orbit-freight-ring',
    )
    pushMetrics()
    expect(screen.getByText('Cargo loaded')).toBeInTheDocument()
    expect(screen.getByText('Mars High Port')).toBeInTheDocument()

    // 4. Fly to the destination and arrive. The mission should complete
    //    and the credit balance should grow by the reward.
    await user.selectOptions(
      screen.getByLabelText('Current destination'),
      'mars-high-port',
    )
    pushMetrics()
    expect(screen.getByText('Delivery complete')).toBeInTheDocument()
    expect(screen.getByText('+4,200 credits')).toBeInTheDocument()
  })

  it('persists the credit balance across remounts', async () => {
    const user = userEvent.setup()

    // First mount: accept and complete a contract.
    const first = renderWithController()
    first.pushMetrics()
    await user.click(
      screen.getByTestId('accept-mission-lunar-logistics-delivery'),
    )
    await user.selectOptions(
      screen.getByLabelText('Current destination'),
      'cislunar-transfer-station',
    )
    first.pushMetrics()
    await user.selectOptions(
      screen.getByLabelText('Current destination'),
      'luna-logistics-base',
    )
    first.pushMetrics()

    expect(window.localStorage.getItem('orbitaltrucker.credits')).toBe('1800')
    first.unmount()

    // Second mount: the balance is restored.
    const second = renderWithController()
    // The balance is loaded synchronously from localStorage during the
    // App's initial state, so the panel header should already show it
    // before any metrics are pushed.
    expect(screen.getByText(/Balance: 1,800 cr/)).toBeInTheDocument()
    // Push an initial metrics frame so the App's effect graph is
    // quiesced (matches the helper used elsewhere in this file).
    second.pushMetrics()
  })
})
