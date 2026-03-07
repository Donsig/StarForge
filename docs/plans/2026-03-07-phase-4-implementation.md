# Phase 4 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Phase 4 features: score tracking, lifetime statistics panel, colonise fleet mission, and deploy fleet mission.

**Architecture:** Score tracking extends `PlayerScores` with accumulated `buildings/fleet/defence` fields incremented in `BuildQueue.processTick`, `processOfflineTime`, and admin-complete hooks. A new `statistics` object on `GameState` holds lifetime resource/combat/fleet stats. Two new fleet mission types (`colonise`, `deploy`) follow the existing `resolveXAtTarget` pattern in `FleetEngine`. All state changes use the existing `StateManager.migrate()` waterfall.

**Tech Stack:** TypeScript strict, Vite, React 19, vitest, @testing-library/react

---

## Context

**Test command:** `npx vitest run` (all tests)
**Single test:** `npx vitest run src/engine/__tests__/BuildQueue.test.ts`
**Branch:** `phase/4.x`

### Key files to understand before starting:
- `src/models/types.ts` — `PlayerScores`, `NavId`
- `src/models/GameState.ts` — `GameState`, `createNewGameState()`
- `src/models/Fleet.ts` — `MissionType`, `FleetMission`
- `src/models/Combat.ts` — `CombatResult` — note: field is `outcome`, NOT `result`
- `src/engine/BuildQueue.ts` — `processTick()` — building/research/ship/defence completions
- `src/engine/ScoreEngine.ts` — `computePlayerScores()` — snapshot-based, runs every tick in `useGameEngine`
- `src/engine/FleetEngine.ts` — `dispatch()`, `dispatchHarvest()`, `resolveAtTarget()`, `resolveXAtTarget()` pattern
- `src/engine/GalaxyEngine.ts` — `colonize()`, `canColonize()`, `isSlotEmpty()`, `planetStatsForSlot()`
- `src/engine/StateManager.ts` — `migrate()` waterfall + `processOfflineTime()`, currently v13
- `src/engine/ResourceEngine.ts` — `processTick()` + `accumulateBulk()` — production per second per planet
- `src/hooks/useGameEngine.ts` — calls `computePlayerScores()` every tick; has admin-complete helpers
- `src/data/assets.ts` — `PANEL_IMAGES`, `PanelImageId`
- `src/App.tsx` — panel routing switch
- `src/components/NavSidebar.tsx` — navigation items

### Skipped: Phase 4.2 (Save Export/Import)
Already implemented — `SettingsPanel.tsx` has clipboard export + textarea import.

### Score model: hybrid snapshot + accumulated
- `ScoreEngine.computePlayerScores()` computes `military`, `economy`, `research`, `total` from current state each tick. It also must return `buildings: 0`, `fleet: 0`, `defence: 0` so the return type satisfies the widened `PlayerScores`.
- `useGameEngine.ts` calls `computePlayerScores()` and then MERGES, preserving accumulated fields: `buildings`, `fleet`, `defence`.
- The snapshot `total` from ScoreEngine (`military*2 + economy*5 + research*3`) is kept AS-IS for NPC scaling in `processNPCUpgrades()`. Do NOT add accumulated fields into the NPC scaling total.
- Accumulated fields are incremented in: `BuildQueue.processTick`, `processOfflineTime` queue completions, and the four admin-complete functions in `useGameEngine`.

---

## Task 0: Defence Panel Banner Test (housekeeping)

**Context:** The panel banner is already fully wired — `src/data/assets.ts` exports `PANEL_IMAGES`, `src/panels/DefencePanel.tsx` already renders `<div className="panel-banner"><img src={PANEL_IMAGES.defence} .../>`, and `src/styles.css` has the `.panel-banner` CSS. The only gap is a test asserting it.

**Files:**
- Modify: `src/panels/__tests__/DefencePanel.test.tsx`

### Step 1: Write the failing test

Add to the existing `describe('DefencePanel')` block in `src/panels/__tests__/DefencePanel.test.tsx`:

```typescript
it('renders panel banner with defence.webp src', () => {
  renderWithGame(<DefencePanel />, {
    gameState: { planet: { buildings: { shipyard: 1 } } },
  });
  const banner = document.querySelector('.panel-banner img') as HTMLImageElement | null;
  expect(banner).not.toBeNull();
  expect(banner!.src).toContain('defence.webp');
});
```

### Step 2: Run — implementation already exists so it should PASS immediately

```bash
npx vitest run src/panels/__tests__/DefencePanel.test.tsx
```

Expected: all PASS (implementation was done in the artwork-wiring PR).

### Step 3: Commit
```bash
git add src/panels/__tests__/DefencePanel.test.tsx
git commit -m "test(defence): assert panel-banner img renders defence.webp"
```

---

## Task 1: Expand PlayerScores + Score Tracking (Phase 4.4)

**Files:**
- Modify: `src/models/types.ts`
- Modify: `src/models/GameState.ts`
- Modify: `src/engine/BuildQueue.ts`
- Modify: `src/engine/ScoreEngine.ts`
- Modify: `src/engine/StateManager.ts`
- Modify: `src/hooks/useGameEngine.ts`
- Modify: `src/engine/__tests__/ScoreEngine.test.ts`
- Modify: `src/engine/__tests__/StateManager.test.ts`
- Modify: `src/panels/__tests__/GalaxyPanel.test.tsx`
- Create: `src/engine/__tests__/ScoreTracking.test.ts`

### Step 1: Write the failing test

Create `src/engine/__tests__/ScoreTracking.test.ts`:

```typescript
import { processTick } from '../BuildQueue';
import { createNewGameState } from '../../models/GameState';
import { BUILDINGS } from '../../data/buildings';
import { buildingCostAtLevel } from '../FormulasEngine';

describe('Accumulated score tracking in BuildQueue.processTick', () => {
  it('increments buildings score when a building completes', () => {
    const state = createNewGameState();
    const now = Date.now();
    state.planets[0].buildingQueue = [
      {
        type: 'building',
        id: 'metalMine',
        targetLevel: 1,
        startedAt: now - 2000,
        completesAt: now - 1000,
      },
    ];
    processTick(state, now);
    const def = BUILDINGS.metalMine;
    const cost = buildingCostAtLevel(def.baseCost, def.costMultiplier, 1);
    const expectedPoints = Math.floor((cost.metal + cost.crystal + cost.deuterium) / 1000);
    expect(state.playerScores.buildings).toBe(expectedPoints);
    expect(state.playerScores.buildings).toBeGreaterThan(0);
  });

  it('increments fleet score when a ship completes', () => {
    const state = createNewGameState();
    const now = Date.now();
    state.planets[0].buildings.shipyard = 4;
    state.planets[0].shipyardQueue = [
      {
        type: 'ship',
        id: 'lightFighter',
        quantity: 1,
        completed: 0,
        startedAt: now - 2000,
        completesAt: now - 1000,
      },
    ];
    processTick(state, now);
    expect(state.playerScores.fleet).toBeGreaterThan(0);
  });

  it('increments defence score when a defence completes', () => {
    const state = createNewGameState();
    const now = Date.now();
    state.planets[0].buildings.shipyard = 2;
    state.planets[0].shipyardQueue = [
      {
        type: 'defence',
        id: 'rocketLauncher',
        quantity: 1,
        completed: 0,
        startedAt: now - 2000,
        completesAt: now - 1000,
      },
    ];
    processTick(state, now);
    expect(state.playerScores.defence).toBeGreaterThan(0);
  });

  it('does NOT track research in accumulated scores (research stays snapshot-only)', () => {
    const state = createNewGameState();
    const now = Date.now();
    state.researchQueue = [
      {
        type: 'research',
        id: 'energyTechnology',
        targetLevel: 1,
        sourcePlanetIndex: 0,
        startedAt: now - 2000,
        completesAt: now - 1000,
      },
    ];
    processTick(state, now);
    // research score comes from ScoreEngine (snapshot), not BuildQueue
    // accumulated fields are only buildings/fleet/defence
    expect(state.playerScores.buildings).toBe(0);
    expect(state.playerScores.fleet).toBe(0);
    expect(state.playerScores.defence).toBe(0);
  });
});
```

