# ADR 006: Missions, cargo, and freight contracts

- **Status:** Accepted
- **Date:** 2026-04-09

## Context

ADR 005 established the autonomous space-trucking loop as the default play
model: the player commands a freighter by selecting destinations and monitoring
travel rather than manually piloting. That rewrite delivered the destination
selection UI, autonomous guidance stack, and a freight-network location
catalog covering Earth, Mars, and selected Jovian-moon destinations.

The resulting prototype is complete at the transport layer — the ship travels
autonomously between real simulated bodies — but there is no gameplay layer on
top of it. The player selects destinations and watches the simulation advance,
but there is no reason to go anywhere in particular. The known limitation from
the roadmap captures this:

> There are still no missions, cargo systems, stations, or local-space
> destination gameplay.

The acceptance criteria for closing that gap are:

- Players can accept at least one mission or freight contract.
- Cargo or destination state affects gameplay and can be completed or failed.
- At least one station or local-space destination exists in the gameplay loop.

## Decision

### 1. Introduce freight delivery contracts as the first mission type

The first gameplay layer is a set of **freight delivery contracts**. Each
contract represents a cargo consignment that needs to travel between two
named locations in the existing freight network.

A contract has:

- a stable `id`
- a human-readable `title` and `description`
- an `originId` — the station or colony the cargo is loaded at
- a `destinationId` — the station or colony it must be delivered to
- a `cargoLabel` — what is being transported (flavour text for v1)
- a `rewardCredits` — credits awarded on delivery (for future economy use)

Origin and destination IDs must reference entries in the existing location
catalog (`LOCATION_CATALOG` in `src/world/locations.ts`).

### 2. Mission state machine

Each contract moves through a minimal lifecycle:

```
available → active → completed
                  ↘ failed (reserved for future deadline / abort mechanics)
```

- **available** — the contract is in the board and has not been accepted.
- **active** — the player has accepted the contract; the cargo is aboard.
- **completed** — the ship has arrived at the contract's `destinationId` while
  the contract is active.
- **failed** — reserved for future use (deadline expiry, abandon action). Not
  used in this first pass.

Only one contract may be active at a time in v1 to keep state simple.

### 3. Arrival detection hooks into the autonomous guidance phase

The autonomous guidance stack already exposes an `autonomousPhase` value that
reaches `'arrived'` when the ship is within the arrival threshold of its
current planned destination. Contract completion is triggered when:

- a contract is in `active` state, **and**
- `autonomousPhase === 'arrived'`, **and**
- `selectedLocationId === activeMission.destinationId`

This wires the existing navigation loop into the gameplay loop without
adding a separate proximity sensor or a new physics pass.

### 4. Mission catalog is hard-coded for v1

The first pass ships a small hard-coded catalog of at least three contracts
spread across the freight network:

| Contract | Origin | Destination |
|---|---|---|
| Mars Supply Run | Earth Orbit Freight Ring | Mars High Port |
| Jovian Outpost Resupply | Ganymede Transfer Yard | Callisto Freight Depot |
| Lunar Logistics Delivery | Cislunar Transfer Station | Luna Logistics Base |

This covers the Earth sphere, the Mars sphere, and the Jovian support network
defined in ADR 005, keeping the first mission pass from being content-heavy
while still exercising all three destination regions.

### 5. Mission panel is added to the left sidebar

A `MissionsPanel` component is added to the left-sidebar column in `App.tsx`
beneath the existing navigation and metrics panels. It shows:

- available contracts (title, route, cargo, reward) with an Accept button
- the active contract's delivery status and destination
- a success banner when the contract is completed

The panel does not replace the existing `ControlPanel` or `MetricsPanel`; it
is additive.

### 6. App-level state owns mission lifecycle

Mission state lives in `App.tsx` as a controlled React state value:

- `activeMissionId: string | null` — which contract (if any) is active
- `missionStatus: MissionStatus` — the lifecycle phase of the active contract

The scene component does not need to know about missions; it only exposes
`autonomousPhase` through `onMetricsChange` as it already does. `App.tsx`
compares the reported `autonomousPhase` and `selectedLocationId` to the active
contract's `destinationId` to drive completion.

## Consequences

### Positive

- The freight-network destinations built in ADR 005 now have a gameplay
  purpose: there is a reason to navigate to specific stations.
- The completion flow is driven entirely by the existing autonomous guidance
  phase; no new physics or proximity logic is required.
- The hard-coded catalog is easy to extend later with dynamic contracts, time
  limits, or payout economies without touching the state machine.
- A `rewardCredits` field on each contract is a clear hook for a future
  currency/economy system.

### Negative

- Only one mission can be active at a time; multi-leg hauls are deferred.
- There is no failure mechanic yet; the `failed` state is reserved but not
  reachable through normal play.
- The reward value is display-only in v1 — there is no persistent currency
  balance yet.

## Follow-up

- Add a persistent credits balance and update it on contract completion.
- Add time limits and the `failed` state for deadline-based contracts.
- Add multi-leg freight routes where the origin must be visited before
  the destination unlock triggers.
- Add dynamic contract generation tied to the simulation date and ship
  position.
