# Bugfix & Balance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add dynamic NPC scaling driven by player power, clickable coordinates in messages, manual coordinate entry in the galaxy map, hover tooltips for Metal/Crystal/Deuterium, and NPC loot scaling by tier.

**Architecture:** New pure `ScoreEngine.ts` computes `PlayerScores` each tick (stored on `GameState`). Player scores are computed *before* the NPC upgrade pass and passed explicitly to `processUpgrades`. NPC catch-up upgrade logic added to `NPCUpgradeEngine.ts`. UI features are isolated to `ResourceBar.tsx`, `MessagesPanel.tsx`, `GalaxyPanel.tsx`, and `GameContext.tsx`. State bumps v12→v13.

**Tech Stack:** TypeScript strict, React 19, vitest, @testing-library/react, jsdom.

---

## Pre-flight: Rebase on latest main

```bash
cd C:/dev/repos/StarForge
git fetch origin
git rebase origin/main
npm install
npm test
```

All tests must pass before starting.

---

## Task 1: PlayerScores type + ScoreEngine pure function

**Files:**
- Modify: `src/models/types.ts` — add `PlayerScores` interface here to avoid circular imports
- Create: `src/engine/ScoreEngine.ts`
- Create: `src/engine/__tests__/ScoreEngine.test.ts`

**Context:**
- `PlayerScores` must live in `src/models/types.ts` (not `ScoreEngine.ts`) because `GameState` will import it, and `ScoreEngine` imports `GameState` — putting it in `ScoreEngine` would create a circular dependency.
- `SHIP_ORDER` is in `src/data/ships.ts`. `RESEARCH_ORDER` is in `src/data/research.ts`. Use these typed arrays instead of `Object.entries` to be type-safe.
- Non-combat ships to exclude from military score: `recycler`, `espionageProbe`, `colonyShip`, `smallCargo`, `largeCargo`, `solarSatellite`. These must be in an explicit typed set.
- The design doc's military formula includes a tech multiplier: `× (1 + weaponsTech × 0.1) × (1 + armourTech × 0.05)`. Include this.

**Step 1: Write failing test**

```ts
// src/engine/__tests__/ScoreEngine.test.ts
import { computePlayerScores } from '../ScoreEngine';
import { createNewGameState } from '../../models/GameState';

describe('computePlayerScores', () => {
  it('returns all zeros for a fresh game', () => {
    const state = createNewGameState();
    const scores = computePlayerScores(state);
    expect(scores.military).toBe(0);
    expect(scores.economy).toBe(0);
    expect(scores.research).toBe(0);
    expect(scores.total).toBe(0);
  });

  it('counts economy from productive buildings across all planets', () => {
    const state = createNewGameState();
    state.planets[0].buildings.metalMine = 5;
    state.planets[0].buildings.crystalMine = 3;
    state.planets[0].buildings.deuteriumSynthesizer = 2;
    const scores = computePlayerScores(state);
    expect(scores.economy).toBe(10); // 5+3+2+0+0
  });

  it('counts research from all research levels', () => {
    const state = createNewGameState();
    state.research.weaponsTechnology = 3;
    state.research.shieldingTechnology = 2;
    const scores = computePlayerScores(state);
    expect(scores.research).toBe(5);
  });

  it('counts military from combat ship weaponPower × count', () => {
    const state = createNewGameState();
    // lightFighter weaponPower = 50
    state.planets[0].ships.lightFighter = 10;
    const scores = computePlayerScores(state);
    expect(scores.military).toBe(50 * 10); // no tech bonus at level 0
  });

  it('excludes non-combat ships from military score', () => {
    const state = createNewGameState();
    state.planets[0].ships.recycler = 100;
    state.planets[0].ships.espionageProbe = 100;
    state.planets[0].ships.colonyShip = 10;
    state.planets[0].ships.solarSatellite = 50;
    const scores = computePlayerScores(state);
    expect(scores.military).toBe(0);
  });

  it('total is weighted composite', () => {
    const state = createNewGameState();
    state.planets[0].ships.lightFighter = 10; // military = 500
    state.planets[0].buildings.metalMine = 5; // economy = 5
    state.research.weaponsTechnology = 1;     // research = 1
    const scores = computePlayerScores(state);
    // total = military*2 + economy*5 + research*3
    expect(scores.total).toBe(500 * 2 + 5 * 5 + 1 * 3);
  });
});
```

**Step 2: Run to verify fail**

```bash
cd C:/dev/repos/StarForge && npx vitest run src/engine/__tests__/ScoreEngine.test.ts
```

Expected: FAIL — `ScoreEngine` module not found.

**Step 3: Add `PlayerScores` to `src/models/types.ts`**

Append to the end of `src/models/types.ts`:
```ts
export interface PlayerScores {
  military: number;
  economy: number;
  research: number;
  total: number;
}
```

**Step 4: Implement `src/engine/ScoreEngine.ts`**

```ts
import type { GameState } from '../models/GameState.ts';
import type { PlayerScores } from '../models/types.ts';
import { SHIPS, SHIP_ORDER } from '../data/ships.ts';
import { RESEARCH_ORDER } from '../data/research.ts';

const NON_COMBAT_SHIP_IDS = new Set<string>([
  'recycler', 'espionageProbe', 'colonyShip', 'smallCargo', 'largeCargo', 'solarSatellite',
]);

const ECONOMY_BUILDINGS = [
  'metalMine', 'crystalMine', 'deuteriumSynthesizer', 'solarPlant', 'fusionReactor',
] as const;

export function computePlayerScores(state: GameState): PlayerScores {
  const weaponsTech = state.research.weaponsTechnology ?? 0;
  const armourTech = state.research.armourTechnology ?? 0;
  const techMultiplier = (1 + weaponsTech * 0.1) * (1 + armourTech * 0.05);

  let military = 0;
  let economy = 0;

  for (const planet of state.planets) {
    for (const buildingId of ECONOMY_BUILDINGS) {
      economy += planet.buildings[buildingId] ?? 0;
    }
    for (const shipId of SHIP_ORDER) {
      if (NON_COMBAT_SHIP_IDS.has(shipId)) continue;
      const count = planet.ships[shipId] ?? 0;
      if (count <= 0) continue;
      const def = SHIPS[shipId];
      if (def) military += def.weaponPower * count;
    }
  }

  military = Math.round(military * techMultiplier);
  const research = RESEARCH_ORDER.reduce((sum, id) => sum + (state.research[id] ?? 0), 0);
  const total = military * 2 + economy * 5 + research * 3;

  return { military, economy, research, total };
}
```

