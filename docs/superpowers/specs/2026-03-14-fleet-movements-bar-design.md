# Fleet Movements Bar — Design Spec

**Date:** 2026-03-14
**Status:** Approved (post-Codex review ×2)

---

## Overview

A persistent fixed bottom bar that shows all active fleet movements at a glance, visible from every panel. Modelled after OGame's movement bar. Supports player outbound missions now; designed to accept NPC inbound raids later with minimal structural changes.

---

## Goals

- Show all active (non-completed) fleet missions from any panel
- OGame-style compact rows: type pill → source → arrow → target → status → countdown → recall
- Hover reveals ship manifest and cargo (returning missions only)
- Color-coded by mission type; directional arrow distinguishes outgoing vs incoming
- Recall button inline for all outbound player missions
- Forward-compatible with NPC inbound raids (different color, flashing, `‹` arrow)
- Zero footprint when no missions are active

---

## Data Model

### Discriminated union (new, `src/models/Fleet.ts`)

Labels are **not** stored in the shared model — they are presentation concerns formatted inside the component. The model carries only raw data.

```ts
export type MovementDirection = 'outgoing' | 'incoming';

export interface PlayerMovementEntry {
  kind: 'player';
  id: string;                         // used for recall
  missionType: MissionType;           // existing player mission types only
  direction: 'outgoing';
  sourcePlanetIndex: number;          // component resolves name + coords from planets[]
  targetCoordinates: Coordinates;
  status: MissionStatus;
  nextTransitionTime: number | null;  // arrivalTime | returnTime | null (at_target)
  ships: Partial<Record<ShipId, number>>;
  cargo: { metal: number; crystal: number; deuterium: number };
  canRecall: boolean;                 // status === 'outbound'
}

export interface NpcRaidEntry {
  kind: 'npc';
  id: string;
  missionType: 'npc_raid';
  direction: 'incoming';
  sourceCoordinates: Coordinates;     // NPC origin (no planet index)
  targetCoordinates: Coordinates;     // player planet being raided
  status: MissionStatus;
  nextTransitionTime: number | null;
  ships: Partial<Record<ShipId, number>>;
  canRecall: false;
}

export type MovementEntry = PlayerMovementEntry | NpcRaidEntry;
```

`MissionType` is **not** modified. `'npc_raid'` only appears in `NpcRaidEntry`.

### One-way mission handling

`deploy` and `colonise` missions complete on arrival and never enter `returning`. The bar filters `status !== 'completed'` — they disappear when the engine marks them done. No special casing needed.

### `at_target` display

`nextTransitionTime` is `null` when `status === 'at_target'`. The bar shows `—` in the countdown column. Status badge shows "At Target".

---

## Countdown — `useNow` hook (`src/hooks/useNow.ts`)

`useCountdown` uses a per-instance `requestAnimationFrame` loop — not suitable for a global bar with multiple rows.

New hook:

```ts
// Returns current timestamp, updated on a shared interval
export function useNow(intervalMs = 1000): number
```

`FleetMovementsBar` calls `useNow(1000)` **once** at the top level. Each row derives its countdown string from the returned `now` value in render — no per-row hooks.

`useCountdown` in `FleetPanel` is left unchanged.

---

## Derivation — `useGameEngine` (`src/hooks/useGameEngine.ts`)

`fleetMovements: MovementEntry[]` is derived with `useMemo` inside `useGameEngine` (not in `GameContext`). Labels stay in the component.

**Derivation logic:**

- Source: `gameState.fleetMissions` filtered to `status !== 'completed'`
- Map each `FleetMission` → `PlayerMovementEntry`:
  - `nextTransitionTime`: `arrivalTime` if `outbound`, `returnTime` if `returning`, `null` if `at_target`
  - `canRecall`: `status === 'outbound'` — explicitly false for `returning` and `at_target`; no no-op recall buttons rendered
- Sort by `nextTransitionTime` ascending, nulls last
- **NPC raids (future):** a second source (e.g. `gameState.npcRaids`) maps to `NpcRaidEntry[]` and is concatenated before sorting. The bar component needs no changes.

Exposed via `GameContext` and `useGame()` hook.

---

## Shared Utility (`src/utils/fleet.ts`)

New file. Extract `missionShipManifest()` from `FleetPanel.tsx`:

```ts
// Returns "3× Light Fighter, 1× Cruiser" etc.
export function missionShipManifest(ships: Partial<Record<ShipId, number>>): string
```

Both `FleetPanel` and `FleetMovementsBar` import from here.

---

## Component: `FleetMovementsBar` (`src/components/FleetMovementsBar.tsx`)

### Layout

```css
position: fixed;
bottom: 0;
left: 0;          /* explicit: prevents shrink-to-fit floating box */
right: 0;         /* explicit: ensures bar spans full viewport width */
width: 100%;
z-index: 100;
max-height: 40vh;
overflow-y: auto; /* scrolls within cap when many missions */
overflow-x: hidden; /* prevents spill when rows are wide */
```

Renders `null` when `fleetMovements.length === 0`.

### Coexistence with `QueueDisplay`

`QueueDisplay` is a CSS grid footer row in `.app-shell` (not fixed). The fixed bar sits visually on top of it when active.

**Solution:** Write `--movements-bar-height` to `document.documentElement.style` via `useLayoutEffect` inside `FleetMovementsBar`, measuring its own `offsetHeight`. Apply this to the app shell:

```css
.app-shell {
  padding-bottom: var(--movements-bar-height, 0px);
}
```

