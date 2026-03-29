# ADR 004: Adopt Vitest, ESLint, and Prettier as the baseline quality toolchain

- **Status:** Accepted
- **Date:** 2026-03-29

## Context

The prototype currently verifies behavior mainly through manual testing and production builds.

As the implementation grows more modular and React-based, the project needs:

- automated unit coverage for orbital math and formatting logic
- integration confidence for app-level state wiring
- component-level confidence for the HUD and controls
- a consistent linting and formatting baseline for future contributors

## Decision

The project will adopt the following quality toolchain:

- **Vitest** for test execution
- **React Testing Library** for React component and integration tests
- **ESLint** for static analysis
- **Prettier** for formatting consistency

The test suite will be organized to explicitly include:

- unit tests
- integration tests
- component tests

End-to-end tests are intentionally deferred for now.

## Consequences

### Positive

- creates a repeatable verification path beyond manual inspection
- makes math and formatting regressions easier to catch early
- supports safe refactoring during the React migration
- improves contributor consistency for code style and conventions

### Negative

- increases setup and maintenance cost for a small prototype
- introduces extra configuration that must stay aligned with Vite and React tooling
- 3D rendering details may still need selective mocking in non-browser test environments

## Follow-up

The repository should expose clear scripts for linting, formatting, and testing, and those commands should pass before a pull request is opened.
