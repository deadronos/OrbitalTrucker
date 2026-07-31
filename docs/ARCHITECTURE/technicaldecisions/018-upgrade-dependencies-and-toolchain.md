# ADR 018: Upgrade dependencies and dev toolchain to latest major releases

- **Status:** Accepted
- **Date:** 2026-07-31
- **Related:** ADR 001, ADR 003, ADR 004

## Context

The OrbitalTrucker project dependencies and development toolchain (React, Three.js, R3F, Vite, Vitest, ESLint, TypeScript, testing-library, Tailwind CSS, etc.) had outdated versions specified in `package.json`.

Keeping dependencies up-to-date ensures access to performance improvements, security fixes, updated TypeScript definitions, and modern toolchain features.

## Decision

The project dependencies and devDependencies have been upgraded to their latest releases:

- **ESLint & Static Analysis**: Upgraded to ESLint 10 (`eslint` ^10.8.0, `@eslint/js` ^10.0.1, `typescript-eslint` 8.65.0, `globals` 17.8.0)
- **TypeScript**: Upgraded to TypeScript 7 (`typescript` ~7.0.2)
- **3D Graphics Stack**: Upgraded `three` (0.185.1), `@react-three/fiber` (9.7.0), and `@react-three/drei` (10.7.7)
- **Build & Test Stack**: Upgraded `vite` (^8.2.0), `vitest` (4.1.10), `@vitest/coverage-v8` (4.1.10), `@vitejs/plugin-react` (6.0.5)
- **Testing Environment**: Upgraded `jsdom` (30.0.1), `@testing-library/jest-dom` (7.0.0), `@testing-library/react` (16.3.2), `@types/node` (26.1.2)
- **React & Styling**: Upgraded `react` / `react-dom` (19.2.8), `tailwindcss` / `@tailwindcss/vite` (4.3.3), `tailwind-merge` (3.6.0), `prettier` (3.9.6)

All configuration and source files were audited and updated to maintain 100% compatibility with zero lint or build warnings and clean test passes across the entire test suite.

## Consequences

### Positive

- Keeps the codebase on latest stable packages and type definitions.
- Ensures compatibility with latest TypeScript, ESLint, Vite, and testing ecosystem tools.
- Maintains fast build times and reliable test execution.

### Negative

- Major version upgrades may occasionally introduce deprecations in downstream packages that will require future maintenance.
