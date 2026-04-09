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

    screen
      .getByTestId('accept-mission-mars-supply-run')
      .click()

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
})