**Step 5: Run to verify pass**

```bash
cd C:/dev/repos/StarForge && npx vitest run src/engine/__tests__/ScoreEngine.test.ts
```

Expected: All tests PASS.

**Step 6: Commit**

```bash
cd C:/dev/repos/StarForge
git add src/models/types.ts src/engine/ScoreEngine.ts src/engine/__tests__/ScoreEngine.test.ts
git commit -m "feat(score): add PlayerScores type and ScoreEngine pure function"
```

---

## Task 2: Add PlayerScores to GameState + v12→v13 migration

**Files:**
- Modify: `src/models/GameState.ts`
- Modify: `src/models/types.ts` (STATE_VERSION bump)
- Modify: `src/engine/StateManager.ts`

**Step 1: Write failing test**

Add to `src/engine/__tests__/ScoreEngine.test.ts`:

```ts
import { loadState } from '../StateManager';

it('migration v12→v13 adds playerScores with zeros', () => {
  const base = createNewGameState();
  const raw = JSON.stringify({ ...base, version: 12, playerScores: undefined });
  localStorage.setItem('starforge_save', raw);
  const loaded = loadState();
  expect(loaded?.playerScores).toEqual({ military: 0, economy: 0, research: 0, total: 0 });
});
```

**Step 2: Run to verify fail**

```bash
cd C:/dev/repos/StarForge && npx vitest run src/engine/__tests__/ScoreEngine.test.ts
```

**Step 3: Implement**

In `src/models/GameState.ts`, add import and field:
```ts
import type { PlayerScores } from './types.ts';
// in interface GameState:
playerScores: PlayerScores;
// in createNewGameState():
playerScores: { military: 0, economy: 0, research: 0, total: 0 },
```

In `src/models/types.ts`, bump:
```ts
STATE_VERSION: 13,
```

In `src/engine/StateManager.ts`, add after the `v < 12` block:
```ts
if (state.version < 13) {
  if ((legacyState as Record<string, unknown>).playerScores === undefined) {
    (legacyState as Record<string, unknown>).playerScores = {
      military: 0, economy: 0, research: 0, total: 0,
    };
  }
  state.version = 13;
}
```

**Step 4: Run full suite**

```bash
cd C:/dev/repos/StarForge && npm test
```

**Step 5: Commit**

```bash
cd C:/dev/repos/StarForge
git add src/models/GameState.ts src/models/types.ts src/engine/StateManager.ts src/engine/__tests__/ScoreEngine.test.ts
git commit -m "feat(score): add playerScores to GameState, state v12->v13 migration"
```

---

## Task 3: Add targetTier + catchUpUpgradeIntervalMs + catchUpProgressTicks to NPCColony

**Files:**
- Modify: `src/models/Galaxy.ts`
- Modify: `src/engine/GalaxyEngine.ts` — `generateNPCColonies` push + `adminNPC` creation helper
- Modify: `src/engine/StateManager.ts` — add NPC fields to v12→v13 migration block
- Modify: `src/hooks/useGameEngine.ts` — `adminSetNPCTier` and `adminAddNPC` must set new fields

**Context:**
- `catchUpProgressTicks` is a NEW field (separate from `upgradeTickCount`). It only increments during catch-up mode and resets to 0 when `tier === targetTier`. This prevents colony age from affecting catch-up rate.
- `adminSetNPCTier` at line 745 in `useGameEngine.ts` resets many colony fields — it must also set `targetTier = safeTier`, `catchUpUpgradeIntervalMs = intervalMs / 4`, `catchUpProgressTicks = 0`.
- `adminAddNPC` calls `addNPCToGalaxy` in `GalaxyEngine.ts` — the colony returned already comes from `generateNPCColonies`-style construction, so if we fix the factory, this is covered automatically.

**Step 1: Write failing test**

```ts
// src/engine/__tests__/NPCScaling.test.ts
import { generateNPCColonies } from '../GalaxyEngine';

describe('NPCColony catch-up fields', () => {
  it('newly generated colonies have targetTier === tier', () => {
    const colonies = generateNPCColonies(42);
    for (const colony of colonies) {
      expect(colony.targetTier).toBe(colony.tier);
    }
  });

  it('catchUpUpgradeIntervalMs is initialUpgradeIntervalMs / 4', () => {
    const colonies = generateNPCColonies(42);
    for (const colony of colonies) {
      expect(colony.catchUpUpgradeIntervalMs).toBe(colony.initialUpgradeIntervalMs / 4);
    }
  });

  it('catchUpProgressTicks starts at 0', () => {
    const colonies = generateNPCColonies(42);
    for (const colony of colonies) {
      expect(colony.catchUpProgressTicks).toBe(0);
    }
  });
});
```

**Step 2: Run to verify fail**

```bash
cd C:/dev/repos/StarForge && npx vitest run src/engine/__tests__/NPCScaling.test.ts
```

**Step 3: Implement**

