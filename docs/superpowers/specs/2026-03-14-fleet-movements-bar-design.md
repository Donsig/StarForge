# Fleet Movements Bar — Design Spec

**Date:** 2026-03-14
**Status:** Approved (post-Codex review)

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

The bar uses a discriminated union rather than adding `'npc_raid'` to the existing `MissionType` (which is shared across dispatch, stats, and targeting logic).

```ts
export type MovementDirection = 'outgoing' | 'incoming';

export interface PlayerMovementEntry {
  kind: 'player';
  id: string;                         // === missionId for recall
  missionType: MissionType;           // existing player mission types only
  direction: 'outgoing';
  sourceLabel: string;                // "Homeworld [G:1 S:1 P:1]"
  targetLabel: string;                // "[G:1 S:2 P:3]"
  sourceCoordinates: Coordinates;     // raw, for sorting/testing
  targetCoordinates: Coordinates;     // raw
  status: MissionStatus;
  nextTransitionTime: number | null;  // arrivalTime | returnTime | null
  ships: Partial<Record<ShipId, number>>;
  cargo: { metal: number; crystal: number; deuterium: number };
  canRecall: boolean;                 // status === 'outbound'
}

export interface NpcRaidEntry {
  kind: 'npc';
  id: string;
  missionType: 'npc_raid';
  direction: 'incoming';
  sourceLabel: string;
  targetLabel: string;
  sourceCoordinates: Coordinates;
  targetCoordinates: Coordinates;
  status: MissionStatus;
  nextTransitionTime: number | null;
  ships: Partial<Record<ShipId, number>>;
  canRecall: false;
}

export type MovementEntry = PlayerMovementEntry | NpcRaidEntry;
```

`MissionType` is **not** modified. `'npc_raid'` only appears in `NpcRaidEntry`.

### One-way mission handling

`deploy` and `colonise` missions complete on arrival — they never enter `returning` status. The bar removes them when `status === 'completed'` (same filter as all missions). No special case needed; they simply disappear when the engine marks them completed.

---

## Countdown — Shared Interval (`src/hooks/useNow.ts`)

`useCountdown` uses a per-instance `requestAnimationFrame` loop. Mounting one per bar row does not scale.

New hook: `useNow(intervalMs: number): number` — returns the current timestamp, updated on a single shared interval. All bar rows share one interval tick.

```ts
// src/hooks/useNow.ts
export function useNow(intervalMs = 1000): number
```

`FleetMovementsBar` calls `useNow(1000)` once at the top level, derives countdown strings per entry in render, and passes them down as props. No per-row timer hooks.