### Step 2: Run to verify it fails

```bash
npx vitest run src/engine/__tests__/ScoreTracking.test.ts
```

Expected: FAIL — `state.playerScores.buildings` is `undefined`.

### Step 3: Implement

**3a. `src/models/types.ts` — add accumulated fields + bump STATE_VERSION:**

```typescript
export interface PlayerScores {
  military: number;
  economy: number;
  research: number;
  buildings: number;  // accumulated: cost of completed buildings / 1000
  fleet: number;      // accumulated: cost of completed ships / 1000
  defence: number;    // accumulated: cost of completed defences / 1000
  total: number;
}
```

Change `STATE_VERSION: 14` (was 13).

**3b. `src/models/GameState.ts` — init new fields:**

```typescript
playerScores: {
  military: 0,
  economy: 0,
  research: 0,
  buildings: 0,
  fleet: 0,
  defence: 0,
  total: 0,
},
```

**3c. `src/engine/ScoreEngine.ts` — return full PlayerScores shape:**

`computePlayerScores` must return all 7 fields. Add `buildings: 0, fleet: 0, defence: 0` to the returned object. These are always 0 from this function — the real values come from BuildQueue and are preserved by `useGameEngine`.

```typescript
return { military, economy, research, buildings: 0, fleet: 0, defence: 0, total };
```

**3d. `src/engine/BuildQueue.ts` — add score helper + call on building/ship/defence completion:**

Add this helper after the imports:

```typescript
function addAccumulatedScore(
  state: GameState,
  field: 'buildings' | 'fleet' | 'defence',
  resourceCost: ResourceCost,
): void {
  const points = Math.floor((resourceCost.metal + resourceCost.crystal + resourceCost.deuterium) / 1000);
  if (points <= 0) return;
  state.playerScores[field] = (state.playerScores[field] ?? 0) + points;
}
```

In `processTick`, after `planet.buildings[item.id as BuildingId] = item.targetLevel!;`:
```typescript
const bDef = BUILDINGS[item.id as BuildingId];
const bCost = buildingCostAtLevel(bDef.baseCost, bDef.costMultiplier, item.targetLevel!);
addAccumulatedScore(state, 'buildings', bCost);
```

After `planet.ships[item.id as ShipId] += 1;`:
```typescript
addAccumulatedScore(state, 'fleet', SHIPS[item.id as ShipId].cost);
```

After `planet.defences[item.id as DefenceId] += 1;`:
```typescript
addAccumulatedScore(state, 'defence', DEFENCES[item.id as DefenceId].cost);
```

Do NOT add score tracking for research completions — research score is snapshot-only (computed by ScoreEngine from current research levels).

**3e. `src/engine/StateManager.ts` — migration v13→v14 + add score tracking in processOfflineTime:**

After the `if (state.version < 13)` block, add:
```typescript
if (state.version < 14) {
  const ps = legacyState.playerScores as Record<string, number> | undefined;
  if (ps !== undefined) {
    ps['buildings'] ??= 0;
    ps['fleet'] ??= 0;
    ps['defence'] ??= 0;
  }
  state.version = 14;
}
```

In `processOfflineTime`, find where queue completion events are applied (the `switch` or `if` blocks that complete building/ship/defence/research items). After each `building` completion, add:
```typescript
const bDef = BUILDINGS[queueEvent.id as BuildingId];
const bCost = buildingCostAtLevel(bDef.baseCost, bDef.costMultiplier, queueEvent.targetLevel!);
const pts = Math.floor((bCost.metal + bCost.crystal + bCost.deuterium) / 1000);
state.playerScores.buildings = (state.playerScores.buildings ?? 0) + pts;
```

Similarly for ship and defence completions in `processOfflineTime`. Use the same formula: `SHIPS[id].cost` for ships, `DEFENCES[id].cost` for defences.

**3f. `src/hooks/useGameEngine.ts` — preserve accumulated fields when running computePlayerScores:**

Find the block that calls `computePlayerScores` (around line 358). Replace:
```typescript
const scores = computePlayerScores(currentState);
currentState.playerScores = scores;
```
With:
```typescript
const snapshotScores = computePlayerScores(currentState);
const prevAccumulated = currentState.playerScores;
currentState.playerScores = {
  ...snapshotScores,
  buildings: prevAccumulated.buildings ?? 0,
  fleet:     prevAccumulated.fleet     ?? 0,
  defence:   prevAccumulated.defence   ?? 0,
  // total stays as snapshot-only (for NPC scaling via processNPCUpgrades)
};
```

Also find the four admin-complete functions: `adminCompleteBuilding`, `adminCompleteResearch`, `adminCompleteShipyard`, `adminCompleteAllQueues`. Each of these directly mutates state (completes queue items). Add score increments after each completion using the same `addAccumulatedScore` logic. For example, in `adminCompleteBuilding`, after the building level is applied, increment `playerScores.buildings`. Use inline math (same formula as the helper) since the helper is defined in BuildQueue and not importable from useGameEngine without a circular dep — or move the helper to a shared location. The simplest approach: inline the math in the admin functions.

**3g. Update test files:**

In `src/engine/__tests__/ScoreEngine.test.ts`, update the migration test assertion:
```typescript
expect(loaded?.playerScores).toEqual({
  military: 0, economy: 0, research: 0,
  buildings: 0, fleet: 0, defence: 0, total: 0,
});
```

In `src/engine/__tests__/StateManager.test.ts`, find any hard-coded version assertions (e.g. `expect(state.version).toBe(13)`) and update to `14`.

In `src/panels/__tests__/GalaxyPanel.test.tsx`, find the literal `playerScores: { military: 1000, economy: 0, research: 0, total: 0 }` and add the new fields:
```typescript
playerScores: { military: 1000, economy: 0, research: 0, buildings: 0, fleet: 0, defence: 0, total: 0 },
```

