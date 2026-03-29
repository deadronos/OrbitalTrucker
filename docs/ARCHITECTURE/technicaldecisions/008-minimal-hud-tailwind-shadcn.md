# ADR 008: Minimal HUD using Tailwind CSS v4 and shadcn-style components

- **Status:** Accepted
- **Date:** 2026-03-29

## Context

The simulator already has a strong visual center: the full-screen R3F canvas. The existing HUD uses bespoke global CSS with several large, opaque panels and dense content blocks. That makes the interface feel busier than necessary and competes with the primary interaction surface.

For a cockpit-style simulator, the UI should support quick glances rather than demand attention. Controls, metrics, and orbital reference data are useful, but they should sit in lighter-weight surfaces, consume less screen space, and remain visually secondary to the solar-system view.

The project also benefits from adopting a modern utility-first styling baseline that keeps the UI easy to refine without adding a large custom stylesheet.

## Decision

The HUD will be redesigned around three styling choices:

### Tailwind CSS v4 as the primary styling layer

- Global and component styling will be expressed with Tailwind utility classes where practical.
- The project will use the Tailwind v4 Vite integration and the v4 `@import "tailwindcss";` entrypoint.
- Custom CSS will be reserved for layout primitives and canvas-specific rules that are awkward to express with utilities.

### shadcn-style component primitives

The interface will use a small set of reusable, shadcn-inspired primitives for common controls and surfaces, such as:

- `Button`
- `Card`
- `Badge`
- compact panel containers

These components are intentionally lightweight: they should be easy to copy, style, and extend locally without introducing a heavy design-system dependency.

### Minimal overlay layout

- HUD content will be visually grouped and reduced to the smallest set of panels needed for moment-to-moment gameplay.
- Panels should use translucent, compact surfaces with restrained borders and spacing.
- The 3D canvas must remain unobstructed as much as possible; any persistent overlay should occupy a narrow edge or corner band rather than a full-width grid.
- On narrower screens, the HUD may stack, but it should still prioritize the simulator view over the overlay.

## Consequences

### Positive

- The interface becomes less cluttered and easier to scan at a glance.
- Tailwind v4 provides a consistent utility-first styling workflow without hand-maintaining large custom CSS blocks.
- Local shadcn-style primitives give the UI a coherent look while staying simple to evolve.
- The main simulation view remains the visual focus.

### Negative

- Introducing Tailwind and small UI primitives adds setup work for a relatively small app.
- Some existing custom CSS will need to be rewritten or removed.
- The HUD may need occasional tuning to balance legibility against canvas visibility on very small screens.

## Follow-up

If additional HUD surfaces are added later, they should reuse the same compact primitives and spacing rules instead of introducing new one-off panel styles.
