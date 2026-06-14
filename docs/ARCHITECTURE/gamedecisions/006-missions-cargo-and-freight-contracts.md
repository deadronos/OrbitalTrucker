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

Each contract moves through a multi-leg lifecycle that mirrors the physical
freight run: contract accepted → travel to the origin → cargo loaded at
the origin → travel to the destination → delivery and payout.

```text
available → active → in-transit → completed
                       ↘ failed (reserved for future deadline / abort mechanics)
```

- **available** — the contract is on the board and has not been accepted.
- **active** — the player has accepted the contract. The contract's
  `originId` is the next navigation target; no cargo is loaded yet.
- **in-transit** — the ship has arrived at the contract's `originId`, the
  cargo is considered loaded, and the `destinationId` is now the active
  navigation target.
- **completed** — the ship has arrived at the contract's `destinationId`
  while the contract is `in-transit`. The contract's `rewardCredits` is
  added to the player's persistent credit balance.
- **failed** — reserved for future use (deadline expiry, abandon action).
  Not reachable in this iteration.

Only one contract may be active at a time in v1 to keep state simple. The
mission panel and the destination select remain interactive in all states
so the player can reroute the ship at any time.

#### Completion does not lock the board

Reaching `completed` (or `failed`) for the active contract must not block the
player from picking a different contract off the freight board. The board
remains interactive in those terminal states, and a successful delivery simply
returns the completed contract to the available set.

Concretely, a contract row shows an **Accept contract** button when:

- the active mission id is `null` (nothing in flight), **or**
- the active mission is no longer in the `active` state (`completed` or
  `failed`) — in which case the player may accept any contract, including a
  different one. Accepting a new contract replaces the active id and resets
  `missionStatus` to `active`, which dismisses the completion banner.

This is what the user sees after a delivery:

1. The completed contract's row is marked **Delivered ✓**.
2. The completion banner at the top of the panel is still visible so the
   player can read the reward summary.
3. Every other contract row exposes an **Accept contract** button, and
   clicking one advances the game onto the next haul without reloading.

The active contract row itself does not show an Accept button while it is in
the `active` state; that row is hidden from the board while the ship is
working on it.

### 3. Arrival detection and status transitions

The autonomous guidance stack already exposes an `autonomousPhase` value
that reaches `'arrived'` whenever the ship is within the arrival
threshold of the currently selected destination. Both mission transitions
are driven off that same phase plus the selected destination, so we do
not add a new proximity sensor or physics pass.

The mission's next status is computed in `src/world/missions.ts` by
`getNextMissionStatus(mission, currentStatus, autonomousPhase,
selectedLocationId)`. It returns:

- `'in-transit'` when `currentStatus === 'active'`,
  `selectedLocationId === mission.originId`, and
  `autonomousPhase === 'arrived'`.
- `'completed'` when `currentStatus === 'in-transit'`,
  `selectedLocationId === mission.destinationId`, and
  `autonomousPhase === 'arrived'`.
- the unchanged `currentStatus` in every other case, including the
  `completed` and `failed` terminal states (no auto-transition out of a
  terminal state).

`App.tsx` calls this reducer from the existing `onMetricsChange`
callback and, when the result changes, advances the mission state and
adds the reward to the credit balance in the same effect. The reward is
credited exactly once per contract, at the moment of the
`in-transit → completed` transition, even if the player lingers at the
destination.

### 4. Mission catalog is hard-coded for v1

The first pass ships a small hard-coded catalog of at least three contracts
spread across the freight network:

| Contract                 | Origin                    | Destination            |
| ------------------------ | ------------------------- | ---------------------- |
| Mars Supply Run          | Earth Orbit Freight Ring  | Mars High Port         |
| Jovian Outpost Resupply  | Ganymede Transfer Yard    | Callisto Freight Depot |
| Lunar Logistics Delivery | Cislunar Transfer Station | Luna Logistics Base    |

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

### 7. Persistent credit balance

The player's credit balance is a single non-negative integer that
survives page reloads. It is owned by `App.tsx` and persisted to
`localStorage` under the key `orbitaltrucker.credits` via the helpers
in `src/world/credits.ts`.

- `loadCredits()` reads the value, returns `0` for missing, non-numeric,
  or negative entries. Used once on App mount.
- `saveCredits(value)` writes a sanitized non-negative integer to
  `localStorage`. Used on every change.
- `awardCredits(balance, reward)` returns `balance + reward` and is the
  only mutation path used by the mission loop.

The current balance is shown in the freight contracts panel header
(below the "Freight contracts" title) so the player always sees their
haul total, and it is included in the completion banner ("Delivery
complete" → "+4,200 cr · Balance: 6,200 cr") so the running total is
visible at the moment of payout.

The balance starts at `0` for new sessions. A future ADR may add a
starting cash grant and per-credit spending (fuel, repairs, equipment).

## Follow-up

- Add time limits and the `failed` state for deadline-based contracts.
- Add a starting credit grant and an economy that spends credits on
  fuel, repairs, and equipment.
- Add dynamic contract generation tied to the simulation date and ship
  position, including payout scaling with distance and cargo class.
- Add cargo capacity constraints so multi-leg hauls compete for hold
  space.
