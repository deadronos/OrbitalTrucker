# ADR 001: Use Vite, TypeScript, and Three.js for the prototype stack

- **Status:** Superseded by ADR 003
- **Date:** 2026-03-29

## Context

The first implementation needed a web-native stack that could:

- render an interactive 3D scene in the browser
- iterate quickly during early prototyping
- support future asset integration and UI layering
- stay simple enough for a small first milestone

## Decision

The prototype is built with:

- **Vite** for dev-server and production bundling
- **TypeScript** for type-checked application code
- **Three.js** for scene management and WebGL rendering

## Consequences

### Positive

- rapid setup and fast local iteration
- low ceremony for a single-page prototype
- strong ecosystem support for 3D rendering and future model loading
- TypeScript helps keep math-heavy code safer and easier to refactor

### Negative

- all scene logic currently lives in a single entry module and will need decomposition later
- there is not yet a game-engine-style entity/component architecture
- future performance work may require more explicit scene partitioning and update budgeting

## Follow-up

The prototype validated the idea successfully, but the implementation is now being migrated to a React-based architecture built on the same rendering foundation.
