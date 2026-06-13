# ADR 016: Warp-aware orbit-redraw throttle with remainder preservation

- **Status:** Accepted
- **Date:** 2026-06-13
- **Related:** ADR 005 (split R3F scene into systems and hooks), ADR 006
  (ephemeris provider abstraction), ADR 015 (planner-aware route visuals and
  telemetry)

## Context

The R3F scene renders one polyline per solar body for the orbit path. Each
polyline is built from 320 heliocentric sample points drawn from
`buildOrbitPoints(body, orbitEpoch)` (see `src/orbital-mechanics.ts` and
`src/ephemeris/{keplerian,vsop87}.ts`). The `OrbitPath` sub-component memoizes
the points array on `[body, orbitEpoch]` (see `src/scene/SolarBodies.tsx`),
so every change to `orbitEpoch` rebuilds the polyline for all bodies.

`useTimeSimulation` (see `src/hooks/useTimeSimulation.ts`) decides when
`orbitEpoch` is updated. Today it does two things that combine badly at high
warp:

1. It accumulates simulated days in `orbitAccumulatorRef`.
2. When the accumulator reaches 7 simulated days it sets
   `orbitEpoch = new Date(date)` **and resets the accumulator to zero**.

At max warp (90 simulated days per real second) the sim clamps the frame delta
to 0.05 s, so each frame advances 4.5 simulated days. That means the
accumulator crosses the 7-day threshold roughly every two frames, which
triggers a full rebuild of all orbit polylines on essentially every other
frame. Even at moderate warps (7–30 d/s) the redraw cadence is in the same
ballpark as the frame rate, which is wasteful given that the orbit polylines
visually only need a refresh every few weeks of simulated time.

The current behaviour also has a precision problem: the accumulator is reset
to zero when the threshold is crossed, so any remainder less than 7 days is
silently discarded. Over a long run this skews the threshold cadence very
slightly (sub-frame remainder drift).

The orbit-epoch threshold is fundamentally a **simulated-time threshold**, not
a real-time threshold. At high warp the threshold is hit every few frames; at
low warp it can take seconds of real time to cross. The current code couples
redraw frequency to raw warp progression with no compensation, and discards
sub-threshold remainder on every transition.

Issue #40 requires both problems to be fixed.

## Decision

### 1. Extract the orbit-epoch cadence logic into a pure, testable function

The accumulator/threshold update rule should live in a pure function in
`src/simulation/` so that it can be unit-tested without a R3F canvas. The
function takes the current accumulator and the simulated days advanced in the
last frame, and returns:

- the new accumulator
- an `orbitEpochUpdated` boolean
- the number of times the threshold was crossed this frame (typically 0 or 1,
  but the function must remain correct if a single frame ever advances more
  than one threshold worth of simulated days)

The `useTimeSimulation` hook becomes a thin wrapper that:

- reads the warp and frame delta
- calls the pure function each frame
- on a transition, calls `setOrbitEpoch(new Date(date))` with the leftover
  remainder carried forward

This makes the cadence logic verifiable in isolation and keeps the hook small.

### 2. Preserve sub-threshold remainder across threshold crossings

When the accumulator crosses the threshold, subtract the threshold from the
accumulator instead of zeroing it. The remainder is carried into the next
frame so the cadence is precise to the threshold granularity, not the frame
granularity.

The threshold itself stays at 7 simulated days, which is a good trade-off
between visual fidelity and CPU cost: 7-day steps keep the polylines accurate
to within about 1° of true anomaly for the inner planets and much less for
the outer planets, and the threshold is a documented constant that can be
referenced from tests and other code that wants the same cadence.

### 3. Decouple redraw cadence from raw warp progression

Cap the **real-time** frequency of `orbitEpoch` updates in addition to the
existing simulated-time threshold. A real-time cap means that even at max warp
the polyline rebuilds cannot exceed a documented real-time rate (e.g. once
every 200 ms, which is 5 Hz and well below the frame rate). This is the
minimum change needed to satisfy the acceptance criterion of issue #40: the
redraw cadence no longer spikes to near-every-frame behaviour at high warp.

The cap is implemented as a `lastOrbitUpdateRef` real-time timestamp inside
the hook. The hook consults both the simulated-time threshold **and** the
real-time cap before calling `setOrbitEpoch`. The cap is irrelevant at low
warp (the threshold is not hit often enough for the cap to fire) and only
kicks in at high warp (where the threshold would otherwise be hit every couple
of frames).

### 4. Skip the work, not the date

Even when the hook decides not to call `setOrbitEpoch`, the simulated date
keeps advancing every frame. Other consumers (body positions, metrics,
autonomous guidance) all read from `simulatedDateRef` and continue to work at
the full frame rate. The cap only affects how often React rerenders the
orbit polylines.

This matches the existing split between high-frequency mutation
(`simulatedDateRef`) and React state (`orbitEpoch`) that ADR 005 already
called out.

### 5. Add a perf check that demonstrates the reduction

Add a small instrumented benchmark in the test suite that drives a fake
`useFrame` loop at 60 fps for 5 seconds of simulated time at max warp and
counts the number of times `setOrbitEpoch` is called. The test asserts that
the call count is well below the number of frames in that interval (5 Hz cap
means 25 calls in 5 s versus 300 frames). The same harness also verifies
that the simulated date still advances to the correct final value and that
the remainder is preserved across threshold crossings.

## Consequences

### Positive

- Orbit polylines no longer rebuild on nearly every frame at high warp.
- Sub-threshold remainder is preserved, so the cadence is exact to the
  threshold granularity rather than the frame granularity.
- The cadence rule is now testable in isolation as a pure function.
- The `useTimeSimulation` hook stays under ~50 lines and remains the only
  place that knows about the warp / frame / threshold interaction.
- Future changes to the cadence (e.g. an even larger threshold for outer
  planets) are a one-line change to the constant.

### Negative

- The cap and threshold constants are now documented in two places (the ADR
  and the code). Tests guard the values to make sure they stay in sync.
- A 5 Hz cap means that orbit polylines can lag the underlying orbit by up to
  0.2 s of real time at max warp. At max warp 0.2 s = 18 simulated days, which
  is well within the threshold granularity (7 days) and not visible in
  practice.
- The test suite grows by a small instrumented benchmark. It is fast (the
  pure function is O(1) per frame) but it is a new test file.

## Follow-up

- If outer-planet orbit paths become a visual concern, consider a per-body
  threshold that grows with orbital period. The pure-function design above
  makes that change trivial.
- If we ever introduce user-tunable orbit fidelity, expose the threshold
  constant and the real-time cap as settings.