In `src/models/Galaxy.ts`, add to `NPCColony`:
```ts
targetTier: number;
catchUpUpgradeIntervalMs: number;
catchUpProgressTicks: number;
```

In `src/engine/GalaxyEngine.ts`, in `generateNPCColonies` `colonies.push({...})`:
```ts
targetTier: tier,
catchUpUpgradeIntervalMs: intervalMs / 4,
catchUpProgressTicks: 0,
```

In `src/engine/StateManager.ts`, in the `v < 13` migration block, add after `playerScores`:
```ts
for (const colony of (legacyState.galaxy?.npcColonies ?? [])) {
  const c = colony as Record<string, unknown>;
  if (c['targetTier'] === undefined) c['targetTier'] = colony.tier;
  if (c['catchUpUpgradeIntervalMs'] === undefined)
    c['catchUpUpgradeIntervalMs'] = colony.initialUpgradeIntervalMs / 4;
  if (c['catchUpProgressTicks'] === undefined) c['catchUpProgressTicks'] = 0;
}
```

In `src/hooks/useGameEngine.ts`, in `adminSetNPCTier` after `colony.upgradeTickCount = 0;`:
```ts
colony.targetTier = safeTier;
colony.catchUpUpgradeIntervalMs = intervalMs / 4;
colony.catchUpProgressTicks = 0;
```

**Step 4: Run full suite**

```bash
cd C:/dev/repos/StarForge && npm test
```

**Step 5: Commit**

```bash
cd C:/dev/repos/StarForge
git add src/models/Galaxy.ts src/engine/GalaxyEngine.ts src/engine/StateManager.ts src/hooks/useGameEngine.ts src/engine/__tests__/NPCScaling.test.ts
git commit -m "feat(npc): add targetTier, catchUpUpgradeIntervalMs, catchUpProgressTicks to NPCColony"
```

---

## Task 4: Compute playerScores each tick and pass to processUpgrades

**Files:**
- Modify: `src/hooks/useGameEngine.ts`
- Modify: `src/engine/NPCUpgradeEngine.ts` — change `processUpgrades` signature

**Context:**
- Scores must be computed **before** the NPC upgrade pass, not after. The current tick order calls `processNPCUpgrades(state, now)` first. We need to flip: compute scores → pass to NPC upgrades.
- Change `processUpgrades(state, now)` to `processUpgrades(state, now, playerTotal: number)` so the dependency is explicit and never stale.
- Also update the offline catch-up call in `StateManager.ts` — it calls `processNPCUpgrades` too. That call can pass `state.playerScores?.total ?? 0` since offline catch-up already has a computed state.
- `StateManager.ts` is imported by the engine, which cannot import from hooks. So `StateManager.ts` will read `state.playerScores.total` (already on state after migration).

**Step 1: Update `processUpgrades` signature**

In `src/engine/NPCUpgradeEngine.ts`, change the function signature:
```ts
export function processUpgrades(state: GameState, now: number, playerTotal: number): void {
```

Replace the internal read of `state.playerScores?.total ?? 0` with the passed `playerTotal` parameter.

Add `computeEffectiveMinTier` at the top of the file:
```ts
const TIER_POWER_THRESHOLD = 500;
const CATCH_UP_TICKS_PER_TIER = 5;

export function computeEffectiveMinTier(playerTotal: number): number {
  return Math.max(1, Math.min(10, Math.floor(playerTotal / TIER_POWER_THRESHOLD)));
}
```

At the top of `processUpgrades`, before the colony loop, add:
```ts
const effectiveMin = computeEffectiveMinTier(playerTotal);
for (const col of state.galaxy.npcColonies) {
  if (effectiveMin > col.targetTier && col.targetTier < col.maxTier) {
    col.targetTier = Math.min(col.maxTier, effectiveMin);
  }
}
```

**Step 2: Update callers**

In `src/hooks/useGameEngine.ts`, find the tick loop call `processNPCUpgrades(state, now)`. Change to:
```ts
const scores = computePlayerScores(stateRef.current);
stateRef.current.playerScores = scores;
processNPCUpgrades(stateRef.current, now, scores.total);
```

Import `computePlayerScores` from `../engine/ScoreEngine.ts`.

In `src/engine/StateManager.ts`, find the offline catch-up call to `processNPCUpgrades(state, now)`. Change to:
```ts
processNPCUpgrades(state, now, state.playerScores?.total ?? 0);
```

**Step 3: Run full suite**

```bash
cd C:/dev/repos/StarForge && npm test
```

**Step 4: Commit**

```bash
cd C:/dev/repos/StarForge
git add src/engine/NPCUpgradeEngine.ts src/hooks/useGameEngine.ts src/engine/StateManager.ts
git commit -m "feat(score): compute playerScores before NPC upgrade pass, pass explicitly"
```

---

## Task 5: NPC catch-up upgrade logic in NPCUpgradeEngine

**Files:**
- Modify: `src/engine/NPCUpgradeEngine.ts`
- Modify: `src/engine/__tests__/NPCScaling.test.ts`

**Context:**
- In the `processUpgrades` while-loop, use `catchUpUpgradeIntervalMs` when `tier < targetTier`, else use `currentUpgradeIntervalMs`.
- After each tick increment, if catching up, increment `catchUpProgressTicks`. When `catchUpProgressTicks % CATCH_UP_TICKS_PER_TIER === 0`, bump `colony.tier` by 1 toward `targetTier`. When `tier === targetTier`, reset `catchUpProgressTicks = 0`.
- Do NOT use `upgradeTickCount % 5` — that's the colony's total age counter, not catch-up progress.

**Step 1: Write failing tests**

Add to `src/engine/__tests__/NPCScaling.test.ts`:

```ts
import { processUpgrades, computeEffectiveMinTier } from '../NPCUpgradeEngine';
import { createNewGameState } from '../../models/GameState';

describe('computeEffectiveMinTier', () => {
  it('returns 1 for zero score', () => {
    expect(computeEffectiveMinTier(0)).toBe(1);
  });

  it('returns 2 at threshold', () => {
    expect(computeEffectiveMinTier(500)).toBe(1); // floor(500/500) = 1, then clamp min 1
    expect(computeEffectiveMinTier(1000)).toBe(2);
  });

  it('caps at 10', () => {
    expect(computeEffectiveMinTier(999_999)).toBe(10);
  });
});

describe('catch-up upgrade mode', () => {
  function makeStateWithColony() {
    const state = createNewGameState();
    // Ensure there's at least one NPC colony by using a fresh galaxy seed
    state.galaxy.npcColonies = [{
      coordinates: { galaxy: 1, system: 2, slot: 1 },
      name: 'Test Colony',
      temperature: 50,
      tier: 1,
      targetTier: 3,
      specialty: 'balanced',
      maxTier: 5,
      initialUpgradeIntervalMs: 1000,
      currentUpgradeIntervalMs: 10_000,
      catchUpUpgradeIntervalMs: 200,
      catchUpProgressTicks: 0,
      lastUpgradeAt: 0,
      upgradeTickCount: 0,
      raidCount: 0,
      recentRaidTimestamps: [],
      abandonedAt: undefined,
      buildings: { metalMine: 2, crystalMine: 1, deuteriumSynthesizer: 0, solarPlant: 1, fusionReactor: 0, roboticsFactory: 0, naniteFactory: 0, shipyard: 1, researchLab: 1, metalStorage: 1, crystalStorage: 1, deuteriumTank: 1 },
      baseDefences: {},
      baseShips: {},
      currentDefences: {},
      currentShips: {},
      lastRaidedAt: 0,
      resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 },
    }];
    return state;
  }

  it('uses catchUpUpgradeIntervalMs when tier < targetTier', () => {
    const state = makeStateWithColony();
    const colony = state.galaxy.npcColonies[0]!;
    // catchUpInterval = 200ms; after 201ms real time at gameSpeed 1, should tick
    processUpgrades(state, 201, 0);
    expect(colony.upgradeTickCount).toBeGreaterThan(0);
  });

  it('increments catchUpProgressTicks while catching up', () => {
    const state = makeStateWithColony();
    const colony = state.galaxy.npcColonies[0]!;
    processUpgrades(state, 500, 0); // multiple ticks
    expect(colony.catchUpProgressTicks).toBeGreaterThan(0);
  });

  it('bumps tier after CATCH_UP_TICKS_PER_TIER (5) catch-up ticks', () => {
    const state = makeStateWithColony();
    const colony = state.galaxy.npcColonies[0]!;
    // Run enough time for at least 5 catch-up ticks (5 * 200ms = 1000ms + buffer)
    processUpgrades(state, 1100, 0);
    expect(colony.tier).toBeGreaterThan(1);
  });

  it('does not exceed targetTier', () => {
    const state = makeStateWithColony();
    const colony = state.galaxy.npcColonies[0]!;
    processUpgrades(state, 100_000, 0);
    expect(colony.tier).toBeLessThanOrEqual(colony.targetTier);
  });

  it('resets catchUpProgressTicks when tier reaches targetTier', () => {
    const state = makeStateWithColony();
    const colony = state.galaxy.npcColonies[0]!;
    colony.targetTier = 2; // only 1 tier to catch up
    processUpgrades(state, 100_000, 0);
    expect(colony.tier).toBe(2);
    expect(colony.catchUpProgressTicks).toBe(0);
  });
});
```

**Step 2: Run to verify fail**

```bash
cd C:/dev/repos/StarForge && npx vitest run src/engine/__tests__/NPCScaling.test.ts
```

**Step 3: Implement in `NPCUpgradeEngine.ts`**

In the `processUpgrades` while-loop, before the loop body, determine the active interval:

```ts
const isCatchingUp = colony.tier < colony.targetTier;
const activeInterval = isCatchingUp
  ? colony.catchUpUpgradeIntervalMs
  : colony.currentUpgradeIntervalMs;
```

Replace `colony.currentUpgradeIntervalMs` with `activeInterval` in:
- The while-condition: `(now - colony.lastUpgradeAt) * safeGameSpeed >= activeInterval`
- The `lastUpgradeAt` increment: `colony.lastUpgradeAt += activeInterval / safeGameSpeed;`

After `colony.upgradeTickCount += 1;`, add:
```ts
if (isCatchingUp) {
  colony.catchUpProgressTicks += 1;
  if (colony.catchUpProgressTicks % CATCH_UP_TICKS_PER_TIER === 0) {
    colony.tier = Math.min(colony.targetTier, colony.tier + 1);
    if (colony.tier >= colony.targetTier) {
      colony.catchUpProgressTicks = 0;
    }
  }
}
```

**Step 4: Run to verify pass**

```bash
cd C:/dev/repos/StarForge && npx vitest run src/engine/__tests__/NPCScaling.test.ts
```

**Step 5: Run full suite**

```bash
cd C:/dev/repos/StarForge && npm test
```

**Step 6: Commit**

```bash
cd C:/dev/repos/StarForge
git add src/engine/NPCUpgradeEngine.ts src/engine/__tests__/NPCScaling.test.ts
git commit -m "feat(npc): catch-up upgrade mode — tier grows gradually toward player-driven target"
```

---

## Task 6: NPC loot scaling by tier²

**Files:**
- Modify: `src/engine/GalaxyEngine.ts` — `getNPCResources`

