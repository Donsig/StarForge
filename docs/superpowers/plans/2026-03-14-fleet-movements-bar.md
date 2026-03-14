# Fleet Movements Bar Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent fixed bottom bar showing all active fleet movements, visible from every panel, with color-coded mission type pills, live countdowns, hover tooltips, and recall buttons.

**Architecture:** New `MovementEntry` discriminated union derives from `gameState.fleetMissions` via `useMemo` in `useGameEngine`. A shared `useNow(1000)` hook drives a single interval for all row countdowns. `FleetMovementsBar` is a fixed-position component mounted in the app shell that renders `null` when idle and writes its height to a CSS variable to push layout content up.

**Tech Stack:** React 19, TypeScript strict, Vite, vitest + @testing-library/react, jsdom

**Spec:** `docs/superpowers/specs/2026-03-14-fleet-movements-bar-design.md`

**Test commands:**
```bash
npm test                                                           # all tests
npx vitest run src/hooks/__tests__/useNow.test.ts                 # single file
npx vitest run src/utils/__tests__/fleet.test.ts
npx vitest run src/hooks/__tests__/useGameEngine.test.ts
npx vitest run src/components/__tests__/FleetMovementsBar.test.tsx
```

---

## Chunk 1: Foundation — Types, useNow, Fleet Utilities, test-utils

### Task 1: Add MovementEntry types to Fleet model

**Files:**
- Modify: `src/models/Fleet.ts`

- [ ] **Step 1: Add the new types**

Append to the bottom of `src/models/Fleet.ts` (after the existing `FleetNotification` interface):

```ts
export type MovementDirection = 'outgoing' | 'incoming';

export interface PlayerMovementEntry {
  kind: 'player';
  id: string;
  missionType: MissionType;
  direction: 'outgoing';
  sourcePlanetIndex: number;
  targetCoordinates: Coordinates;
  status: MissionStatus;
  nextTransitionTime: number | null;
  ships: Partial<Record<string, number>>;
  cargo: { metal: number; crystal: number; deuterium: number };
  canRecall: boolean;
}

export interface NpcRaidEntry {
  kind: 'npc';
  id: string;
  missionType: 'npc_raid';
  direction: 'incoming';
  sourceCoordinates: Coordinates;
  targetCoordinates: Coordinates;
  status: MissionStatus;
  nextTransitionTime: number | null;
  ships: Partial<Record<string, number>>;
  canRecall: false;
}

export type MovementEntry = PlayerMovementEntry | NpcRaidEntry;
```

Add the `Coordinates` import if not already present — it lives in `src/models/Galaxy.ts`:
```ts
import type { Coordinates } from './Galaxy.ts';
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/models/Fleet.ts
git commit -m "feat(fleet): add MovementEntry discriminated union types"
```

---

### Task 2: Add useNow hook

**Files:**
- Create: `src/hooks/__tests__/useNow.test.ts`
- Create: `src/hooks/useNow.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/__tests__/useNow.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react';
import { useNow } from '../useNow.ts';

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the current timestamp on mount', () => {
    const before = Date.now();
    const { result } = renderHook(() => useNow(1000));
    expect(result.current).toBeGreaterThanOrEqual(before);
  });

  it('updates after the interval elapses', () => {
    const { result } = renderHook(() => useNow(1000));
    const initial = result.current;

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current).toBeGreaterThan(initial);
  });

  it('clears interval on unmount', () => {
    const clearSpy = vi.spyOn(window, 'clearInterval');
    const { unmount } = renderHook(() => useNow(1000));
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/hooks/__tests__/useNow.test.ts
```
Expected: FAIL with "Cannot find module '../useNow.ts'"

- [ ] **Step 3: Implement useNow**

Create `src/hooks/useNow.ts`:

