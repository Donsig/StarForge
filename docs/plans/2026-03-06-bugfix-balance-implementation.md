# Bugfix & Balance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add dynamic NPC scaling driven by player power, clickable coordinates in messages, manual coordinate entry in the galaxy map, and hover tooltips for Metal/Crystal/Deuterium.

**Architecture:** New pure `ScoreEngine.ts` computes `PlayerScores` each tick (stored on `GameState`). NPC catch-up upgrade logic added to `NPCUpgradeEngine.ts`. UI features are isolated to `ResourceBar.tsx`, `MessagesPanel.tsx`, `GalaxyPanel.tsx`, and `GameContext.tsx`. State bumps v12→v13.

**Tech Stack:** TypeScript strict, React 19, vitest, @testing-library/react, jsdom.

---

## Pre-flight: Rebase on latest main

Before writing any code, pull main and rebase the feature branch:

```bash
cd C:/dev/repos/StarForge
git fetch origin
git rebase origin/main
npm install
npm test
```

All 283 tests must pass before starting.

---

## Task 1: ScoreEngine — PlayerScores pure function

**Files:**
- Create: `src/engine/ScoreEngine.ts`
- Create: `src/engine/__tests__/ScoreEngine.test.ts`

**Context:** `SHIPS` in `src/data/ships.ts` has `.weaponPower` and `.structuralIntegrity` on each ship definition. Use `weaponPower` as the military weight for each ship type. Non-combat ships (recycler, espionageProbe, colonyShip, smallCargo, largeCargo, solarSatellite) contribute 0 military weight. `GameState.research` is a flat `Record<ResearchId, number>`.

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

  it('counts economy from mine levels across all planets', () => {
    const state = createNewGameState();
    state.planets[0].buildings.metalMine = 5;
    state.planets[0].buildings.crystalMine = 3;
    state.planets[0].buildings.deuteriumSynthesizer = 2;
    const scores = computePlayerScores(state);
    // economy = sum of metalMine+crystalMine+deutSynth+solarPlant+fusionReactor across planets
    expect(scores.economy).toBe(10);
  });

  it('counts research from all research levels', () => {
    const state = createNewGameState();
    state.research.weaponsTechnology = 3;
    state.research.shieldingTechnology = 2;
    const scores = computePlayerScores(state);
    expect(scores.research).toBe(5);
  });

  it('counts military from ship weaponPower * count across all planets', () => {
    const state = createNewGameState();
    // lightFighter weaponPower = 50
    state.planets[0].ships.lightFighter = 10;
    const scores = computePlayerScores(state);
    expect(scores.military).toBe(50 * 10);
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

**Step 3: Implement**

```ts
// src/engine/ScoreEngine.ts
import type { GameState } from '../models/GameState.ts';
import { SHIPS } from '../data/ships.ts';

export interface PlayerScores {
  military: number;
  economy: number;
  research: number;
  total: number;
}

const NON_COMBAT_SHIPS = new Set([
  'recycler', 'espionageProbe', 'colonyShip', 'smallCargo', 'largeCargo', 'solarSatellite',
]);

export function computePlayerScores(state: GameState): PlayerScores {
  let military = 0;
  let economy = 0;

  for (const planet of state.planets) {
    // Economy: productive buildings
    economy +=
      (planet.buildings.metalMine ?? 0) +
      (planet.buildings.crystalMine ?? 0) +
      (planet.buildings.deuteriumSynthesizer ?? 0) +
      (planet.buildings.solarPlant ?? 0) +
      (planet.buildings.fusionReactor ?? 0);

    // Military: combat ships weighted by weaponPower
    for (const [shipId, count] of Object.entries(planet.ships)) {
      if (NON_COMBAT_SHIPS.has(shipId) || !count || count <= 0) continue;
      const def = SHIPS[shipId as keyof typeof SHIPS];
      if (def) {
        military += def.weaponPower * count;
      }
    }
  }

  const research = Object.values(state.research).reduce((sum, lvl) => sum + (lvl ?? 0), 0);
  const total = military * 2 + economy * 5 + research * 3;

  return { military, economy, research, total };
}
```

**Step 4: Run to verify pass**

```bash
cd C:/dev/repos/StarForge && npx vitest run src/engine/__tests__/ScoreEngine.test.ts
```

Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
cd C:/dev/repos/StarForge
git add src/engine/ScoreEngine.ts src/engine/__tests__/ScoreEngine.test.ts
git commit -m "feat(score): add ScoreEngine with computePlayerScores pure function"
```

---

## Task 2: Add PlayerScores to GameState (model + migration)

**Files:**
- Modify: `src/models/GameState.ts`
- Modify: `src/models/types.ts` (STATE_VERSION bump)
- Modify: `src/engine/StateManager.ts` (v12→v13 migration)

**Context:** `GAME_CONSTANTS.STATE_VERSION` is in `src/models/types.ts` line ~117. Migration block pattern is `if (state.version < N) { ... state.version = N; }` in the `migrate()` function in `StateManager.ts` around line 343.

**Step 1: Write failing test**

Add to `src/engine/__tests__/ScoreEngine.test.ts`:

```ts
import { loadState, saveState } from '../StateManager';

it('migration v12->v13 adds playerScores with zeros', () => {
  const raw = JSON.stringify({
    ...createNewGameState(),
    version: 12,
    // no playerScores field
  });
  localStorage.setItem('starforge_save', raw);
  const loaded = loadState();
  expect(loaded?.playerScores).toEqual({ military: 0, economy: 0, research: 0, total: 0 });
});
```

**Step 2: Run to verify fail**

```bash
cd C:/dev/repos/StarForge && npx vitest run src/engine/__tests__/ScoreEngine.test.ts
```

Expected: FAIL — `playerScores` is undefined.

**Step 3: Implement**

In `src/models/GameState.ts`, add import and field:
```ts
import type { PlayerScores } from '../engine/ScoreEngine.ts';

export interface GameState {
  // ... existing fields ...
  playerScores: PlayerScores;
}
```

In `createNewGameState()`, add:
```ts
playerScores: { military: 0, economy: 0, research: 0, total: 0 },
```

In `src/models/types.ts`, change:
```ts
STATE_VERSION: 13,
```

In `src/engine/StateManager.ts`, add after the `v < 12` block:
```ts
if (state.version < 13) {
  (legacyState as Record<string, unknown>).playerScores = {
    military: 0, economy: 0, research: 0, total: 0,
  };
  state.version = 13;
}
```

**Step 4: Run to verify pass**

```bash
cd C:/dev/repos/StarForge && npx vitest run src/engine/__tests__/ScoreEngine.test.ts
```

**Step 5: Run full suite to check nothing regressed**

```bash
cd C:/dev/repos/StarForge && npm test
```

Expected: All tests pass (migration tests cover new field).

**Step 6: Commit**

```bash
cd C:/dev/repos/StarForge
git add src/models/GameState.ts src/models/types.ts src/engine/StateManager.ts src/engine/__tests__/ScoreEngine.test.ts
git commit -m "feat(score): add playerScores to GameState, state v12->v13 migration"
```

---

## Task 3: Update playerScores each game tick

**Files:**
- Modify: `src/hooks/useGameEngine.ts`

**Context:** `useGameEngine.ts` is the game loop. Search for `processNPCUpgrades` — it's called inside the rAF tick. Import `computePlayerScores` from `ScoreEngine` and call it once per tick, writing the result into `state.playerScores`.

**Step 1: Write failing test**

Add to `src/engine/__tests__/ScoreEngine.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderWithGame } from '../../test/test-utils';
import { screen, act } from '@testing-library/react';

// Simple smoke test: scores object exists on state after a tick
it('playerScores is present on state from context', async () => {
  const { getGameState } = renderWithGame();
  // Scores are computed immediately on mount
  const state = getGameState();
  expect(state.playerScores).toBeDefined();
  expect(typeof state.playerScores.total).toBe('number');
});
```

**Step 2: Run to verify fail**

```bash
cd C:/dev/repos/StarForge && npx vitest run src/engine/__tests__/ScoreEngine.test.ts
```

Expected: FAIL — `getGameState` helper or `playerScores` missing from context.

**Step 3: Implement**

In `src/hooks/useGameEngine.ts`, add import near top:
```ts
import { computePlayerScores } from '../engine/ScoreEngine.ts';
```

Find the tick function (look for `processNPCUpgrades(state, now)` call). Directly after that call, add:
```ts
state.playerScores = computePlayerScores(state);
```

**Step 4: Run to verify pass**

```bash
cd C:/dev/repos/StarForge && npm test
```

Expected: All tests pass.

**Step 5: Commit**

```bash
cd C:/dev/repos/StarForge
git add src/hooks/useGameEngine.ts
git commit -m "feat(score): compute playerScores every tick in game loop"
```

---

## Task 4: Add targetTier + catchUpUpgradeIntervalMs to NPCColony

**Files:**
- Modify: `src/models/Galaxy.ts`
- Modify: `src/engine/StateManager.ts` (migration already at v13 — add fields there)
- Modify: `src/engine/GalaxyEngine.ts` (set defaults when creating colonies)

**Context:** `NPCColony` interface is in `src/models/Galaxy.ts`. `generateNPCColonies` in `GalaxyEngine.ts` is where new colonies are constructed (pushes to `colonies` array). Migration v12→v13 already added; add these fields to the same block.

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
});
```

**Step 2: Run to verify fail**

```bash
cd C:/dev/repos/StarForge && npx vitest run src/engine/__tests__/NPCScaling.test.ts
```

Expected: FAIL — `targetTier` does not exist on colony.

**Step 3: Implement**

In `src/models/Galaxy.ts`, add two fields to `NPCColony`:
```ts
targetTier: number;
catchUpUpgradeIntervalMs: number;
```

In `src/engine/GalaxyEngine.ts`, in the `generateNPCColonies` function, add to the `colonies.push({...})` object:
```ts
targetTier: tier,
catchUpUpgradeIntervalMs: intervalMs / 4,
```

In `src/engine/StateManager.ts`, in the v12→v13 migration block, add after setting `playerScores`:
```ts
for (const colony of (legacyState.galaxy?.npcColonies ?? [])) {
  if ((colony as Record<string, unknown>).targetTier === undefined) {
    (colony as Record<string, unknown>).targetTier = colony.tier;
  }
  if ((colony as Record<string, unknown>).catchUpUpgradeIntervalMs === undefined) {
    (colony as Record<string, unknown>).catchUpUpgradeIntervalMs =
      colony.initialUpgradeIntervalMs / 4;
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
git add src/models/Galaxy.ts src/engine/GalaxyEngine.ts src/engine/StateManager.ts src/engine/__tests__/NPCScaling.test.ts
git commit -m "feat(npc): add targetTier and catchUpUpgradeIntervalMs to NPCColony"
```

---

## Task 5: NPC catch-up upgrade logic in NPCUpgradeEngine

**Files:**
- Modify: `src/engine/NPCUpgradeEngine.ts`
- Modify: `src/engine/__tests__/NPCScaling.test.ts`

**Context:** `processUpgrades(state, now)` in `NPCUpgradeEngine.ts` (lines 297–349) contains the main upgrade loop. The current interval used is `colony.currentUpgradeIntervalMs`. We need to: (1) check if `colony.tier < colony.targetTier` and if so use `catchUpUpgradeIntervalMs`; (2) after an upgrade tick, if stats have grown enough, increment `colony.tier` toward `targetTier`. The tier increment logic: after every 5 upgrade ticks while in catch-up mode, bump `colony.tier` by 1 (capped at `targetTier`).

The constant `TIER_POWER_THRESHOLD = 500` and `effectiveMinTier` computation live in this file as a new exported helper called from the game tick.

**Step 1: Write failing tests**

Add to `src/engine/__tests__/NPCScaling.test.ts`:

```ts
import { processUpgrades } from '../NPCUpgradeEngine';
import { createNewGameState } from '../../models/GameState';

describe('catch-up upgrade mode', () => {
  it('uses catchUpUpgradeIntervalMs when tier < targetTier', () => {
    const state = createNewGameState();
    const colony = state.galaxy.npcColonies[0];
    if (!colony) return;

    colony.tier = 1;
    colony.targetTier = 3;
    colony.catchUpUpgradeIntervalMs = 1000;
    colony.currentUpgradeIntervalMs = 10_000;
    colony.lastUpgradeAt = 0;
    colony.upgradeTickCount = 0;

    // Advance by enough time to trigger one catch-up tick (1s real = 1000ms interval)
    const now = colony.lastUpgradeAt + 1001; // > catchUpInterval / gameSpeed(1)
    processUpgrades(state, now);

    expect(colony.upgradeTickCount).toBeGreaterThan(0);
  });

  it('increments colony.tier every 5 catch-up ticks toward targetTier', () => {
    const state = createNewGameState();
    const colony = state.galaxy.npcColonies[0];
    if (!colony) return;

    colony.tier = 1;
    colony.targetTier = 3;
    colony.catchUpUpgradeIntervalMs = 100;
    colony.currentUpgradeIntervalMs = 10_000;
    colony.lastUpgradeAt = 0;
    colony.upgradeTickCount = 0;
    colony.abandonedAt = undefined;

    // Enough time for 10 ticks
    processUpgrades(state, 1100);

    expect(colony.tier).toBeGreaterThan(1);
    expect(colony.tier).toBeLessThanOrEqual(3);
  });

  it('does not exceed targetTier', () => {
    const state = createNewGameState();
    const colony = state.galaxy.npcColonies[0];
    if (!colony) return;

    colony.tier = 2;
    colony.targetTier = 3;
    colony.catchUpUpgradeIntervalMs = 1;
    colony.currentUpgradeIntervalMs = 10_000;
    colony.lastUpgradeAt = 0;
    colony.upgradeTickCount = 0;
    colony.abandonedAt = undefined;

    processUpgrades(state, 10_000);

    expect(colony.tier).toBeLessThanOrEqual(3);
  });
});

describe('computeEffectiveMinTier', () => {
  it('returns 1 for zero player total score', () => {
    const { computeEffectiveMinTier } = await import('../NPCUpgradeEngine');
    expect(computeEffectiveMinTier(0)).toBe(1);
  });

  it('returns higher tiers as score grows', () => {
    const { computeEffectiveMinTier } = await import('../NPCUpgradeEngine');
    expect(computeEffectiveMinTier(500)).toBeGreaterThanOrEqual(2);
    expect(computeEffectiveMinTier(5000)).toBeGreaterThanOrEqual(10);
  });
});
```

**Step 2: Run to verify fail**

```bash
cd C:/dev/repos/StarForge && npx vitest run src/engine/__tests__/NPCScaling.test.ts
```

**Step 3: Implement**

In `src/engine/NPCUpgradeEngine.ts`, add at the top of the file (after imports):
```ts
const TIER_POWER_THRESHOLD = 500;
const CATCH_UP_TICKS_PER_TIER = 5;

export function computeEffectiveMinTier(playerTotal: number): number {
  return Math.max(1, Math.min(10, Math.floor(playerTotal / TIER_POWER_THRESHOLD)));
}
```

In `processUpgrades(state, now)`, replace the inner while-loop interval check. The relevant section currently reads:
```ts
(now - colony.lastUpgradeAt) * safeGameSpeed >= colony.currentUpgradeIntervalMs &&
```

Change to:
```ts
const isCatchingUp = colony.tier < colony.targetTier;
const activeInterval = isCatchingUp
  ? colony.catchUpUpgradeIntervalMs
  : colony.currentUpgradeIntervalMs;
```

And in the condition use `activeInterval`:
```ts
(now - colony.lastUpgradeAt) * safeGameSpeed >= activeInterval &&
```

And in the `lastUpgradeAt` increment:
```ts
colony.lastUpgradeAt += activeInterval / safeGameSpeed;
```

After `colony.upgradeTickCount += 1;`, add the tier increment logic:
```ts
if (colony.tier < colony.targetTier && colony.upgradeTickCount % CATCH_UP_TICKS_PER_TIER === 0) {
  colony.tier = Math.min(colony.targetTier, colony.tier + 1);
}
```

**Also** add the call to update `targetTier` for all colonies at the top of `processUpgrades`, before the colony loop:

```ts
const effectiveMin = computeEffectiveMinTier(state.playerScores?.total ?? 0);
for (const col of state.galaxy.npcColonies) {
  if (effectiveMin > col.targetTier && col.targetTier < col.maxTier) {
    col.targetTier = Math.min(col.maxTier, effectiveMin);
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
git commit -m "feat(npc): catch-up upgrade mode driven by player power score"
```

---

## Task 6: Relative strength labels in GalaxyPanel

**Files:**
- Modify: `src/panels/GalaxyPanel.tsx`

**Context:** `npcStrengthLabel(tier)` is at line 17. Replace it with a function that takes `npcPower` and `playerMilitary` and returns a relative label. NPC power is computed from `npc.currentShips` using the same `SHIP_MILITARY_WEIGHT` logic (use `SHIPS[id]?.weaponPower`). Import `SHIPS` which is already imported at line 8.

**Step 1: Write failing test**

```ts
// src/panels/__tests__/GalaxyPanel.test.ts (add to existing or create)
import { npcRelativeStrengthLabel } from '../GalaxyPanel'; // will need to export for test

// If you can't export from panel file, test via rendered output instead.
// Export the helper function by adding `export` keyword to it.
describe('npcRelativeStrengthLabel', () => {
  it('returns Easy when npc power < 30% of player', () => {
    expect(npcRelativeStrengthLabel(10, 100)).toBe('Easy');
  });
  it('returns Fair when ratio is 0.3–0.7', () => {
    expect(npcRelativeStrengthLabel(50, 100)).toBe('Fair');
  });
  it('returns Even when ratio is 0.7–1.3', () => {
    expect(npcRelativeStrengthLabel(100, 100)).toBe('Even');
  });
  it('returns Hard when ratio is 1.3–2.5', () => {
    expect(npcRelativeStrengthLabel(200, 100)).toBe('Hard');
  });
  it('returns Dangerous when ratio > 2.5', () => {
    expect(npcRelativeStrengthLabel(300, 100)).toBe('Dangerous');
  });
  it('returns Easy when playerMilitary is 0', () => {
    expect(npcRelativeStrengthLabel(0, 0)).toBe('Easy');
  });
});
```

**Step 2: Run to verify fail**

```bash
cd C:/dev/repos/StarForge && npx vitest run src/panels/__tests__/GalaxyPanel.test.ts
```

**Step 3: Implement**

In `src/panels/GalaxyPanel.tsx`, replace `npcStrengthLabel` (line 17) with:

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

function calcNPCPower(npc: import('../models/Galaxy.ts').NPCColony): number {
  let power = 0;
  for (const [shipId, count] of Object.entries(npc.currentShips)) {
    if (!count || count <= 0) continue;
    const def = SHIPS[shipId as keyof typeof SHIPS];
    if (def) power += def.weaponPower * count;
  }
  return power;
}
```

Find every usage of `npcStrengthLabel(colony.tier)` in the JSX and replace with:
```ts
npcRelativeStrengthLabel(calcNPCPower(colony), gameState.playerScores.military)
```

Pull `gameState` from `useGame()` (it's already destructured in this component).

**Step 4: Run to verify pass**

```bash
cd C:/dev/repos/StarForge && npm test
```

**Step 5: Commit**

```bash
cd C:/dev/repos/StarForge
git add src/panels/GalaxyPanel.tsx src/panels/__tests__/GalaxyPanel.test.ts
git commit -m "feat(npc): relative strength labels based on player military score"
```

---

## Task 7: galaxyJumpTarget in GameContext

**Files:**
- Modify: `src/context/GameContext.tsx`
- Modify: `src/hooks/useGameEngine.ts`

**Context:** `GameContextType` interface is at line 16. `useGameEngine` exposes everything; add `galaxyJumpTarget` and `setGalaxyJumpTarget` as simple `useState` values in the hook, exposed through context.

**Step 1: Write failing test**

```ts
// src/context/__tests__/GameContext.test.ts (or add to existing)
import { renderWithGame } from '../../test/test-utils';
import { useGame } from '../GameContext';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';

it('galaxyJumpTarget starts null and can be set', async () => {
  const { result } = renderHook(() => useGame(), {
    wrapper: ({ children }) => {
      const { GameProvider } = require('../GameContext');
      return React.createElement(GameProvider, null, children);
    },
  });
  expect(result.current.galaxyJumpTarget).toBeNull();
  act(() => {
    result.current.setGalaxyJumpTarget({ galaxy: 1, system: 5, slot: 3 });
  });
  await waitFor(() => {
    expect(result.current.galaxyJumpTarget).toEqual({ galaxy: 1, system: 5, slot: 3 });
  });
});
```

**Step 2: Run to verify fail**

```bash
cd C:/dev/repos/StarForge && npx vitest run src/context/__tests__/GameContext.test.ts
```

**Step 3: Implement**

In `src/context/GameContext.tsx`, add to `GameContextType`:
```ts
galaxyJumpTarget: Coordinates | null;
setGalaxyJumpTarget: (coords: Coordinates | null) => void;
```

In `src/hooks/useGameEngine.ts`, add near other `useState` declarations:
```ts
const [galaxyJumpTarget, setGalaxyJumpTarget] = useState<Coordinates | null>(null);
```

Expose it in the returned object from `useGameEngine`:
```ts
galaxyJumpTarget,
setGalaxyJumpTarget,
```

In `src/context/GameContext.tsx`, destructure in the provider and pass through (mirrors the existing pattern for `fleetTarget`/`setFleetTarget`).

**Step 4: Run to verify pass**

```bash
cd C:/dev/repos/StarForge && npm test
```

**Step 5: Commit**

```bash
cd C:/dev/repos/StarForge
git add src/context/GameContext.tsx src/hooks/useGameEngine.ts
git commit -m "feat(nav): add galaxyJumpTarget to GameContext"
```

---

## Task 8: Clickable coordinates in MessagesPanel

**Files:**
- Modify: `src/panels/MessagesPanel.tsx`

**Context:** Coordinates are currently rendered as plain text strings using `formatCoords()` in three places: line 127 (combat title), line 174 (espionage title), line 240 (fleet notification). We need a `CoordLink` component that renders as a `<button>` and calls `setGalaxyJumpTarget` + `setActivePanel('galaxy')` on click.

`useGame()` is already imported. `setActivePanel` is passed as a prop — check the panel signature to see how it receives it (look at the component export and how it's used in App.tsx or the main panel router).

**Step 1: Check the panel props pattern**

Read `src/App.tsx` or the panel router to confirm how `setActivePanel` is passed to panels. Then update the plan accordingly: add `setActivePanel` as a prop to `MessagesPanel` if not already there, or confirm it's accessible via context.

**Step 2: Write failing test**

```ts
// src/panels/__tests__/MessagesPanel.test.ts (or add to existing)
import { render, screen, fireEvent } from '@testing-library/react';
import { renderWithGame } from '../../test/test-utils';

it('clicking a coordinate link in a combat report sets galaxy jump target', async () => {
  // This is an integration test - render with a game state that has a combat log entry
  // and verify clicking the coord triggers navigation context change.
  // Implementation: use renderWithGame() and check that setGalaxyJumpTarget is called.
  // Minimal test: coord-link button exists and is clickable.
  const { container } = renderWithGame(<MessagesPanel setActivePanel={() => {}} />, {
    withCombatLog: true,
  });
  const coordLinks = container.querySelectorAll('.coord-link');
  expect(coordLinks.length).toBeGreaterThan(0);
});
```

**Step 3: Implement**

At the top of `MessagesPanel.tsx` add import:
```ts
import { useGame } from '../context/GameContext.tsx';
import type { ActivePanel } from '../models/types.ts';
```

Add `setActivePanel` prop to `MessagesPanel`:
```ts
export function MessagesPanel({ setActivePanel }: { setActivePanel: (p: ActivePanel) => void }) {
```

Add `CoordLink` component inside the file (above `MessagesPanel`):
```ts
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

Replace every `[${formatCoords(...)}]` string occurrence in JSX titles and bodies with `<CoordLink coords={...} setActivePanel={setActivePanel} />`.

**Step 4: Run to verify pass**

```bash
cd C:/dev/repos/StarForge && npm test
```

**Step 5: Commit**

```bash
cd C:/dev/repos/StarForge
git add src/panels/MessagesPanel.tsx
git commit -m "feat(nav): clickable coordinates in MessagesPanel navigate to galaxy map"
```

---

## Task 9: Manual coordinate entry in GalaxyPanel

**Files:**
- Modify: `src/panels/GalaxyPanel.tsx`

**Context:** The galaxy panel currently has a system navigator (look for system selection state in the component). We need a `Jump to:` text input at the top. The panel renders systems 1–`GALAXY_CONSTANTS.MAX_SYSTEMS`. The existing selected system state is likely `selectedSystem` or similar — check the component.

**Step 1: Locate current system navigation state**

Read `src/panels/GalaxyPanel.tsx` lines 150–250 to find the system state variable and how it's set. Then add a controlled input that parses `"5"` or `"1:5"` and calls the existing setter.

**Step 2: Implement** (no separate test needed — input is pure UI state)

Add `jumpInput` state:
```ts
const [jumpInput, setJumpInput] = useState('');
const [jumpError, setJumpError] = useState('');
```

Add `handleJump` function:
```ts
function handleJump() {
  const trimmed = jumpInput.trim();
  const parts = trimmed.split(':').map(Number);
  const system = parts.length === 2 ? parts[1] : parts[0];
  if (!system || isNaN(system) || system < 1 || system > GALAXY_CONSTANTS.MAX_SYSTEMS) {
    setJumpError(`System must be 1–${GALAXY_CONSTANTS.MAX_SYSTEMS}`);
    setTimeout(() => setJumpError(''), 2000);
    return;
  }
  setSelectedSystem(system); // use the existing system state setter
  setJumpError('');
  setJumpInput('');
}
```

Add JSX at the top of the panel (before the system list or grid):
```tsx
<div className="galaxy-jump-input">
  <label>Jump to:</label>
  <input
    type="text"
    placeholder="System (e.g. 5 or 1:5)"
    value={jumpInput}
    onChange={(e) => setJumpInput(e.target.value)}
    onKeyDown={(e) => e.key === 'Enter' && handleJump()}
  />
  <button type="button" onClick={handleJump}>Go</button>
  {jumpError && <span className="galaxy-jump-error">{jumpError}</span>}
</div>
```

**Step 3: Handle galaxyJumpTarget from context**

At the top of `GalaxyPanel`, read `galaxyJumpTarget` and `setGalaxyJumpTarget` from `useGame()`. Add a `useEffect`:

```ts
useEffect(() => {
  if (galaxyJumpTarget) {
    setSelectedSystem(galaxyJumpTarget.system);
    setGalaxyJumpTarget(null);
  }
}, [galaxyJumpTarget, setGalaxyJumpTarget]);
```

**Step 4: Run full suite**

```bash
cd C:/dev/repos/StarForge && npm test
```

**Step 5: Commit**

```bash
cd C:/dev/repos/StarForge
git add src/panels/GalaxyPanel.tsx
git commit -m "feat(nav): manual coordinate entry and jump-target navigation in GalaxyPanel"
```

---

## Task 10: Metal, Crystal, Deuterium hover tooltips in ResourceBar

**Files:**
- Modify: `src/components/ResourceBar.tsx`

**Context:** The energy hover pattern (lines 14–198 in `ResourceBar.tsx`) is the exact template to follow. Each resource entry `<div className="resource-entry">` gets wrapped with `ref`, `onMouseEnter`, `onMouseLeave`, and a `<HoverPortal>` child. The formulas to use are already imported: `metalProductionPerHour`, `crystalProductionPerHour`, `deuteriumProductionPerHour`. The `energyFactor` (efficiency ratio) can be computed as `Math.min(1, energyProduction / energyConsumption)` — already available from `productionRates`.

**Step 1: Write failing test**

```ts
// src/components/__tests__/ResourceBar.test.ts (or add to existing)
import { renderWithGame } from '../../test/test-utils';
import { screen, fireEvent } from '@testing-library/react';
import { ResourceBar } from '../ResourceBar';

it('hovering Metal shows mine level in tooltip', async () => {
  const { container } = renderWithGame(<ResourceBar />);
  const metalEntry = container.querySelector('.resource-entry--metal');
  expect(metalEntry).not.toBeNull();
  fireEvent.mouseEnter(metalEntry!);
  expect(await screen.findByText(/Metal Mine/)).toBeInTheDocument();
});
```

**Step 2: Run to verify fail**

```bash
cd C:/dev/repos/StarForge && npx vitest run src/components/__tests__/ResourceBar.test.ts
```

**Step 3: Implement**

Add three new refs and hover states near the existing `energyRef`:
```ts
const metalRef = useRef<HTMLDivElement>(null);
const crystalRef = useRef<HTMLDivElement>(null);
const deuteriumRef = useRef<HTMLDivElement>(null);
const [metalHovered, setMetalHovered] = useState(false);
const [crystalHovered, setCrystalHovered] = useState(false);
const [deuteriumHovered, setDeuteriumHovered] = useState(false);
```

Add generic open/close helpers (or reuse the existing timer pattern with separate timer refs per resource). The cleanest approach: create a `useHover(delay)` helper inline returning `{ hovered, openHover, scheduleHoverClose }`.

Add computed values:
```ts
const efficiencyPct = productionRates.energyConsumption > 0
  ? Math.min(100, Math.round((productionRates.energyProduction / productionRates.energyConsumption) * 100))
  : 100;
const energyPenalised = efficiencyPct < 100;
const metalMineLevel = buildings.metalMine ?? 0;
const crystalMineLevel = buildings.crystalMine ?? 0;
const deutMineLevel = buildings.deuteriumSynthesizer ?? 0;
const tempModifierPct = Number.isFinite(planet.maxTemperature)
  ? Math.round((-0.002 * planet.maxTemperature + 1.28) * 100) - 100
  : 0;
```

Wrap the Metal `<div className="resource-entry">` with `ref={metalRef}`, `onMouseEnter` / `onMouseLeave`, and add:
```tsx
<HoverPortal
  anchorRef={metalRef}
  open={metalHovered}
  align="below-right"
  className="energy-hover-panel"
  onMouseEnter={() => setMetalHovered(true)}
  onMouseLeave={() => setMetalHovered(false)}
>
  <div className="resource-label">Metal Mine (Lv {metalMineLevel})</div>
  <div className="energy-hover-row">
    <span>Production</span>
    <span className="number">{formatRate(productionRates.metalPerHour * speed)}/hr</span>
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

Repeat the same pattern for Crystal (crystal mine level, crystalPerHour) and Deuterium (deut synth level, deuteriumPerHour, add temperature modifier row).

Also add `className="resource-entry--metal"` / `--crystal` / `--deuterium` to the respective resource entry divs (used by the test selector).

**Step 4: Run to verify pass**

```bash
cd C:/dev/repos/StarForge && npm test
```

**Step 5: Commit**

```bash
cd C:/dev/repos/StarForge
git add src/components/ResourceBar.tsx src/components/__tests__/ResourceBar.test.ts
git commit -m "feat(ui): hover tooltips for Metal, Crystal, Deuterium in ResourceBar"
```

---

## Task 11: Final verification

```bash
cd C:/dev/repos/StarForge
npm run build
npm test
```

Both must pass with 0 errors before the branch is ready for PR.

If `npm run build` surfaces TypeScript errors, fix them before moving on.

**Commit any final fixes, then the branch is ready.**