**Context:**
- Current `getNPCResources` accumulates from passive mine production up to a `NPC_RESOURCE_CAP_HOURS` ceiling. We add a **floor**: resources are always at least `BASE_POOL × tier²`, so a tier-8 NPC always has a meaningful stockpile even if recently raided.
- This is a floor, not a replacement — the production-based accumulation still applies. `Math.max(floor, accumulatedValue)` per resource.
- Covers both fleet raid loot (via `calcLoot` in `FleetEngine.ts`) and espionage (via `EspionageEngine.ts`), since both call `getNPCResources`.

**Step 1: Write failing test**

```ts
// src/engine/__tests__/NPCScaling.test.ts (add to existing file)
import { getNPCResources } from '../GalaxyEngine';

describe('getNPCResources tier² floor', () => {
  it('tier-1 NPC has at least BASE_POOL × 1 resources', () => {
    const colony = {
      ...makeStateWithColony().galaxy.npcColonies[0]!,
      tier: 1,
      lastRaidedAt: Date.now() - 1000, // recently raided
      resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 },
    };
    const resources = getNPCResources(colony, Date.now(), 1);
    expect(resources.metal).toBeGreaterThanOrEqual(50_000);
    expect(resources.crystal).toBeGreaterThanOrEqual(30_000);
  });

  it('tier-4 NPC floor is 16× tier-1 floor', () => {
    const base = makeStateWithColony().galaxy.npcColonies[0]!;
    const colony4 = { ...base, tier: 4, lastRaidedAt: Date.now() - 1000, resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 } };
    const colony1 = { ...base, tier: 1, lastRaidedAt: Date.now() - 1000, resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 } };
    const r4 = getNPCResources(colony4, Date.now(), 1);
    const r1 = getNPCResources(colony1, Date.now(), 1);
    expect(r4.metal).toBeGreaterThanOrEqual(r1.metal * 16 * 0.9); // tier² scaling with 10% tolerance
  });
});
```

**Step 2: Run to verify fail**

```bash
cd C:/dev/repos/StarForge && npx vitest run src/engine/__tests__/NPCScaling.test.ts
```

**Step 3: Implement**

In `src/engine/GalaxyEngine.ts`, add constants near the top of the file (with other NPC constants):
```ts
const NPC_BASE_POOL = { metal: 50_000, crystal: 30_000, deuterium: 10_000 };
```

In `getNPCResources`, in the return statement, wrap each value with a `Math.max` floor:
```ts
const tierFloor = colony.tier * colony.tier;
return {
  metal: Math.max(
    NPC_BASE_POOL.metal * tierFloor,
    Math.max(0, Math.floor(Math.min(stockpileCap.metal, baseline.metal + production.metalPerHour * elapsedHours))),
  ),
  crystal: Math.max(
    NPC_BASE_POOL.crystal * tierFloor,
    Math.max(0, Math.floor(Math.min(stockpileCap.crystal, baseline.crystal + production.crystalPerHour * elapsedHours))),
  ),
  deuterium: Math.max(
    NPC_BASE_POOL.deuterium * tierFloor,
    Math.max(0, Math.floor(Math.min(stockpileCap.deuterium, baseline.deuterium + production.deuteriumPerHour * elapsedHours))),
  ),
};
```

**Step 4: Run full suite**

```bash
cd C:/dev/repos/StarForge && npm test
```

**Step 5: Commit**

```bash
cd C:/dev/repos/StarForge
git add src/engine/GalaxyEngine.ts src/engine/__tests__/NPCScaling.test.ts
git commit -m "feat(npc): scale loot floor by tier² so higher-tier raids yield more resources"
```

---

## Task 7: Relative strength labels in GalaxyPanel

**Files:**
- Modify: `src/panels/GalaxyPanel.tsx`
- Create: `src/panels/__tests__/GalaxyPanel.test.ts` (or add to existing)

**Context:**
- NPC power includes **both ships and defences** — use `getNPCCurrentForce(colony, now)` which already interpolates current vs base. Apply `SHIPS[id]?.weaponPower` for ships and `DEFENCES[id]?.weaponPower` for defences.
- `DEFENCES` is already imported in `GalaxyPanel.tsx` at line 7.
- Guard: if `playerMilitary <= 0`, return `'Easy'`.

**Step 1: Write failing test**

```ts
// src/panels/__tests__/GalaxyPanel.test.ts
import { npcRelativeStrengthLabel } from '../GalaxyPanel';

describe('npcRelativeStrengthLabel', () => {
  it('returns Easy when playerMilitary is 0', () => {
    expect(npcRelativeStrengthLabel(500, 0)).toBe('Easy');
  });
  it('returns Easy when npc power < 30% of player', () => {
    expect(npcRelativeStrengthLabel(10, 100)).toBe('Easy');
  });
  it('returns Fair for 0.3–0.7', () => {
    expect(npcRelativeStrengthLabel(50, 100)).toBe('Fair');
  });
  it('returns Even for 0.7–1.3', () => {
    expect(npcRelativeStrengthLabel(100, 100)).toBe('Even');
  });
  it('returns Hard for 1.3–2.5', () => {
    expect(npcRelativeStrengthLabel(200, 100)).toBe('Hard');
  });
  it('returns Dangerous above 2.5', () => {
    expect(npcRelativeStrengthLabel(300, 100)).toBe('Dangerous');
  });
});
```

**Step 2: Run to verify fail**

```bash
cd C:/dev/repos/StarForge && npx vitest run src/panels/__tests__/GalaxyPanel.test.ts
```

**Step 3: Implement**

In `src/panels/GalaxyPanel.tsx`, replace the existing `npcStrengthLabel` function with:

```ts
export function npcRelativeStrengthLabel(npcPower: number, playerMilitary: number): string {
  if (playerMilitary <= 0) return 'Easy';
  const ratio = npcPower / playerMilitary;
  if (ratio < 0.3) return 'Easy';
  if (ratio < 0.7) return 'Fair';
  if (ratio < 1.3) return 'Even';
  if (ratio < 2.5) return 'Hard';
  return 'Dangerous';
}
```