### Step 4: Run tests

```bash
npx vitest run src/engine/__tests__/ScoreTracking.test.ts src/engine/__tests__/ScoreEngine.test.ts
```

Expected: PASS

### Step 5: Run all tests
```bash
npx vitest run
```
Expected: all PASS

### Step 6: Commit
```bash
git add src/models/types.ts src/models/GameState.ts \
  src/engine/BuildQueue.ts src/engine/ScoreEngine.ts \
  src/engine/StateManager.ts src/hooks/useGameEngine.ts \
  src/engine/__tests__/ScoreTracking.test.ts \
  src/engine/__tests__/ScoreEngine.test.ts \
  src/engine/__tests__/StateManager.test.ts \
  src/panels/__tests__/GalaxyPanel.test.tsx
git commit -m "feat(score): accumulated buildings/fleet/defence score tracking (v13→v14)"
```

---

## Task 2: Lifetime Statistics State (Phase 4.5 data layer)

**Files:**
- Modify: `src/models/GameState.ts`
- Modify: `src/engine/StateManager.ts`
- Modify: `src/engine/ResourceEngine.ts`
- Modify: `src/engine/FleetEngine.ts`
- Modify: `src/engine/__tests__/StateManager.test.ts`
- Create: `src/engine/__tests__/Statistics.test.ts`

### Important: combat result field name
`CombatResult` in `src/models/Combat.ts` uses `outcome`, not `result`. Every reference in this task must use `combatResult.outcome`, not `combatResult.result`.

### Important: resource stats — track actual delta, not raw rate
In `ResourceEngine.processTick`, compute the actual amount added (after clamping) by comparing before/after values, not the raw rate. This avoids overcounting when storage is full.

### Important: harvest dispatch
Harvest missions use `dispatchHarvest()`, a separate exported function in `FleetEngine.ts`. Fleet stats must be incremented in BOTH `dispatch()` and `dispatchHarvest()`.

### Important: offline catch-up
`accumulateBulk()` in `ResourceEngine.ts` is called during `processOfflineTime()`. Add statistics tracking there too, or it will be silently skipped for offline sessions.

### Step 1: Write the failing test

Create `src/engine/__tests__/Statistics.test.ts`:

```typescript
import { processTick as resourceTick } from '../ResourceEngine';
import { createNewGameState } from '../../models/GameState';
import { dispatch, dispatchHarvest } from '../FleetEngine';

describe('GameStatistics', () => {
  it('fresh state has zero statistics', () => {
    const state = createNewGameState();
    expect(state.statistics).toBeDefined();
    expect(state.statistics.resourcesMined.metal).toBe(0);
    expect(state.statistics.combat.fought).toBe(0);
    expect(state.statistics.fleet.totalDistance).toBe(0);
  });

  it('resourcesMined increases by actual amount added (not raw rate)', () => {
    const state = createNewGameState();
    state.planets[0].buildings.metalMine = 5;
    // Set metal to 0 so capping doesn't occur
    state.planets[0].resources.metal = 0;
    const before = state.statistics.resourcesMined.metal;
    resourceTick(state);
    const after = state.statistics.resourcesMined.metal;
    expect(after).toBeGreaterThan(before);
  });

  it('resourcesMined does NOT overcount when storage is full', () => {
    const state = createNewGameState();
    state.planets[0].buildings.metalMine = 5;
    // Fill metal to cap
    const caps = { metal: 10000, crystal: 10000, deuterium: 10000 };
    state.planets[0].resources.metal = caps.metal;
    const before = state.statistics.resourcesMined.metal;
    resourceTick(state);
    // Should not increase since storage is full
    expect(state.statistics.resourcesMined.metal).toBe(before);
  });

  it('fleet.sent increments on dispatch', () => {
    const state = createNewGameState();
    state.research.combustionDrive = 6;
    state.planets[0].ships.lightFighter = 5;
    state.planets[0].resources.deuterium = 10000;
    state.planets[0].coordinates = { galaxy: 1, system: 1, slot: 4 };
    const target = { galaxy: 1, system: 3, slot: 5 };
    // NPC at target
    state.galaxy.npcColonies.push({
      id: 'npc-test', name: 'NPC', coordinates: target,
      tier: 1, targetTier: 1, specialty: 'balanced',
      buildings: {}, ships: {}, defences: {},
      resources: { metal: 1000, crystal: 1000, deuterium: 0 },
      resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 },
      lastRaidTimestamp: 0, lastUpgradeTimestamp: 0,
      initialUpgradeIntervalMs: 3600000, catchUpUpgradeIntervalMs: 900000,
      catchUpProgressTicks: 0,
    });
    dispatch(state, 0, target, { lightFighter: 5 }, 'attack');
    expect(state.statistics.fleet.sent['attack']).toBe(1);
    expect(state.statistics.fleet.totalDistance).toBeGreaterThan(0);
  });

  it('fleet.sent increments for dispatchHarvest too', () => {
    const state = createNewGameState();
    state.research.combustionDrive = 6;
    state.planets[0].ships.recycler = 2;
    state.planets[0].resources.deuterium = 10000;
    state.planets[0].coordinates = { galaxy: 1, system: 1, slot: 4 };
    const target = { galaxy: 1, system: 1, slot: 6 };
    state.debrisFields.push({ coordinates: target, metal: 5000, crystal: 3000 });
    dispatchHarvest(state, 0, target);
    expect(state.statistics.fleet.sent['harvest']).toBe(1);
  });
});
```

### Step 2: Run to verify it fails

```bash
npx vitest run src/engine/__tests__/Statistics.test.ts
```

Expected: FAIL — `state.statistics` is undefined.

### Step 3: Implement

**3a. `src/models/GameState.ts` — add GameStatistics interface and field:**

Add the interface before `GameState`:

```typescript
export interface GameStatistics {
  resourcesMined: { metal: number; crystal: number; deuterium: number };
  combat: {
    fought: number;
    won: number;
    lost: number;
    drawn: number;
    totalLoot: number;
    shipsLost: number;
  };
  fleet: {
    sent: Partial<Record<string, number>>;
    totalDistance: number;
  };
  milestones: {
    firstColony?: number;
    firstBattleWon?: number;
    firstEspionage?: number;
  };
}
```

Add `statistics: GameStatistics;` to `GameState` interface.

Add to `createNewGameState()`:
```typescript
statistics: {
  resourcesMined: { metal: 0, crystal: 0, deuterium: 0 },
  combat: { fought: 0, won: 0, lost: 0, drawn: 0, totalLoot: 0, shipsLost: 0 },
  fleet: { sent: {}, totalDistance: 0 },
  milestones: {},
},
```

**3b. `src/engine/StateManager.ts` — migration v14→v15:**

