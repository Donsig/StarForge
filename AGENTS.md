# StarForge — Agent Guidelines

## Project Overview

StarForge is a single-player OGame-inspired idle browser game. Vite + React 19 + TypeScript (strict). No backend — all state in localStorage.

## Project Structure

This is a **root-level project** (not a subdirectory). All commands run from repo root.

```
src/
  engine/       — pure game logic (no React imports)
  data/         — game balance definitions (buildings, ships, research, defences, assets)
  models/       — TypeScript interfaces only (GameState, PlanetState, types)
  components/   — shared React components (ResourceBar, NavSidebar, CostDisplay, etc.)
  panels/       — page-level panel components (Buildings, Research, Fleet, etc.)
  context/      — GameContext providing state + action functions
  hooks/        — React hooks bridging engine to UI
  utils/        — pure utility functions (formatting)
  test/         — test utilities and integration tests
public/assets/  — static images (panels, planets, buildings, ships, defences)
handoff/        — design handoff package (reference only, not production code)
```

## Build & Dev Commands

```bash
npm install
npm run dev          # Vite dev server with HMR
npm run build        # tsc + Vite production build
npm run lint         # ESLint
npm test             # vitest run (all tests once)
npm run test:watch   # vitest in watch mode
```

## Coding Style

- TypeScript strict — keep types explicit, avoid `any`
- 2-space indentation, match surrounding style
- Components: `PascalCase` (`ResourceBar.tsx`), hooks: `useX`, utilities: `camelCase`
- Engine code (`src/engine/`, `src/data/`) must NEVER import React or DOM
- Data-driven: building costs, ship stats, etc. live in `src/data/` — don't hardcode in UI

## Key Architecture Rules

- **Single state object.** `GameState` is the source of truth. Engine mutates it, React reads a spread copy.
- **Formulas are pure functions.** `FormulasEngine.ts` — inputs in, outputs out, no side effects.
- **Build queues are arrays.** Always check `.length > 0` and access `[0]` for front item.
- **Research queue is global** on `GameState`, not per-planet.
- **Seeded PRNG** — all randomness uses `mulberry32` seeded PRNG, never `Math.random()`.

## Testing

- Framework: Vitest + Testing Library (`jsdom`)
- Naming: `*.test.ts` or `*.test.tsx`
- Placement: colocated `__tests__/` for units/components, `src/test/integration/` for gameplay flows
- `renderWithGame()` in `src/test/test-utils.tsx` wraps components in mock GameContext

## State Schema

- Current version: **v10**. Migrations in `StateManager.migrate()`.
- localStorage key: `starforge_save`

---

## UI Redesign (Active)

**Plan:** `docs/superpowers/plans/2026-04-19-ui-redesign.md` — read this for task details and progress checkboxes.

**Design reference files:**
- `handoff/design_handoff/README.md` — full design spec (438 lines)
- `handoff/design_handoff/StarForge Redesign.html` — interactive prototype (open in browser)
- `handoff/design_handoff/sf-shared.jsx` — ResourceBar, PlanetSwitcher, NavSidebar, FleetMovementsBar
- `handoff/design_handoff/sf-overview.jsx` — Overview panel
- `handoff/design_handoff/sf-panels-a.jsx` — PanelBanner, CardImage, Buildings, Shipyard, Defence
- `handoff/design_handoff/sf-panels-b.jsx` — Galaxy, Fleet, Research
- `handoff/design_handoff/sf-panels-c.jsx` — Messages
- `handoff/design_handoff/sf-panels-d.jsx` — Statistics, Settings

### CSS Design Tokens

The redesign uses CSS custom properties defined in `:root`. Always use these — never hardcode colours or fonts:

```css
/* Font stacks */
--font-display   /* Orbitron — titles, section headers */
--font-body      /* Space Grotesk — body text, buttons */
--font-mono      /* JetBrains Mono — numbers, coords, costs */

/* Colours */
--bg-void, --bg-panel, --bg-panel-dark, --bg-hover
--border, --border-hover
--metal, --crystal, --deuterium, --energy
--accent, --accent-blue, --accent-teal, --accent-amber, --accent-purple, --accent-violet
--danger, --success, --text, --text-dim, --text-muted

/* Layout */
--card-radius (10px), --panel-radius (12px), --btn-radius (6px)
--card-padding, --grid-gap, --card-shadow, --card-shadow-hover
```

### CSS Naming Convention

- **New components** (PanelBanner, CardImage, LevelRing): BEM — `.panel-banner__img`
- **Existing components** (NavSidebar, ResourceBar, CostDisplay): flat — `.nav-button`, `.cost-pill`

### Constraints

- **No engine changes.** This is a UI-only rewrite. Don't modify `src/engine/`, `src/data/`, `src/models/`, or `src/hooks/`.
- **CSS classes over inline styles.** The `sf-*.jsx` reference files use inline styles — convert to CSS classes in `src/styles.css`.
- **Keep existing component interfaces.** Props must stay compatible. Adding optional new props is fine.
- **AdminPanel excluded.** Don't touch `src/panels/AdminPanel.tsx` — it has its own `.admin-*` CSS namespace.
- **CardImage graceful degradation.** Individual building/ship/defence/research images don't exist yet. The `CardImage` component has a striped placeholder fallback — don't break this.
- **Use HoverPortal.** `src/components/HoverPortal.tsx` handles portal-based tooltips. Use it instead of creating new portal logic.
- **ONLY modify files listed in the task.** Do not touch files outside the task scope.

### Mission Type Colours (shared across FleetMovementsBar, FleetPanel, Overview)

| Type | Background | Text | Border |
|------|-----------|------|--------|
| attack | `rgba(120,40,0,0.9)` | `#ffb366` | `rgba(180,60,0,0.6)` |
| espionage | `rgba(0,30,100,0.9)` | `#66aaff` | `rgba(0,60,180,0.5)` |
| harvest | `rgba(0,60,60,0.9)` | `#30d5c8` | `rgba(0,100,100,0.5)` |
| transport | `rgba(0,60,20,0.9)` | `#66ff88` | `rgba(0,100,40,0.5)` |
| colonise | `rgba(60,0,100,0.9)` | `#cc88ff` | `rgba(100,0,160,0.5)` |

Status colours: outbound `#4d8fff` · returning `#34d399` · at_target `#f0a832`

## Commits

- Use imperative subjects: `feat(ui): redesign BuildingsPanel with banner and card images`
- Keep commits scoped to one task from the plan
- Run `npm run build` before committing to catch type errors
