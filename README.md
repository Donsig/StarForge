# Star Forge

A single-player browser idle game inspired by OGame. Real-time resource production, building upgrades, research trees, ship construction, planetary defences, galaxy exploration, and fleet combat — all running in the browser with no backend. State persists to `localStorage`.

## Features

- **Resources** — Metal, Crystal, Deuterium with real-time production, energy balance, and storage caps
- **Buildings** — Mine upgrades, energy structures (Solar Plant, Fusion Reactor, Solar Satellites), storage, robotics, shipyard, nanite factory, research lab
- **Research** — Full tech tree with prerequisite chains (energy, weapons, shields, armour, drive techs, espionage, astrophysics, plasma tech, and more)
- **Ships & Defences** — 10 ship types, 8 defence types with OGame-accurate combat stats and rapid-fire tables
- **Galaxy** — 5 galaxies × 50 systems × 15 slots. Slot-based planet properties (temperature, field count). NPC colonies with dynamic tier upgrades and specialty behaviours
- **Fleet Missions** — Attack, Espionage, Harvest (recycler), Transport between your own colonies
- **Combat** — Round-based engine with shields, hull explosion chance, 1% deflection rule, loot calculation
- **Espionage** — Probe-based intel gathering with detection chance scaling
- **Colonisation** — Gated behind Astrophysics research; colony count scales with tech level
- **Offline catch-up** — Up to 7 days of production and queue completions processed on load
- **Admin panel** — God-mode tools for testing: set resources, buildings, ships, simulate time, trigger combat

## Tech Stack

- **Vite + React 19 + TypeScript (strict)**
- **Game engine** — Pure TypeScript, zero React imports. Runs independently of the UI.
- **State** — Single `GameState` object mutated by the engine, spread-copied into React on each tick
- **Persistence** — `localStorage` with versioned schema migrations (currently v10)
- **Tests** — Vitest + Testing Library, 257+ tests across engine units, integration flows, and components

## Getting Started

```bash
npm install
npm run dev       # Dev server at http://localhost:5173 (HMR)
npm run build     # Production build to dist/
npm run preview   # Preview production build at http://localhost:4173
npm test          # Run all tests once
```

## Project Structure

```
src/
  engine/       # Pure game logic (ResourceEngine, BuildQueue, FormulasEngine, FleetEngine, ...)
  data/         # Static definitions — buildings, research, ships, defences, combat tables
  models/       # TypeScript interfaces only (GameState, PlanetState, Fleet, ...)
  hooks/        # React hooks bridging engine to UI (useGameEngine)
  context/      # GameContext — state + actions for the component tree
  components/   # Shared UI (ResourceBar, NavSidebar, HoverPortal, ...)
  panels/       # Page-level views (Buildings, Research, Shipyard, Fleet, Galaxy, ...)
  utils/        # Pure utilities (number/time formatting)
```

## Roadmap

See [PLAN.md](PLAN.md) for the full feature roadmap and current phase status.
