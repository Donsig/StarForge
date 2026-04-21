# Star Forge

A single-player, browser-based idle strategy game inspired by **OGame**. Build mines, research technologies, construct fleets, raid NPC colonies across a procedurally generated galaxy, and expand your empire — all running entirely in the browser with zero backend. Your save lives in `localStorage`.

Built with **Vite + React 19 + TypeScript** (strict mode). The game engine is pure TypeScript with no React dependency — the UI is just a view layer over a deterministic simulation.

**▶ Play it live: [donsig.github.io/StarForge](https://donsig.github.io/StarForge/)** — each visitor gets their own save scoped to that origin. No account, no server.

---

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Game Systems](#game-systems)
- [Testing](#testing)
- [Save System](#save-system)
- [Development Notes](#development-notes)
- [Roadmap](#roadmap)

---

## Features

### Core economy
- **Three resources** — Metal, Crystal, Deuterium with real-time production, storage caps, and an energy-balance system that proportionally throttles mines when demand exceeds supply.
- **Energy sources** — Solar Plant, Fusion Reactor (consumes deuterium), and Solar Satellites (temperature-scaled output, destructible in combat).
- **Offline catch-up** — Up to 7 days of production, build completions, and fleet movements are replayed chronologically when you return.

### Buildings & research
- **Full mine/infrastructure tree** — Metal / Crystal / Deuterium mines, storages, Robotics Factory, Nanite Factory, Research Lab, Shipyard.
- **Research tree** with prerequisite chains — energy, laser, ion, plasma, weapons, shielding, armour, combustion/impulse/hyperspace drives, espionage, computer, astrophysics, and more.
- **Unlimited queues** — Building, research, and shipyard queues accept any number of items. Cancelling a dependency cascades to dependent queue items.

### Military
- **10 ship types** + **8 defence structures** with OGame-accurate combat stats, shield values, hull integrity, and rapid-fire tables.
- **Deterministic combat engine** — Pure function `simulate(attacker, defender, seed)`. Max 6 rounds, simultaneous volleys, shield reset each round, 1% deflection rule, <70% hull explosion chance.
- **Defence rebuild** — 70% of destroyed defences rebuild instantly after combat (ships are permanently lost).
- **Debris fields** — 30% of destroyed-ship metal + crystal costs accumulate at battle coordinates, harvestable by Recyclers.

### Galaxy & exploration
- **Procedurally generated galaxy** — 1 galaxy × ~50 systems × 15 slots, deterministic from a seeded PRNG (`mulberry32`).
- **Slot-based planets** — Temperature and field count vary by orbital position. Hot inner slots get small, hot worlds with deuterium penalties; cold outer slots get large, cold worlds with deuterium bonuses.
- **NPC colonies** — 2–5 per system, tier-scaled with distance from your homeworld. Each has a hidden **specialty** (turtle / fleeter / miner / balanced / raider / researcher) that drives their upgrade priorities.
- **Dynamic NPC upgrades** — NPCs upgrade buildings, fleet, and defences over real time. Repeated raids trigger adaptation (faster rebuild, respecialisation to turtle); too many raids in 24h triggers abandonment.
- **Colonisation** gated behind Astrophysics research; colony count scales with tech level.

### Fleet missions
- **Mission types** — Attack, Espionage, Harvest (recycler), Transport (between your own colonies), Colonise, Deploy (permanent fleet relocation).
- **OGame-accurate travel** — Fleet speed is the minimum effective speed across all selected ship types, adjusted for drive-tech bonuses. Distance, fuel cost, and travel time all derive from explicit formulas.
- **Fleet slots** — Capped by Computer Technology level. Full OGame lifecycle: `outbound → at_target → returning → completed`.
- **Fleet Movements Bar** — Persistent bottom bar showing every active mission's countdown and destination.
- **Recall** — Outbound missions can be recalled; elapsed-time symmetry determines the return ETA.

### Espionage
- **Probe-based intel** — Tiered reports gated by your Espionage Technology level: resources (always), fleet (≥2), defences (≥4), buildings + tier (≥6), rebuild status (≥8), NPC specialty (≥6).
- **Detection** — NPC espionage level (tier-derived, boosted by Research Lab for `researcher` specialty) vs. your tech and probe count; detected probes are lost.
- **Combat simulation preview** in the dispatch form when a non-detected report exists — runs the full combat engine against the spied fleet/defences and shows expected losses, debris, and loot with colour-coded advisory labels.

### Messages & statistics
- **Messages panel** — Combat reports, espionage intel, and fleet notifications with unread badges, auto-prune at 7 days, mark-as-read.
- **Statistics panel** — Lifetime counters (resources mined, battles won/lost, loot, distance travelled) plus a score breakdown across buildings, research, fleet, and defence.

### Quality of life
- **Admin dashboard** — Dev-mode panel for direct state manipulation: set resources, buildings, ships, research; colonize anywhere; trigger combat; simulate offline time; regenerate the galaxy; raw JSON state viewer.
- **God Mode** — Toggle in Admin that surfaces instant-complete buttons on queues and missions throughout the UI.
- **Save export / import** — JSON download and upload from Settings, with migration on import.
- **Hover portals** — Hover panels render via React portal so they escape scroll containers; delayed-close lets you move into them and scroll.

---

## Screenshots

Bundled in the repo root:

- `overview.png`, `overview_loaded.png` — home dashboard
- `buildings.png`, `research.png`, `shipyard.png`, `defence.png` — build panels
- `galaxy.png` — galaxy view
- `fleet.png` — fleet dispatch and active missions
- `messages.png`, `statistics.png`, `settings.png` — secondary panels

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Build | Vite 7 |
| Runtime | React 19 (strict mode) |
| Language | TypeScript 5.9 (strict) |
| Styling | Plain CSS with design tokens (no framework) |
| Tests | Vitest + @testing-library/react + @testing-library/user-event + jsdom |
| Lint | ESLint 9 flat config + typescript-eslint |
| Persistence | Browser `localStorage` (no backend) |
| Fonts | Orbitron, Space Grotesk, JetBrains Mono (Google Fonts) |

---

## Getting Started

### Prerequisites

- **Node.js 20+** (ESM + modern build tooling)
- **npm** (or pnpm/yarn — lockfile is npm)

### Install & run

```bash
npm install
npm run dev         # Dev server at http://localhost:5173 with HMR
```

Open the URL in a browser. On first load you'll start on your homeworld with a fresh save. All state persists to `localStorage` under the key `starforge_save`.

### Production build

```bash
npm run build       # tsc -b && vite build → dist/
npm run preview     # Preview the dist/ build at http://localhost:4173/StarForge/
```

### Deployment

The live site at [donsig.github.io/StarForge](https://donsig.github.io/StarForge/) auto-deploys on every push to `main` via `.github/workflows/deploy.yml` (GitHub Actions → GitHub Pages). Vite is configured with `base: '/StarForge/'` so assets resolve under the subpath; `src/data/assets.ts` wraps all asset URLs in a `BASE_URL`-aware helper so the same code serves both `/` locally and `/StarForge/` in production.

---

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | TypeScript project-references build + Vite production bundle |
| `npm run preview` | Serve the `dist/` folder locally |
| `npm run lint` | ESLint across the repo |
| `npm test` | Vitest — run all tests once |
| `npm run test:watch` | Vitest in watch mode |
| `npx vitest run <path>` | Run a single test file |

---

## Project Structure

```
src/
  engine/           Pure game logic — zero React/DOM imports
    GameEngine          requestAnimationFrame tick loop, wires sub-engines together
    ResourceEngine      per-planet production accumulation + energy balance
    BuildQueue          building / research / shipyard / defence queue processing
    FormulasEngine      all math — pure functions, inputs in, outputs out
    StateManager        localStorage save/load/migrate, offline catch-up
    FleetEngine         fleet dispatch, transit, arrival — attack / espionage / harvest / transport / colonise / deploy
    GalaxyEngine        galaxy generation, colonisation, NPC spawning
    CombatEngine        deterministic round-based combat simulation
    EspionageEngine     tiered spy report generation + detection rolls
    NPCUpgradeEngine    background NPC upgrade simulation
    ScoreEngine         player score tracking (buildings / research / fleet / defence)
  data/             Static game definitions — the "design spreadsheet"
                    buildings.ts · research.ts · ships.ts · defences.ts · combat.ts · galaxy.ts
  models/           TypeScript interfaces only — GameState, PlanetState, Fleet, Galaxy, types
  hooks/            React hooks bridging engine to UI (useGameEngine owns the engine)
  context/          GameContext — state + action functions for the component tree
  components/       Shared UI — ResourceBar, NavSidebar, QueueDisplay, CostDisplay,
                    HoverPortal, PanelBanner, CardImage, LevelRing, FleetMovementsBar
  panels/           Page-level views — Overview, Buildings, Research, Shipyard, Defence,
                    Fleet, Galaxy, Messages, Statistics, Settings, Admin
  utils/            Pure utility functions — number and time formatting
  test/             Integration tests, test utilities, jsdom setup
```

Other top-level folders:

- `public/assets/` — panel banners and planet portraits (WebP)
- `docs/` — planning documents, reviews, UI redesign handoff
- `scripts/` — local automation scripts
- `dist/` — production build output (gitignored)

---

## Architecture

### Key design rules

1. **Engine has no React or DOM.** `src/engine/` and `src/data/` never import from React or UI code. The engine runs identically in a Node test environment.
2. **Data-driven.** Building costs, prerequisites, ship stats, and combat tables live in `src/data/`. To rebalance or add content, edit those files — don't touch engine logic.
3. **Single state object.** `GameState` is the source of truth. The engine mutates it in place; React reads a spread copy on each tick.
4. **Pure formulas.** `FormulasEngine.ts` contains all math as pure functions.
5. **Deterministic randomness.** All engine randomness goes through a seeded `mulberry32` PRNG threaded from `state.galaxy.seed`. Never `Math.random()` in engine code.

### Game loop

```
requestAnimationFrame loop (in useGameEngine)
  → accumulate delta time
  → while (accumulator >= 1000ms):
      ResourceEngine.processTick(state)         // all planets, not just active
      BuildQueue.processTick(state)
      FleetEngine.processTick(state, now)       // mission lifecycle transitions
      NPCUpgradeEngine.processUpgrades(state, now)
      state.tickCount++
  → setGameState({ ...state })                   // React re-render
  → auto-save every 30 ticks
```

### Offline catch-up

On load, elapsed seconds since `lastSaveTimestamp` are computed (capped at 7 days). Build completions, fleet arrivals, and fleet returns are merged into a chronological event list and replayed — completions can change production rates, so order matters. Multi-planet production accumulates in the intervals between events. NPC upgrades are caught up in a final pass.

### Core formulas

- **Production/hr:**
  - Metal: `30 * level * 1.1^level`
  - Crystal: `20 * level * 1.1^level`
  - Deuterium: `10 * level * 1.1^level * (-0.002 * temp + 1.28)`
- **Cost at level L:** `baseCost * multiplier^(L-1)`
- **Build time (hours):** `(metalCost + crystalCost) / (2500 * (1 + roboticsLevel) * 2^naniteLevel * gameSpeed)`
- **Fleet travel time (seconds):** `10 + (3500 / gameSpeed) * sqrt(distance * 10 / fleetSpeed)`
- **Energy penalty:** if consumption > production, all mine output scaled by `available / required`.

---

## Game Systems

### Resources

Metal and crystal follow a clean geometric curve; deuterium scales with temperature (cold planets produce more). Resources clamp at storage capacity — **overflow is lost**. Build storages before you outgrow them.

### Research

All research shares one global queue. Each queue item records `sourcePlanetIndex` so costs are deducted from the right planet. Research Lab on that planet determines speed; future Intergalactic Research Network would pool labs across planets.

### Combat

Pure-function simulation seeded from `now ^ missionId`:

1. Collect live units on both sides.
2. For 6 rounds (or until one side is eliminated):
   - Each attacker unit targets a random defender; rapid-fire chains trigger `(n-1)/n` follow-up shots against a random enemy.
   - Shields absorb damage up to shield value; excess hits hull.
   - Hull < 70% → each subsequent hit has `(1 - hull/maxHull)` chance to instantly destroy.
   - Damage < 1% of target shield → 0 damage (deflection).
   - Both volleys resolve simultaneously; shields reset between rounds.
3. Post-combat: 70% of destroyed defences rebuild; debris field created from 30% of destroyed-ship material cost; loot computed from attacker cargo capacity vs. defender available resources (50% cap).

### Galaxy & NPCs

Galaxy generation is deterministic from `state.galaxy.seed`. Each NPC colony has:

- **Tier 1–10** — scales building levels, fleet composition, defences.
- **Specialty** — biases upgrade priorities (e.g., `turtle` prioritises defences, `miner` prioritises mines).
- **Raid memory** — 10-slot ring buffer of raid timestamps drives adaptation and abandonment logic.
- **Running resource balance** — NPCs accumulate resources over real time at their `production_rate(buildings)` and spend them on cost-gated upgrades; raids deplete the balance rather than reset a timestamp, so sustained pressure meaningfully starves them.

NPCs never initiate raids — they're purely reactive targets.

### Fleet missions

Each mission is one `FleetMission` with an explicit lifecycle:

```
outbound → at_target → returning → completed
```

At `at_target`, combat/espionage resolves inline. Cargo and surviving ships are returned to the source planet on `completed`. Missions older than 7 days are pruned. Recall flips `outbound` to `returning` with the elapsed outbound time as the new return ETA.

Game-speed changes rescale active mission ETAs (same pattern as build queue rescaling).

---

## Testing

Framework: **Vitest** with globals + `@testing-library/react` + `@testing-library/user-event` in a jsdom environment. Vitest globals (`describe`, `it`, `expect`, `beforeEach`, `vi`) are available without imports.

### Test layout

| Directory | Purpose |
|-----------|---------|
| `src/engine/__tests__/` | Engine units — formulas, resources, build queue, combat, fleet, espionage, state manager |
| `src/utils/__tests__/` | Utility functions (number and time formatting) |
| `src/test/integration/` | End-to-end game flows — full build cycles, research chains, ship production, save/load round-trips |
| `src/components/__tests__/` | Shared component tests |
| `src/panels/__tests__/` | Panel rendering, interaction, and asset-wiring tests |

### Utilities

`src/test/test-utils.tsx` exposes `renderWithGame()` which wraps components in a mock `GameContext`. `src/test/setup.ts` provides a `localStorage` mock and jest-dom matchers.

### Running

```bash
npm test                                                    # all tests once
npm run test:watch                                          # watch mode
npx vitest run src/engine/__tests__/FormulasEngine.test.ts  # single file
```

---

## Save System

- **Storage key:** `starforge_save` (localStorage)
- **Schema version:** currently **v10**, managed by `StateManager.migrate()`
- **Auto-save:** every 30 ticks (~30 seconds of active play)
- **Save-on-action:** queue-mutating actions save immediately; a `beforeunload` handler catches tab close
- **Migrations** are additive and run in sequence; old saves upgrade cleanly

Migration history:

| v | Change |
|---|--------|
| 1→2 | Added defences |
| 2→3 | Queues changed from single-item to arrays |
| 3→4 | Multi-planet + galaxy refactor |
| 4→5 | NPC colony model + debris fields |
| 5→6 | Fleet missions + combat log |
| 6→7 | Espionage reports |
| 7→8 | Admin panel settings + NPC specialty/upgrade fields |
| 8→9 | NPC raid memory, abandonment proximity |
| 9→10 | Astrophysics research, slot-based planet temperature/fields, solar satellite ship, NPC temperatures |

Manual export/import is available in Settings if you want to move a save between browsers.

---

## Development Notes

### Gotchas

- **Build queues are arrays** — always check `.length > 0` and access `[0]` for the front item. They are never null.
- **Defences share the shipyard queue** — `QueueItem.type === 'defence'` distinguishes them from ships. Shield Domes have `maxCount: 1`.
- **`solarSatellite` is a ship**, not a building — built via the shipyard queue but exposed in the Buildings panel as a convenience. Energy contribution: `floor(count * max(0, floor((maxTemperature + 140) / 6)))`.
- **`maxFields` vs `fieldCount`** — `planet.maxFields` is the building slot cap used by engine and UI. `fieldCount` is a display/legacy field. Set both together.
- **Research queue is global** — lives on `GameState`, not per planet. Items carry `sourcePlanetIndex`.
- **Game speed** scales production and build times. Always factor it into time calculations. Changes rescale in-flight mission ETAs.
- **Offline cap: 7 days** — prevents afk-for-months exploits.
- **Deterministic RNG** — never call `Math.random()` in engine code; thread the seed through and call the shared PRNG.
- **HoverPortal** — use it for any hover panel. Renders via React portal into `document.body` so it escapes `overflow-y: auto` clipping. Known open bug: left-edge clipping when anchor is near viewport left edge.

### Contributing

1. Read `CLAUDE.md` for architecture details, conventions, and a gotchas list geared at agents.
2. Check `PLAN.md` for the roadmap — every feature lands through a numbered phase with explicit migration steps.
3. Engine changes need unit tests under `src/engine/__tests__/`. UI changes need panel/component tests.
4. `npm run lint && npm test` before pushing.

---

## Roadmap

See [`PLAN.md`](PLAN.md) for the full 7-phase roadmap. Summary of current status:

- **Phase 0–2** — complete (bugfix, storage UI, defences, unlimited queues, galaxy, combat, fleet dispatch, espionage, admin dashboard, NPC upgrades)
- **Phase 3.1–3.2** — complete (debris + recyclers, economy polish)
- **Phase 3.3** — complete (Messages panel + combat reports)
- **Phase 3.4** — in progress (UI polish: planet rename, IRN, fleet slots)
- **Phase 4** — in progress (bugfix/balance, save export/import, colonise-via-fleet, score tracking, statistics panel, deploy missions)
- **Phase 5–7** — planned (missile system, expeditions, new ships, moon system, graviton, terraformer, multi-galaxy)

The active UI redesign plan is tracked in `docs/superpowers/plans/2026-04-19-ui-redesign.md`.
