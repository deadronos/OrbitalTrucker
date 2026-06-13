import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MissionsPanel } from '../../src/components/MissionsPanel'
import { getMissionCatalog } from '../../src/world/missions'

const missions = getMissionCatalog()

describe('MissionsPanel', () => {
  it('renders all available freight contracts with accept buttons', () => {
    render(
      <MissionsPanel
        activeMissionId={null}
        missionStatus="available"
        missions={missions}
        onAcceptMission={vi.fn()}
      />,
    )

    expect(screen.getByText('Freight contracts')).toBeInTheDocument()
    expect(screen.getByText('Mars Supply Run')).toBeInTheDocument()
    expect(screen.getByText('Jovian Outpost Resupply')).toBeInTheDocument()
    expect(screen.getByText('Lunar Logistics Delivery')).toBeInTheDocument()
    expect(screen.getAllByText('Accept contract').length).toBe(missions.length)
  })

  it('calls onAcceptMission with the mission id when the accept button is clicked', async () => {
    const onAcceptMission = vi.fn()

    render(
      <MissionsPanel
        activeMissionId={null}
        missionStatus="available"
        missions={missions}
        onAcceptMission={onAcceptMission}
      />,
    )

    screen.getByTestId('accept-mission-mars-supply-run').click()

    expect(onAcceptMission).toHaveBeenCalledWith('mars-supply-run')
  })

  it('shows the active contract banner and hides the accept button for it', () => {
    render(
      <MissionsPanel
        activeMissionId="mars-supply-run"
        missionStatus="active"
        missions={missions}
        onAcceptMission={vi.fn()}
      />,
    )

    expect(screen.getByText('Active contract')).toBeInTheDocument()
    // Active mission row is hidden entirely; no accept button for it
    expect(screen.queryByTestId('accept-mission-mars-supply-run')).toBeNull()
    // Only one contract active at a time: other missions visible but not acceptable
    expect(
      screen.queryByTestId('accept-mission-jovian-outpost-resupply'),
    ).toBeNull()
    expect(screen.getByText('Jovian Outpost Resupply')).toBeInTheDocument()
  })

  it('shows a completion banner when the mission is completed', () => {
    render(
      <MissionsPanel
        activeMissionId="mars-supply-run"
        missionStatus="completed"
        missions={missions}
        onAcceptMission={vi.fn()}
      />,
    )

    expect(screen.getByText('Delivery complete')).toBeInTheDocument()
    expect(screen.getByText('+4,200 credits')).toBeInTheDocument()
  })

  it('allows accepting a different contract after the active one completes', () => {
    // After delivery the active contract is in 'completed' state, but other
    // contracts on the board must still be accept-able so the player can
    // advance to the next haul (regression test for issue #39).
    render(
      <MissionsPanel
        activeMissionId="mars-supply-run"
        missionStatus="completed"
        missions={missions}
        onAcceptMission={vi.fn()}
      />,
    )

    // The completed contract is marked as delivered and no longer exposes an
    // accept button — the player should pick a different contract.
    expect(screen.getByText('Delivered ✓')).toBeInTheDocument()
    expect(screen.queryByTestId('accept-mission-mars-supply-run')).toBeNull()

    // Other contracts on the board must be selectable.
    expect(
      screen.getByTestId('accept-mission-jovian-outpost-resupply'),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('accept-mission-lunar-logistics-delivery'),
    ).toBeInTheDocument()
  })

  it('invokes onAcceptMission with the new contract id after completion', () => {
    const onAcceptMission = vi.fn()

    render(
      <MissionsPanel
        activeMissionId="mars-supply-run"
        missionStatus="completed"
        missions={missions}
        onAcceptMission={onAcceptMission}
      />,
    )

    screen.getByTestId('accept-mission-jovian-outpost-resupply').click()

    expect(onAcceptMission).toHaveBeenCalledWith('jovian-outpost-resupply')
  })

  it('locks the board only while a contract is in flight', () => {
    // While the active contract is in the 'active' state every other contract
    // on the board must remain locked — that part of the previous behavior is
    // preserved.
    const { rerender } = render(
      <MissionsPanel
        activeMissionId="mars-supply-run"
        missionStatus="active"
        missions={missions}
        onAcceptMission={vi.fn()}
      />,
    )

    expect(
      screen.queryByTestId('accept-mission-jovian-outpost-resupply'),
    ).toBeNull()
    expect(
      screen.queryByTestId('accept-mission-lunar-logistics-delivery'),
    ).toBeNull()

    // Once the active mission moves to a terminal state, the board unlocks.
    rerender(
      <MissionsPanel
        activeMissionId="mars-supply-run"
        missionStatus="failed"
        missions={missions}
        onAcceptMission={vi.fn()}
      />,
    )

    expect(
      screen.getByTestId('accept-mission-jovian-outpost-resupply'),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('accept-mission-lunar-logistics-delivery'),
    ).toBeInTheDocument()
  })
})
