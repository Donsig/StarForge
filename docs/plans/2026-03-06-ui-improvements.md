# UI Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Max build button, queue item durations, level-aware upgrade buttons, and fleet cargo helper to improve build/dispatch UX.

**Architecture:** Pure UI changes — no new engine logic. Panels read existing `QueueItem` data and ship/resource data from `GameState`. Fleet cargo helper reads from `espionageReports` context + `gameState.galaxy.npcColonies`.

**Tech Stack:** React 19, TypeScript strict, vitest + @testing-library/react

---

## Key Files Reference

- `src/panels/ShipyardPanel.tsx` — ship build cards with qty input
- `src/panels/DefencePanel.tsx` — defence build cards with qty input
- `src/components/QueueDisplay.tsx` — footer bar showing all active queues
- `src/panels/BuildingsPanel.tsx` — building upgrade cards
- `src/panels/ResearchPanel.tsx` — research upgrade cards
- `src/panels/FleetPanel.tsx` — fleet dispatch form (~800 lines)
- `src/models/types.ts` — `QueueItem` interface (startedAt, completesAt, quantity, completed, targetLevel)
- `src/data/ships.ts` — `SHIPS.smallCargo.cargoCapacity = 5000`, `SHIPS.largeCargo.cargoCapacity = 25000`
- `src/engine/GalaxyEngine.ts` — `getNPCResources(colony, now, gameSpeed)` returns stockpiled resources
- `src/utils/time.ts` — `formatDuration(seconds: number): string`
- `src/test/test-utils.tsx` — `renderWithGame(component, options)` for all panel tests

## Context: How Queue Items Work

`QueueItem` (types.ts):
- `startedAt`: timestamp when item begins
- `completesAt`: timestamp when item completes (for ships/defences: when the CURRENT unit completes; each unit takes `completesAt - startedAt` ms)
- `quantity`: total units in batch (ships/defences only)
- `completed`: units finished so far (ships/defences only)
- `targetLevel`: for buildings/research

So:
- Building/research duration = `completesAt - startedAt` ms
- Ship/defence batch total = `(completesAt - startedAt) * quantity` ms (since completesAt is per-unit)

---

## Task 1: Max button — Shipyard

**Files:**
- Modify: `src/panels/ShipyardPanel.tsx`
- Test: `src/panels/__tests__/ShipyardPanel.test.tsx`

### Step 1: Write the failing test

Add to `src/panels/__tests__/ShipyardPanel.test.tsx`:

```tsx
it('Max button sets quantity to max affordable count', async () => {
  const user = userEvent.setup();

  renderWithGame(<ShipyardPanel />, {
    gameState: {
      planet: {
        buildings: { shipyard: 2 },
        resources: { metal: 6000, crystal: 2000, deuterium: 0 },
      },
      research: { combustionDrive: 2 },
    },
  });

  // Small Cargo costs 2000M / 2000C / 0D each (requires shipyard 2, combustionDrive 2)
  // With 6000M / 2000C → max = floor(min(6000/2000, 2000/2000)) = 1
  const card = screen.getByRole('heading', { name: 'Small Cargo', level: 3 }).closest('article')!;
  const maxButton = within(card).getByRole('button', { name: 'Max' });
  await user.click(maxButton);

  expect(within(card).getByRole('spinbutton')).toHaveValue(1);
});
```

### Step 2: Run test to verify it fails

```bash
npx vitest run src/panels/__tests__/ShipyardPanel.test.tsx
```
Expected: FAIL — "Unable to find role 'button' with name 'Max'"

### Step 3: Add Max button to ShipyardPanel

In `src/panels/ShipyardPanel.tsx`, replace the `item-meta` block containing `quantity-input` with:

```tsx
<div className="item-meta">
  <span className="label">Batch Quantity</span>
  <div className="qty-input-group">
    <input
      className="input quantity-input number"
      type="number"
      min={1}
      step={1}
      value={quantityInput}
      onChange={(event) => {
        setQuantities((current) => ({
          ...current,
          [shipId]: event.target.value,
        }));
      }}
    />
    <button
      type="button"
      className="btn btn-sm"
      onClick={() => {
        const { metal, crystal, deuterium } = planet.resources;
        const { cost } = definition;
        const limits: number[] = [];
        if (cost.metal > 0) limits.push(Math.floor(metal / cost.metal));
        if (cost.crystal > 0) limits.push(Math.floor(crystal / cost.crystal));
        if (cost.deuterium > 0) limits.push(Math.floor(deuterium / cost.deuterium));
        const max = limits.length > 0 ? Math.max(0, Math.min(...limits)) : 0;
        setQuantities((current) => ({ ...current, [shipId]: String(max) }));
      }}
    >
      Max
    </button>
  </div>
</div>
```

Also add to `src/styles.css`:
```css
.qty-input-group {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
```

### Step 4: Run test to verify it passes

```bash
npx vitest run src/panels/__tests__/ShipyardPanel.test.tsx
```
Expected: PASS

### Step 5: Commit

```bash
git add src/panels/ShipyardPanel.tsx src/panels/__tests__/ShipyardPanel.test.tsx src/styles.css
git commit -m "feat(shipyard): add Max button to set quantity to max affordable"
```

---

## Task 2: Max button — Defence

**Files:**
- Modify: `src/panels/DefencePanel.tsx`
- Test: `src/panels/__tests__/DefencePanel.test.tsx`

### Step 1: Write the failing test

Check the existing test file to find the right helper pattern. Add to `src/panels/__tests__/DefencePanel.test.tsx`:

```tsx
it('Max button sets quantity to max affordable count', async () => {
  const user = userEvent.setup();

  renderWithGame(<DefencePanel />, {
    gameState: {
      planet: {
        buildings: { shipyard: 1 },
        resources: { metal: 24000, crystal: 8000, deuterium: 0 },
      },
    },
  });

  // Rocket Launcher costs 2000M / 0C / 0D — so max = floor(24000/2000) = 12
  const heading = screen.getByRole('heading', { name: 'Rocket Launcher', level: 3 });
  const card = heading.closest('article')!;
  await user.click(within(card).getByRole('button', { name: 'Max' }));

  expect(within(card).getByRole('spinbutton')).toHaveValue(12);
});

it('Max button caps at remainingMax for limited defences', async () => {
  const user = userEvent.setup();

  renderWithGame(<DefencePanel />, {
    gameState: {
      planet: {
        buildings: { shipyard: 2 },
        resources: { metal: 10_000_000, crystal: 10_000_000, deuterium: 10_000_000 },
      },
      research: { shieldingTechnology: 2 },
    },
  });

  // Small Shield Dome has maxCount: 1 and requires shieldingTechnology 2 — so max affordable but capped at 1
  // (do NOT pass defences: { smallShieldDome: 0 } — defences is not partial in renderWithGame)
  const heading = screen.getByRole('heading', { name: 'Small Shield Dome', level: 3 });
  const card = heading.closest('article')!;
  await user.click(within(card).getByRole('button', { name: 'Max' }));

  expect(within(card).getByRole('spinbutton')).toHaveValue(1);
});
```

### Step 2: Run test to verify it fails

```bash
npx vitest run src/panels/__tests__/DefencePanel.test.tsx
```
Expected: FAIL

### Step 3: Add Max button to DefencePanel

In `src/panels/DefencePanel.tsx`, replace the `item-meta` block containing `quantity-input` with:

```tsx
<div className="item-meta">
  <span className="label">Batch Quantity</span>
  <div className="qty-input-group">
    <input
      className="input quantity-input number"
      type="number"
      min={1}
      step={1}
      max={remainingMax ?? undefined}
      value={quantityInput}
      disabled={maxReached}
      onChange={(event) => {
        setQuantities((current) => ({
          ...current,
          [defenceId]: event.target.value,
        }));
      }}
    />
    <button
      type="button"
      className="btn btn-sm"
      disabled={maxReached}
      onClick={() => {
        const { metal, crystal, deuterium } = planet.resources;
        const { cost } = definition;
        const limits: number[] = [];
        if (cost.metal > 0) limits.push(Math.floor(metal / cost.metal));
        if (cost.crystal > 0) limits.push(Math.floor(crystal / cost.crystal));
        if (cost.deuterium > 0) limits.push(Math.floor(deuterium / cost.deuterium));
        let max = limits.length > 0 ? Math.max(0, Math.min(...limits)) : 0;
        if (remainingMax !== null) max = Math.min(max, remainingMax);
        setQuantities((current) => ({ ...current, [defenceId]: String(max) }));
      }}
    >
      Max
    </button>
  </div>
</div>
```