```ts
import { useEffect, useState } from 'react';

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => {
      window.clearInterval(id);
    };
  }, [intervalMs]);

  return now;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/hooks/__tests__/useNow.test.ts
```
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useNow.ts src/hooks/__tests__/useNow.test.ts
git commit -m "feat(hooks): add useNow shared interval hook"
```

---

### Task 3: Create fleet utility (missionShipManifest + formatCoords)

**Files:**
- Create: `src/utils/__tests__/fleet.test.ts`
- Create: `src/utils/fleet.ts`
- Modify: `src/panels/FleetPanel.tsx` (update import)

- [ ] **Step 1: Write the failing tests**

Create `src/utils/__tests__/fleet.test.ts`:

```ts
import { missionShipManifest, formatCoords } from '../fleet.ts';

describe('missionShipManifest', () => {
  it('returns empty string when no ships', () => {
    expect(missionShipManifest({})).toBe('');
  });

  it('formats a single ship type', () => {
    expect(missionShipManifest({ lightFighter: 5 })).toBe('5× Light Fighter');
  });

  it('formats multiple ship types, skipping zero counts', () => {
    const result = missionShipManifest({
      lightFighter: 3,
      cruiser: 0,
      battleship: 1,
    });
    expect(result).toContain('3× Light Fighter');
    expect(result).toContain('1× Battleship');
    expect(result).not.toContain('Cruiser');
  });

  it('floors fractional counts', () => {
    expect(missionShipManifest({ lightFighter: 2.9 })).toBe('2× Light Fighter');
  });
});

