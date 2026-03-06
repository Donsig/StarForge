# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this project.

## Workflow

- Use `AskUserQuestion` tool when clarifying questions are needed before proceeding with design or implementation decisions.
- **Continuously save learnings to memory** (`C:\Users\ander\.claude\projects\C--dev-repos-StarForge\memory\`). Update immediately — not at end of session — whenever you discover: a Codex interaction pattern that worked or failed, a planning workflow step, a user collaboration preference, or a project gotcha. Keep `MEMORY.md` under 200 lines; use topic files for detail.

## Implementation Rules

- **Never write code without explicit user approval.** Claude's role is design, planning, review, and orchestration — not implementation.
- **Codex handles all implementation.** Once a plan is approved, use the `codex-agent` skill to send it to Codex (gpt-5.4, `reasoning_effort: high` for complex tasks).
- **Codex reviews the plan before implementation.** After a plan is written and user-approved, send it to Codex (`sandbox: "read-only"`) for a review pass. Surface any gaps or issues back to the user before dispatching for implementation.
- **Codex only implements after user approval.** Present the plan or feature table first, get a "yes", then dispatch to Codex.
- **Always use the `codex-agent` skill** before invoking any Codex MCP tool or Bash codex command. The skill defines the correct invocation patterns for this project.

## Purpose

Single-player OGame-inspired idle browser game called "Star Forge." Real-time resource production, building upgrades, research tree, ship construction, planetary defences, galaxy exploration, fleet combat, espionage, and transport missions. No backend — all state in localStorage. See `PLAN.md` for roadmap and current phase status.

## Quick Start

```bash
npm install
npm run dev          # Vite dev server with HMR
npm run build        # tsc + Vite production build to dist/
npm run preview      # Preview production build locally
npm run lint         # ESLint
npm test             # vitest run (all tests once)
npm run test:watch   # vitest in watch mode
npx vitest run src/engine/__tests__/FormulasEngine.test.ts  # run a single test file
```

## Testing

**Framework:** vitest with globals + @testing-library/react + @testing-library/user-event, jsdom environment.

**Test structure:**
- `src/engine/__tests__/` — Engine unit tests (formulas, resources, build queue, state manager)
- `src/utils/__tests__/` — Utility function tests (formatting)
- `src/test/integration/` — Game flow integration tests (full build cycles, research chains, ship production, save/load)
- `src/components/__tests__/` — React component tests (ResourceBar, NavSidebar, CostDisplay, QueueDisplay)
- `src/panels/__tests__/` — Panel component tests (Buildings, Research, Shipyard, Fleet, Settings)

**Test utilities:** `src/test/test-utils.tsx` provides `renderWithGame()` which wraps components in mock GameContext. `src/test/setup.ts` provides localStorage mock and jest-dom matchers.

**Note:** vitest globals are enabled — `describe`, `it`, `expect`, `beforeEach`, `vi` are available without importing.

## Architecture

**Vite + React 19 + TypeScript (strict).** Game engine is pure TypeScript with zero React imports. React reads engine state via context.

### Directory Layout

- `src/engine/` — Pure game logic, no React/DOM:
  - `GameEngine` — rAF tick loop, wires all sub-engines together
  - `ResourceEngine` — per-planet production accumulation
  - `BuildQueue` — building/research/ship/defence queue processing
  - `FormulasEngine` — all math, pure functions
  - `StateManager` — localStorage save/load/migrate, offline catch-up
  - `FleetEngine` — fleet mission dispatch, transit, arrival (raid, harvest, transport, espionage)
  - `GalaxyEngine` — galaxy generation, colonization, NPC colony spawn, debris field management
  - `CombatEngine` — pure deterministic combat simulation (`simulate(attacker, defender, seed)`)
  - `EspionageEngine` — spy probe result generation
  - `NPCUpgradeEngine` — background NPC colony upgrade simulation
- `src/data/` — Static game definitions (buildings, research, ships, defences). The "design spreadsheet." To rebalance or add content, edit these files.
- `src/models/` — TypeScript interfaces only. GameState, PlanetState, types. No logic.
- `src/hooks/` — React hooks bridging engine to UI. `useGameEngine` owns the engine instance and pushes state into React.
- `src/context/` — GameContext providing state + action functions to the component tree.
- `src/components/` — Shared React components (ResourceBar, NavSidebar, QueueDisplay, CostDisplay, HoverPortal).
- `src/panels/` — Page-level panel components (Buildings, Research, Shipyard, Defence, Fleet, Overview, Settings).
- `src/utils/` — Pure utility functions (number formatting, time formatting).

### Key Design Rules

1. **Engine has no React/DOM.** `src/engine/` and `src/data/` never import from React or UI code.
2. **Data-driven.** Building costs, prerequisites, ship stats live in `src/data/`. Don't hardcode balance values in engine code.
3. **Single state object.** `GameState` is the one source of truth. Engine mutates it, React reads a spread copy.
4. **Formulas are pure functions.** `FormulasEngine.ts` — inputs in, outputs out, no side effects.

### Game Loop

```
requestAnimationFrame loop (in useGameEngine)
  → accumulate delta time
  → while (accumulator >= 1000ms):
      ResourceEngine.processTick(state)
      BuildQueue.processTick(state)
      state.tickCount++
  → setGameState({...state})  // React re-render on tick
  → auto-save every 30 ticks
```

### Offline Catch-Up

On load, elapsed seconds since `lastSaveTimestamp` are calculated. Build queue completions processed chronologically (completions change production rates). Capped at 7 days.

### State Persistence

localStorage key: `starforge_save`. State has a `version` field (currently **v10**) for schema migration via `StateManager.migrate()`.

Migration history:
- v1→v2: added defences
- v2→v3: building/research queues from single-item to arrays
- v3→v4: multi-planet/galaxy refactor
- v4→v5: NPC colony model + debris fields
- v5→v6: fleet missions + combat log
- v6→v7: espionage reports
- v7→v8: admin panel settings, NPC specialty/upgrade fields
- v8→v9: NPC raid memory, abandonment proximity
- v9→v10: astrophysicsTechnology research, slot-based planet temperature/fields, solarSatellite ship type, NPC colony temperatures

## Formulas Reference

Production/hr: Metal `30 * level * 1.1^level`, Crystal `20 * level * 1.1^level`, Deuterium `10 * level * 1.1^level * (-0.002 * temp + 1.28)`

Cost at level L: `baseCost * multiplier^(L-1)`

Build time: `(metalCost + crystalCost) / (2500 * (1 + roboticsLevel) * 2^naniteLevel * gameSpeed)` hours

Energy penalty: if consumption > production, all output scaled by `available / required`

## Gotchas

- **Game speed multiplier** in settings scales production and build times. Always use it in calculations.
- **Storage caps** — resources clamp to storage capacity. Overflow is lost.
- **Energy balance** — negative energy proportionally reduces all mine output.
- **Prerequisites** — buildings and research have prerequisite chains. Check before enabling upgrade buttons.
- **Offline cap** — 7 days max to prevent exploits.
- **Build queues are arrays** — building and research queues are `QueueItem[]`, not nullable. Always check `.length > 0` and access `[0]` for front item.
- **Defences share shipyard queue** — `QueueItem.type === 'defence'` distinguishes them from ships. Shield domes have `maxCount: 1`.
- **Save after mutations** — queue-mutating actions save immediately to localStorage (plus `beforeunload` handler).
- **`maxFields` vs `fieldCount`** — `planet.maxFields` is the building slot cap used everywhere in the engine and UI. `planet.fieldCount` is a display/legacy field. Always set both together; admin actions must update `maxFields` to affect the building cap.
- **`solarSatellite` is a ship** — built via the shipyard queue (also exposed in the Buildings panel as a convenience). Energy contribution: `Math.floor(count * Math.max(0, Math.floor((maxTemperature + 140) / 6)))`. Guard with `Number.isFinite(maxTemperature)`.
- **HoverPortal** — use `src/components/HoverPortal.tsx` for any hover panels. Renders via React portal into `document.body` to avoid clipping inside `overflow-y: auto` containers. Accepts `onMouseEnter`/`onMouseLeave` for stay-open behaviour when cursor moves into the panel. **Known bug:** when anchor is near the left viewport edge, the right-aligned panel can overflow left. Fix: clamp so `panel.left >= 0` after positioning.
- **Seeded PRNG** — `StateManager` uses `mulberry32` seeded PRNG for deterministic galaxy/NPC generation. All new engine code that needs randomness must accept an explicit seed and call the PRNG — never `Math.random()`.
- **Research queue is global** — `state.researchQueue` lives on `GameState`, not per planet. Each `QueueItem` carries `sourcePlanetIndex` to track which planet pays the cost. Don't move it to `PlanetState`.