### Step 4: Run tests to verify they pass

```bash
npx vitest run src/panels/__tests__/DefencePanel.test.tsx
```
Expected: PASS

### Step 5: Commit

```bash
git add src/panels/DefencePanel.tsx src/panels/__tests__/DefencePanel.test.tsx
git commit -m "feat(defence): add Max button to set quantity to max affordable"
```

---

## Task 3: Queue item durations in QueueDisplay

**Files:**
- Modify: `src/components/QueueDisplay.tsx`
- Test: `src/components/__tests__/QueueDisplay.test.tsx`

### Step 1: Write the failing test

Check if `src/components/__tests__/QueueDisplay.test.tsx` exists. If not, create it. Add:

```tsx
/// <reference types="vitest/globals" />
import { QueueDisplay } from '../QueueDisplay';
import { renderWithGame, screen } from '../../test/test-utils';

describe('QueueDisplay', () => {
  it('shows duration for queued (non-active) building items', () => {
    const now = Date.now();
    const oneHourMs = 3600 * 1000;

    renderWithGame(<QueueDisplay />, {
      gameState: {
        planet: {
          buildingQueue: [
            {
              type: 'building',
              id: 'metalMine',
              targetLevel: 2,
              startedAt: now,
              completesAt: now + oneHourMs,
            },
            {
              type: 'building',
              id: 'metalMine',
              targetLevel: 3,
              startedAt: now + oneHourMs,
              completesAt: now + 3 * oneHourMs, // 2h duration
            },
          ],
        },
      },
    });

    // Second item should show "2h" (formatDuration omits zero-padded minutes/seconds)
    expect(screen.getByText('2h')).toBeInTheDocument();
  });

  it('shows duration for queued shipyard batches as total batch time', () => {
    const now = Date.now();
    const perUnitMs = 30 * 60 * 1000; // 30 minutes per unit

    renderWithGame(<QueueDisplay />, {
      gameState: {
        planet: {
          shipyardQueue: [
            {
              type: 'ship',
              id: 'lightFighter',
              quantity: 1,
              completed: 0,
              startedAt: now,
              completesAt: now + perUnitMs,
            },
            {
              type: 'ship',
              id: 'cruiser',
              quantity: 4, // 4 units × 30min = 2h total
              completed: 0,
              startedAt: now + perUnitMs,
              completesAt: now + 2 * perUnitMs,
            },
          ],
        },
      },
    });

    // Second item (4 cruisers × 30min each) should show "2h" (formatDuration omits zero-padded minutes)
    expect(screen.getByText('2h')).toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

```bash
npx vitest run src/components/__tests__/QueueDisplay.test.tsx
```
Expected: FAIL

### Step 3: Update QueueDisplay

In `src/components/QueueDisplay.tsx`:

1. Add `duration?: string` to `QueueRowProps` and render it when countdown is absent:

```tsx
interface QueueRowProps {
  label: string;
  subtitle: string;
  completesAt: number | null;
  duration?: string;
  onCancel?: () => void;
}

