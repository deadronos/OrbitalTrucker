# ADR 003: Adopt React, React Three Fiber, and Drei for the simulator implementation

- **Status:** Accepted
- **Date:** 2026-03-29

## Context

The first prototype proved that the simulation concept works, but the implementation concentrated scene setup, UI generation, controls, state management, and rendering orchestration in a single imperative `main.ts` file.

The next iteration needs to:

- separate UI concerns from scene concerns
- make the simulator easier to evolve with reusable components
- align the app with current React web development practices
- keep direct access to Three.js where low-level control is still useful
- use helper abstractions where they reduce boilerplate without hiding important simulation behavior

## Decision

The simulator will be ported to a React-based architecture using:

- **React** for application composition and UI state
- **React DOM** for browser rendering
- **@react-three/fiber** as the React renderer for Three.js scenes
- **@react-three/drei** for scene helpers where they fit the current implementation

The resulting application will keep the existing solar-system prototype behavior while splitting responsibilities into React components, hooks, and utility modules.

The migration will continue to allow raw `three` classes for math, geometry, and custom scene behavior when that is clearer or more capable than a helper abstraction.

## Consequences

### Positive

- improves maintainability through component boundaries
- makes HUD and simulation state easier to test separately
- reduces imperative DOM construction in favor of declarative UI
- enables selective use of Drei helpers such as `Stars`, `Line`, and camera conveniences
- preserves the ability to drop to low-level Three.js APIs when needed

### Negative

- introduces more dependencies and more moving parts in the toolchain
- requires some extra care around React render frequency versus per-frame simulation updates
- testing 3D scene behavior in jsdom remains less direct than testing regular UI

## Follow-up

The simulator should be organized into scene components, UI components, hooks, and pure utility modules so the React migration produces structural improvements rather than only a syntax conversion.