`useCountdown` in `FleetPanel` is left unchanged (it's fine for single-panel use).

---

## Derivation — `useGameEngine` (`src/hooks/useGameEngine.ts`)

`fleetMovements: MovementEntry[]` is derived with `useMemo` inside `useGameEngine`, not in `GameContext`. This keeps label formatting out of state plumbing.

**Derivation logic:**
- Source: `gameState.fleetMissions` filtered to `status !== 'completed'`
- Map each `FleetMission` → `PlayerMovementEntry`:
  - `sourceLabel`: `planets[sourcePlanetIndex].name + formatCoords(planet.coordinates)`
  - `targetLabel`: `formatCoords(targetCoordinates)`
  - `nextTransitionTime`: `arrivalTime` if `outbound`, `returnTime` if `returning`, `null` if `at_target`
  - `canRecall`: `status === 'outbound'`
- Sort by `nextTransitionTime` ascending, nulls last
- **NPC raids (future):** a second source (e.g. `gameState.npcRaids`) maps to `NpcRaidEntry[]` and is concatenated before sorting. The bar component needs no changes.

`fleetMovements` is exposed via `GameContext` and the `useGame()` hook.

---

## Shared Utility (`src/utils/fleet.ts`)

New file. Extract `missionShipManifest()` from `FleetPanel.tsx` here.

```ts
// Returns "3× Light Fighter, 1× Cruiser" etc.
export function missionShipManifest(ships: Partial<Record<ShipId, number>>): string
```

`FleetPanel.tsx` imports it from here. `FleetMovementsBar` also imports it from here.

---

## Component: `FleetMovementsBar` (`src/components/FleetMovementsBar.tsx`)

### Layout

```css
position: fixed;
bottom: 0;
left: 0;
right: 0;
z-index: 100;
max-height: 40vh;
overflow-y: auto;
```

- Renders `null` when `fleetMovements.length === 0` (zero footprint)
- `QueueDisplay` is a CSS grid footer row (not fixed) — the bar overlaps it when active. The `.main-content` area gets `padding-bottom` equal to the bar's rendered height via a CSS variable or a sentinel div approach. Simple initial solution: fixed `padding-bottom: var(--movements-bar-height, 0)` set by a `useLayoutEffect` measuring the bar's height.

### Row structure

```
[type pill]  [sourceLabel]  [›/‹]  [targetLabel]  [status badge]  [countdown]  [Recall?]
```

- **Type pill:** small colored label using CSS class from table below
- **Arrow:** `›` for `direction === 'outgoing'`, `‹` for `'incoming'`
- **Status badge:** Outbound / Returning / At Target
- **Countdown:** computed from `useNow()` result — `formatDuration(Math.max(0, Math.floor((entry.nextTransitionTime - now) / 1000)))`; shows `—` if `nextTransitionTime` is null
- **Recall button:** shown when `canRecall === true`; calls `recallFleet(entry.id)`

### Hover tooltip

Uses `HoverPortal` (same pattern as existing `MissionRow` in `FleetPanel`):
- Ship manifest via `missionShipManifest(entry.ships)`
- Cargo line only when `entry.status === 'returning'` and cargo is non-zero: `M 1,234  C 567  D 89`
- Stay-open with `HOVER_CLOSE_DELAY_MS = 120ms` (matches FleetPanel)

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

`FleetMovementsBar` is the last child of `.app-shell`. It is `position: fixed` so it does not affect the grid flow. Bottom padding on `.main-content` is managed dynamically via `useLayoutEffect` measuring the bar's `offsetHeight` and writing `--movements-bar-height` to `document.documentElement.style`.

---

## NPC Raid Forward-Compatibility Checklist

- [x] `MovementDirection = 'outgoing' | 'incoming'` defined
- [x] `NpcRaidEntry` interface defined with `kind: 'npc'` discriminant
- [x] `‹` arrow rendered for `direction === 'incoming'`
- [x] `movement-type--npc-raid` CSS class defined (flashing red animation)
- [x] Bar component renders `MovementEntry` union — handles both `kind` variants
- [x] Derivation in `useGameEngine` accepts second source array without bar changes
- [x] `'npc_raid'` NOT added to `MissionType` (keeps player dispatch types clean)

---

## Out of Scope

- NPC raid engine (scheduling, dispatch, combat resolution)
- Click-to-navigate to Fleet panel
- Grouping rows into "Outgoing" / "Incoming" sections (color + arrow sufficient)
- Fixing HoverPortal left-edge clipping (tracked separately in PLAN.md)

---

## Files Affected

| File | Change |
|------|--------|
| `src/models/Fleet.ts` | Add `PlayerMovementEntry`, `NpcRaidEntry`, `MovementEntry`, `MovementDirection` |
| `src/hooks/useNow.ts` | New — shared interval hook |
| `src/hooks/useGameEngine.ts` | Derive `fleetMovements` with `useMemo`; expose via context |
| `src/context/GameContext.tsx` | Add `fleetMovements: MovementEntry[]` to context value + `useGame()` return |
| `src/utils/fleet.ts` | New — `missionShipManifest()` extracted from FleetPanel |
| `src/components/FleetMovementsBar.tsx` | New component |
| `src/panels/FleetPanel.tsx` | Import `missionShipManifest` from `src/utils/fleet.ts` |
| `src/App.tsx` | Mount `<FleetMovementsBar />` in shell |
| `src/styles.css` | Bar layout + color-coded mission type classes |
