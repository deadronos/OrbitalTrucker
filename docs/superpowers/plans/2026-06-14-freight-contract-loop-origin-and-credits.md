# Issue 49: Freight-Contract Loop — Origin Pickup and Persistent Credits

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the freight-contract gameplay loop so a contract requires the player to (1) pick up cargo at the contract's `originId` and (2) deliver it to `destinationId` to be paid. Reward credits accumulate into a persistent balance that survives reloads and is shown in the HUD.

**Architecture:** Extend the existing mission state machine with a new `in-transit` status that sits between `active` (en route to origin) and `completed` (delivered). Add a small `credits` module that owns localStorage persistence and pure credit arithmetic. Drive status transitions from the same `onMetricsChange` callback in `App.tsx` that already triggers completion, and add a new arrival check for the origin. Update the `MissionsPanel` UI to show pickup/delivery status, the current credit balance, and a running total on the completion banner.

**Tech Stack:** React 19, TypeScript, Vitest, @testing-library/react, Tailwind (v4), localStorage.

---

## File Map

### Files to create

- `src/world/credits.ts` — pure credit arithmetic and localStorage persistence helpers.
- `tests/unit/credits.test.ts` — unit tests for the credit helpers.

### Files to modify

- `src/world/missions.ts` — add `in-transit` status, arrival helpers, and a unified `getNextMissionStatus` reducer. Keep `isMissionCompleted` as a thin wrapper so existing call-sites stay correct.
- `src/App.tsx` — own credits state with localStorage persistence, advance mission state through the new transitions, and pass the balance into the panel.
- `src/components/MissionsPanel.tsx` — show the credit balance in the panel header, swap the active/in-transit banner copy, and surface the new balance in the completion banner.
- `tests/unit/missions.test.ts` — cover the new status and arrival helpers.
- `tests/component/MissionsPanel.test.tsx` — cover the new banner variants and the credits display.
- `tests/integration/App.test.tsx` — add a full-pickup-and-deliver scenario and a persistence scenario.
- `docs/ARCHITECTURE/gamedecisions/006-missions-cargo-and-freight-contracts.md` — extend the ADR to describe the new status, the pickup step, and the persistent credits model.

### Files not touched

- `src/world/locations.ts` — the catalog already contains the origins.
- `src/simulation/**` — the guidance stack already reports `autonomousPhase === 'arrived'` at any selected destination, so no physics change is needed.
- `src/components/SimulatorCanvas.tsx` — same reason.

---

## Task 1: ADR update — document the new state machine and credits

**Files:**

- Modify: `docs/ARCHITECTURE/gamedecisions/006-missions-cargo-and-freight-contracts.md`

ADR 006 already lists the `available → active → completed` state machine and the `failed` reserved state, and the "Follow-up" section explicitly calls out adding a persistent credits balance and a multi-leg pickup flow. The ADR is the source of truth per `AGENTS.md`, so we update it before any code lands.

- [ ] **Step 1: Replace the lifecycle diagram and section 2**

In `docs/ARCHITECTURE/gamedecisions/006-missions-cargo-and-freight-contracts.md`, replace the existing "### 2. Mission state machine" block (the diagram plus the four bullet items that follow it, ending just before "### 3. Arrival detection hooks into the autonomous guidance phase") with:

```markdown
### 2. Mission state machine

Each contract moves through a multi-leg lifecycle that mirrors the physical
freight run: contract accepted → travel to the origin → cargo loaded at
the origin → travel to the destination → delivery and payout.
```

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
```

- [ ] **Step 2: Replace section 3 with the new arrival detection rules**

In the same file, replace the existing "### 3. Arrival detection hooks into the autonomous guidance phase" section with:

```markdown
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
```

- [ ] **Step 3: Document the persistent credits model**

Add a new section 7 (after the existing "### 6. App-level state owns mission lifecycle" section) with the following content:

```markdown
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
```

- [ ] **Step 4: Update the Follow-up section**

Replace the existing "## Follow-up" block with:

```markdown
## Follow-up

- Add time limits and the `failed` state for deadline-based contracts.
- Add a starting credit grant and an economy that spends credits on
  fuel, repairs, and equipment.
- Add dynamic contract generation tied to the simulation date and ship
  position, including payout scaling with distance and cargo class.
- Add cargo capacity constraints so multi-leg hauls compete for hold
  space.
```

- [ ] **Step 5: Commit the ADR**

```bash
git add docs/ARCHITECTURE/gamedecisions/006-missions-cargo-and-freight-contracts.md
git commit -m "docs(#49): add cargo pickup and persistent credits to freight ADR"
```

---

## Task 2: Add credit arithmetic and localStorage helpers

**Files:**

- Create: `src/world/credits.ts`
- Create: `tests/unit/credits.test.ts`

The credits module is intentionally tiny. It owns three pure-ish
functions plus a `STORAGE_KEY` constant so the rest of the app does not
touch `localStorage` directly.

- [ ] **Step 1: Write the failing unit tests**

Create `tests/unit/credits.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  awardCredits,
  CREDITS_STORAGE_KEY,
  loadCredits,
  saveCredits,
} from '../../src/world/credits'