After the `if (state.version < 14)` block:
```typescript
if (state.version < 15) {
  (legacyState as unknown as Record<string, unknown>)['statistics'] = {
    resourcesMined: { metal: 0, crystal: 0, deuterium: 0 },
    combat: { fought: 0, won: 0, lost: 0, drawn: 0, totalLoot: 0, shipsLost: 0 },
    fleet: { sent: {}, totalDistance: 0 },
    milestones: {},
  };
  state.version = 15;
}
```

Update `STATE_VERSION: 15` in `src/models/types.ts`.

Update `src/engine/__tests__/StateManager.test.ts` — any `expect(state.version).toBe(14)` → `toBe(15)`.

**3c. `src/engine/ResourceEngine.ts` — track actual delta mined (not raw rate):**

In `processTick`, inside the `for (const planet of state.planets)` loop, compute deltas AFTER clamping:

```typescript
const prevMetal    = res.metal;
const prevCrystal  = res.crystal;
const prevDeuterium = res.deuterium;

res.metal = Math.min(caps.metal, res.metal + rates.metalPerHour / 3600);
res.crystal = Math.min(caps.crystal, res.crystal + rates.crystalPerHour / 3600);
res.deuterium = Math.min(
  caps.deuterium,
  Math.max(0, res.deuterium + rates.deuteriumPerHour / 3600),
);
res.energyProduction = rates.energyProduction;
res.energyConsumption = rates.energyConsumption;

if (state.statistics) {
  state.statistics.resourcesMined.metal     += res.metal     - prevMetal;
  state.statistics.resourcesMined.crystal   += res.crystal   - prevCrystal;
  state.statistics.resourcesMined.deuterium += res.deuterium - prevDeuterium;
}
```

In `accumulateBulk` (called by `processOfflineTime`), apply the same delta tracking — compute pre/post for each resource accumulation and add to `state.statistics.resourcesMined`.

**3d. `src/engine/FleetEngine.ts` — track combat and fleet stats:**

In `dispatch()`, just before `state.fleetMissions.push(mission)`:
```typescript
if (state.statistics) {
  const type = missionType as string;
  state.statistics.fleet.sent[type] = (state.statistics.fleet.sent[type] ?? 0) + 1;
  state.statistics.fleet.totalDistance += distance;
}
```

In `dispatchHarvest()`, after computing the distance (or before pushing the mission), add:
```typescript
if (state.statistics) {
  state.statistics.fleet.sent['harvest'] = (state.statistics.fleet.sent['harvest'] ?? 0) + 1;
  state.statistics.fleet.totalDistance += calcDistance(sourcePlanet.coordinates, targetCoords);
}
```

In `resolveAttackAtTarget()`, after `const combatResult = simulate(...)` and `const loot = calcLoot(...)`:

```typescript
if (state.statistics) {
  state.statistics.combat.fought += 1;
  if (combatResult.outcome === 'attacker_wins') {
    state.statistics.combat.won += 1;
    state.statistics.combat.totalLoot += loot.metal + loot.crystal + loot.deuterium;
    if (state.statistics.milestones.firstBattleWon === undefined) {
      state.statistics.milestones.firstBattleWon = now;
    }
  } else if (combatResult.outcome === 'defender_wins') {
    state.statistics.combat.lost += 1;
  } else {
    state.statistics.combat.drawn += 1;
  }
  const shipsLost = Object.entries(mission.ships).reduce((total, [shipId, startCount]) => {
    const endCount = Math.max(0, Math.floor(combatResult.attackerEnd.ships[shipId] ?? 0));
    return total + Math.max(0, startCount - endCount);
  }, 0);
  state.statistics.combat.shipsLost += shipsLost;
}
```

In `resolveEspionageAtTarget()`, after `state.espionageReports.push(report)`:
```typescript
if (state.statistics && state.statistics.milestones.firstEspionage === undefined) {
  state.statistics.milestones.firstEspionage = now;
}
```

### Step 4: Run tests

```bash
npx vitest run src/engine/__tests__/Statistics.test.ts
```

Expected: PASS

### Step 5: Run all tests
```bash
npx vitest run
```
Expected: all PASS

### Step 6: Commit
```bash
git add src/models/GameState.ts src/models/types.ts \
  src/engine/StateManager.ts src/engine/ResourceEngine.ts \
  src/engine/FleetEngine.ts \
  src/engine/__tests__/Statistics.test.ts \
  src/engine/__tests__/StateManager.test.ts
git commit -m "feat(stats): lifetime statistics state — resources mined, combat, fleet (v14→v15)"
```

---

## Task 3: Statistics Panel (Phase 4.5 UI)

**Files:**
- Modify: `src/models/types.ts`
- Modify: `src/data/assets.ts`
- Create: `src/panels/StatisticsPanel.tsx`
- Modify: `src/components/NavSidebar.tsx`
- Modify: `src/App.tsx`
- Modify: `src/data/__tests__/assets.test.ts` (if exists — check for PanelImageId count assertion)
- Create: `src/panels/__tests__/StatisticsPanel.test.tsx`

### Step 1: Write the failing test

Create `src/panels/__tests__/StatisticsPanel.test.tsx`:

```typescript
import { StatisticsPanel } from '../StatisticsPanel';
import { renderWithGame, screen } from '../../test/test-utils';

const baseStatistics = {
  resourcesMined: { metal: 0, crystal: 0, deuterium: 0 },
  combat: { fought: 0, won: 0, lost: 0, drawn: 0, totalLoot: 0, shipsLost: 0 },
  fleet: { sent: {}, totalDistance: 0 },
  milestones: {},
};

describe('StatisticsPanel', () => {
  it('renders panel title', () => {
    renderWithGame(<StatisticsPanel />, { gameState: { statistics: baseStatistics } });
    expect(screen.getByRole('heading', { name: 'Statistics', level: 1 })).toBeInTheDocument();
  });

  it('displays resource mining stats', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: {
          ...baseStatistics,
          resourcesMined: { metal: 12345, crystal: 6789, deuterium: 1000 },
        },
      },
    });
    expect(screen.getByText(/12,345|12345/)).toBeInTheDocument();
  });

  it('displays combat stats', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: {
          ...baseStatistics,
          combat: { fought: 10, won: 7, lost: 2, drawn: 1, totalLoot: 50000, shipsLost: 30 },
        },
      },
    });
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });
});
```

### Step 2: Run to verify it fails

```bash
npx vitest run src/panels/__tests__/StatisticsPanel.test.tsx
```

Expected: FAIL — module not found.

### Step 3: Implement

**3a. `src/models/types.ts` — add 'statistics' to NavId:**

```typescript
export type NavId =
  | 'overview'
  | 'buildings'
  | 'research'
  | 'shipyard'
  | 'defence'
  | 'fleet'
  | 'galaxy'
  | 'messages'
  | 'statistics'
  | 'settings'
  | 'admin';
```

**3b. `src/data/assets.ts` — add 'statistics' to PanelImageId and PANEL_IMAGES:**