This pushes the entire shell — including `QueueDisplay` — up by the bar's current height, preventing overlap.

**Cleanup:** When the bar renders `null` (no missions), the effect sets `--movements-bar-height` to `'0px'`. A `ResizeObserver` on the bar element handles recomputation when rows are added/removed or the viewport is resized.

### Mobile behavior

On small screens, `max-height: 40vh` is capped further:

```css
@media (max-height: 500px) {
  .fleet-movements-bar {
    max-height: 25vh;
    overflow-y: auto;   /* explicit: missions scroll within cap, don't spill */
    overflow-x: hidden;
  }
}
```

When the bar has more rows than fit, `overflow-y: auto` scrolls within the cap.

### Row structure

The component resolves labels locally from `gameState.planets` and `entry.targetCoordinates`:

```
[type pill]  [sourceName coords]  [›/‹]  [targetCoords]  [status badge]  [countdown]  [Recall?]
```

- **Type pill:** small colored label
- **Arrow:** `›` for `direction === 'outgoing'`, `‹` for `'incoming'`
- **Source label:** for `PlayerMovementEntry` — `planets[entry.sourcePlanetIndex].name + formatCoords(...)`;  for `NpcRaidEntry` — `formatCoords(entry.sourceCoordinates)`
- **Target label:** `formatCoords(entry.targetCoordinates)`
- **Status badge:** Outbound / Returning / At Target
- **Countdown:** `entry.nextTransitionTime !== null ? formatDuration(Math.max(0, Math.floor((entry.nextTransitionTime - now) / 1000))) : '—'`
- **Recall button:** shown when `entry.canRecall === true`; calls `recallFleet(entry.id)`

### Hover tooltip

Uses `HoverPortal` (same pattern as existing `MissionRow` in `FleetPanel`):
- Ship manifest via `missionShipManifest(entry.ships)`
- Cargo line **only** when `entry.status === 'returning'` and at least one cargo value is non-zero: `M 1,234  C 567  D 89`
- Stay-open behavior with `HOVER_CLOSE_DELAY_MS = 120ms`
- **Note:** The existing `HoverPortal` left-edge clipping bug is tracked separately in `PLAN.md`. It is out of scope here but may affect leftmost bar rows on narrow viewports.

### Color coding

| Mission type | CSS class                     | Style          |
|--------------|-------------------------------|----------------|
| `attack`     | `movement-type--attack`       | Amber/orange   |
| `espionage`  | `movement-type--espionage`    | Blue           |
| `harvest`    | `movement-type--harvest`      | Teal           |
| `transport`  | `movement-type--transport`    | Green          |
| `colonise`   | `movement-type--colonise`     | Purple         |
| `deploy`     | `movement-type--deploy`       | Grey           |
| `npc_raid`   | `movement-type--npc-raid`     | Flashing red   |

---

## App Shell Integration (`src/App.tsx`)

```tsx
<div className="app-shell">
  <PlanetSwitcher />
  <ResourceBar />
  <NavSidebar ... />
  <main className="main-content">
    <ActivePanelContent ... />
  </main>
  <QueueDisplay />
  <FleetMovementsBar />
</div>
```

`FleetMovementsBar` is last child. `position: fixed` keeps it out of the grid flow. The `--movements-bar-height` CSS variable on `:root` shifts `.app-shell` padding to prevent overlap with `QueueDisplay`.

---

## Test Utilities (`src/test/test-utils.tsx`)

`fleetMovements` must be added to the mock context returned by `renderWithGame()`. Default value: `[]`. Allows passing custom entries for bar-specific tests.

---

## NPC Raid Forward-Compatibility Checklist

- [x] `MovementDirection = 'outgoing' | 'incoming'` defined
- [x] `NpcRaidEntry` with `kind: 'npc'` discriminant defined
- [x] `‹` arrow rendered for `direction === 'incoming'`
- [x] `movement-type--npc-raid` CSS class defined (flashing red animation)
- [x] Component handles both `kind` variants of the union
- [x] Derivation in `useGameEngine` accepts a second source array without bar changes
- [x] `'npc_raid'` NOT added to `MissionType` (player dispatch types stay clean)

---

## Out of Scope

- NPC raid engine (scheduling, dispatch, combat resolution)
- Click-to-navigate to Fleet panel
- Grouping rows into "Outgoing" / "Incoming" sections (color + arrow sufficient)
- Fixing `HoverPortal` left-edge clipping (tracked in `PLAN.md`)

---

## Files Affected

| File | Change |
|------|--------|
| `src/models/Fleet.ts` | Add `PlayerMovementEntry`, `NpcRaidEntry`, `MovementEntry`, `MovementDirection` |
| `src/hooks/useNow.ts` | New — shared interval hook |
| `src/hooks/useGameEngine.ts` | Derive `fleetMovements` with `useMemo`; expose via context |
| `src/context/GameContext.tsx` | Add `fleetMovements: MovementEntry[]` to context type + `useGame()` return |
| `src/utils/fleet.ts` | New — `missionShipManifest()` extracted from `FleetPanel` |
| `src/components/FleetMovementsBar.tsx` | New component |
| `src/panels/FleetPanel.tsx` | Import `missionShipManifest` from `src/utils/fleet.ts` |
| `src/App.tsx` | Mount `<FleetMovementsBar />` in shell |
| `src/styles.css` | Bar layout, color-coded mission type classes, mobile cap, `--movements-bar-height` on `.app-shell` |
| `src/test/test-utils.tsx` | Add `fleetMovements: []` default to mock context |