describe('credits', () => {
  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('uses a stable storage key', () => {
    expect(CREDITS_STORAGE_KEY).toBe('orbitaltrucker.credits')
  })

  it('loadCredits returns 0 when storage is empty', () => {
    expect(loadCredits()).toBe(0)
  })

  it('loadCredits reads a stored integer value', () => {
    window.localStorage.setItem(CREDITS_STORAGE_KEY, '12500')
    expect(loadCredits()).toBe(12500)
  })

  it('loadCredits returns 0 for non-numeric values', () => {
    window.localStorage.setItem(CREDITS_STORAGE_KEY, 'twelve thousand')
    expect(loadCredits()).toBe(0)
  })

  it('loadCredits returns 0 for negative values', () => {
    window.localStorage.setItem(CREDITS_STORAGE_KEY, '-1')
    expect(loadCredits()).toBe(0)
  })

  it('loadCredits returns 0 for fractional values', () => {
    window.localStorage.setItem(CREDITS_STORAGE_KEY, '12.5')
    expect(loadCredits()).toBe(0)
  })

  it('saveCredits writes a sanitized integer to storage', () => {
    saveCredits(4200)
    expect(window.localStorage.getItem(CREDITS_STORAGE_KEY)).toBe('4200')
  })

  it('saveCredits clamps negative values to zero', () => {
    saveCredits(-5)
    expect(window.localStorage.getItem(CREDITS_STORAGE_KEY)).toBe('0')
  })

  it('saveCredits truncates fractional values', () => {
    saveCredits(12.7)
    expect(window.localStorage.getItem(CREDITS_STORAGE_KEY)).toBe('12')
  })

  it('awardCredits adds the reward to the current balance', () => {
    expect(awardCredits(1200, 4200)).toBe(5400)
  })

  it('awardCredits returns the reward when balance is zero', () => {
    expect(awardCredits(0, 1800)).toBe(1800)
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npm run test:unit -- tests/unit/credits.test.ts`
Expected: FAIL with "Cannot find module '../../src/world/credits'".

- [ ] **Step 3: Implement the credits module**

Create `src/world/credits.ts`:

```ts
export const CREDITS_STORAGE_KEY = 'orbitaltrucker.credits'

/**
 * Reads the persisted credit balance from `localStorage`. Returns 0 when
 * the entry is missing, non-numeric, fractional, or negative. The credit
 * balance is always a non-negative integer.
 */
export function loadCredits(): number {
  if (typeof window === 'undefined') return 0

  const raw = window.localStorage.getItem(CREDITS_STORAGE_KEY)
  if (raw === null) return 0

  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return 0
  if (parsed < 0) return 0
  if (!Number.isInteger(parsed)) return 0

  return parsed
}

/**
 * Persists the credit balance to `localStorage`. The value is sanitized
 * to a non-negative integer (fractional input is truncated, negative
 * input is clamped to zero) so the stored value can always be parsed
 * back via `loadCredits`.
 */
export function saveCredits(value: number): void {
  if (typeof window === 'undefined') return

  const sanitized = Math.max(0, Math.trunc(value))
  window.localStorage.setItem(CREDITS_STORAGE_KEY, String(sanitized))
}

/**
 * Pure helper: returns the credit balance that results from awarding
 * `reward` credits on top of the current `balance`. The reward must be
 * a non-negative integer; the result is also a non-negative integer.
 */
export function awardCredits(balance: number, reward: number): number {
  return Math.max(0, Math.trunc(balance) + Math.max(0, Math.trunc(reward)))
}
```

- [ ] **Step 4: Re-run the tests to confirm they pass**

Run: `npm run test:unit -- tests/unit/credits.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/world/credits.ts tests/unit/credits.test.ts
git commit -m "feat(#49): add credit arithmetic and localStorage persistence helpers"
```

---

## Task 3: Extend mission state machine with `in-transit` status

**Files:**

- Modify: `src/world/missions.ts`
- Modify: `tests/unit/missions.test.ts`

We extend the existing module rather than introducing a new one so
`App.tsx` keeps importing the same surface. `MissionStatus` grows a
new `'in-transit'` value, and we add two new pure helpers next to the
existing `isMissionCompleted`.

- [ ] **Step 1: Add the failing tests to `tests/unit/missions.test.ts`**

Append the following describe block to the bottom of the file (after
the closing brace of the existing `describe('missions', ...)` call):

```ts
import {
  getMissionAtOrigin,
  getMissionAtDestination,
  getNextMissionStatus,
  isMissionCargoLoaded,
} from '../../src/world/missions'

describe('mission state machine', () => {
  const mars = getMissionById('mars-supply-run')!

  it('promotes active → in-transit when ship arrives at the origin', () => {
    expect(getNextMissionStatus(mars, 'active', 'arrived', mars.originId)).toBe(
      'in-transit',
    )
  })

  it('does not promote active → in-transit when ship has not arrived', () => {
    expect(
      getNextMissionStatus(mars, 'active', 'cruising', mars.originId),
    ).toBe('active')
  })

  it('does not promote active → in-transit at a non-origin location', () => {
    expect(getNextMissionStatus(mars, 'active', 'arrived', 'earth')).toBe(
      'active',
    )
  })

  it('promotes in-transit → completed when ship arrives at the destination', () => {
    expect(
      getNextMissionStatus(mars, 'in-transit', 'arrived', mars.destinationId),
    ).toBe('completed')
  })

  it('does not promote in-transit → completed when ship is still travelling', () => {
    expect(
      getNextMissionStatus(mars, 'in-transit', 'cruising', mars.destinationId),
    ).toBe('in-transit')
  })

  it('does not complete an in-transit mission at the origin', () => {
    expect(
      getNextMissionStatus(mars, 'in-transit', 'arrived', mars.originId),
    ).toBe('in-transit')
  })

  it('does not auto-transition out of completed', () => {
    expect(
      getNextMissionStatus(mars, 'completed', 'arrived', mars.destinationId),
    ).toBe('completed')
  })

  it('does not auto-transition out of failed', () => {
    expect(
      getNextMissionStatus(mars, 'failed', 'arrived', mars.destinationId),
    ).toBe('failed')
  })

  it('reports cargo loaded only for in-transit or completed statuses', () => {
    expect(isMissionCargoLoaded(mars, 'available')).toBe(false)
    expect(isMissionCargoLoaded(mars, 'active')).toBe(false)
    expect(isMissionCargoLoaded(mars, 'in-transit')).toBe(true)
    expect(isMissionCargoLoaded(mars, 'completed')).toBe(true)
  })

  it('detects when the selected location matches the origin', () => {
    expect(getMissionAtOrigin(mars, mars.originId)).toBe(true)
    expect(getMissionAtOrigin(mars, mars.destinationId)).toBe(false)
    expect(getMissionAtOrigin(mars, 'earth')).toBe(false)
  })

  it('detects when the selected location matches the destination', () => {
    expect(getMissionAtDestination(mars, mars.destinationId)).toBe(true)
    expect(getMissionAtDestination(mars, mars.originId)).toBe(false)
    expect(getMissionAtDestination(mars, 'earth')).toBe(false)
  })

  it('returns the unchanged status when no mission is provided', () => {
    expect(
      getNextMissionStatus(
        undefined,
        'active',
        'arrived',
        'earth-orbit-freight-ring',
      ),
    ).toBe('active')
    expect(
      getNextMissionStatus(
        undefined,
        'in-transit',
        'arrived',
        'mars-high-port',
      ),
    ).toBe('in-transit')
  })
})
```

- [ ] **Step 2: Run the new tests to confirm they fail**

Run: `npm run test:unit -- tests/unit/missions.test.ts`
Expected: FAIL — `getNextMissionStatus`, `isMissionCargoLoaded`,
`getMissionAtOrigin`, and `getMissionAtDestination` are not exported
from `src/world/missions.ts`.

- [ ] **Step 3: Extend the mission module**

Replace the contents of `src/world/missions.ts` with:

```ts
export type MissionStatus =
  'available' | 'active' | 'in-transit' | 'completed' | 'failed'

export type FreightMission = {
  id: string
  title: string
  description: string
  originId: string
  destinationId: string
  cargoLabel: string
  rewardCredits: number
}

export const MISSION_CATALOG: readonly FreightMission[] = [
  {
    id: 'mars-supply-run',
    title: 'Mars Supply Run',
    description:
      'Deliver pressurized habitat modules from the Earth Orbit Freight Ring to Mars High Port. Critical infrastructure for the expanding Mars Prime Colony.',
    originId: 'earth-orbit-freight-ring',
    destinationId: 'mars-high-port',
    cargoLabel: 'Habitat modules',
    rewardCredits: 4200,
  },
  {
    id: 'jovian-outpost-resupply',
    title: 'Jovian Outpost Resupply',
    description:
      'Transport food stores and medical supplies from the Ganymede Transfer Yard to the Callisto Freight Depot. The depot is running low after the last convoy delay.',
    originId: 'ganymede-transfer-yard',
    destinationId: 'callisto-freight-depot',
    cargoLabel: 'Food stores and medical supplies',
    rewardCredits: 6800,
  },
  {
    id: 'lunar-logistics-delivery',
    title: 'Lunar Logistics Delivery',
    description:
      'Haul water ice and electrolysis gear from the Cislunar Transfer Station to Luna Logistics Base. Supports ongoing propellant production at the lunar outpost.',
    originId: 'cislunar-transfer-station',
    destinationId: 'luna-logistics-base',
    cargoLabel: 'Water ice and electrolysis gear',
    rewardCredits: 1800,
  },
]

const MISSION_BY_ID = new Map(
  MISSION_CATALOG.map((mission) => [mission.id, mission]),
)

export function getMissionById(id: string): FreightMission | undefined {
  return MISSION_BY_ID.get(id)
}

export function getMissionCatalog(): readonly FreightMission[] {
  return MISSION_CATALOG
}

export function getMissionAtOrigin(
  mission: FreightMission | undefined,
  selectedLocationId: string,
): boolean {
  return Boolean(mission) && mission!.originId === selectedLocationId
}

export function getMissionAtDestination(
  mission: FreightMission | undefined,
  selectedLocationId: string,
): boolean {
  return Boolean(mission) && mission!.destinationId === selectedLocationId
}

export function isMissionCargoLoaded(
  mission: FreightMission | undefined,
  status: MissionStatus,
): boolean {
  if (!mission) return false
  return status === 'in-transit' || status === 'completed'
}

/**
 * Returns true when an in-transit mission has been delivered: the ship
 * has arrived (autonomousPhase === 'arrived') at the mission's
 * destination. Used by the existing completion banner test and by the
 * App-level reducer (it is the `in-transit → completed` transition).
 */
export function isMissionCompleted(
  mission: FreightMission | undefined,
  autonomousPhase: string,
  selectedLocationId: string,
): boolean {
  if (!mission) return false
  return (
    autonomousPhase === 'arrived' &&
    selectedLocationId === mission.destinationId
  )
}

/**
 * Reducer for the freight mission lifecycle:
 *   available → active → in-transit → completed
 *                          ↘ failed (reserved)
 *
 * The transition rules are:
 * - `active` advances to `in-transit` when the ship is `arrived` at
 *   `mission.originId`.
 * - `in-transit` advances to `completed` when the ship is `arrived` at
 *   `mission.destinationId`.
 * - `completed` and `failed` are terminal: this reducer never auto-
 *   transitions out of them, which keeps the freight board interactive
 *   after delivery.
 * - In every other case the current status is returned unchanged.
 */
export function getNextMissionStatus(
  mission: FreightMission | undefined,
  currentStatus: MissionStatus,
  autonomousPhase: string,
  selectedLocationId: string,
): MissionStatus {
  if (!mission) return currentStatus

  if (currentStatus === 'active') {
    if (
      autonomousPhase === 'arrived' &&
      selectedLocationId === mission.originId
    ) {
      return 'in-transit'
    }
    return 'active'
  }

  if (currentStatus === 'in-transit') {
    if (
      autonomousPhase === 'arrived' &&
      selectedLocationId === mission.destinationId
    ) {
      return 'completed'
    }
    return 'in-transit'
  }

  return currentStatus
}
```

- [ ] **Step 4: Re-run the tests to confirm they pass**

Run: `npm run test:unit -- tests/unit/missions.test.ts`
Expected: PASS (the original 7 tests plus the 12 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/world/missions.ts tests/unit/missions.test.ts
git commit -m "feat(#49): add in-transit status and pickup-to-delivery state machine"
```

---

## Task 4: Wire App state through the new transitions and persist credits

**Files:**

- Modify: `src/App.tsx`
- Modify: `tests/integration/App.test.tsx`

`App.tsx` is the single owner of mission lifecycle. The change is to
call the new `getNextMissionStatus` reducer from the existing
`handleMetricsChange` callback, advance state on change, and award
credits on the `in-transit → completed` edge. We also load
`loadCredits()` on mount and `saveCredits(value)` on every change.

- [ ] **Step 1: Add the failing integration tests**

Append a new `describe('freight contract loop', ...)` block at the end
of `tests/integration/App.test.tsx`. The block must import
`afterEach` from `vitest` (extend the existing import) and read:

```tsx
import { afterEach, describe, expect, it } from 'vitest'

// ...existing imports from App.test.tsx stay above this line...

describe('freight contract loop', () => {
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
      selectedLocationId,
    }: SimulatorCanvasProps) {
      pushMetrics = onMetricsChange
      // intentionally render nothing — the controller is a prop injection
      // shim, not a visible scene.
      void selectedLocationId
      return null
    }

    const utils = render(<AppShell SceneComponent={Controller} />)
    return { ...utils, pushMetrics: () => pushMetrics }
  }

  function makeMetrics(
    overrides: Partial<Metrics> & {
      autonomousPhase?: Metrics['autonomousPhase']
      selectedLocationId?: string
    } = {},
  ): Metrics {
    return {
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
      ...overrides,
    }
  }

  it('requires the player to visit the origin before completing a contract', async () => {
    const user = userEvent.setup()
    const { pushMetrics } = renderWithController()

    act(() => {
      pushMetrics(makeMetrics())
    })

    // 1. Accept the contract.
    await user.click(screen.getByTestId('accept-mission-mars-supply-run'))
    expect(screen.getByText('Pickup')).toBeInTheDocument()
    expect(screen.getByText('Earth Orbit Freight Ring')).toBeInTheDocument()

    // 2. Fly straight to the destination. Completion must not fire.
    await user.selectOptions(
      screen.getByLabelText('Current destination'),
      'mars-high-port',
    )
    act(() => {
      pushMetrics(
        makeMetrics({
          autonomousPhase: 'arrived',
          // selectedLocationId is driven by the select above, no override.
        }),
      )
    })
    expect(screen.queryByText('Delivery complete')).toBeNull()
    expect(screen.getByText('Active contract')).toBeInTheDocument()

    // 3. Reroute to the origin and arrive. Cargo should be loaded.
    await user.selectOptions(
      screen.getByLabelText('Current destination'),
      'earth-orbit-freight-ring',
    )
    act(() => {
      pushMetrics(makeMetrics())
    })
    expect(screen.getByText('Cargo loaded')).toBeInTheDocument()

    // 4. Fly to the destination and arrive. The mission should complete
    //    and the credit balance should grow by the reward.
    await user.selectOptions(
      screen.getByLabelText('Current destination'),
      'mars-high-port',
    )
    act(() => {
      pushMetrics(makeMetrics())
    })
    expect(screen.getByText('Delivery complete')).toBeInTheDocument()
    expect(screen.getByText('+4,200 credits')).toBeInTheDocument()
  })

  it('persists the credit balance across remounts', async () => {
    const user = userEvent.setup()

    // First mount: accept and complete a contract.
    const first = renderWithController()
    act(() => {
      first.pushMetrics(makeMetrics())
    })
    await user.click(
      screen.getByTestId('accept-mission-lunar-logistics-delivery'),
    )
    await user.selectOptions(
      screen.getByLabelText('Current destination'),
      'cislunar-transfer-station',
    )
    act(() => {
      first.pushMetrics(makeMetrics())
    })
    await user.selectOptions(
      screen.getByLabelText('Current destination'),
      'luna-logistics-base',
    )
    act(() => {
      first.pushMetrics(makeMetrics())
    })

    expect(window.localStorage.getItem('orbitaltrucker.credits')).toBe('1800')
    first.unmount()

    // Second mount: the balance is restored.
    renderWithController()
    expect(screen.getByText('Balance: 1,800 cr')).toBeInTheDocument()
  })
})
```

Also update the existing import line at the top of the file from:

```ts
import { describe, expect, it } from 'vitest'
```

to:

```ts
import { afterEach, describe, expect, it } from 'vitest'
```

- [ ] **Step 2: Run the new tests to confirm they fail**

Run: `npm run test:integration -- tests/integration/App.test.tsx`
Expected: FAIL — the freight board does not yet show "Pickup", "Cargo
loaded", or a credit balance; the localStorage key is not set.

- [ ] **Step 3: Update `src/App.tsx`**

Replace `src/App.tsx` with the version below. The shape is identical to
the current file; the diff is the new imports, the `credits` state, the
expanded `handleMetricsChange` reducer, and the new `credits` prop on
`MissionsPanel`.

```tsx
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type LazyExoticComponent,
} from 'react'

import { ControlPanel } from './components/ControlPanel'
import { LegendPanel } from './components/LegendPanel'
import { MetricsPanel } from './components/MetricsPanel'
import { MissionsPanel } from './components/MissionsPanel'
import {
  INITIAL_METRICS,
  TIME_WARP_STEPS,
  type SimulationMetrics,
} from './simulation/types'
import type { SimulatorCanvasProps } from './components/SimulatorCanvas'
import { SOLAR_BODIES } from './solar-data'
import { Card } from './components/ui/card'
import {
  DEFAULT_LOCATION_ID,
  getLocationById,
  getLocationCatalog,
} from './world/locations'
import {
  getMissionById,
  getMissionCatalog,
  getNextMissionStatus,
  type MissionStatus,
} from './world/missions'
import { awardCredits, loadCredits, saveCredits } from './world/credits'

/**
 * Heavy 3D engine chunk (Three.js, R3F, Drei, all scene components) is loaded
 * lazily so it does not block the initial HUD render. The Suspense fallback
 * shows a matching dark background while the canvas module downloads.
 */
const SimulatorCanvas = lazy(() => import('./components/SimulatorCanvas'))

type AppShellProps = {
  SceneComponent?:
    | ComponentType<SimulatorCanvasProps>
    | LazyExoticComponent<ComponentType<SimulatorCanvasProps>>
}

export function AppShell({ SceneComponent = SimulatorCanvas }: AppShellProps) {
  const [metrics, setMetrics] = useState<SimulationMetrics>(INITIAL_METRICS)
  const [selectedLocationId, setSelectedLocationId] =
    useState(DEFAULT_LOCATION_ID)
  const [timeWarpIndex, setTimeWarpIndex] = useState(3)
  const [timePaused, setTimePaused] = useState(false)
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null)
  const [missionStatus, setMissionStatus] = useState<MissionStatus>('available')
  const [credits, setCredits] = useState<number>(() => loadCredits())

  useEffect(() => {
    saveCredits(credits)
  }, [credits])

  const destinations = useMemo(() => getLocationCatalog(), [])
  const selectedLocation = useMemo(
    () =>
      getLocationById(selectedLocationId) ??
      getLocationById(DEFAULT_LOCATION_ID)!,
    [selectedLocationId],
  )
  const legendBodies = useMemo(
    () =>
      SOLAR_BODIES.map((body) => ({
        name: body.name,
        semiMajorAxisAu: body.elements.semiMajorAxisAu.base,
        orbitalPeriodDays: body.orbitalPeriodDays,
      })),
    [],
  )
  const missionCatalog = useMemo(() => getMissionCatalog(), [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'BracketLeft') {
        setTimePaused(false)
        setTimeWarpIndex((current) => Math.max(0, current - 1))
      } else if (event.code === 'BracketRight') {
        setTimePaused(false)
        setTimeWarpIndex((current) =>
          Math.min(TIME_WARP_STEPS.length - 1, current + 1),
        )
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const handleMetricsChange = useCallback(
    (newMetrics: SimulationMetrics) => {
      setMetrics(newMetrics)

      if (!activeMissionId) return
      const activeMission = getMissionById(activeMissionId)
      if (!activeMission) return

      const nextStatus = getNextMissionStatus(
        activeMission,
        missionStatus,
        newMetrics.autonomousPhase,
        selectedLocationId,
      )

      if (nextStatus === missionStatus) return

      setMissionStatus(nextStatus)

      if (nextStatus === 'completed') {
        setCredits((current) =>
          awardCredits(current, activeMission.rewardCredits),
        )
      }
    },
    [missionStatus, activeMissionId, selectedLocationId],
  )

  const handleAcceptMission = useCallback((missionId: string) => {
    setActiveMissionId(missionId)
    setMissionStatus('active')
  }, [])

  return (
    <div className="relative h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(46,_86,_142,_0.28),_transparent_35%),linear-gradient(180deg,_rgba(2,_4,_9,_0.78),_rgba(2,_4,_9,_0.98))] text-slate-50">
      <Suspense fallback={<div className="absolute inset-0 bg-[#020409]" />}>
        <SceneComponent
          selectedLocationId={selectedLocation.id}
          timePaused={timePaused}
          timeWarpIndex={timeWarpIndex}
          onMetricsChange={handleMetricsChange}
        />
      </Suspense>

      <aside className="pointer-events-none absolute inset-y-4 left-4 z-10 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 overflow-y-auto pr-1 sm:w-[19rem] lg:w-[20rem]">
        <Card className="pointer-events-auto border-white/10 bg-slate-950/55 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-cyan-200/80">
                OrbitalTrucker
              </p>
              <h1 className="mt-1 text-lg font-semibold tracking-tight text-slate-50">
                Destination bridge
              </h1>
            </div>
            <span className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-100/90">
              R3F
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Select destinations, watch intercept and travel state, and manage
            simulation time while the freighter reroutes on its own.
          </p>
        </Card>

        <MetricsPanel
          metrics={metrics}
          timeWarpDaysPerSecond={
            timePaused ? 0 : TIME_WARP_STEPS[timeWarpIndex]
          }
          onFasterTime={() => {
            setTimePaused(false)
            setTimeWarpIndex((current) =>
              Math.min(TIME_WARP_STEPS.length - 1, current + 1),
            )
          }}
          onPauseToggle={() => {
            setTimePaused((current) => !current)
          }}
          onSlowerTime={() => {
            setTimePaused(false)
            setTimeWarpIndex((current) => Math.max(0, current - 1))
          }}
        />

        <ControlPanel
          destinations={destinations}
          metrics={metrics}
          onSelectLocation={setSelectedLocationId}
          selectedLocationId={selectedLocation.id}
          timeWarpDaysPerSecond={
            timePaused ? 0 : TIME_WARP_STEPS[timeWarpIndex]
          }
        />

        <MissionsPanel
          activeMissionId={activeMissionId}
          credits={credits}
          missionStatus={missionStatus}
          missions={missionCatalog}
          onAcceptMission={handleAcceptMission}
        />

        <LegendPanel bodies={legendBodies} />
      </aside>
    </div>
  )
}

export default function App() {
  return <AppShell />
}
```

- [ ] **Step 4: Run the integration tests**

Run: `npm run test:integration -- tests/integration/App.test.tsx`
Expected: FAIL — `MissionsPanel` does not yet accept a `credits` prop,
the panel does not yet show the pickup / cargo-loaded banners, and the
balance is not displayed.

- [ ] **Step 5: Commit the App and integration-test scaffold together**

We commit the integration tests alongside the App changes so the
failing test for the next task is checked in. This is the same shape
the existing `App.test.tsx` test for the post-completion acceptance
flow uses (test + production code change in one commit).

```bash
git add src/App.tsx tests/integration/App.test.tsx
git commit -m "feat(#49): drive mission state through pickup and persist credit balance"
```

---

## Task 5: Update the `MissionsPanel` UI for pickup, in-transit, and credits

**Files:**

- Modify: `src/components/MissionsPanel.tsx`
- Modify: `tests/component/MissionsPanel.test.tsx`

The panel needs three things:

1. A `credits: number` prop and a header line that always shows the
   current balance.
2. A pickup banner shown when the active mission is in the `active`
   state ("Pickup: Earth Orbit Freight Ring" + cargo).
3. An in-transit banner shown when the active mission is in the
   `in-transit` state ("Cargo loaded" + delivery destination).
4. The completion banner shows the new balance as well as the reward.

- [ ] **Step 1: Add the failing component tests**

Append a new `describe('pickup and credit balance', ...)` block to
`tests/component/MissionsPanel.test.tsx`. The new tests should sit
_after_ the existing `describe('MissionsPanel', ...)` block:

```tsx
describe('pickup and credit balance', () => {
  it('always shows the current credit balance in the panel header', () => {
    render(
      <MissionsPanel
        activeMissionId={null}
        credits={6200}
        missionStatus="available"
        missions={missions}
        onAcceptMission={vi.fn()}
      />,
    )

    expect(screen.getByText('Balance: 6,200 cr')).toBeInTheDocument()
  })

  it('shows the pickup location while the active mission is en route to origin', () => {
    render(
      <MissionsPanel
        activeMissionId="mars-supply-run"
        credits={0}
        missionStatus="active"
        missions={missions}
        onAcceptMission={vi.fn()}
      />,
    )

    expect(screen.getByText('Pickup')).toBeInTheDocument()
    expect(screen.getByText('Earth Orbit Freight Ring')).toBeInTheDocument()
    expect(screen.queryByText('Cargo loaded')).toBeNull()
  })

  it('shows the cargo-loaded banner while in-transit to the destination', () => {
    render(
      <MissionsPanel
        activeMissionId="mars-supply-run"
        credits={0}
        missionStatus="in-transit"
        missions={missions}
        onAcceptMission={vi.fn()}
      />,
    )

    expect(screen.getByText('Cargo loaded')).toBeInTheDocument()
    expect(screen.getByText('Mars High Port')).toBeInTheDocument()
    expect(screen.queryByText('Pickup')).toBeNull()
  })

  it('shows the running balance in the completion banner', () => {
    render(
      <MissionsPanel
        activeMissionId="mars-supply-run"
        credits={8400}
        missionStatus="completed"
        missions={missions}
        onAcceptMission={vi.fn()}
      />,
    )

    expect(screen.getByText('+4,200 credits')).toBeInTheDocument()
    expect(screen.getByText('Balance: 8,400 cr')).toBeInTheDocument()
  })

  it('hides the active mission row when it is in-transit', () => {
    render(
      <MissionsPanel
        activeMissionId="mars-supply-run"
        credits={0}
        missionStatus="in-transit"
        missions={missions}
        onAcceptMission={vi.fn()}
      />,
    )

    expect(screen.queryByTestId('accept-mission-mars-supply-run')).toBeNull()
    expect(
      screen.queryByTestId('accept-mission-jovian-outpost-resupply'),
    ).toBeNull()
    expect(
      screen.queryByTestId('accept-mission-lunar-logistics-delivery'),
    ).toBeNull()
  })
})
```

Also update the existing tests in this file so they pass the new
`credits` prop. At each existing `render(<MissionsPanel ...)` call,
add `credits={0}` between `activeMissionId` and `missionStatus`. The
existing five test bodies stay otherwise unchanged.

- [ ] **Step 2: Run the new tests to confirm they fail**

Run: `npm run test:component -- tests/component/MissionsPanel.test.tsx`
Expected: FAIL — the panel does not yet accept a `credits` prop.

- [ ] **Step 3: Replace the `MissionsPanel` component**

Replace the contents of `src/components/MissionsPanel.tsx` with:

```tsx
import type { FreightMission, MissionStatus } from '../world/missions'
import { Button } from './ui/button'
import { Card } from './ui/card'

type MissionsPanelProps = {
  missions: readonly FreightMission[]
  activeMissionId: string | null
  missionStatus: MissionStatus
  credits: number
  onAcceptMission: (missionId: string) => void
}

export function MissionsPanel({
  missions,
  activeMissionId,
  missionStatus,
  credits,
  onAcceptMission,
}: MissionsPanelProps) {
  const activeMission = missions.find((m) => m.id === activeMissionId)
  const formattedBalance = `${credits.toLocaleString()} cr`

  return (
    <Card className="pointer-events-auto border-white/10 bg-slate-950/55 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-slate-50">
          Freight contracts
        </h2>
        <span
          className="text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-300/80"
          data-testid="credit-balance"
        >
          Balance: {formattedBalance}
        </span>
      </div>

      {missionStatus === 'completed' && activeMission ? (
        <div
          className="mt-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-3"
          data-testid="delivery-complete-banner"
        >
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
          <p className="mt-1 text-xs font-medium text-emerald-300/80">
            Balance: {formattedBalance}
          </p>
        </div>
      ) : missionStatus === 'in-transit' && activeMission ? (
        <div
          className="mt-3 rounded-2xl border border-sky-400/25 bg-sky-400/[0.08] px-3 py-3"
          data-testid="cargo-loaded-banner"
        >
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-sky-300/90">
            Cargo loaded
          </p>
          <p className="mt-1 text-sm font-medium text-slate-50">
            {activeMission.title}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-300">
            Cargo: {activeMission.cargoLabel}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Deliver to:{' '}
            <span className="text-sky-200/80">
              {formatDestinationLabel(activeMission.destinationId)}
            </span>
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Navigate to the destination and arrive to complete the contract.
          </p>
        </div>
      ) : missionStatus === 'active' && activeMission ? (
        <div
          className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.08] px-3 py-3"
          data-testid="pickup-banner"
        >
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-300/90">
            Pickup
          </p>
          <p className="mt-1 text-sm font-medium text-slate-50">
            {activeMission.title}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-300">
            Cargo: {activeMission.cargoLabel}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Pickup at:{' '}
            <span className="text-amber-200/80">
              {formatDestinationLabel(activeMission.originId)}
            </span>
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Fly to the origin station to load the cargo, then deliver it to{' '}
            {formatDestinationLabel(activeMission.destinationId)}.
          </p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-2">
        {missions.map((mission) => {
          const isActive = mission.id === activeMissionId
          const isDone =
            isActive &&
            (missionStatus === 'completed' || missionStatus === 'failed')
          // The board is locked only while a contract is in flight. Once
          // the active contract reaches a terminal state (completed /
          // failed) the player must be able to pick a *different*
          // contract off the board without reloading, so any row becomes
          // acceptable again. Active and in-transit rows are hidden
          // because they are already represented by the status banner
          // above the board.
          const isBoardLocked =
            missionStatus === 'active' || missionStatus === 'in-transit'
          const canAccept = !isBoardLocked && !isActive
          const isHiddenRow =
            isActive &&
            (missionStatus === 'active' || missionStatus === 'in-transit')

          if (isHiddenRow) return null

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
```

- [ ] **Step 4: Re-run all component tests**

Run: `npm run test:component -- tests/component/MissionsPanel.test.tsx`
Expected: PASS — every existing test plus the 5 new ones.

- [ ] **Step 5: Re-run all integration tests**

Run: `npm run test:integration -- tests/integration/App.test.tsx`
Expected: PASS — both pre-existing tests plus the 2 new ones.

- [ ] **Step 6: Commit**

```bash
git add src/components/MissionsPanel.tsx tests/component/MissionsPanel.test.tsx
git commit -m "feat(#49): surface pickup, in-transit, and credit balance in mission panel"
```

---

## Task 6: Full verification

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: PASS with no warnings (the project uses `--max-warnings=0`).

- [ ] **Step 2: Run the entire test suite**

Run: `npm test`
Expected: PASS for unit, component, and integration suites.

- [ ] **Step 3: Type-check the production build**

Run: `npm run build`
Expected: PASS — `tsc --noEmit` is the first step of the build script,
so a type error in `App.tsx` or `MissionsPanel.tsx` would surface here
even before the bundle is produced.

- [ ] **Step 4: Spot-check the panel manually (optional)**

Run `npm run dev` and walk through the manual loop:

1. Open the freight board; confirm the balance shows `Balance: 0 cr`.
2. Accept _Mars Supply Run_; confirm the _Pickup_ banner names
   _Earth Orbit Freight Ring_.
3. Select `mars-high-port` in the destination select; confirm the
   completion banner does _not_ fire even after the autonomous
   guidance would report `arrived`.
4. Switch the destination back to `earth-orbit-freight-ring` and let
   the simulation arrive; confirm the banner changes to _Cargo loaded_
   with _Mars High Port_ as the next stop.
5. Switch to `mars-high-port` and arrive; confirm the
   _Delivery complete_ banner shows `+4,200 credits` and
   `Balance: 4,200 cr`, and the freight board row is marked
   _Delivered ✓_.
6. Reload the page; confirm the balance still reads `4,200 cr`.

- [ ] **Step 5: Commit any formatting fixes from lint**

```bash
git status
# If prettier reformatted anything, stage and commit it.
git add -A
git commit -m "style: apply prettier formatting" || true
```

---

## Task 7: Push the branch and open the PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/49-freight-contract-loop-origin-and-credits
```

- [ ] **Step 2: Open the PR with `gh`**

Run:

```bash
gh pr create \
  --base main \
  --head feat/49-freight-contract-loop-origin-and-credits \
  --title "feat(#49): complete freight-contract loop with origin pickup and persistent credits" \
  --body "$(cat <<'EOF'
Closes #49.

## Summary

The freight-contract gameplay loop was missing two pieces: the origin
pickup step (you could complete a contract by simply arriving at the
destination without ever visiting the origin station), and a real
credit balance (the `rewardCredits` field was display-only).

This change wires both into the existing autonomous-guidance pipeline.

- **Origin pickup.** `MissionStatus` now includes an `in-transit`
  value between `active` (en route to origin) and `completed`
  (delivered). The transition is driven by the same `autonomousPhase
  === 'arrived'` signal that already triggers completion, just
  compared against `mission.originId` instead of `mission.destinationId`.
- **Persistent credits.** A new `src/world/credits.ts` module owns
  credit arithmetic and `localStorage` persistence (key
  `orbitaltrucker.credits`). `App.tsx` loads the balance on mount,
  increments it on the `in-transit → completed` transition, and writes
  it back on every change.

## UI

- `MissionsPanel` shows the current credit balance in its header.
- A new *Pickup* banner names the origin station while the contract is
  en route to it.
- A *Cargo loaded* banner names the delivery destination while the
  contract is in-transit.
- The *Delivery complete* banner shows the reward and the new running
  balance.

## ADR

`docs/ARCHITECTURE/gamedecisions/006-missions-cargo-and-freight-contracts.md`
is updated to describe the new lifecycle and the credits model.

## Tests

- `tests/unit/credits.test.ts` — 11 unit tests for the credit helpers
  (storage key, sanitisation, persistence, arithmetic).
- `tests/unit/missions.test.ts` — 12 new unit tests for the new
  state transitions and arrival helpers.
- `tests/component/MissionsPanel.test.tsx` — 5 new component tests for
  the new banners and credit display.
- `tests/integration/App.test.tsx` — 2 new integration tests covering
  the full pickup-and-deliver flow and localStorage persistence across
  remounts.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Print the PR URL**

`gh pr view --json url -q '.url'` will print the URL once the PR is
open. Confirm the PR is open and the link is correct before reporting
back to the user.