function QueueRow({ label, subtitle, completesAt, duration, onCancel }: QueueRowProps) {
  const countdown = useCountdown(completesAt);

  return (
    <div className="queue-item">
      <div className="queue-main">
        <div className="queue-label">{label}</div>
        <div className="queue-subtitle">{subtitle}</div>
      </div>
      {(countdown || duration) && (
        <div className="queue-time number">{countdown ?? duration}</div>
      )}
      {onCancel && (
        <button type="button" className="btn btn-danger" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}
```

2. Add a helper to compute item duration (add after imports):

```tsx
import { formatDuration } from '../utils/time.ts';

function getQueuedItemDuration(item: QueueItem): string {
  const perUnitMs = item.completesAt - item.startedAt;
  if (item.type === 'ship' || item.type === 'defence') {
    return formatDuration((perUnitMs * (item.quantity ?? 1)) / 1000);
  }
  return formatDuration(perUnitMs / 1000);
}
```

3. Pass `duration` for non-active items in all three queue sections:

For building queue:
```tsx
{planet.buildingQueue.map((item, index) => (
  <QueueRow
    key={`b-${item.id}-${item.targetLevel}-${index}`}
    label={`Building: ${BUILDINGS[item.id as BuildingId].name}`}
    subtitle={`Lv ${item.targetLevel ?? 0}${index > 0 ? ' (queued)' : ''}`}
    completesAt={index === 0 ? item.completesAt : null}
    duration={index > 0 ? getQueuedItemDuration(item) : undefined}
    onCancel={() => cancelBuilding(index)}
  />
))}
```

Apply the same `duration={index > 0 ? getQueuedItemDuration(item) : undefined}` pattern to research and shipyard queue rows.

### Step 4: Run tests to verify they pass

```bash
npx vitest run src/components/__tests__/QueueDisplay.test.tsx
```
Expected: PASS

### Step 5: Commit

```bash
git add src/components/QueueDisplay.tsx src/components/__tests__/QueueDisplay.test.tsx
git commit -m "feat(queue): show build duration for queued items"
```

---

## Task 4: Level-aware upgrade button — Buildings

**Files:**
- Modify: `src/panels/BuildingsPanel.tsx`
- Test: `src/panels/__tests__/BuildingsPanel.test.tsx`

### Step 1: Write the failing test

Add to `src/panels/__tests__/BuildingsPanel.test.tsx`:

```tsx
it('upgrade button shows future level accounting for items already in queue', () => {
  renderWithGame(<BuildingsPanel />, {
    gameState: {
      planet: {
        buildings: { metalMine: 5 },
        buildingQueue: [
          {
            type: 'building',
            id: 'metalMine',
            targetLevel: 6,
            startedAt: Date.now(),
            completesAt: Date.now() + 60_000,
          },
          {
            type: 'building',
            id: 'metalMine',
            targetLevel: 7,
            startedAt: Date.now() + 60_000,
            completesAt: Date.now() + 120_000,
          },
        ],
        resources: { metal: 10_000_000, crystal: 10_000_000, deuterium: 10_000_000 },
      },
    },
  });

  // Current level 5, 2 items queued → next queued level is 8
  expect(screen.getByRole('button', { name: 'Queue Lv 8' })).toBeInTheDocument();
});
```

### Step 2: Run test to verify it fails

```bash
npx vitest run src/panels/__tests__/BuildingsPanel.test.tsx
```
Expected: FAIL — finds "Queue Lv 6" instead of "Queue Lv 8"

### Step 3: Update BuildingsPanel

In `src/panels/BuildingsPanel.tsx`, find the building card rendering loop and update `nextLevel` calculation:

```tsx
const currentLevel = planet.buildings[buildingId];
const queuedCount = planet.buildingQueue.filter((q) => q.id === buildingId).length;
const nextLevel = currentLevel + queuedCount + 1;
const cost = buildingCostAtLevel(
  definition.baseCost,
  definition.costMultiplier,
  nextLevel,
);
const timeSeconds = buildingTime(
  cost.metal,
  cost.crystal,
  planet.buildings.roboticsFactory,
  planet.buildings.naniteFactory,
  gameState.settings.gameSpeed,
);
const affordable = canAfford(cost, gameState);
```

The level badge in the card header continues to show `currentLevel` (what's built now). The button label and cost show the next-to-be-queued level.

### Step 4: Run tests to verify they pass

```bash
npx vitest run src/panels/__tests__/BuildingsPanel.test.tsx
```
Expected: PASS

### Step 5: Commit

```bash
git add src/panels/BuildingsPanel.tsx src/panels/__tests__/BuildingsPanel.test.tsx
git commit -m "feat(buildings): upgrade button reflects queue depth for level and cost"
```

---

## Task 5: Level-aware upgrade button — Research

**Files:**
- Modify: `src/panels/ResearchPanel.tsx`
- Test: `src/panels/__tests__/ResearchPanel.test.tsx`

### Step 1: Write the failing test

Add to `src/panels/__tests__/ResearchPanel.test.tsx`:

```tsx
it('research button shows future level accounting for items already in queue', () => {
  renderWithGame(<ResearchPanel />, {
    gameState: {
      research: { energyTechnology: 3 },
      researchQueue: [
        {
          type: 'research',
          id: 'energyTechnology',
          targetLevel: 4,
          sourcePlanetIndex: 0,
          startedAt: Date.now(),
          completesAt: Date.now() + 60_000,
        },
      ],
      planet: {
        buildings: { researchLab: 1 },
        resources: { metal: 10_000_000, crystal: 10_000_000, deuterium: 10_000_000 },
      },
    },
  });

  // Current Lv 3, 1 in queue → next is Lv 5
  expect(screen.getByRole('button', { name: 'Queue Lv 5' })).toBeInTheDocument();
});
```

### Step 2: Run test to verify it fails

```bash
npx vitest run src/panels/__tests__/ResearchPanel.test.tsx
```
Expected: FAIL

### Step 3: Update ResearchPanel

In `src/panels/ResearchPanel.tsx`, update the `nextLevel` calculation:

```tsx
const currentLevel = gameState.research[researchId];
const queuedCount = gameState.researchQueue.filter((q) => q.id === researchId).length;
const nextLevel = currentLevel + queuedCount + 1;
const cost = researchCostAtLevel(
  definition.baseCost,
  definition.costMultiplier,
  nextLevel,
);
const timeSeconds = researchTime(
  cost.metal,
  cost.crystal,
  effectiveResearchLabLevel(gameState, {
    type: 'research',
    id: researchId,
    targetLevel: nextLevel,
    sourcePlanetIndex: gameState.activePlanetIndex,
    startedAt: 0,
    completesAt: 0,
  }),
  gameState.settings.gameSpeed,
);
const affordable = canAfford(cost, gameState);
```

The level badge continues showing `currentLevel`. Button label and cost use `nextLevel`.

### Step 4: Run tests to verify they pass

```bash
npx vitest run src/panels/__tests__/ResearchPanel.test.tsx
```
Expected: PASS

### Step 5: Commit

```bash
git add src/panels/ResearchPanel.tsx src/panels/__tests__/ResearchPanel.test.tsx
git commit -m "feat(research): research button reflects queue depth for level and cost"
```

---

## Task 6: Fleet cargo capacity helper

**Files:**
- Modify: `src/panels/FleetPanel.tsx`
- Test: `src/panels/__tests__/FleetPanel.test.tsx`

### Step 1: Write the failing test

Add to `src/panels/__tests__/FleetPanel.test.tsx`:

```tsx
it('shows cargo capacity helper with + cargo buttons when attacking NPC with known resources', async () => {
  const user = userEvent.setup();
  const now = Date.now();

  // NOTE: `fleetTarget` is a context field (not in GameState). Codex must add
  // `fleetTarget?: Coordinates` as a supported option in renderWithGame (src/test/test-utils.tsx)
  // and seed the mock context with it — similar to how `actions` are handled.
  // `espionageReports` IS part of GameState — pass it under gameState.espionageReports.
  renderWithGame(<FleetPanel />, {
    gameState: {
      galaxy: {
        seed: 1,
        npcColonies: [
          {
            coordinates: { galaxy: 1, system: 2, slot: 4 },
            name: 'Target Base',
            temperature: 25,
            tier: 5,
            specialty: 'balanced',
            maxTier: 8,
            initialUpgradeIntervalMs: 10_800_000,
            currentUpgradeIntervalMs: 10_800_000,
            targetTier: 5,
            catchUpUpgradeIntervalMs: 2_700_000,
            catchUpProgressTicks: 0,
            lastUpgradeAt: 0,
            upgradeTickCount: 0,
            raidCount: 0,
            recentRaidTimestamps: [],
            abandonedAt: undefined,
            buildings: {},
            baseDefences: {},
            baseShips: {},
            currentDefences: {},
            currentShips: {},
            lastRaidedAt: 0,
            resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 },
          },
        ],
      },
      espionageReports: [
        {
          id: 'report_1',
          timestamp: now - 1000,
          targetCoordinates: { galaxy: 1, system: 2, slot: 4 },
          targetName: 'Target Base',
          sourcePlanetIndex: 0,
          probesSent: 1,
          probesLost: 0,
          detected: false,
          detectionChance: 0,
          read: false,
          resources: { metal: 200_000, crystal: 100_000, deuterium: 50_000 },
        },
      ],
      planet: {
        ships: { largeCargo: 10, smallCargo: 5 },
        resources: { deuterium: 50_000 },
      },
    },
    fleetTarget: { galaxy: 1, system: 2, slot: 4 },
  });

  // Lootable = floor((200000+100000+50000) * 0.5) = 175000
  expect(screen.getByText(/Lootable/i)).toBeInTheDocument();

  // + Large Cargo button: ceil(175000 / 25000) = 7
  expect(screen.getByRole('button', { name: /\+ 7 Large Cargo/i })).toBeInTheDocument();

  // Click it — adds 7 large cargo to selectedShips → fleet capacity becomes 7 × 25000 = 175,000
  await user.click(screen.getByRole('button', { name: /\+ 7 Large Cargo/i }));
  // After click, "175,000" appears twice: once for Lootable, once for Fleet cargo capacity
  expect(screen.getAllByText(/175,000/)).toHaveLength(2);
});
```

### Step 2: Run test to verify it fails

```bash
npx vitest run src/panels/__tests__/FleetPanel.test.tsx
```
Expected: FAIL

### Step 3: Implement cargo helper in FleetPanel

**Add import** at top of `src/panels/FleetPanel.tsx`:
```ts
import { getNPCResources } from '../engine/GalaxyEngine.ts';
```

**Add `cargoInfo` memo** inside `FleetPanel` component, after the existing `combatEstimate` memo:

```tsx
const cargoInfo = useMemo(() => {
  if (missionType !== 'attack' || !fleetTarget) return null;

  const colony = gameState.galaxy.npcColonies.find(
    (c) =>
      c.coordinates.galaxy === fleetTarget.galaxy &&
      c.coordinates.system === fleetTarget.system &&
      c.coordinates.slot === fleetTarget.slot,
  );
  if (!colony) return null;

  // Prefer latest spy report with resources; fall back to live estimate
  const reportWithResources = espionageReports
    .filter(
      (r) =>
        r.targetCoordinates.galaxy === fleetTarget.galaxy &&
        r.targetCoordinates.system === fleetTarget.system &&
        r.targetCoordinates.slot === fleetTarget.slot &&
        r.detected === false &&
        r.resources !== undefined,
    )
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  const resources = reportWithResources?.resources
    ?? getNPCResources(colony, currentTime, gameState.settings.gameSpeed);

  const lootable = Math.floor(
    (resources.metal + resources.crystal + resources.deuterium) * 0.5,
  );

  const largeCargoCap = SHIPS.largeCargo.cargoCapacity;
  const smallCargoCap = SHIPS.smallCargo.cargoCapacity;
  const requiredLarge = Math.ceil(lootable / largeCargoCap);
  const requiredSmall = Math.ceil(lootable / smallCargoCap);
  const availableLarge = sourcePlanet.ships.largeCargo ?? 0;
  const availableSmall = sourcePlanet.ships.smallCargo ?? 0;

  return {
    lootable,
    requiredLarge,
    requiredSmall,
    availableLarge,
    availableSmall,
    fromReport: reportWithResources !== undefined,
  };
}, [
  missionType,
  fleetTarget,
  gameState.galaxy.npcColonies,
  gameState.settings.gameSpeed,
  espionageReports,
  currentTime,
  sourcePlanet.ships,
]);
```

**Add cargo info UI** inside the dispatch card, immediately after the `combatEstimate` block (around line 753):

```tsx
{cargoInfo && missionType === 'attack' && (
  <div className="fleet-cargo-helper">
    <div className="fleet-cargo-header">
      <strong>Cargo needed</strong>
      <span className="hint">{cargoInfo.fromReport ? 'from spy report' : 'estimated'}</span>
    </div>
    <p className="stat-line">
      <span className="label">Lootable</span>
      <span className="number">~{formatNumber(cargoInfo.lootable)}</span>
    </p>
    <p className="stat-line">
      <span className="label">Fleet cargo capacity</span>
      <span className="number">{formatNumber(cargoCapacity)}</span>
    </p>
    <div className="fleet-cargo-buttons">
      {cargoInfo.requiredLarge > 0 && (
        <button
          type="button"
          className="btn btn-sm"
          disabled={cargoInfo.availableLarge < cargoInfo.requiredLarge}
          onClick={() => {
            setSelectedShips((current) => ({
              ...current,
              largeCargo: Math.min(
                cargoInfo.availableLarge,
                (current.largeCargo ?? 0) + cargoInfo.requiredLarge,
              ),
            }));
          }}
        >
          + {cargoInfo.requiredLarge} Large Cargo
        </button>
      )}
      {cargoInfo.requiredSmall > 0 && (
        <button
          type="button"
          className="btn btn-sm"
          disabled={cargoInfo.availableSmall < cargoInfo.requiredSmall}
          onClick={() => {
            setSelectedShips((current) => ({
              ...current,
              smallCargo: Math.min(
                cargoInfo.availableSmall,
                (current.smallCargo ?? 0) + cargoInfo.requiredSmall,
              ),
            }));
          }}
        >
          + {cargoInfo.requiredSmall} Small Cargo
        </button>
      )}
    </div>
  </div>
)}
```

**Add CSS** to `src/styles.css`:

```css
.fleet-cargo-helper {
  border: 1px solid var(--border);
  border-radius: 0.4rem;
  padding: 0.6rem 0.8rem;
  margin-top: 0.5rem;
  font-size: 0.85rem;
}

.fleet-cargo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.4rem;
}

.fleet-cargo-buttons {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.4rem;
  flex-wrap: wrap;
}
```

### Step 4: Run tests to verify they pass

```bash
npx vitest run src/panels/__tests__/FleetPanel.test.tsx
```
Expected: PASS

### Step 5: Commit

```bash
git add src/panels/FleetPanel.tsx src/panels/__tests__/FleetPanel.test.tsx src/styles.css
git commit -m "feat(fleet): add cargo capacity helper with required ship buttons for attack missions"
```

---

## Task 7: Run full test suite and verify

### Step 1: Run all tests

```bash
npm test
```
Expected: All tests pass (no regressions)

### Step 2: Commit if any cleanup needed

If any minor fixes required, commit them. Then:

```bash
git log --oneline -6
```

---

## Notes for Codex

- All panels are in `src/panels/`. Tests are in `src/panels/__tests__/`.
- `renderWithGame` is in `src/test/test-utils.tsx`. It accepts deep partial `gameState` overrides — only specify what you need.
- `espionageReports` is part of `GameState` — pass it under `gameState.espionageReports` (not at the top level).
- `fleetTarget` is a context field (NOT in `GameState`). Codex must add `fleetTarget?: Coordinates` as a supported option to `renderWithGame` in `src/test/test-utils.tsx` and seed the mock context with it. Check if already present before adding.
- `planet.defences` is NOT partial in `renderWithGame` — do not pass a partial `defences` object. Omit it entirely and rely on defaults.
- Only `planet.buildings`, `planet.ships`, and `planet.resources` accept partial overrides.
- Never use `Math.random()` — all randomness goes through the seeded PRNG.
- `formatDuration` accepts seconds (number), not milliseconds.
- Do NOT change any engine files (`src/engine/`). All changes are UI-only.
- Do NOT add Solar Satellite Max button — it already exists in BuildingsPanel.
