# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this project.

## Purpose

Single-player OGame-inspired idle browser game called "Star Forge." Real-time resource production, building upgrades, research tree, ship construction, and planetary defences. No backend — all state in localStorage. See `PLAN.md` for Phase 2 roadmap (galaxy, combat, raids).

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

- `src/engine/` — Pure game logic, no React/DOM. GameEngine (rAF tick loop), ResourceEngine (production), BuildQueue (construction queues), FormulasEngine (all math), StateManager (localStorage).
- `src/data/` — Static game definitions (buildings, research, ships, defences). The "design spreadsheet." To rebalance or add content, edit these files.
- `src/models/` — TypeScript interfaces only. GameState, PlanetState, types. No logic.
- `src/hooks/` — React hooks bridging engine to UI. `useGameEngine` owns the engine instance and pushes state into React.
- `src/context/` — GameContext providing state + action functions to the component tree.
- `src/components/` — Shared React components (ResourceBar, NavSidebar, QueueDisplay, CostDisplay).
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

localStorage key: `starforge_save`. State has a `version` field (currently v6) for schema migration via `StateManager.migrate()`. Migrations: v1→v2 added defences, v2→v3 converted building/research queues from single-item to arrays, v3→v4 multi-planet/galaxy refactor, v4→v5 NPC colony model + debris fields, v5→v6 fleet missions + combat log.

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