describe('formatCoords', () => {
  it('formats coordinates as [G:x S:y P:z]', () => {
    expect(formatCoords({ galaxy: 1, system: 5, slot: 3 })).toBe('[G:1 S:5 P:3]');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/utils/__tests__/fleet.test.ts
```
Expected: FAIL with "Cannot find module '../fleet.ts'"

- [ ] **Step 3: Implement fleet utils**

Create `src/utils/fleet.ts`:

```ts
import { SHIPS } from '../data/ships.ts';
import type { Coordinates } from '../models/Galaxy.ts';

/** Format a ship counts record into a human-readable manifest string.
 *  e.g. "3× Light Fighter, 1× Battleship" */
export function missionShipManifest(ships: Partial<Record<string, number>>): string {
  return Object.entries(ships)
    .map(([shipId, countValue]) => {
      const count = Math.max(0, Math.floor(countValue ?? 0));
      if (count <= 0) return null;
      const shipName = SHIPS[shipId as keyof typeof SHIPS]?.name ?? shipId;
      return `${count}× ${shipName}`;
    })
    .filter((entry): entry is string => entry !== null)
    .join(', ');
}

/** Format galaxy coordinates as "[G:x S:y P:z]" */
export function formatCoords(coords: Coordinates): string {
  return `[G:${coords.galaxy} S:${coords.system} P:${coords.slot}]`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/utils/__tests__/fleet.test.ts
```
Expected: 5 tests PASS

- [ ] **Step 5: Update FleetPanel to import from the new util**

In `src/panels/FleetPanel.tsx`, find the local `missionShipManifest` function (around line 95) and delete it. Then add the import:

```ts
import { missionShipManifest } from '../utils/fleet.ts';
```

- [ ] **Step 6: Run full test suite to verify nothing broke**

```bash
npm test
```
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/utils/fleet.ts src/utils/__tests__/fleet.test.ts src/panels/FleetPanel.tsx
git commit -m "feat(utils): extract missionShipManifest + add formatCoords to fleet utils"
```

---

---

## Chunk 2: Derivation — useGameEngine + GameContext

### Task 5: Derive fleetMovements in useGameEngine

**Files:**
- Modify: `src/hooks/useGameEngine.ts`
- Modify: `src/context/GameContext.tsx`
- Modify: `src/test/test-utils.tsx`

- [ ] **Step 1: Write the failing test for the derivation**

The `useGameEngine` hook is large and stateful, so test the pure derivation logic as a separate helper first. Add a new test file:

Create `src/hooks/__tests__/fleetMovements.test.ts`:

```ts
import { deriveFleetMovements } from '../useGameEngine.ts';
import type { FleetMission } from '../../models/Fleet.ts';
import type { PlanetState } from '../../models/Planet.ts';
import { createDefaultPlanet } from '../../models/Planet.ts';

function makeMission(overrides: Partial<FleetMission> = {}): FleetMission {
  return {
    id: 'mission-1',
    type: 'attack',
    status: 'outbound',
    sourcePlanetIndex: 0,
    targetCoordinates: { galaxy: 1, system: 2, slot: 3 },
    targetType: 'npc_colony',
    ships: { lightFighter: 5 },
    cargo: { metal: 0, crystal: 0, deuterium: 0 },
    fuelCost: 10,
    departureTime: 1000,
    arrivalTime: 5000,
    returnTime: 9000,
    ...overrides,
  };
}

function makePlanet(name = 'Homeworld'): PlanetState {
  const p = createDefaultPlanet();
  p.name = name;
  return p;
}

describe('deriveFleetMovements', () => {
  it('returns empty array when no missions', () => {
    expect(deriveFleetMovements([], [makePlanet()])).toEqual([]);
  });

  it('excludes completed missions', () => {
    const mission = makeMission({ status: 'completed' });
    expect(deriveFleetMovements([mission], [makePlanet()])).toHaveLength(0);
  });

  it('maps outbound mission to PlayerMovementEntry with correct fields', () => {
    const mission = makeMission({ status: 'outbound', arrivalTime: 5000 });
    const planet = makePlanet('Alpha');
    const [entry] = deriveFleetMovements([mission], [planet]);

    expect(entry.kind).toBe('player');
    expect(entry.id).toBe('mission-1');
    expect(entry.missionType).toBe('attack');
    expect(entry.direction).toBe('outgoing');
    expect(entry.sourcePlanetIndex).toBe(0);
    expect(entry.targetCoordinates).toEqual({ galaxy: 1, system: 2, slot: 3 });
    expect(entry.status).toBe('outbound');
    expect(entry.nextTransitionTime).toBe(5000);
    expect(entry.canRecall).toBe(true);
  });

  it('sets canRecall false for returning mission', () => {
    const mission = makeMission({ status: 'returning', returnTime: 9000 });
    const [entry] = deriveFleetMovements([mission], [makePlanet()]);
    expect(entry.canRecall).toBe(false);
    expect(entry.nextTransitionTime).toBe(9000);
  });

  it('sets nextTransitionTime null for at_target mission', () => {
    const mission = makeMission({ status: 'at_target' });
    const [entry] = deriveFleetMovements([mission], [makePlanet()]);
    expect(entry.nextTransitionTime).toBeNull();
  });

  it('sorts by nextTransitionTime ascending, nulls last', () => {
    const m1 = makeMission({ id: 'a', status: 'outbound', arrivalTime: 9000 });
    const m2 = makeMission({ id: 'b', status: 'outbound', arrivalTime: 3000 });
    const m3 = makeMission({ id: 'c', status: 'at_target' });
    const entries = deriveFleetMovements([m1, m2, m3], [makePlanet()]);
    expect(entries[0].id).toBe('b');
    expect(entries[1].id).toBe('a');
    expect(entries[2].id).toBe('c');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/hooks/__tests__/fleetMovements.test.ts
```
Expected: FAIL with "deriveFleetMovements is not exported"

- [ ] **Step 3: Add deriveFleetMovements to useGameEngine.ts**

In `src/hooks/useGameEngine.ts`:

First, add `useMemo` to the existing React import (currently `import { useCallback, useEffect, useRef, useState } from 'react'`):
```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
```

Then add these type imports alongside the existing Fleet imports at the top of the file:
```ts
import type { FleetMission, MovementEntry, PlayerMovementEntry } from '../models/Fleet.ts';
import type { PlanetState } from '../models/Planet.ts';

export function deriveFleetMovements(
  missions: FleetMission[],
  planets: PlanetState[],
): PlayerMovementEntry[] {
  return missions
    .filter((m) => m.status !== 'completed')
    .map((m): PlayerMovementEntry => ({
      kind: 'player',
      id: m.id,
      missionType: m.type,
      direction: 'outgoing',
      sourcePlanetIndex: m.sourcePlanetIndex,
      targetCoordinates: m.targetCoordinates,
      status: m.status,
      nextTransitionTime:
        m.status === 'outbound'
          ? m.arrivalTime
          : m.status === 'returning'
            ? m.returnTime
            : null,
      ships: m.ships,
      cargo: m.cargo,
      canRecall: m.status === 'outbound',
    }))
    .sort((a, b) => {
      if (a.nextTransitionTime === null && b.nextTransitionTime === null) return 0;
      if (a.nextTransitionTime === null) return 1;
      if (b.nextTransitionTime === null) return -1;
      return a.nextTransitionTime - b.nextTransitionTime;
    });
}
```

Note: the `planets` parameter is accepted for forward-compatibility (NPC raids will use it) but is not yet consumed by `PlayerMovementEntry` derivation. The component resolves planet names locally.

Then inside the `useGameEngine` hook body, add a `useMemo` for `fleetMovements` alongside the other derived state:

```ts
const fleetMovements: MovementEntry[] = useMemo(
  () => deriveFleetMovements(gameState.fleetMissions, gameState.planets),
  [gameState.fleetMissions, gameState.planets],
);
```

Add `fleetMovements` to the `GameEngineState` interface at the top of the file:

```ts
export interface GameEngineState {
  // ... existing fields ...
  fleetMovements: MovementEntry[];
}
```

And include it in the returned object from `useGameEngine`.

- [ ] **Step 4: Run derivation tests to verify they pass**

```bash
npx vitest run src/hooks/__tests__/fleetMovements.test.ts
```
Expected: 6 tests PASS

- [ ] **Step 5: Add fleetMovements to GameContextType**

In `src/context/GameContext.tsx`:

Update the Fleet import to include `MovementEntry`:
```ts
import type { EspionageReport, FleetMission, FleetNotification, MovementEntry, MissionType } from '../models/Fleet.ts';
```

Add to `GameContextType` interface (alongside the other derived data fields like `espionageReports`):
```ts
export interface GameContextType {
  // ... existing fields ...
  fleetMovements: MovementEntry[];
}
```

The `GameProvider` passes `gameEngine` (a `GameEngineState`) directly as the context value — it does not spread it. Since `GameEngineState` now includes `fleetMovements: MovementEntry[]` (from Step 3), and `GameContextType` now also requires it, TypeScript will enforce consistency. No additional wiring is needed — the value flows through automatically because `GameEngineState` satisfies `GameContextType`.

- [ ] **Step 6: Update test-utils to include fleetMovements**

In `src/test/test-utils.tsx`:

Update the `GameActions` Omit type to also omit `fleetMovements`:
```ts
type GameActions = Omit<
  GameContextType,
  'gameState' | 'espionageReports' | 'fleetNotifications' | 'fleetMovements' | 'productionRates' | 'storageCaps'
>;
```

In `createMockGameContext`, add `fleetMovements` to the returned object:
```ts
return {
  gameState,
  espionageReports: gameState.espionageReports,
  fleetNotifications: gameState.fleetNotifications,
  fleetMovements: [],
  productionRates,
  storageCaps,
  ...defaultActions,
  ...options.actions,
};
```

- [ ] **Step 7: Run full test suite**

```bash
npm test
```
Expected: all tests PASS. TypeScript should compile cleanly.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useGameEngine.ts src/hooks/__tests__/fleetMovements.test.ts src/context/GameContext.tsx src/test/test-utils.tsx
git commit -m "feat(engine): derive fleetMovements in useGameEngine, expose via context"
```

---

## Chunk 3: Component + Integration

### Task 6: FleetMovementsBar component

**Files:**
- Create: `src/components/__tests__/FleetMovementsBar.test.tsx`
- Create: `src/components/FleetMovementsBar.tsx`

- [ ] **Step 1: Update test-utils to support fleetMovements override**

In `src/test/test-utils.tsx`, add `MovementEntry` to the Fleet import:
```ts
import type { MovementEntry } from '../models/Fleet.ts';
```

Add `fleetMovements` to `RenderWithGameOptions`:
```ts
interface RenderWithGameOptions {
  gameState?: GameStateOverrides;
  productionRates?: Partial<ProductionRates>;
  storageCaps?: Partial<StorageCaps>;
  actions?: Partial<GameActions>;
  fleetMovements?: MovementEntry[];   // top-level override (not via actions)
  withMultiplePlanets?: boolean;
}
```

Update `createMockGameContext` to use the override (Task 5 already set `fleetMovements: []` as the default; replace that line):
```ts
fleetMovements: options.fleetMovements ?? [],
```

- [ ] **Step 2: Write the failing tests**

Create `src/components/__tests__/FleetMovementsBar.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FleetMovementsBar } from '../FleetMovementsBar.tsx';
import { renderWithGame } from '../../test/test-utils.tsx';
import type { PlayerMovementEntry } from '../../models/Fleet.ts';

function makeEntry(overrides: Partial<PlayerMovementEntry> = {}): PlayerMovementEntry {
  return {
    kind: 'player',
    id: 'mission-1',
    missionType: 'attack',
    direction: 'outgoing',
    sourcePlanetIndex: 0,
    targetCoordinates: { galaxy: 1, system: 2, slot: 3 },
    status: 'outbound',
    nextTransitionTime: Date.now() + 60_000,
    ships: { lightFighter: 3 },
    cargo: { metal: 0, crystal: 0, deuterium: 0 },
    canRecall: true,
    ...overrides,
  };
}

describe('FleetMovementsBar', () => {
  it('renders nothing when there are no fleet movements', () => {
    const { container } = renderWithGame(<FleetMovementsBar />, {
      fleetMovements: [],
    });
    expect(container.firstChild).toBeNull();
  });

  it('renders a row for each active movement', () => {
    const entries = [
      makeEntry({ id: 'a', missionType: 'attack' }),
      makeEntry({ id: 'b', missionType: 'transport' }),
    ];
    renderWithGame(<FleetMovementsBar />, { fleetMovements: entries });
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows the outgoing arrow for player missions', () => {
    renderWithGame(<FleetMovementsBar />, { fleetMovements: [makeEntry()] });
    expect(screen.getByText('›')).toBeInTheDocument();
  });

  it('shows Recall button only for canRecall entries', () => {
    const entries = [
      makeEntry({ id: 'a', canRecall: true }),
      makeEntry({ id: 'b', canRecall: false, status: 'returning' }),
    ];
    renderWithGame(<FleetMovementsBar />, { fleetMovements: entries });
    expect(screen.getAllByRole('button', { name: /recall/i })).toHaveLength(1);
  });

  it('calls recallFleet with the mission id when Recall is clicked', async () => {
    const recallFleet = vi.fn();
    renderWithGame(<FleetMovementsBar />, {
      fleetMovements: [makeEntry({ id: 'mission-99', canRecall: true })],
      actions: { recallFleet },
    });
    await userEvent.click(screen.getByRole('button', { name: /recall/i }));
    expect(recallFleet).toHaveBeenCalledWith('mission-99');
  });

  it('shows — for countdown when nextTransitionTime is null', () => {
    const entry = makeEntry({ status: 'at_target', nextTransitionTime: null });
    renderWithGame(<FleetMovementsBar />, { fleetMovements: [entry] });
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('applies color class for mission type', () => {
    renderWithGame(<FleetMovementsBar />, {
      fleetMovements: [makeEntry({ missionType: 'espionage' })],
    });
    expect(document.querySelector('.movement-type--espionage')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run src/components/__tests__/FleetMovementsBar.test.tsx
```
Expected: FAIL with "Cannot find module '../FleetMovementsBar.tsx'"

- [ ] **Step 4: Implement FleetMovementsBar**

Create `src/components/FleetMovementsBar.tsx`:

```tsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MovementEntry, PlayerMovementEntry } from '../models/Fleet.ts';
import { useGame } from '../context/GameContext.tsx';
import { useNow } from '../hooks/useNow.ts';
import { HoverPortal } from './HoverPortal.tsx';
import { missionShipManifest, formatCoords } from '../utils/fleet.ts';
import { formatCountdown } from '../utils/time.ts';
import { formatNumber } from '../utils/format.ts';

const HOVER_CLOSE_DELAY_MS = 120;

function getMissionTypeClass(missionType: string): string {
  switch (missionType) {
    case 'attack':     return 'movement-type--attack';
    case 'espionage':  return 'movement-type--espionage';
    case 'harvest':    return 'movement-type--harvest';
    case 'transport':  return 'movement-type--transport';
    case 'colonise':   return 'movement-type--colonise';
    case 'deploy':     return 'movement-type--deploy';
    case 'npc_raid':   return 'movement-type--npc-raid';
    default:           return '';
  }
}

function getMissionTypeLabel(missionType: string): string {
  switch (missionType) {
    case 'attack':     return 'Attack';
    case 'espionage':  return 'Espionage';
    case 'harvest':    return 'Harvest';
    case 'transport':  return 'Transport';
    case 'colonise':   return 'Colonise';
    case 'deploy':     return 'Deploy';
    case 'npc_raid':   return 'Raid';
    default:           return missionType;
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'outbound':   return 'Outbound';
    case 'returning':  return 'Returning';
    case 'at_target':  return 'At Target';
    default:           return status;
  }
}

// Uses formatCountdown (ms → HH:MM:SS) to match OGame-style timers,
// consistent with FleetPanel's existing countdown display.
function formatCountdownFromNow(nextTransitionTime: number | null, now: number): string {
  if (nextTransitionTime === null) return '—';
  const remainingMs = nextTransitionTime - now;
  return formatCountdown(Math.max(0, remainingMs));
}

interface MovementRowProps {
  entry: MovementEntry;
  planets: { name: string }[];
  now: number;
  onRecall: (id: string) => void;
}

function MovementRow({ entry, planets, now, onRecall }: MovementRowProps) {
  const anchorRef = useRef<HTMLLIElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const hoverTimerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const openTooltip = () => { clearTimer(); setShowTooltip(true); };
  const scheduleClose = () => {
    clearTimer();
    hoverTimerRef.current = window.setTimeout(() => {
      setShowTooltip(false);
      hoverTimerRef.current = null;
    }, HOVER_CLOSE_DELAY_MS);
  };

  useEffect(() => () => clearTimer(), []);

  // For player entries, planet name + coords are resolved from the planets[] prop.
  // planets is gameState.planets (PlanetState[]), so .coordinates is available.
  const sourcePlanet = entry.kind === 'player' ? planets[entry.sourcePlanetIndex] : null;
  const sourceLabel = sourcePlanet
    ? `${sourcePlanet.name} ${formatCoords(sourcePlanet.coordinates)}`
    : entry.kind === 'npc'
      ? formatCoords(entry.sourceCoordinates)
      : '?';
  const targetLabel = formatCoords(entry.targetCoordinates);
  const arrow = entry.direction === 'outgoing' ? '›' : '‹';
  const typeClass = getMissionTypeClass(entry.missionType);
  const typeLabel = getMissionTypeLabel(entry.missionType);
  const statusLabel = getStatusLabel(entry.status);
  const countdown = formatCountdownFromNow(entry.nextTransitionTime, now);
  const shipManifest = missionShipManifest(entry.ships);
  const hasCargo = entry.kind === 'player' &&
    entry.status === 'returning' &&
    (entry.cargo.metal > 0 || entry.cargo.crystal > 0 || entry.cargo.deuterium > 0);

  return (
    <li
      ref={anchorRef}
      className="movement-row"
      onMouseEnter={openTooltip}
      onMouseLeave={scheduleClose}
    >
      <span className={`movement-type-pill ${typeClass}`}>{typeLabel}</span>
      <span className="movement-source">{sourceLabel}</span>
      <span className="movement-arrow">{arrow}</span>
      <span className="movement-target">{targetLabel}</span>
      <span className={`movement-status movement-status--${entry.status}`}>{statusLabel}</span>
      <span className="movement-countdown">{countdown}</span>
      {entry.canRecall && (
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => onRecall(entry.id)}
        >
          Recall
        </button>
      )}
      <HoverPortal
        anchorRef={anchorRef}
        open={showTooltip && shipManifest.length > 0}
        align="below-right"
        className="movement-tooltip"
        onMouseEnter={clearTimer}
        onMouseLeave={scheduleClose}
      >
        <p>{shipManifest}</p>
        {hasCargo && entry.kind === 'player' && (
          <p className="hint">
            M {formatNumber(entry.cargo.metal)}&nbsp;
            C {formatNumber(entry.cargo.crystal)}&nbsp;
            D {formatNumber(entry.cargo.deuterium)}
          </p>
        )}
      </HoverPortal>
    </li>
  );
}

export function FleetMovementsBar() {
  const { fleetMovements, gameState, recallFleet } = useGame();
  const now = useNow(1000);
  const barRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) {
      document.documentElement.style.setProperty('--movements-bar-height', '0px');
      return;
    }

    const observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty(
        '--movements-bar-height',
        `${bar.offsetHeight}px`,
      );
    });
    observer.observe(bar);
    // Set immediately on mount
    document.documentElement.style.setProperty(
      '--movements-bar-height',
      `${bar.offsetHeight}px`,
    );

    return () => {
      observer.disconnect();
      document.documentElement.style.setProperty('--movements-bar-height', '0px');
    };
  }, []);

  if (fleetMovements.length === 0) {
    return null;
  }

  return (
    <nav ref={barRef} className="fleet-movements-bar" aria-label="Fleet movements">
      <ul className="movement-list">
        {fleetMovements.map((entry) => (
          <MovementRow
            key={entry.id}
            entry={entry}
            planets={gameState.planets}
            now={now}
            onRecall={recallFleet}
          />
        ))}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/components/__tests__/FleetMovementsBar.test.tsx
```
Expected: all tests PASS

- [ ] **Step 6: Run full test suite**

```bash
npm test
```
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/FleetMovementsBar.tsx src/components/__tests__/FleetMovementsBar.test.tsx src/test/test-utils.tsx
git commit -m "feat(ui): add FleetMovementsBar component"
```

---

### Task 7: App shell integration + CSS

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Mount FleetMovementsBar in App.tsx**

Read `src/App.tsx` first to confirm the current structure, then add the import:
```ts
import { FleetMovementsBar } from './components/FleetMovementsBar.tsx';
```

In `GameLayout`, add `<FleetMovementsBar />` as the last child of `.app-shell`:
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

- [ ] **Step 2: Add CSS for the bar and its layout impact**

In `src/styles.css`, add the following (find a logical place — e.g. after the `.queue-display` styles or at the end of the file before media queries):

```css
/* ── Fleet Movements Bar ─────────────────────────── */

.fleet-movements-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  z-index: 100;
  max-height: 40vh;
  overflow-y: auto;
  overflow-x: hidden;
  background: rgba(10, 14, 26, 0.96);
  border-top: 1px solid #2a3554;
}

.movement-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.movement-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 0.8rem;
}

.movement-row:last-child {
  border-bottom: none;
}

.movement-type-pill {
  display: inline-block;
  padding: 0.15rem 0.45rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  min-width: 5.5rem;
  text-align: center;
}

.movement-arrow {
  color: #6b7fb5;
  font-size: 1rem;
  flex-shrink: 0;
}

.movement-source,
.movement-target {
  color: #c0cce8;
  white-space: nowrap;
}

.movement-status {
  color: #7a8db8;
  font-size: 0.75rem;
  white-space: nowrap;
}

.movement-countdown {
  font-family: monospace;
  color: #9fb0d8;
  white-space: nowrap;
  margin-left: auto;
}

.movement-tooltip {
  background: #131a2e;
  border: 1px solid #2a3554;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  color: #c0cce8;
  max-width: 300px;
  white-space: pre-wrap;
}

/* Mission type pill colors */
.movement-type--attack     { background: #7a3a00; color: #ffb366; }
.movement-type--espionage  { background: #00336b; color: #66aaff; }
.movement-type--harvest    { background: #003d3d; color: #4dd9d9; }
.movement-type--transport  { background: #003d00; color: #66ff88; }
.movement-type--colonise   { background: #3d0066; color: #cc88ff; }
.movement-type--deploy     { background: #2a2a3a; color: #9999bb; }
.movement-type--npc-raid   {
  background: #7a0000;
  color: #ff6666;
  animation: npc-raid-flash 1s ease-in-out infinite alternate;
}

@keyframes npc-raid-flash {
  from { background: #7a0000; }
  to   { background: #cc0000; }
}

/* Push app shell content up to avoid overlap */
.app-shell {
  padding-bottom: var(--movements-bar-height, 0px);
}

/* Mobile: reduce max height on short viewports */
@media (max-height: 500px) {
  .fleet-movements-bar {
    max-height: 25vh;
    overflow-y: auto;
    overflow-x: hidden;
  }
}
```

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```
Expected: all tests PASS

- [ ] **Step 4: Start dev server and manually verify**

```bash
npm run dev
```

Manual checks:
- With no fleet missions: bar is not visible, no layout shift
- Dispatch an attack mission from Fleet panel → bar appears at bottom with amber "Attack" pill, `›`, source planet, target coords, countdown timer, Recall button
- Click Recall → mission disappears from bar
- Dispatch a transport mission → green "Transport" pill appears
- Hover a row → tooltip shows ship manifest; cargo only shows when returning
- Let a deploy mission arrive → row disappears (status becomes `completed`)
- Multiple missions → sorted by soonest arrival first

- [ ] **Step 5: Build to verify no TypeScript errors**

```bash
npm run build
```
Expected: clean build, no errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/styles.css
git commit -m "feat(ui): integrate FleetMovementsBar into app shell with CSS"
```

---

### Task 8: Final cleanup commit

- [ ] **Step 1: Run lint**

```bash
npm run lint
```
Fix any warnings.

- [ ] **Step 2: Final commit**

```bash
git add src/models/Fleet.ts src/hooks/useNow.ts src/hooks/useGameEngine.ts src/context/GameContext.tsx src/utils/fleet.ts src/components/FleetMovementsBar.tsx src/panels/FleetPanel.tsx src/App.tsx src/styles.css src/test/test-utils.tsx
git commit -m "feat: fleet movements bar — persistent bottom bar for active missions

- PlayerMovementEntry / NpcRaidEntry discriminated union in Fleet model
- useNow(1000) shared interval hook replaces per-row rAF countdown
- deriveFleetMovements pure function in useGameEngine (useMemo)
- FleetMovementsBar: fixed bottom, color-coded pills, recall, hover tooltip
- CSS variable --movements-bar-height prevents QueueDisplay overlap
- Forward-compatible with NPC inbound raids (NpcRaidEntry reserved)"
```