Add a helper that uses `getNPCCurrentForce` (already available from `GalaxyEngine.ts` imports — add it if missing):
```ts
import { getNPCCurrentForce, ... } from '../engine/GalaxyEngine.ts';

function calcNPCPower(colony: NPCColony, now: number): number {
  const force = getNPCCurrentForce(colony, now);
  let power = 0;
  for (const [id, count] of Object.entries(force.ships)) {
    if (count > 0) power += (SHIPS[id as keyof typeof SHIPS]?.weaponPower ?? 0) * count;
  }
  for (const [id, count] of Object.entries(force.defences)) {
    if (count > 0) power += (DEFENCES[id as keyof typeof DEFENCES]?.weaponPower ?? 0) * count;
  }
  return power;
}
```

In the JSX, replace every `npcStrengthLabel(colony.tier)` call with:
```ts
npcRelativeStrengthLabel(calcNPCPower(colony, now), gameState.playerScores.military)
```

Where `now` is `Date.now()` — add `const now = Date.now();` near the top of the component if not already present.

**Step 4: Run full suite**

```bash
cd C:/dev/repos/StarForge && npm test
```

**Step 5: Commit**

```bash
cd C:/dev/repos/StarForge
git add src/panels/GalaxyPanel.tsx src/panels/__tests__/GalaxyPanel.test.ts
git commit -m "feat(npc): player-relative strength labels using actual fleet+defence power"
```

---

## Task 8: galaxyJumpTarget in GameContext + update test harness

**Files:**
- Modify: `src/context/GameContext.tsx`
- Modify: `src/hooks/useGameEngine.ts`
- Modify: `src/test/test-utils.tsx` — add `galaxyJumpTarget` and `setGalaxyJumpTarget` to `defaultActions`

**Context:**
- `GameContextType` is the interface — adding fields here causes TypeScript errors in all files that provide a mock context object, specifically `test-utils.tsx` (line 43, `defaultActions`) and any inline mock in test files (e.g., `AdminPanel.test.tsx`).
- Search for all files that construct a `GameContextType` object: `grep -rn "GameContextType\|GameContext.Provider" src/`. Update every one.

**Step 1: Write failing test**

```ts
// Add to src/context/__tests__/GameContext.test.ts or any existing context test
import { createMockGameContext } from '../../test/test-utils';

it('mock context includes galaxyJumpTarget and setGalaxyJumpTarget', () => {
  const ctx = createMockGameContext();
  expect(ctx.galaxyJumpTarget).toBeNull();
  expect(typeof ctx.setGalaxyJumpTarget).toBe('function');
});
```

**Step 2: Run to verify fail**

```bash
cd C:/dev/repos/StarForge && npx vitest run --reporter=verbose 2>&1 | grep -E "TypeScript|galaxyJumpTarget" | head -20
```

**Step 3: Implement**

In `src/context/GameContext.tsx`, add to `GameContextType`:
```ts
galaxyJumpTarget: Coordinates | null;
setGalaxyJumpTarget: (coords: Coordinates | null) => void;
```

In `src/hooks/useGameEngine.ts`, add:
```ts
const [galaxyJumpTarget, setGalaxyJumpTarget] = useState<Coordinates | null>(null);
```

Expose both in the returned object (mirrors `fleetTarget`/`setFleetTarget` pattern).

In `src/context/GameContext.tsx`, destructure and pass through in the provider.

In `src/test/test-utils.tsx`, add to `defaultActions`:
```ts
galaxyJumpTarget: null,
setGalaxyJumpTarget: () => {},
```

Search for any other inline mock objects providing `GameContextType` (e.g., in panel tests):
```bash
cd C:/dev/repos/StarForge && grep -rn "fleetTarget:" src/ --include="*.ts" --include="*.tsx" | grep -v "test-utils"
```
Add `galaxyJumpTarget: null, setGalaxyJumpTarget: () => {},` to each one found.

**Step 4: Run full suite**

```bash
cd C:/dev/repos/StarForge && npm test
```

**Step 5: Commit**

```bash
cd C:/dev/repos/StarForge
git add src/context/GameContext.tsx src/hooks/useGameEngine.ts src/test/test-utils.tsx
git commit -m "feat(nav): add galaxyJumpTarget to GameContext and test harness"
```

---

## Task 9: Clickable coordinates in MessagesPanel

**Files:**
- Modify: `src/panels/MessagesPanel.tsx`

**Context:**
- `RowFrame.title` is currently a `string` rendered inside a `<button>` toggle (line 77–90). Adding a clickable `<button>` inside that button is invalid HTML.
- Fix: add an optional `coordsNode?: React.ReactNode` prop to `RowFrame`. Render it as a **sibling** to the toggle button, inside `message-row-top`, between the toggle and the delete button.
- `MessagesPanel` currently receives no props. Check how `setActivePanel` reaches it — read `src/App.tsx` first. If it's not passed, add it as a prop and update the callsite in `App.tsx`.

**Step 1: Check App.tsx callsite**

Read `src/App.tsx` to see how `MessagesPanel` is rendered. If no `setActivePanel` prop, add it there and update the component signature.

**Step 2: Write failing test**

