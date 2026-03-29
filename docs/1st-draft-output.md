# OrbitalTrucker — first draft output

## What was built

A browser-based 3D solar-system simulator prototype was created using Vite, TypeScript, and Three.js.

The current build includes:

- a full-screen heliocentric map of the solar system
- the Sun, the eight major planets, and Pluto
- physically scaled **orbital distances** using astronomical units (AU)
- placeholder geometry for the Sun, planets, Saturn's rings, and the player cargo freighter
- orbital motion generated from low-precision **J2000 Keplerian orbital elements**
- a flyable placeholder ship with inertial movement and chase-camera controls
- a HUD showing simulated date, time warp, ship speed, heliocentric radius, target, and range to target
- target selection buttons for the Sun and all rendered bodies
- a renderer configured with `logarithmicDepthBuffer` to better handle extreme scene scale

## Current implementation summary

### Runtime and tooling

The app is scaffolded with Vite and written in TypeScript.

Current package choices:

- `vite` for development/build tooling
- `typescript` for type safety
- `three` for 3D rendering
- `@types/three` for Three.js type declarations

Useful scripts in `package.json`:

- `npm run dev`
- `npm run build`
- `npm run preview`

### Main scene setup

The scene is assembled in `src/main.ts` and currently contains:

- a `WebGLRenderer` with antialiasing and `logarithmicDepthBuffer: true`
- a perspective camera with a very small near plane and large far plane to support AU-scale navigation
- ambient lighting plus a point light at the Sun
- a simple grid helper for spatial orientation
- a procedural starfield using `Points`
- placeholder meshes for the Sun, each body, the ship, and the target marker
- orbit lines generated from sampled orbital positions

### Orbital model

Orbital values are stored in `src/solar-data.ts`.

Each body currently includes:

- name and kind
- placeholder color
- real radius in kilometers
- exaggerated display radius in AU for visibility
- orbit color
- sidereal orbital period in days
- low-precision J2000 orbital element series with base value and linear rate

Orbital positions are computed in `src/orbital-mechanics.ts` by:

1. converting wall-clock time to Julian date
2. evaluating time-varying orbital elements at the selected date
3. solving Kepler's equation iteratively for eccentric anomaly
4. converting orbital-plane coordinates into heliocentric 3D space
5. sampling orbit curves for rendering

This gives the prototype more realistic motion than circular placeholder orbits while keeping the implementation lightweight.

### Flight and camera model

The ship is currently a gameplay-friendly placeholder freighter, not a full Newtonian spacecraft model.

Current behavior:

- `W`, `A`, `S`, `D` for forward/strafe thrust
- `Q`, `E` for vertical thrust
- `Shift` for boost
- `Space` for rapid dampening
- mouse drag to rotate ship heading
- mouse wheel for chase-camera distance
- `[` and `]` or on-screen buttons for time-warp changes

The camera follows from behind the ship and looks toward a forward chase target. This keeps the prototype usable before introducing cockpit mode, autopilot, or map-navigation tools.

### Visual scaling decisions

The implementation currently mixes two kinds of scale intentionally:

- **distances** are treated as physically meaningful and measured in AU
- **object sizes** are exaggerated so bodies remain visible across interplanetary distances

This means the simulation is suitable as a navigable systems map, not yet as a strict one-to-one physical visualization of both size and distance simultaneously.

## Files added for the prototype

- `src/main.ts` — scene composition, controls, HUD, animation loop
- `src/solar-data.ts` — solar-system body definitions and orbital data
- `src/orbital-mechanics.ts` — orbital math utilities and orbit sampling
- `src/style.css` — full-screen simulator UI styling
- `index.html` — app entry point metadata

## What was verified

The prototype was verified by:

- installing dependencies successfully
- running a production build successfully with `npm run build`
- loading the built app in a browser over a temporary local static server
- confirming that the UI renders and target selection updates the HUD

## Known limitations in this first draft

- ship movement is inertial and arcade-leaning rather than a full gravity-driven orbital flight model
- no moons, asteroid belts, stations, cargo systems, or mission gameplay yet
- planets use placeholder materials and simple geometry instead of textured or modeled assets
- orbital solution is a practical low-precision approximation, not a high-fidelity ephemeris
- there is no save/load, route planner, autopilot, or map overlay yet

## Good next steps

1. replace placeholder bodies and ship with GLTF assets and texture maps
2. separate simulation units from display units more explicitly
3. add labels, minimap tools, and destination/course planning
4. introduce optional autopilot and transfer-planning support
5. expand the solar system with moons, belts, and points of interest
6. add tests around orbital calculations and formatting helpers