```typescript
export type PanelImageId = 'fleet' | 'defence' | 'buildings' | 'research' | 'galaxy' | 'statistics';

export const PANEL_IMAGES: Record<PanelImageId, string> = {
  fleet:      '/assets/panels/fleet.webp',
  defence:    '/assets/panels/defence.webp',
  buildings:  '/assets/panels/buildings.webp',
  research:   '/assets/panels/research.webp',
  galaxy:     '/assets/panels/galaxy.webp',
  statistics: '/assets/panels/statistics.webp',
};
```

Check `src/data/__tests__/assets.test.ts` — if it has a count assertion like `expect(Object.keys(PANEL_IMAGES).length).toBe(5)`, update it to `6`.

**3c. `src/panels/StatisticsPanel.tsx` — create panel:**

Use the same `onLoad`/`onError` pattern as the other panels (see `DefencePanel.tsx` for the exact pattern):

```typescript
import { useGame } from '../context/GameContext';
import { PANEL_IMAGES } from '../data/assets.ts';
import { formatNumber } from '../utils/format';

export function StatisticsPanel() {
  const { gameState } = useGame();
  const { statistics, playerScores } = gameState;

  return (
    <section className="panel">
      <div className="panel-banner">
        <img
          src={PANEL_IMAGES.statistics}
          alt=""
          onLoad={(event) => {
            event.currentTarget.parentElement?.classList.add('panel-banner--loaded');
          }}
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      </div>
      <h1 className="panel-title">Statistics</h1>
      <p className="panel-subtitle">Lifetime progression and counters.</p>

      <div className="settings-grid">
        <article className="panel-card">
          <h2 className="section-title">Score</h2>
          <table className="stats-table">
            <tbody>
              <tr><td>Military</td><td>{formatNumber(playerScores.military)}</td></tr>
              <tr><td>Economy</td><td>{formatNumber(playerScores.economy)}</td></tr>
              <tr><td>Research</td><td>{formatNumber(playerScores.research)}</td></tr>
              <tr><td>Buildings</td><td>{formatNumber(playerScores.buildings ?? 0)}</td></tr>
              <tr><td>Fleet</td><td>{formatNumber(playerScores.fleet ?? 0)}</td></tr>
              <tr><td>Defence</td><td>{formatNumber(playerScores.defence ?? 0)}</td></tr>
              <tr><td><strong>Total</strong></td><td><strong>{formatNumber(playerScores.total)}</strong></td></tr>
            </tbody>
          </table>
        </article>

        <article className="panel-card">
          <h2 className="section-title">Resources Mined</h2>
          <table className="stats-table">
            <tbody>
              <tr><td>Metal</td><td>{formatNumber(Math.floor(statistics.resourcesMined.metal))}</td></tr>
              <tr><td>Crystal</td><td>{formatNumber(Math.floor(statistics.resourcesMined.crystal))}</td></tr>
              <tr><td>Deuterium</td><td>{formatNumber(Math.floor(statistics.resourcesMined.deuterium))}</td></tr>
            </tbody>
          </table>
        </article>

        <article className="panel-card">
          <h2 className="section-title">Combat</h2>
          <table className="stats-table">
            <tbody>
              <tr><td>Battles Fought</td><td>{statistics.combat.fought}</td></tr>
              <tr><td>Won</td><td>{statistics.combat.won}</td></tr>
              <tr><td>Lost</td><td>{statistics.combat.lost}</td></tr>
              <tr><td>Drawn</td><td>{statistics.combat.drawn}</td></tr>
              <tr><td>Total Loot</td><td>{formatNumber(Math.floor(statistics.combat.totalLoot))}</td></tr>
              <tr><td>Ships Lost</td><td>{formatNumber(statistics.combat.shipsLost)}</td></tr>
            </tbody>
          </table>
        </article>

        <article className="panel-card">
          <h2 className="section-title">Fleet</h2>
          <table className="stats-table">
            <tbody>
              <tr><td>Total Distance</td><td>{formatNumber(Math.floor(statistics.fleet.totalDistance))}</td></tr>
              {Object.entries(statistics.fleet.sent).map(([type, count]) => (
                <tr key={type}>
                  <td>{type.charAt(0).toUpperCase() + type.slice(1)} missions</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        {Object.keys(statistics.milestones).length > 0 && (
          <article className="panel-card">
            <h2 className="section-title">Milestones</h2>
            <table className="stats-table">
              <tbody>
                {statistics.milestones.firstColony !== undefined && (
                  <tr><td>First Colony</td><td>{new Date(statistics.milestones.firstColony).toLocaleDateString()}</td></tr>
                )}
                {statistics.milestones.firstBattleWon !== undefined && (
                  <tr><td>First Battle Won</td><td>{new Date(statistics.milestones.firstBattleWon).toLocaleDateString()}</td></tr>
                )}
                {statistics.milestones.firstEspionage !== undefined && (
                  <tr><td>First Espionage</td><td>{new Date(statistics.milestones.firstEspionage).toLocaleDateString()}</td></tr>
                )}
              </tbody>
            </table>
          </article>
        )}
      </div>
    </section>
  );
}
```

**3d. `src/components/NavSidebar.tsx` — add Statistics before Settings:**

In `MAIN_NAV_ITEMS`, add `{ id: 'statistics', label: 'Statistics' }` between `messages` and `settings`.

**3e. `src/App.tsx` — import and add case:**

Add import: `import { StatisticsPanel } from './panels/StatisticsPanel';`

Add case: `case 'statistics': return <StatisticsPanel />;`

### Step 4: Run tests

```bash
npx vitest run src/panels/__tests__/StatisticsPanel.test.tsx
```

Expected: PASS

### Step 5: Run all tests
```bash
npx vitest run
```
Expected: all PASS

### Step 6: Commit
```bash
git add src/models/types.ts src/data/assets.ts \
  src/panels/StatisticsPanel.tsx src/components/NavSidebar.tsx \
  src/App.tsx src/panels/__tests__/StatisticsPanel.test.tsx
git commit -m "feat(ui): Statistics panel with score, resources mined, combat and fleet lifetime stats"
```

---

## Task 4: Colonise Fleet Mission (Phase 4.3)

**Files:**
- Modify: `src/models/Fleet.ts`
- Modify: `src/engine/FleetEngine.ts`
- Modify: `src/panels/FleetPanel.tsx`
- Create: `src/engine/__tests__/FleetColonise.test.ts`

### Key design notes