```ts
// src/panels/__tests__/MessagesPanel.test.ts (or add to existing)
import { renderWithGame } from '../../test/test-utils';
import { screen } from '@testing-library/react';
import { MessagesPanel } from '../MessagesPanel';
import type { CombatLogEntry } from '../../models/Fleet';

it('renders coord-link buttons for combat report coordinates', () => {
  const fakeEntry: CombatLogEntry = {
    id: 'test-1',
    timestamp: Date.now(),
    targetCoordinates: { galaxy: 1, system: 5, slot: 3 },
    targetName: 'Test NPC',
    read: false,
    result: { outcome: 'attacker_wins', rounds: 2, attackerLosses: {}, defenderLosses: {}, loot: { metal: 0, crystal: 0, deuterium: 0 } },
  };
  renderWithGame(
    <MessagesPanel setActivePanel={() => {}} />,
    { gameState: { combatLog: [fakeEntry] } },
  );
  const coordLinks = document.querySelectorAll('.coord-link');
  expect(coordLinks.length).toBeGreaterThan(0);
});
```

**Step 3: Implement**

Add `coordsNode?: React.ReactNode` to `RowFrameProps` and render it in `RowFrame`:
```tsx
// In message-row-top, after the toggle button and before the delete button:
{coordsNode}
```

Add `CoordLink` component:
```tsx
function CoordLink({
  coords,
  setActivePanel,
}: {
  coords: { galaxy: number; system: number; slot: number };
  setActivePanel: (p: ActivePanel) => void;
}) {
  const { setGalaxyJumpTarget } = useGame();
  return (
    <button
      type="button"
      className="coord-link"
      title="View in galaxy map"
      onClick={() => {
        setGalaxyJumpTarget(coords);
        setActivePanel('galaxy');
      }}
    >
      [{formatCoords(coords)}]
    </button>
  );
}
```

For each message row (`CombatMessageRow`, espionage row, fleet notification row), pass `coordsNode={<CoordLink coords={entry.targetCoordinates} setActivePanel={setActivePanel} />}` to `RowFrame`. Remove the coords from the `title` string.

Update `MessagesPanel`'s function signature to accept `setActivePanel`:
```ts
export function MessagesPanel({ setActivePanel }: { setActivePanel: (p: ActivePanel) => void })
```

Import `type { ActivePanel }` from `'../models/types.ts'`.

**Step 4: Run full suite**

```bash
cd C:/dev/repos/StarForge && npm test
```

**Step 5: Commit**

```bash
cd C:/dev/repos/StarForge
git add src/panels/MessagesPanel.tsx src/panels/__tests__/MessagesPanel.test.ts src/App.tsx
git commit -m "feat(nav): clickable coord-link buttons in MessagesPanel, no nested buttons"
```

---

## Task 10: Manual coordinate entry in GalaxyPanel

**Files:**
- Modify: `src/panels/GalaxyPanel.tsx`

**Context:**
- Read lines 150–280 of `GalaxyPanel.tsx` first to find the system selection state variable and its setter.
- Galaxy input: clamp galaxy to `1` (the game only has one galaxy). Only system (1–MAX_SYSTEMS) is user-editable.
- Handle `galaxyJumpTarget` from context: when non-null, call `setSelectedSystem(target.system)` and clear it.

**Step 1: Locate system state variable**

```bash
cd C:/dev/repos/StarForge && grep -n "useState\|selectedSystem\|setSystem\|system" src/panels/GalaxyPanel.tsx | head -30
```

**Step 2: Implement**

Add state:
```ts
const [jumpInput, setJumpInput] = useState('');
const [jumpError, setJumpError] = useState('');
```

Add handler:
```ts
function handleJump() {
  const trimmed = jumpInput.trim();
  const parts = trimmed.split(':').map(Number);
  // Accept "5" or "1:5" — always clamp galaxy to 1
  const system = parts.length >= 2 ? parts[1] : parts[0];
  if (!system || !Number.isInteger(system) || system < 1 || system > GALAXY_CONSTANTS.MAX_SYSTEMS) {
    setJumpError(`System must be 1–${GALAXY_CONSTANTS.MAX_SYSTEMS}`);
    setTimeout(() => setJumpError(''), 2000);
    return;
  }
  setSelectedSystem(system); // use the actual state setter found in step 1
  setJumpInput('');
  setJumpError('');
}
```

Add JSX near the top of the panel render:
```tsx
<div className="galaxy-jump-input">
  <label htmlFor="galaxy-jump">Jump to:</label>
  <input
    id="galaxy-jump"
    type="text"
    placeholder={`System 1–${GALAXY_CONSTANTS.MAX_SYSTEMS}`}
    value={jumpInput}
    onChange={(e) => setJumpInput(e.target.value)}
    onKeyDown={(e) => { if (e.key === 'Enter') handleJump(); }}
  />
  <button type="button" onClick={handleJump}>Go</button>
  {jumpError && <span className="galaxy-jump-error">{jumpError}</span>}
</div>
```

Add `useEffect` for `galaxyJumpTarget` from context:
```ts
const { galaxyJumpTarget, setGalaxyJumpTarget } = useGame();

useEffect(() => {
  if (galaxyJumpTarget) {
    setSelectedSystem(galaxyJumpTarget.system);
    setGalaxyJumpTarget(null);
  }
}, [galaxyJumpTarget, setGalaxyJumpTarget]);
```

**Step 3: Run full suite**

```bash
cd C:/dev/repos/StarForge && npm test
```

**Step 4: Commit**

```bash
cd C:/dev/repos/StarForge
git add src/panels/GalaxyPanel.tsx
git commit -m "feat(nav): manual coordinate entry and jump-target navigation in GalaxyPanel"
```

---

## Task 11: Metal, Crystal, Deuterium hover tooltips in ResourceBar

**Files:**
- Modify: `src/components/ResourceBar.tsx`
- Modify: `src/components/__tests__/ResourceBar.test.tsx` (add to existing)

**Context:**
- The energy hover uses a `hoverCloseTimerRef` with a 120ms debounce delay so the panel stays open when the cursor moves into it. Metal/crystal/deuterium hovers MUST use the same pattern — plain `setState(true/false)` would cause the panel to close immediately.
- Pattern to follow exactly: `useRef<number | null>(null)`, `clearHoverCloseTimer()`, `openHover()`, `scheduleHoverClose()` — replicate per resource or extract a small `useHoverTimer` helper.
- `formatRate` already adds `/hr` suffix — don't double it.
- Efficiency row only shown when `energyConsumption > 0 && energyProduction < energyConsumption`.

**Step 1: Write failing test**

Add to `src/components/__tests__/ResourceBar.test.tsx`:
```ts
import { fireEvent, waitFor } from '@testing-library/react';

it('hovering Metal entry shows Metal Mine level', async () => {
  const { container } = renderWithGame(<ResourceBar />, {
    gameState: { planet: { buildings: { metalMine: 7 } } },
  });
  const metalEntry = container.querySelector('.resource-entry--metal');
  expect(metalEntry).not.toBeNull();
  fireEvent.mouseEnter(metalEntry!);
  await waitFor(() => {
    expect(container.querySelector('.resource-hover-panel')).not.toBeNull();
  });
  expect(container.textContent).toContain('Metal Mine');
  expect(container.textContent).toContain('Lv 7');
});

it('hovering Deuterium entry shows temperature modifier', async () => {
  const { container } = renderWithGame(<ResourceBar />, {
    gameState: { planet: { maxTemperature: 100 } },
  });
  const deutEntry = container.querySelector('.resource-entry--deuterium');
  fireEvent.mouseEnter(deutEntry!);
  await waitFor(() => {
    expect(container.querySelector('.resource-hover-panel')).not.toBeNull();
  });
  expect(container.textContent).toMatch(/Temp/i);
});
```

**Step 2: Run to verify fail**

```bash
cd C:/dev/repos/StarForge && npx vitest run src/components/__tests__/ResourceBar.test.tsx
```

**Step 3: Implement**

Extract a reusable hover timer helper at the top of `ResourceBar.tsx` (inside the module, before the component):

```ts
function useHoverTimer(delayMs: number) {
  const [hovered, setHovered] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clear = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const open = () => { clear(); setHovered(true); };
  const close = () => {
    clear();
    timerRef.current = window.setTimeout(() => {
      setHovered(false);
      timerRef.current = null;
    }, delayMs);
  };

  useEffect(() => () => clear(), []);

  return { hovered, open, close };
}
```

Replace the existing energy hover state + timer logic in `ResourceBar` with:
```ts
const energyHover = useHoverTimer(HOVER_CLOSE_DELAY_MS);
const metalHover = useHoverTimer(HOVER_CLOSE_DELAY_MS);
const crystalHover = useHoverTimer(HOVER_CLOSE_DELAY_MS);
const deuteriumHover = useHoverTimer(HOVER_CLOSE_DELAY_MS);
```

Update all existing energy hover refs (`openHover` → `energyHover.open`, etc.).

Add computed values:
```ts
const energyPenalised =
  productionRates.energyConsumption > 0 &&
  productionRates.energyProduction < productionRates.energyConsumption;
const efficiencyPct = energyPenalised
  ? Math.min(100, Math.round((productionRates.energyProduction / productionRates.energyConsumption) * 100))
  : 100;
const metalMineLevel = buildings.metalMine ?? 0;
const crystalMineLevel = buildings.crystalMine ?? 0;
const deutMineLevel = buildings.deuteriumSynthesizer ?? 0;
const tempModifierPct = Number.isFinite(planet.maxTemperature)
  ? Math.round((-0.002 * planet.maxTemperature + 1.28) * 100) - 100
  : 28; // default +28% at 0°C
```

Add `className="resource-entry--metal"`, `--crystal`, `--deuterium` to the respective `<div className="resource-entry">` elements.

Add `ref`, `onMouseEnter={metalHover.open}`, `onMouseLeave={metalHover.close}` to each resource entry div.

Add `<HoverPortal>` to each (use `className="resource-hover-panel"` for test selectors):

**Metal:**
```tsx
<HoverPortal anchorRef={metalRef} open={metalHover.hovered} align="below-right"
  className="resource-hover-panel" onMouseEnter={metalHover.open} onMouseLeave={metalHover.close}>
  <div className="resource-label">Metal Mine (Lv {metalMineLevel})</div>
  <div className="energy-hover-row">
    <span>Production</span>
    <span className="number">{formatRate(productionRates.metalPerHour * speed)}</span>
  </div>
  {energyPenalised && (
    <div className="energy-hover-row">
      <span>Energy efficiency</span>
      <span className="number" style={{ color: 'var(--danger)' }}>{efficiencyPct}%</span>
    </div>
  )}
  <div className="energy-hover-row">
    <span>Storage</span>
    <span className="number">{formatNumber(resources.metal)} / {formatNumber(storageCaps.metal)}</span>
  </div>
</HoverPortal>
```

**Crystal:** same pattern with `crystalMineLevel` and `crystalPerHour`.

**Deuterium:** same pattern plus temperature row:
```tsx
<div className="energy-hover-row">
  <span>Temp modifier</span>
  <span className="number" style={{ color: tempModifierPct >= 0 ? 'var(--success)' : 'var(--danger)' }}>
    {tempModifierPct >= 0 ? '+' : ''}{tempModifierPct}%
  </span>
</div>
```

**Step 4: Run to verify pass**

```bash
cd C:/dev/repos/StarForge && npm test
```

**Step 5: Commit**

```bash
cd C:/dev/repos/StarForge
git add src/components/ResourceBar.tsx src/components/__tests__/ResourceBar.test.tsx
git commit -m "feat(ui): hover tooltips for Metal, Crystal, Deuterium with debounce stay-open"
```

---

## Task 12: Final verification

```bash
cd C:/dev/repos/StarForge
npm run build
npm test
```

Both must pass with 0 TypeScript errors and 0 test failures before the branch is ready for PR.