- `colonize()` in GalaxyEngine is the instant-colonise shortcut from GalaxyPanel. Do NOT call it for fleet colonise — the colony ship was already deducted by `dispatch()`.
- Dispatch validates EXACTLY `colonyShip === 1` in the fleet.
- On arrival success: create planet, remove exactly 1 colony ship from `mission.ships`, return remaining ships.
- On arrival failure (slot taken, max colonies): all ships return as-is via normal `resolveReturn`.
- `FleetPanel.tsx` has extensive `missionType === 'transport'` guards. Colonise needs similar guards: show/hide cargo section, pending-target type handling, target description. Read the full FleetPanel carefully before making changes.
- `GalaxyPanel.tsx` keeps its existing instant-colonise button — no changes needed there.
- NPC fixture shape: look at `NPCColony` in `src/models/Galaxy.ts` for exact required fields. Key fields: `id`, `name`, `coordinates`, `tier`, `targetTier`, `specialty`, `buildings`, `ships`, `defences`, `resources`, `resourcesAtLastRaid`, `lastRaidTimestamp`, `lastUpgradeTimestamp`, `initialUpgradeIntervalMs`, `catchUpUpgradeIntervalMs`, `catchUpProgressTicks`.

### Step 1: Write the failing test

Create `src/engine/__tests__/FleetColonise.test.ts`:

```typescript
import { dispatch, resolveMissionArrival, resolveMissionReturn } from '../FleetEngine';
import { createNewGameState } from '../../models/GameState';
import type { NPCColony } from '../../models/Galaxy';

function makeNPCAt(coords: { galaxy: number; system: number; slot: number }): NPCColony {
  return {
    id: `npc-${coords.slot}`,
    name: 'NPC',
    coordinates: coords,
    tier: 1,
    targetTier: 1,
    specialty: 'balanced',
    buildings: {},
    ships: {},
    defences: {},
    resources: { metal: 0, crystal: 0, deuterium: 0 },
    resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 },
    lastRaidTimestamp: 0,
    lastUpgradeTimestamp: 0,
    initialUpgradeIntervalMs: 3600000,
    catchUpUpgradeIntervalMs: 900000,
    catchUpProgressTicks: 0,
  };
}

function makeColoniseState() {
  const state = createNewGameState();
  state.research.astrophysicsTechnology = 2; // allows 1 colony
  state.research.combustionDrive = 6;
  state.planets[0].ships.colonyShip = 2;
  state.planets[0].ships.smallCargo = 2;
  state.planets[0].resources.deuterium = 50000;
  state.planets[0].coordinates = { galaxy: 1, system: 1, slot: 4 };
  return state;
}

describe('Colonise fleet mission', () => {
  it('dispatch fails if no colony ship in fleet', () => {
    const state = makeColoniseState();
    const target = { galaxy: 1, system: 2, slot: 5 };
    const result = dispatch(state, 0, target, { smallCargo: 2 }, 'colonise');
    expect(result).toBeNull();
  });

  it('dispatch fails if not exactly 1 colony ship', () => {
    const state = makeColoniseState();
    const target = { galaxy: 1, system: 2, slot: 5 };
    // 2 colony ships not allowed
    const result = dispatch(state, 0, target, { colonyShip: 2 }, 'colonise');
    expect(result).toBeNull();
  });

  it('dispatch fails if max colonies already reached (astrophysics 0)', () => {
    const state = makeColoniseState();
    state.research.astrophysicsTechnology = 0;
    const target = { galaxy: 1, system: 2, slot: 5 };
    const result = dispatch(state, 0, target, { colonyShip: 1 }, 'colonise');
    expect(result).toBeNull();
  });

  it('dispatch fails if target slot is already occupied by NPC', () => {
    const state = makeColoniseState();
    const target = { galaxy: 1, system: 2, slot: 5 };
    state.galaxy.npcColonies.push(makeNPCAt(target));
    const result = dispatch(state, 0, target, { colonyShip: 1 }, 'colonise');
    expect(result).toBeNull();
  });

  it('dispatch removes colony ship and other ships from source planet', () => {
    const state = makeColoniseState();
    const target = { galaxy: 1, system: 2, slot: 5 };
    dispatch(state, 0, target, { colonyShip: 1, smallCargo: 2 }, 'colonise');
    expect(state.planets[0].ships.colonyShip).toBe(1); // had 2, used 1
    expect(state.planets[0].ships.smallCargo).toBe(0);
  });

  it('on arrival at empty slot: creates colony, consumes exactly 1 colony ship', () => {
    const state = makeColoniseState();
    const target = { galaxy: 1, system: 2, slot: 5 };
    const now = Date.now();
    const mission = dispatch(state, 0, target, { colonyShip: 1, smallCargo: 2 }, 'colonise');
    expect(mission).not.toBeNull();
    expect(state.planets.length).toBe(1);

    resolveMissionArrival(state, mission!, now);

    expect(state.planets.length).toBe(2);
    expect(mission!.status).toBe('returning');
    expect(mission!.ships['colonyShip'] ?? 0).toBe(0); // consumed
    expect(mission!.ships['smallCargo']).toBe(2); // escort ships return
  });

  it('on arrival when slot already taken: all ships return including colony ship', () => {
    const state = makeColoniseState();
    const target = { galaxy: 1, system: 2, slot: 5 };
    const now = Date.now();
    const mission = dispatch(state, 0, target, { colonyShip: 1 }, 'colonise');
    // Occupy slot between dispatch and arrival
    state.galaxy.npcColonies.push(makeNPCAt(target));

    resolveMissionArrival(state, mission!, now);

    expect(state.planets.length).toBe(1); // no new planet
    expect(mission!.status).toBe('returning');
    expect(mission!.ships['colonyShip']).toBe(1); // colony ship returns
  });

  it('returning mission restores escort ships to source planet', () => {
    const state = makeColoniseState();
    const target = { galaxy: 1, system: 2, slot: 5 };
    const now = Date.now();
    const mission = dispatch(state, 0, target, { colonyShip: 1, smallCargo: 2 }, 'colonise');
    resolveMissionArrival(state, mission!, now);
    resolveMissionReturn(state, mission!);
    expect(state.planets[0].ships.smallCargo).toBe(2);
  });

  it('sets firstColony milestone on success', () => {
    const state = makeColoniseState();
    const target = { galaxy: 1, system: 2, slot: 5 };
    const now = Date.now();
    const mission = dispatch(state, 0, target, { colonyShip: 1 }, 'colonise');
    resolveMissionArrival(state, mission!, now);
    expect(state.statistics?.milestones.firstColony).toBeDefined();
  });
});
```

### Step 2: Run to verify it fails

```bash
npx vitest run src/engine/__tests__/FleetColonise.test.ts
```

Expected: FAIL — `'colonise'` is not a valid MissionType.

### Step 3: Implement

**3a. `src/models/Fleet.ts` — add 'colonise' and 'deploy' to MissionType, 'empty_slot' to targetType:**

```typescript
export type MissionType = 'attack' | 'espionage' | 'harvest' | 'transport' | 'colonise' | 'deploy';

export interface FleetMission {
  ...
  targetType: 'npc_colony' | 'debris_field' | 'player_planet' | 'empty_slot';
  ...
}
```

**3b. `src/engine/FleetEngine.ts` — add imports, resolveColoniseAtTarget, update dispatch + resolveAtTarget:**

Add imports at top if not already present:
```typescript
import { isSlotEmpty, planetStatsForSlot } from './GalaxyEngine.ts';
import { createDefaultPlanet } from '../models/Planet.ts';
```

Add `resolveColoniseAtTarget` before `resolveAtTarget`:

```typescript
function resolveColoniseAtTarget(state: GameState, mission: FleetMission, now: number): void {
  if (!isSlotEmpty(state, mission.targetCoordinates)) {
    mission.returnTime = now + calcMissionReturnTravelMs(state, mission);
    mission.status = 'returning';
    return;
  }

  const astroLevel = state.research.astrophysicsTechnology ?? 0;
  const maxColonies = Math.floor(astroLevel / 2) + (astroLevel > 0 ? 1 : 0);
  if (state.planets.length - 1 >= maxColonies) {
    mission.returnTime = now + calcMissionReturnTravelMs(state, mission);
    mission.status = 'returning';
    return;
  }

  const newPlanet = createDefaultPlanet();
  newPlanet.name = `Colony ${state.planets.length + 1}`;
  newPlanet.coordinates = { ...mission.targetCoordinates };
  const seed = now ^ (mission.targetCoordinates.system * 1000 + mission.targetCoordinates.slot * 17);
  const stats = planetStatsForSlot(seed, mission.targetCoordinates);
  newPlanet.maxTemperature = stats.maxTemperature;
  newPlanet.maxFields = stats.maxFields;
  newPlanet.fieldCount = stats.maxFields;
  state.planets.push(newPlanet);

  if (state.statistics && state.statistics.milestones.firstColony === undefined) {
    state.statistics.milestones.firstColony = now;
  }

  // Consume exactly 1 colony ship; remaining ships return
  const returningShips = { ...mission.ships };
  if ((returningShips.colonyShip ?? 0) > 0) {
    returningShips.colonyShip = (returningShips.colonyShip ?? 0) - 1;
    if (returningShips.colonyShip === 0) delete returningShips.colonyShip;
  }
  mission.ships = returningShips;

  if (Object.keys(returningShips).length > 0) {
    mission.returnTime = now + calcMissionReturnTravelMs(state, mission);
    mission.status = 'returning';
  } else {
    mission.status = 'completed';
  }
}
```

Update `resolveAtTarget` to dispatch colonise and deploy:

```typescript
function resolveAtTarget(state: GameState, mission: FleetMission, now: number): void {
  if (mission.type === 'transport')  { resolveTransportAtTarget(state, mission, now); return; }
  if (mission.type === 'espionage')  { resolveEspionageAtTarget(state, mission, now); return; }
  if (mission.type === 'harvest')    { resolveHarvestAtTarget(state, mission, now); return; }
  if (mission.type === 'colonise')   { resolveColoniseAtTarget(state, mission, now); return; }
  if (mission.type === 'deploy')     { resolveDeployAtTarget(state, mission, now); return; }
  resolveAttackAtTarget(state, mission, now);
}
```

Update `dispatch()` for colonise:

1. Change the abandoned-NPC check to exclude colonise: `if (missionType !== 'transport' && missionType !== 'colonise' && missionType !== 'deploy') { /* abandoned check */ }`

2. Add colonise validation block (after that check, before fleet-slots check):
```typescript
if (missionType === 'colonise') {
  if (!isSlotEmpty(state, targetCoords)) return null;
  const astroLevel = state.research.astrophysicsTechnology ?? 0;
  const maxColonies = Math.floor(astroLevel / 2) + (astroLevel > 0 ? 1 : 0);
  if (maxColonies <= 0) return null;
  if (state.planets.length - 1 >= maxColonies) return null;
  const requested = Math.floor(ships['colonyShip'] ?? 0);
  if (requested !== 1) return null; // must have EXACTLY 1 colony ship
}
```

3. Update `targetType` assignment:
```typescript
targetType:
  missionType === 'transport' || missionType === 'deploy'
    ? 'player_planet'
    : missionType === 'colonise'
    ? 'empty_slot'
    : 'npc_colony',
```

**3c. `src/panels/FleetPanel.tsx` — add colonise and deploy mission types:**

Read `FleetPanel.tsx` fully before editing. The panel has guards scattered across ~15 locations keyed on `missionType === 'transport'` and `missionType === 'espionage'`. For each one, update appropriately for `colonise` and `deploy`.

Key locations to update:
- `formatMissionType()` — add cases for `'colonise'` → `'Colonise'` and `'deploy'` → `'Deploy'`
- Mission type `<select>` or radio buttons — add `colonise` and `deploy` options
- Pending-target type display — colonise targets empty slots, deploy targets player planets
- Cargo section visibility — show for deploy (same as transport), hide for colonise
- Target validation hints — "Must be an empty slot" for colonise, "Must be your own planet" for deploy
- Ship selection — for colonise, show requirement: "Colony Ship required (exactly 1)"
- `targetType` resolution on the client side — update any `pendingMissionTarget.type` guards

Do NOT modify GalaxyPanel — it keeps its instant-colonise path unchanged.

### Step 4: Run tests

```bash
npx vitest run src/engine/__tests__/FleetColonise.test.ts
```

Expected: all PASS

### Step 5: Run all tests
```bash
npx vitest run
```
Expected: all PASS

### Step 6: Commit
```bash
git add src/models/Fleet.ts src/engine/FleetEngine.ts src/panels/FleetPanel.tsx \
  src/engine/__tests__/FleetColonise.test.ts
git commit -m "feat(fleet): colonise mission — dispatch colony ship, create planet on arrival"
```

---

## Task 5: Deploy Fleet Mission (Phase 4.6)

**Files:**
- Modify: `src/engine/FleetEngine.ts`
- Modify: `src/panels/FleetPanel.tsx`
- Create: `src/engine/__tests__/FleetDeploy.test.ts`

Note: `'deploy'` was already added to `MissionType` and `resolveAtTarget` in Task 4.

### Step 1: Write the failing test

Create `src/engine/__tests__/FleetDeploy.test.ts`:

```typescript
import { dispatch, resolveMissionArrival } from '../FleetEngine';
import { createNewGameState } from '../../models/GameState';
import { createDefaultPlanet } from '../../models/Planet';

function makeDeployState() {
  const state = createNewGameState();
  state.research.combustionDrive = 6;

  state.planets[0].coordinates = { galaxy: 1, system: 1, slot: 4 };
  state.planets[0].ships.lightFighter = 10;
  state.planets[0].resources.deuterium = 50000;
  state.planets[0].resources.metal = 10000;

  // Second planet — fresh, no shared references
  const colony = createDefaultPlanet();
  colony.coordinates = { galaxy: 1, system: 2, slot: 5 };
  colony.name = 'Colony 2';
  state.planets.push(colony);

  return state;
}

describe('Deploy fleet mission', () => {
  it('dispatch removes ships from source planet', () => {
    const state = makeDeployState();
    dispatch(state, 0, state.planets[1].coordinates, { lightFighter: 5 }, 'deploy');
    expect(state.planets[0].ships.lightFighter).toBe(5);
  });

  it('dispatch fails if target is not a player planet', () => {
    const state = makeDeployState();
    const emptySlot = { galaxy: 1, system: 3, slot: 7 };
    const result = dispatch(state, 0, emptySlot, { lightFighter: 5 }, 'deploy');
    expect(result).toBeNull();
  });

  it('dispatch fails if target is source planet', () => {
    const state = makeDeployState();
    const result = dispatch(state, 0, state.planets[0].coordinates, { lightFighter: 5 }, 'deploy');
    expect(result).toBeNull();
  });

  it('on arrival: ships merge into target planet, mission completes (no return)', () => {
    const state = makeDeployState();
    const now = Date.now();
    const mission = dispatch(state, 0, state.planets[1].coordinates, { lightFighter: 5 }, 'deploy');
    expect(mission).not.toBeNull();

    resolveMissionArrival(state, mission!, now);

    expect(mission!.status).toBe('completed');
    expect(state.planets[1].ships.lightFighter).toBe(5);
  });

  it('on arrival: cargo deposited into target planet resources', () => {
    const state = makeDeployState();
    const now = Date.now();
    state.planets[0].ships.largeCargo = 2;
    const targetMetalBefore = state.planets[1].resources.metal;
    const mission = dispatch(
      state, 0, state.planets[1].coordinates,
      { largeCargo: 2 }, 'deploy',
      { metal: 5000, crystal: 0, deuterium: 0 },
    );
    expect(mission).not.toBeNull();
    resolveMissionArrival(state, mission!, now);
    expect(state.planets[1].resources.metal).toBeGreaterThan(targetMetalBefore);
  });

  it('on arrival when target planet no longer exists: ships lost, mission completes', () => {
    const state = makeDeployState();
    const targetCoords = { ...state.planets[1].coordinates };
    const now = Date.now();
    const mission = dispatch(state, 0, targetCoords, { lightFighter: 5 }, 'deploy');
    state.planets.splice(1, 1); // remove target before arrival
    resolveMissionArrival(state, mission!, now);
    expect(mission!.status).toBe('completed');
    // ships are lost — they don't return
    expect(state.planets[0].ships.lightFighter).toBe(5); // only 5 remain (5 were sent)
  });
});
```

### Step 2: Run to verify it fails

```bash
npx vitest run src/engine/__tests__/FleetDeploy.test.ts
```

Expected: FAIL — `'deploy'` not handled in dispatch.

### Step 3: Implement

**3a. `src/engine/FleetEngine.ts` — add resolveDeployAtTarget:**

Add this function before `resolveAtTarget` (and after `resolveColoniseAtTarget`):

```typescript
function resolveDeployAtTarget(state: GameState, mission: FleetMission, now: number): void {
  const targetPlanet = state.planets.find((planet) =>
    isMatchingCoordinates(planet.coordinates, mission.targetCoordinates));

  if (!targetPlanet) {
    mission.status = 'completed'; // ships lost, no return
    return;
  }

  for (const [shipId, countValue] of Object.entries(mission.ships)) {
    const count = Math.max(0, Math.floor(countValue));
    if (count <= 0) continue;
    if (targetPlanet.ships[shipId as ShipId] === undefined) continue;
    targetPlanet.ships[shipId as ShipId] += count;
  }

  const caps = getStorageCaps(targetPlanet);
  targetPlanet.resources.metal = Math.min(
    caps.metal, targetPlanet.resources.metal + mission.cargo.metal,
  );
  targetPlanet.resources.crystal = Math.min(
    caps.crystal, targetPlanet.resources.crystal + mission.cargo.crystal,
  );
  targetPlanet.resources.deuterium = Math.min(
    caps.deuterium, targetPlanet.resources.deuterium + mission.cargo.deuterium,
  );

  mission.status = 'completed';
}
```

In `dispatch()`, add deploy validation:

```typescript
if (missionType === 'deploy') {
  const targetPlanet = state.planets.find((planet) =>
    isMatchingCoordinates(planet.coordinates, targetCoords));
  if (!targetPlanet) return null;
  if (isMatchingCoordinates(sourcePlanet.coordinates, targetCoords)) return null;
}
```

Reuse transport cargo deduction for deploy — change the transport cargo block to apply to both:
```typescript
if (missionType === 'transport' || missionType === 'deploy') {
  // ... same cargo validation and deduction ...
}
```

Note: for deploy the cargo check must ensure target is a player planet — already done in the deploy validation above.

**3b. `src/panels/FleetPanel.tsx` — deploy UI:**

Deploy shares the cargo section with transport. Ensure:
- Cargo inputs are visible when `missionType === 'deploy'`
- Target selection shows player planets only
- Dispatch button label: "Deploy Fleet"
- No recall needed since there is no return trip — but the mission will be immediately `completed`, so it won't appear in active missions list

### Step 4: Run tests

```bash
npx vitest run src/engine/__tests__/FleetDeploy.test.ts
```

Expected: all PASS

### Step 5: Run all tests
```bash
npx vitest run
```
Expected: all PASS

### Step 6: Commit
```bash
git add src/engine/FleetEngine.ts src/panels/FleetPanel.tsx \
  src/engine/__tests__/FleetDeploy.test.ts
git commit -m "feat(fleet): deploy mission — permanently station fleet at player planet"
```

---

## Final: Verify & Wrap Up

```bash
npx vitest run
npm run build
npm run lint
```

All tests pass, no build errors, no lint errors.

```bash
git push origin phase/4.x
```

---

## Codex Execution Notes

- Working directory: `C:/dev/repos/StarForge`
- Use `npx vitest run <file>` to run specific tests, `npx vitest run` for all
- `npm run build` uses `tsc + vite` — TypeScript strict mode, no implicit `any`
- Imports use `.ts`/`.tsx` extensions explicitly (e.g. `import { foo } from './bar.ts'`)
- `legacyState` in StateManager is a type-unsafe alias for unsafe migration assignments
- `CombatResult.outcome` NOT `.result` — critical, check `src/models/Combat.ts`
- `createDefaultPlanet()` is in `src/models/Planet.ts`
- Do NOT shallow-copy `PlanetState` objects in tests — use `createDefaultPlanet()` to get independent instances
- NPC fixture shape: check `NPCColony` in `src/models/Galaxy.ts` for all required fields
- `renderWithGame` partial overrides: `planet.buildings`, `planet.ships`, `planet.resources` only; pass `statistics` under `gameState: { statistics: ... }`
- `panel-banner` pattern in all panels: use `onLoad` to add `panel-banner--loaded` class, use `onError` to hide the img (see `DefencePanel.tsx`)
- Score tracking: `buildings/fleet/defence` are ACCUMULATED (never zeroed by ScoreEngine); `military/economy/research/total` are SNAPSHOT (recomputed every tick by ScoreEngine)
- NPC scaling uses snapshot-only `total` — do NOT add accumulated fields to the total passed to `processNPCUpgrades`
