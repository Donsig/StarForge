# Card Detail Modal — Implementation Plan

> **For Codex:** Each task is a self-contained Codex dispatch. Each task header includes the structured prompt skeleton (TASK / ALLOWED WRITES / READ-ONLY CONTEXT / NON-GOALS / DONE MEANS) the codex-agent skill expects. Steps use checkbox (`- [ ]`) syntax — tick them off as work completes and update this file with deviations.

**Goal:** Implement the StarForge card detail modal (Issue #44) per the approved spec — a shared, type-aware modal that opens on any item card click in Buildings/Research/Shipyard/Defence panels, shows derived data via pure helpers, and dispatches existing build/upgrade actions.

**Architecture:** Pure helpers in `src/utils/cardDetails.ts`; `ModalContext` for selection state in `src/context/`; modal subcomponents under `src/components/CardDetailModal/`; 4 panels wired with a shared interactive-child guard; component + integration tests.

**Tech Stack:** React 19, TypeScript (strict), Vite, vitest, @testing-library/react, user-event.

**Spec:** `docs/superpowers/specs/2026-04-30-card-detail-modal-design.md` — authoritative for API shapes, names, and edge cases. Read it before each task.

---

## Sequencing Overview

```
1.  Strategic-notes data file        →  no React, no other deps
2.  Helpers: types/accents/maxAffordable/prereqRowsFor/enablesFor
3.  Helpers: cardStatsFor + benefit-at-level
4.  Helpers: buildingProgression / researchProgression
5.  ModalContext + ModalProvider (with test-injectable `value` prop)
6.  Modal shell + LeftColumn + RightColumn (no LevelTable yet, no stepper)
7.  LevelTable + QuantityStepper + PrereqPills (the interactive children)
8.  styles.css additions for the modal
9.  Wire ModalProvider into App.tsx; render <CardDetailModal /> once at root
10. Wire all four panels (article click + keydown + interactive-child guard)
11. Component tests (one happy-path per type) + SpyModalProvider helper
12. Integration test (panel click → modal → CTA → QUEUE badge → Escape)
```

After Task 12 there is a manual smoke-test checklist (Task 13). Type-check (`npm run build`) and the full test suite (`npm test`) must pass after every task.

---

## Task 1: Strategic-Notes Data File

**Files:**
- Create: `src/data/strategicNotes.ts`

**Goal:** Seed editorial copy for ~10–15 high-traffic items across all four types. Modal hides the section when an entry is missing.

```
TASK: Create src/data/strategicNotes.ts per spec section "Strategic Notes" (decision #2).
ALLOWED WRITES: src/data/strategicNotes.ts
READ-ONLY CONTEXT:
  - docs/superpowers/specs/2026-04-30-card-detail-modal-design.md (decision #2 + helper notes)
  - src/data/buildings.ts, research.ts, ships.ts, defences.ts (for valid id types)
  - src/models/types.ts (for BuildingId / ResearchId / ShipId / DefenceId)
NON-GOALS: no UI work, no helper changes, no tests, no other files.
STOP CONDITION: if a needed type is missing, stop and report.
DONE MEANS: file exports the four maps + getStrategicNote, npm run build passes.
```

- [x] **Step 1: Create the file**

```ts
// src/data/strategicNotes.ts
import type { BuildingId, ResearchId, ShipId, DefenceId } from '../models/types.ts';

export type StrategicNoteType = 'building' | 'research' | 'ship' | 'defence';

const BUILDING_NOTES: Partial<Record<BuildingId, string>> = {
  metalMine:
    'The single highest-impact upgrade early game. Every other building depends on the metal flow this provides. Prioritise until Lv 20+ before diversifying.',
  crystalMine:
    'Crystal becomes the bottleneck around the time you start research-heavy upgrades. Keep within 1–2 levels of your Metal Mine.',
  deuteriumSynthesizer:
    'Cold planets produce more deuterium per level. Slot-place colonies on cold worlds before scaling this aggressively.',
  solarPlant:
    'The default early-game energy supply. Each Lv increases output but eventually loses to Fusion Reactor + Energy Tech for energy-per-deuterium efficiency.',
  fusionReactor:
    'Endgame energy. Pair with Energy Technology — fusion output scales with that tech, so plan upgrades together.',
  roboticsFactory:
    'Compounds on every other building. Even one extra level here saves hours across a long upgrade chain.',
  naniteFactory:
    'A single Nanite level halves all build times. The unlock cost is steep but the payoff is permanent.',
  shipyard:
    'Ships build linearly faster per shipyard level. Push to Lv 8+ before any large fleet build-out.',
  researchLab:
    'The cheapest cumulative speedup for the entire tech tree. Always queue Lv +1 when you have spare resources.',
};

const RESEARCH_NOTES: Partial<Record<ResearchId, string>> = {
  weaponsTechnology:
    'Pure offensive multiplier. Stacks with Plasma Technology bonus. Essential before any large-scale fleet engagement.',
  shieldingTechnology:
    'Survival math. Each level multiplies effective shield HP across every ship and turret you own.',
  armourTechnology:
    'The cheapest of the three combat techs. Soak more shots without losing fleet value.',
  computerTechnology:
    'Every level unlocks an additional fleet slot. Bottleneck for serious raiders past Lv 5.',
  astrophysicsTechnology:
    'Two levels = one new colony. Decide your colony slot ceiling early — late-game expansion runs through this tech.',
  plasmaTechnology:
    'A permanent mine production multiplier. The single most cost-efficient long-term economy upgrade.',
};

const SHIP_NOTES: Partial<Record<ShipId, string>> = {
  cruiser:
    'Rapid-fire against Light Fighters (×6). Excellent for clearing weak defenders. Poor against Battleships — mix with heavier units.',
  battleship:
    'Backbone of any serious fleet. Strong all-rounder; vulnerable to Battlecruisers without mixed support.',
  destroyer:
    'Counter to Battlecruisers. Pair with Battleships to neutralize cruiser swarms efficiently.',
  bomber:
    'Devastating against fixed defences. Bring at least a small bomber wing on any planet raid.',
  smallCargo:
    'Throughput for small economic transfers. Cargo capacity scales with combustion-drive level.',
  largeCargo:
    'The hauler. Use for raid recovery and long-distance resource shuttling.',
  espionageProbe:
    'Cheap recon. Send 5–10 to reduce the chance of detection on espionage missions.',
  recycler:
    'Sweeps debris fields after combat. Bring enough cargo capacity to recover full battle debris.',
  colonyShip:
    'One-shot vessel. Consumed on use; check planet temperature/fields before committing.',
};

const DEFENCE_NOTES: Partial<Record<DefenceId, string>> = {
  rocketLauncher:
    'Cheap meatshield. Builds in seconds and absorbs cruiser fire while heavier turrets do the work.',
  gaussCannon:
    'Best attack-per-resource of mid-tier defences. Specifically strong against Destroyers and Battleships.',
  plasmaTurret:
    'Top-tier fixed firepower. Place on high-value planets — moderate price tag, devastating output.',
  smallShieldDome:
    'Single-instance defensive shield. Build it on every planet you care about.',
  largeShieldDome:
    'Endgame shielding. Pairs with Small Shield Dome for stacking shield HP.',
};

export function getStrategicNote(
  type: StrategicNoteType,
  id: string,
): string | undefined {
  switch (type) {
    case 'building':
      return BUILDING_NOTES[id as BuildingId];
    case 'research':
      return RESEARCH_NOTES[id as ResearchId];
    case 'ship':
      return SHIP_NOTES[id as ShipId];
    case 'defence':
      return DEFENCE_NOTES[id as DefenceId];
  }
}
```

- [x] **Step 2: Type-check passes**

Run: `npm run build`
Expected: builds clean (only the new file added; no other changes). ✅ Verified locally — `vite build` clean.

- [x] **Step 3: Commit** — `3c14efc`

```bash
git add src/data/strategicNotes.ts
git commit -m "feat(data): add strategic-notes seed for card detail modal"
```

---

## Task 2: Helpers — Foundation (types, accents, maxAffordable, prereqRowsFor, enablesFor)

**Files:**
- Create: `src/utils/cardDetails.ts`
- Create: `src/utils/__tests__/cardDetails.test.ts`

**Goal:** Lay the helper module's foundation: shared types (`CardType`, `CardStat`, `LevelRow`, `UnlockEntry`, `PrereqRow`), the `TYPE_ACCENTS` table, and the three independent helpers that don't depend on game progression: `maxAffordable`, `prereqRowsFor`, `enablesFor`. TDD — write each test first.

```
TASK: Create src/utils/cardDetails.ts and tests covering the foundation block per spec "Pure Helpers".
ALLOWED WRITES: src/utils/cardDetails.ts, src/utils/__tests__/cardDetails.test.ts
READ-ONLY CONTEXT:
  - docs/superpowers/specs/2026-04-30-card-detail-modal-design.md (Pure Helpers section, Decisions #7)
  - src/data/{buildings,research,ships,defences}.ts
  - src/models/{types,GameState,Planet}.ts
  - src/engine/BuildQueue.ts (existing canAfford / prerequisitesMet logic for parity)
NON-GOALS: do not implement cardStatsFor, benefit-at-level, or progression helpers in this task.
STOP CONDITION: if BuildingId / ResearchId / ShipId / DefenceId are not exported from src/models/types.ts, stop and report.
DONE MEANS: all new tests pass; npm run build passes; no other files changed.
```

- [x] **Step 1: Write tests for `TYPE_ACCENTS`, `maxAffordable`, `prereqRowsFor`, `enablesFor`**

```ts
// src/utils/__tests__/cardDetails.test.ts
import { describe, it, expect } from 'vitest';
import {
  TYPE_ACCENTS,
  maxAffordable,
  prereqRowsFor,
  enablesFor,
} from '../cardDetails';
import type { GameState } from '../../models/GameState';
import type { ResourcesState } from '../../models/Planet';

describe('TYPE_ACCENTS', () => {
  it('exposes all four card types with the spec colour values', () => {
    expect(TYPE_ACCENTS.building.c).toBe('#4d8fff');
    expect(TYPE_ACCENTS.research.c).toBe('#818cf8');
    expect(TYPE_ACCENTS.ship.c).toBe('#30d5c8');
    expect(TYPE_ACCENTS.defence.c).toBe('#f0a832');
  });
});

describe('maxAffordable', () => {
  const r: ResourcesState = { metal: 10000, crystal: 5000, deuterium: 2000, energy: 0 };

  it('returns the limiting min across resources', () => {
    expect(maxAffordable({ metal: 1000, crystal: 1000, deuterium: 0 }, r)).toBe(5);
  });
  it('returns 0 when not affordable at qty 1', () => {
    expect(maxAffordable({ metal: 999999, crystal: 0, deuterium: 0 }, r)).toBe(0);
  });
  it('clamps to maxCount minus existing (built or queued)', () => {
    expect(
      maxAffordable({ metal: 100, crystal: 100, deuterium: 0 }, r, 1, 0),
    ).toBe(1);
    expect(
      maxAffordable({ metal: 100, crystal: 100, deuterium: 0 }, r, 1, 1),
    ).toBe(0); // already at cap (built or queued)
  });
  it('handles zero-cost resources without dividing by zero', () => {
    expect(maxAffordable({ metal: 0, crystal: 0, deuterium: 100 }, r)).toBe(20);
  });
});

describe('prereqRowsFor', () => {
  function makeState(overrides: Partial<GameState> = {}): GameState {
    // Use the project's existing test-utils helper if one exists; otherwise
    // construct a minimal GameState. See src/test/test-utils.tsx.
    // (Codex: import the project's existing factory rather than rolling a new one.)
    return overrides as GameState;
  }
  it('returns empty array for empty input', () => {
    expect(prereqRowsFor([], makeState())).toEqual([]);
  });
  it('marks prereqs met/unmet correctly', () => {
    // Codex: build a minimal GameState fixture using src/test/test-utils.tsx
    // helpers. Set planet.buildings.shipyard = 5, research.combustionDrive = 0.
    // Assert: prereq { type:'building', id:'shipyard', level:5 } -> met=true.
    //         prereq { type:'research', id:'combustionDrive', level:1 } -> met=false.
    // Confirm `target.type` and `target.id` mirror the prerequisite.
  });
  it('returns target=null when prereq id is unknown (data drift)', () => {
    const rows = prereqRowsFor(
      [{ type: 'building', id: 'nonexistentXyz' as unknown as never, level: 1 }],
      makeState(),
    );
    expect(rows[0].target).toBeNull();
    expect(rows[0].label).toContain('nonexistentXyz');
  });
});

describe('enablesFor', () => {
  it('returns empty array for items that unlock nothing', () => {
    expect(enablesFor('building', 'metalMine')).toEqual([]);
  });
  it('lists ships unlocked by shipyard at the correct level', () => {
    const out = enablesFor('building', 'shipyard');
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((u) => typeof u.atLevel === 'number')).toBe(true);
  });
  it('lists defences unlocked by weaponsTechnology', () => {
    const out = enablesFor('research', 'weaponsTechnology');
    expect(out.find((u) => u.id === 'gaussCannon')).toBeDefined();
  });
});
```

- [x] **Step 2: Run tests, confirm they all fail**

Run: `npx vitest run src/utils/__tests__/cardDetails.test.ts`
Expected: every test fails (module not found / functions undefined).

- [x] **Step 3: Implement `src/utils/cardDetails.ts` foundation block**

Per spec section "Pure Helpers". Skeleton:

```ts
// src/utils/cardDetails.ts
import { BUILDINGS } from '../data/buildings';
import { RESEARCH } from '../data/research';
import { SHIPS } from '../data/ships';
import { DEFENCES } from '../data/defences';
import type {
  BuildingId, DefenceId, Prerequisite, ResearchId, ResourceCost, ShipId,
} from '../models/types';
import type { GameState } from '../models/GameState';
import type { ResourcesState } from '../models/Planet';

export type CardType = 'building' | 'research' | 'ship' | 'defence';

export const TYPE_ACCENTS: Record<CardType, { c: string; bg: string; bd: string; glow: string }> = {
  building: { c: '#4d8fff', bg: 'rgba(77,143,255,0.12)',  bd: 'rgba(77,143,255,0.35)',  glow: 'rgba(77,143,255,0.22)'  },
  research: { c: '#818cf8', bg: 'rgba(129,140,248,0.12)', bd: 'rgba(129,140,248,0.35)', glow: 'rgba(129,140,248,0.22)' },
  ship:     { c: '#30d5c8', bg: 'rgba(48,213,200,0.12)',  bd: 'rgba(48,213,200,0.35)',  glow: 'rgba(48,213,200,0.22)'  },
  defence:  { c: '#f0a832', bg: 'rgba(240,168,50,0.12)',  bd: 'rgba(240,168,50,0.35)',  glow: 'rgba(240,168,50,0.22)'  },
};

// — maxAffordable —
export function maxAffordable(
  cost: ResourceCost,
  resources: ResourcesState,
  maxCount?: number,
  existingCount = 0,
): number {
  const byResource = (Object.keys(cost) as Array<keyof ResourceCost>)
    .map((k) => (cost[k] > 0 ? Math.floor(resources[k] / cost[k]) : Infinity));
  let max = Math.min(...byResource);
  if (!Number.isFinite(max)) max = 0;
  if (typeof maxCount === 'number') max = Math.max(0, Math.min(max, maxCount - existingCount));
  return Math.max(0, max);
}

// — prereqRowsFor —
export interface PrereqRow {
  label: string;
  met: boolean;
  target: { type: CardType; id: string } | null;
}
export function prereqRowsFor(requires: Prerequisite[], state: GameState): PrereqRow[] {
  // Implementation: mirror `requirementMet` and `requirementLabel` from
  // src/panels/BuildingsPanel.tsx:41-57, but with defensive lookup that
  // returns target=null when the id is not in the relevant definition map.
  // See spec "Pure Helpers > prereqRowsFor".
  // ... Codex: implement here.
  throw new Error('not implemented');
}

// — enablesFor (precomputed map) —
export interface UnlockEntry { type: CardType; id: string; label: string; atLevel: number; }
const UNLOCKS_BY_KEY: Map<string, UnlockEntry[]> = (() => {
  const m = new Map<string, UnlockEntry[]>();
  const add = (depType: CardType, depId: string, level: number, target: UnlockEntry) => {
    const key = `${depType}:${depId}`;
    const list = m.get(key) ?? [];
    list.push(target);
    m.set(key, list);
  };
  for (const b of Object.values(BUILDINGS)) {
    for (const p of b.requires) add(p.type, p.id, p.level, { type: 'building', id: b.id, label: b.name, atLevel: p.level });
  }
  for (const r of Object.values(RESEARCH)) {
    for (const p of r.requires) add(p.type, p.id, p.level, { type: 'research', id: r.id, label: r.name, atLevel: p.level });
  }
  for (const s of Object.values(SHIPS)) {
    for (const p of s.requires) add(p.type, p.id, p.level, { type: 'ship', id: s.id, label: s.name, atLevel: p.level });
  }
  for (const d of Object.values(DEFENCES)) {
    for (const p of d.requires) add(p.type, p.id, p.level, { type: 'defence', id: d.id, label: d.name, atLevel: p.level });
  }
  return m;
})();
export function enablesFor(type: CardType, id: string): UnlockEntry[] {
  return UNLOCKS_BY_KEY.get(`${type}:${id}`) ?? [];
}
```

- [x] **Step 4: Tests pass** — 11 tests pass.

- [x] **Step 5: Type-check + full test suite** — `npm run build` clean; full suite 57 files / 631 tests green (Codex's verification matches local re-run).

- [x] **Step 6: Commit**

```bash
git add src/utils/cardDetails.ts src/utils/__tests__/cardDetails.test.ts
git commit -m "feat(utils): add card-details helper foundation (accents, maxAffordable, prereqRowsFor, enablesFor)"
```

---

## Task 3: Helpers — `cardStatsFor` + benefit-at-level

**Files:**
- Modify: `src/utils/cardDetails.ts` (append)
- Modify: `src/utils/__tests__/cardDetails.test.ts` (append)

**Goal:** Add the per-id stat layouts (`cardStatsFor`) and per-level benefit strings (`buildingBenefitAtLevel`, `researchBenefitAtLevel`).

```
TASK: Append cardStatsFor + benefit-at-level helpers and tests.
ALLOWED WRITES: src/utils/cardDetails.ts, src/utils/__tests__/cardDetails.test.ts
READ-ONLY CONTEXT:
  - spec sections "Pure Helpers", "Building benefit mapping", "cardStatsFor"
  - src/engine/FormulasEngine.ts (production/energy/storage/time formulas)
  - src/data/{buildings,research,ships,defences}.ts
  - src/models/Planet.ts (planet.maxTemperature)
NON-GOALS: do not implement progression helpers (next task).
STOP CONDITION: if a referenced formula is missing in FormulasEngine, stop and report.
DONE MEANS: every new test passes; existing tests still pass; npm run build passes.
```

- [ ] **Step 1: Append tests**

```ts
import { cardStatsFor, buildingBenefitAtLevel, researchBenefitAtLevel } from '../cardDetails';

describe('buildingBenefitAtLevel', () => {
  it('formats metal mine production at level 7 as "+N/h"', () => {
    // Codex: build a state fixture with metalMine=7, plasmaTechnology=0;
    // assert format /^\+[\d,]+\/h$/.
  });
  it('formats solar plant as energy at level L', () => {
    // assert /^\+\d+$/ shape (no /h suffix).
  });
  it('formats storage capacity', () => {
    // metalStorage at level 5 should yield a comma-formatted number.
  });
  it('formats robotics factory as build-time reduction', () => {
    // assert /^−\d+%/ format.
  });
  it('formats fusion as combined energy + deut consumption signed pair', () => {
    // assert format like "+200 / −20/h".
  });
});

describe('researchBenefitAtLevel', () => {
  it('weaponsTechnology +X% per level', () => {
    expect(researchBenefitAtLevel('weaponsTechnology', 3)).toBe('+30% attack');
  });
  it('computerTechnology grants +1 fleet slot per level', () => {
    expect(researchBenefitAtLevel('computerTechnology', 5)).toBe('+5 fleet slots');
  });
  it('astrophysicsTechnology grants +1 colony per 2 levels', () => {
    expect(researchBenefitAtLevel('astrophysicsTechnology', 4)).toBe('+2 colonies');
  });
});

describe('cardStatsFor', () => {
  it('returns RAW combat stats for ships (no research scaling)', () => {
    // Codex: build state with weaponsTechnology=5; assert cardStatsFor('ship','cruiser', state)
    // returns ATK=400 (raw, not 600 with +50% bonus).
  });
  it('adds Energy/unit stat for solarSatellite', () => {
    // Build state with planet.maxTemperature=80;
    // assert one stat has label 'Energy / unit' and value matches Math.max(0, Math.floor((80+140)/6)) = 36.
  });
  it('handles non-finite temperature defensively', () => {
    // planet.maxTemperature = NaN -> Energy/unit = 0
  });
});
```

- [ ] **Step 2: Run new tests, confirm they fail**

- [ ] **Step 3: Append helper implementations**

```ts
// src/utils/cardDetails.ts (appended)
import {
  metalProductionPerHour, crystalProductionPerHour, deuteriumProductionPerHour,
  solarPlantEnergy, fusionReactorEnergy, fusionReactorDeuteriumConsumption,
  metalMineEnergy, crystalMineEnergy, deuteriumSynthEnergy,
  storageCapacity,
} from '../engine/FormulasEngine';

export interface CardStat { label: string; value: string; color: string; }

// Building benefit mapping per spec table.
export function buildingBenefitAtLevel(id: BuildingId, level: number, state: GameState): string {
  const planet = state.planets[state.activePlanetIndex];
  switch (id) {
    case 'metalMine':              return `+${formatNumber(metalProductionPerHour(level))}/h`;
    case 'crystalMine':            return `+${formatNumber(crystalProductionPerHour(level))}/h`;
    case 'deuteriumSynthesizer':   return `+${formatNumber(deuteriumProductionPerHour(level, planet.maxTemperature))}/h`;
    case 'solarPlant':             return `+${solarPlantEnergy(level)}`;
    case 'fusionReactor': {
      const e = fusionReactorEnergy(level, state.research.energyTechnology);
      const d = fusionReactorDeuteriumConsumption(level);
      return `+${formatNumber(e)} / −${formatNumber(d)}/h`;
    }
    case 'metalStorage':
    case 'crystalStorage':
    case 'deuteriumTank':          return `${formatNumber(storageCapacity(level))} cap`;
    case 'roboticsFactory':        return formatBuildTimeReduction(level, 'robotics');
    case 'naniteFactory':          return formatBuildTimeReduction(level, 'nanite');
    case 'shipyard':               return formatShipyardSpeedup(level);
    case 'researchLab':            return formatLabSpeedup(level);
  }
}

export function researchBenefitAtLevel(id: ResearchId, level: number): string {
  switch (id) {
    case 'weaponsTechnology':      return `+${level * 10}% attack`;
    case 'shieldingTechnology':    return `+${level * 10}% shields`;
    case 'armourTechnology':       return `+${level * 10}% hull`;
    case 'computerTechnology':     return `+${level} fleet slot${level === 1 ? '' : 's'}`;
    case 'astrophysicsTechnology': return `+${Math.floor(level / 2)} colon${Math.floor(level / 2) === 1 ? 'y' : 'ies'}`;
    case 'plasmaTechnology':       return `+${level}% metal / +${(level * 0.66).toFixed(1)}% crystal / +${(level * 0.33).toFixed(1)}% deut.`;
    // ... fall through to a generic "Lv N" placeholder for items that don't have a numeric headline benefit.
    default:                       return `Lv ${level}`;
  }
}

// cardStatsFor — first 3 stats for left column, full list for right-column grid.
export function cardStatsFor(type: CardType, id: string, state: GameState): CardStat[] {
  const planet = state.planets[state.activePlanetIndex];
  switch (type) {
    case 'building':
      // Per-id stat list — reuse buildingBenefitAtLevel for the headline value.
      // Mines/synth: Prod/hr, Energy used, Fields used.
      // Solar: Energy produced, Fields used.
      // Storage: Capacity, Fields used.
      // Facilities: percent speedup, Fields used.
      // Codex: implement per spec "Building benefit mapping".
      return /* ... */ [];
    case 'research':
      // Effect, Applies-to, Stacks-with (when applicable). For weapons/shielding/armour
      // include "current bonus" + "after Lv +1".
      return /* ... */ [];
    case 'ship': {
      const def = SHIPS[id as ShipId];
      const stats: CardStat[] = [
        { label: 'ATK',   value: formatNumber(def.attack),   color: '#f87171' },
        { label: 'SHD',   value: formatNumber(def.shield),   color: '#60a5fa' },
        { label: 'HULL',  value: formatNumber(def.hull),     color: '#c8e0ff' },
        { label: 'CARGO', value: formatNumber(def.cargoCapacity), color: '#34d399' },
        { label: 'SPD',   value: formatNumber(def.speed),    color: '#f0a832' },
        { label: 'DRIVE', value: def.drive,                  color: '#818cf8' },
      ];
      if (id === 'solarSatellite') {
        const t = planet.maxTemperature;
        const e = Number.isFinite(t) ? Math.max(0, Math.floor((t + 140) / 6)) : 0;
        stats.push({ label: 'Energy / unit', value: String(e), color: '#fbbf24' });
      }
      return stats;
    }
    case 'defence': {
      const def = DEFENCES[id as DefenceId];
      return [
        { label: 'ATK',  value: formatNumber(def.attack), color: '#f87171' },
        { label: 'SHD',  value: formatNumber(def.shield), color: '#60a5fa' },
        { label: 'HULL', value: formatNumber(def.hull),   color: '#c8e0ff' },
        { label: 'MAX',  value: def.maxCount === undefined ? '∞' : String(def.maxCount), color: '#c8e0ff' },
      ];
    }
  }
}

// Local helpers for percent speedups; Codex picks reasonable formulas. The cleanest is
// percent-faster relative to L=0 baseline:
//   robotics:  1 - 1/(1+L)         -> Lv 1: 50%, Lv 5: 83%
//   nanite:    1 - 1/(2^L)         -> Lv 1: 50%, Lv 3: 87%
//   shipyard:  same as robotics
//   research:  same as robotics (against research lab L)
function formatBuildTimeReduction(level: number, kind: 'robotics' | 'nanite'): string {
  const factor = kind === 'nanite' ? Math.pow(2, level) : (1 + level);
  const pct = Math.round((1 - 1 / factor) * 100);
  return `−${pct}% build time`;
}
function formatShipyardSpeedup(level: number): string { return `−${Math.round((1 - 1 / (1 + level)) * 100)}% ship time`; }
function formatLabSpeedup(level: number): string { return `−${Math.round((1 - 1 / (1 + level)) * 100)}% research time`; }

function formatNumber(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'K';
  return Math.round(n).toLocaleString('en-US');
}
```

- [ ] **Step 4: Tests pass**

Run: `npx vitest run src/utils/__tests__/cardDetails.test.ts`

- [ ] **Step 5: Build + full suite**

Run: `npm run build && npm test`

- [ ] **Step 6: Commit**

```bash
git add src/utils/cardDetails.ts src/utils/__tests__/cardDetails.test.ts
git commit -m "feat(utils): add cardStatsFor + benefit-at-level helpers"
```

---

## Task 4: Helpers — Progression (`buildingProgression`, `researchProgression`)

**Files:**
- Modify: `src/utils/cardDetails.ts` (append)
- Modify: `src/utils/__tests__/cardDetails.test.ts` (append)

**Goal:** The level-progression rows used by the Level Table, with NOW / QUEUE / NEXT flags and dynamic visible range.

```
TASK: Append buildingProgression + researchProgression helpers and tests.
ALLOWED WRITES: src/utils/cardDetails.ts, src/utils/__tests__/cardDetails.test.ts
READ-ONLY CONTEXT:
  - spec "QUEUE badges in the Level Progression table" + "Pure Helpers" notes
  - src/engine/FormulasEngine.ts (buildingCostAtLevel, researchCostAtLevel,
                                   buildingTime, researchTime; energy formulas)
  - src/models/types.ts (QueueItem)
  - CLAUDE.md research-queue gotcha
NON-GOALS: do not change other helpers.
STOP CONDITION: if cost helpers are missing, stop.
DONE MEANS: progression tests pass; existing helper tests still green.
```

- [ ] **Step 1: Append tests**

```ts
import { buildingProgression, researchProgression } from '../cardDetails';

describe('buildingProgression', () => {
  it('returns rows from max(1, current-2) to max(current+3, next+1)', () => {
    // Codex: build state with metalMine=7, empty queue.
    // Assert returned rows have levels: 5,6,7,8,9,10 (6 rows).
    // Lv 7 row: current=true, queued=false, next=false.
    // Lv 8 row: next=true.
  });
  it('expands the range when queue is long enough to push NEXT past +3', () => {
    // queue has 4 entries -> current=7, queued levels 8/9/10/11, next=12.
    // expects rows 5..12 (8 rows).
  });
  it('never returns rows with level < 1', () => {
    // current=1 -> rows start at 1 (not 0 or -1).
  });
  it('marks queued rows correctly', () => {
    // current=7, queue has entries for levels 8 and 9.
    // Lv 8 and Lv 9 rows: queued=true. Lv 10 row: next=true.
  });
});

describe('researchProgression', () => {
  it('always starts at 1', () => {
    // current=5, no queue -> rows[0].level === 1.
  });
  it('counts queue by id only (sourcePlanetIndex ignored)', () => {
    // queue has two entries for weaponsTechnology with different sourcePlanetIndex.
    // Both should count toward queued; next = current + 2 + 1.
  });
});
```

- [ ] **Step 2: Tests fail (helpers don't exist)**

- [ ] **Step 3: Implement progression helpers**

```ts
import {
  buildingCostAtLevel, researchCostAtLevel,
  buildingTime, researchTime,
} from '../engine/FormulasEngine';
import { BUILDINGS } from '../data/buildings';
import { RESEARCH } from '../data/research';
import type { QueueItem } from '../models/types';

export interface LevelRow {
  level: number;
  benefit: string;
  metal: number; crystal: number; deuterium: number; energy: number;
  current: boolean; queued: boolean; next: boolean;
}

export function buildingProgression(
  id: BuildingId,
  currentLevel: number,
  queue: QueueItem[],     // already filtered to entries for this id
  state: GameState,
): LevelRow[] {
  const queuedLevels = new Set(queue.map((q) => q.targetLevel ?? 0));
  const nextLevel = currentLevel + queue.length + 1;
  const start = Math.max(1, currentLevel - 2);
  const end   = Math.max(currentLevel + 3, nextLevel + 1);

  const rows: LevelRow[] = [];
  const def = BUILDINGS[id];
  const planet = state.planets[state.activePlanetIndex];

  for (let lv = start; lv <= end; lv++) {
    const cost = buildingCostAtLevel(def.baseCost, def.costMultiplier, lv);
    const time = buildingTime(
      cost.metal, cost.crystal,
      planet.buildings.roboticsFactory, planet.buildings.naniteFactory,
      state.settings.gameSpeed,
    );
    rows.push({
      level: lv,
      benefit: buildingBenefitAtLevel(id, lv, state),
      metal: cost.metal,
      crystal: cost.crystal,
      deuterium: cost.deuterium,
      energy: energyAtLevel(id, lv, state),
      current: lv === currentLevel,
      queued: queuedLevels.has(lv) && lv !== currentLevel,
      next: lv === nextLevel,
    });
  }
  return rows;
}

export function researchProgression(
  id: ResearchId,
  currentLevel: number,
  queue: QueueItem[],     // already filtered to entries for this id (id only — see CLAUDE.md gotcha)
  state: GameState,
): LevelRow[] {
  // Same shape as buildingProgression but range starts at 1.
  // ... Codex: implement.
  return [];
}

// Per-building energy delta at a given level (consumption negative, production positive).
function energyAtLevel(id: BuildingId, level: number, state: GameState): number {
  switch (id) {
    case 'metalMine':            return -metalMineEnergy(level);
    case 'crystalMine':          return -crystalMineEnergy(level);
    case 'deuteriumSynthesizer': return -deuteriumSynthEnergy(level);
    case 'solarPlant':           return solarPlantEnergy(level);
    case 'fusionReactor':        return fusionReactorEnergy(level, state.research.energyTechnology);
    default:                     return 0;
  }
}
```

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Full suite + build**

- [ ] **Step 6: Commit**

```bash
git add src/utils/cardDetails.ts src/utils/__tests__/cardDetails.test.ts
git commit -m "feat(utils): add level-progression helpers with QUEUE/NEXT flags"
```

---

## Task 5: ModalContext + ModalProvider

**Files:**
- Create: `src/context/ModalContext.tsx`
- Create: `src/context/__tests__/ModalContext.test.tsx`

**Goal:** Public API `{ selectedCard, open, close, restoreFocus }`. Origin focus capture via `useRef` with the "first capture wins" rule. Optional `value` prop for tests to bypass internals.

```
TASK: Create ModalContext per spec "ModalContext" + "Focus management".
ALLOWED WRITES: src/context/ModalContext.tsx, src/context/__tests__/ModalContext.test.tsx
READ-ONLY CONTEXT: spec sections "Architecture", "Closing", "Focus management", "Test infra".
NON-GOALS: do not implement the modal yet.
DONE MEANS: tests for open/close/origin-preservation/restoreFocus pass; npm run build passes.
```

- [ ] **Step 1: Write tests**

```tsx
// src/context/__tests__/ModalContext.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalProvider, useModal, type ModalContextValue } from '../ModalContext';

function Probe({ onValue }: { onValue: (v: ModalContextValue) => void }) {
  const v = useModal();
  onValue(v);
  return null;
}

describe('ModalContext', () => {
  it('open() sets selectedCard; close() clears it', () => {
    let api!: ModalContextValue;
    render(<ModalProvider><Probe onValue={(v) => (api = v)} /></ModalProvider>);
    api.open('building', 'metalMine');
    expect(api.selectedCard).toEqual({ type: 'building', id: 'metalMine' });
    api.close();
    expect(api.selectedCard).toBeNull();
  });

  it('preserves originating focus across prereq navigation', () => {
    // Codex: render a button outside the provider, focus it, call open() while focused,
    // then call open() again with a different target. Assert: restoreFocus restores
    // the FIRST originating element, not the second.
  });

  it('restoreFocus returns focus and clears the captured ref', () => {
    // Codex: focus an element, open(), close(), call restoreFocus(),
    // assert document.activeElement is the original; calling restoreFocus again is a no-op.
  });

  it('value prop bypasses internal state (test-injection seam)', () => {
    const spy: ModalContextValue = {
      selectedCard: { type: 'ship', id: 'cruiser' },
      open: vi.fn(),
      close: vi.fn(),
      restoreFocus: vi.fn(),
    };
    let observed!: ModalContextValue;
    render(
      <ModalProvider value={spy}><Probe onValue={(v) => (observed = v)} /></ModalProvider>
    );
    expect(observed).toBe(spy);
  });
});
```

- [ ] **Step 2: Tests fail**

- [ ] **Step 3: Implement provider**

```tsx
// src/context/ModalContext.tsx
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { CardType } from '../utils/cardDetails';

export interface SelectedCard { type: CardType; id: string; }

export interface ModalContextValue {
  selectedCard: SelectedCard | null;
  open(type: CardType, id: string): void;
  close(): void;
  restoreFocus(): void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function useModal(): ModalContextValue {
  const v = useContext(ModalContext);
  if (!v) throw new Error('useModal must be used inside <ModalProvider>');
  return v;
}

export function ModalProvider({
  children,
  value,
}: {
  children: ReactNode;
  value?: ModalContextValue;   // tests inject a fully-controlled value
}) {
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);
  const originRef = useRef<HTMLElement | null>(null);

  const open = useCallback((type: CardType, id: string) => {
    if (originRef.current === null && document.activeElement instanceof HTMLElement) {
      originRef.current = document.activeElement;
    }
    setSelectedCard({ type, id });
  }, []);

  const close = useCallback(() => {
    setSelectedCard(null);
  }, []);

  const restoreFocus = useCallback(() => {
    const el = originRef.current;
    originRef.current = null;
    if (el && el.isConnected && typeof el.focus === 'function') el.focus();
  }, []);

  const internal: ModalContextValue = { selectedCard, open, close, restoreFocus };
  return <ModalContext.Provider value={value ?? internal}>{children}</ModalContext.Provider>;
}
```

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Full suite + build**

- [ ] **Step 6: Commit**

```bash
git add src/context/ModalContext.tsx src/context/__tests__/ModalContext.test.tsx
git commit -m "feat(context): add ModalContext with focus capture and test-injection seam"
```

---

## Task 6: Modal Shell + LeftColumn + RightColumn (no LevelTable, no stepper yet)

**Files:**
- Create: `src/components/CardDetailModal/index.tsx`
- Create: `src/components/CardDetailModal/LeftColumn.tsx`
- Create: `src/components/CardDetailModal/RightColumn.tsx`

**Goal:** Render the modal shell, two-phase close, Escape/backdrop close, focus trap. Left column = image + Current Level + Next Level (no LevelTable). Right column = name + description + stat grid + (placeholder) prereqs/progression/unlocks/notes + (placeholder) footer with cost + plain Build CTA. The LevelTable, QuantityStepper, and PrereqPills slots render `null` for now (added in Task 7).

```
TASK: Create CardDetailModal index.tsx + LeftColumn.tsx + RightColumn.tsx per spec.
ALLOWED WRITES: src/components/CardDetailModal/index.tsx, .../LeftColumn.tsx, .../RightColumn.tsx
READ-ONLY CONTEXT: design handoff README.md, spec sections "Architecture", "Modal Lifecycle & Interactions", "Animation", "Focus management".
NON-GOALS: do not implement LevelTable, QuantityStepper, PrereqPills (next task).
DONE MEANS: <CardDetailModal /> renders for any selectedCard, closes via X / backdrop / Escape, two-phase close drives data-state attribute, no test failures introduced.
```

(See spec for layout dimensions, type accents, animation keyframe semantics. Use `createPortal` to render into `document.body`. Wire `useModal()` for state, `useGame()` for data, `cardStatsFor` / `getStrategicNote` from Task 1–3.)

- [ ] Step 1: Stub each file with the empty subcomponents and the portal+backdrop+container structure.
- [ ] Step 2: Implement two-phase close via local `displayedCard` state and `data-state` attribute. Test manually with a temporary direct call from console.
- [ ] Step 3: Wire Escape handler (effect with cleanup), backdrop click, X button.
- [ ] Step 4: Implement focus trap (Tab cycles inside the modal — small inline implementation).
- [ ] Step 5: After exit animation, call `useModal().restoreFocus()`.
- [ ] Step 6: `npm run build && npm test` clean.
- [ ] Step 7: Commit.

```bash
git add src/components/CardDetailModal/
git commit -m "feat(modal): add CardDetailModal shell, LeftColumn, RightColumn"
```

---

## Task 7: LevelTable + QuantityStepper + PrereqPills

**Files:**
- Create: `src/components/CardDetailModal/LevelTable.tsx`
- Create: `src/components/CardDetailModal/QuantityStepper.tsx`
- Create: `src/components/CardDetailModal/PrereqPills.tsx`
- Modify: `src/components/CardDetailModal/RightColumn.tsx` (replace the placeholders with the new subcomponents).

**Goal:** Fill in the interactive children. LevelTable consumes `LevelRow[]` from helpers; QuantityStepper handles −/+/MAX/input/CTA-label-update; PrereqPills uses `prereqRowsFor` output and the timer-cancellation pattern for navigation.

```
TASK: Implement LevelTable, QuantityStepper, PrereqPills; wire RightColumn to use them.
ALLOWED WRITES: src/components/CardDetailModal/{LevelTable,QuantityStepper,PrereqPills,RightColumn}.tsx
READ-ONLY CONTEXT: spec "QUEUE badges...", "Quantity stepper", "Prereq pill navigation", "After successful CTA — modal stays open".
NON-GOALS: do not change CSS or helpers.
DONE MEANS: NOW/QUEUE/NEXT badges render correctly; MAX button computes via maxAffordable; clicking unmet prereq calls open() after 150 ms with timer-cancellation on rapid re-click; build/test clean.
```

- [ ] **Step 1: LevelTable.tsx** — props `{ rows: LevelRow[]; accentColor: string; hasDeut: boolean; hasEnergy: boolean }`. Renders the table per spec "QUEUE badges in the Level Progression table". `hasDeut` and `hasEnergy` are computed by the caller (`rows.some(r => r.deuterium > 0)` / `rows.some(r => r.energy !== 0)`). Each row tints based on its `current/queued/next` flag.
- [ ] **Step 2: QuantityStepper.tsx** — props `{ qty: number; setQty: (n:number)=>void; cost: ResourceCost; timeSeconds: number; type: 'ship'|'defence'; resources: ResourcesState; maxCount?: number; existingCount?: number }`. − / + / number-input / MAX / total cost pills / total time. MAX uses `maxAffordable(...)`.
- [ ] **Step 3: PrereqPills.tsx** — props `{ rows: PrereqRow[] }`. Calls `useModal()` for the click handler. Holds `useRef<ReturnType<typeof setTimeout> | null>(null)` for the deferred nav; clears it before each new schedule and on unmount; uses `useState<string | null>(navigatingTo)` for the inline toast.
- [ ] **Step 4: RightColumn.tsx** — replace the Task 6 placeholders. Use `prereqRowsFor(...)`, `buildingProgression(...) / researchProgression(...)`, `enablesFor(...)`, `getStrategicNote(...)` to build the props for the new subcomponents.
- [ ] **Step 5: Manual smoke** — `npm run dev`, click a building card; verify NOW/QUEUE/NEXT render, MAX behaves, prereq pill click swaps the modal after the toast.
- [ ] **Step 6: `npm run build && npm test`** — clean.
- [ ] **Step 7: Commit:**

```bash
git add src/components/CardDetailModal/
git commit -m "feat(modal): add LevelTable, QuantityStepper, PrereqPills"
```

---

## Task 8: CSS — Modal styles in `src/styles.css`

**Files:**
- Modify: `src/styles.css`

**Goal:** All modal styling under a `.card-detail-modal` namespace, appended at the bottom of `styles.css` under a clear comment marker.

```
TASK: Append modal CSS to src/styles.css per design handoff (Proposal A).
ALLOWED WRITES: src/styles.css (append only — do NOT modify existing rules)
READ-ONLY CONTEXT: design handoff README "Container", "Top Bar", "Body", animation keyframes; spec "Animation".
NON-GOALS: no token changes; no new CSS files.
DONE MEANS: visual output matches the prototype; existing styles unchanged.
```

- [ ] Step 1: Add a `/* ── Card Detail Modal (Issue #44) ─────────── */` marker comment.
- [ ] Step 2: Backdrop (`.card-detail-modal__backdrop`), container, top bar, columns, badges, pills, stepper, CTA button, animation `@keyframes`.
- [ ] Step 3: Visually verify with `npm run dev` and clicking through all 4 card types.
- [ ] Step 4: Commit:

```bash
git add src/styles.css
git commit -m "style(modal): add CardDetailModal CSS"
```

---

## Task 9: Wire `<ModalProvider>` and `<CardDetailModal />` into App.tsx

**Files:**
- Modify: `src/App.tsx`

```
TASK: Wrap children in <ModalProvider>; render <CardDetailModal /> once at App root inside ModalProvider.
ALLOWED WRITES: src/App.tsx
NON-GOALS: do NOT touch panels yet.
DONE MEANS: App still renders; opening a modal from the React DevTools (calling open() in a hook) shows the modal.
```

- [ ] Step 1: Add `import { ModalProvider } from './context/ModalContext'`; `import { CardDetailModal } from './components/CardDetailModal'`.
- [ ] Step 2: Wrap children in `<ModalProvider>`; render `<CardDetailModal />` as a sibling of the existing app shell (so it's portaled but mounted under the provider).
- [ ] Step 3: `npm run build && npm test`
- [ ] Step 4: Commit:

```bash
git add src/App.tsx
git commit -m "feat(app): mount ModalProvider and CardDetailModal at root"
```

---

## Task 10: Wire All Four Panels — Article Click + Keydown + Interactive-Child Guard

**Files:**
- Modify: `src/panels/BuildingsPanel.tsx`
- Modify: `src/panels/ResearchPanel.tsx`
- Modify: `src/panels/ShipyardPanel.tsx`
- Modify: `src/panels/DefencePanel.tsx`

**Goal:** Each panel's article gets the shared interactive-child-guarded onClick + onKeyDown + role/tabIndex. Solar Satellite card in Buildings calls `open('ship', 'solarSatellite')`. **No per-element `stopPropagation`.**

```
TASK: Wire article-level click+keydown handlers on all four panels per spec "Opening".
ALLOWED WRITES: src/panels/{BuildingsPanel,ResearchPanel,ShipyardPanel,DefencePanel}.tsx
READ-ONLY CONTEXT: spec "Opening", "Modified files".
NON-GOALS: no logic changes to existing buttons.
DONE MEANS: clicking any card opens the modal; clicking the inner Build/Upgrade button still triggers ONLY the existing action and does NOT open the modal; Solar Satellite input is type-able without opening the modal; all existing tests still pass.
```

- [ ] Step 1: In a shared place (could be inline in each panel — or a tiny `src/panels/_useCardOpenHandlers.ts` if you prefer), define:

```ts
const INTERACTIVE_SELECTOR = 'button, input, select, textarea, a';

function useCardOpenHandlers(type: CardType, id: string) {
  const { open } = useModal();
  const onClick = (e: React.MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
    open(type, id);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
    e.preventDefault();
    open(type, id);
  };
  return { onClick, onKeyDown, role: 'button' as const, tabIndex: 0 };
}
```

- [ ] Step 2: BuildingsPanel: spread the handlers onto each `<article className="item-card">` for buildings AND onto the Solar Satellite article (calling `useCardOpenHandlers('ship', 'solarSatellite')`).
- [ ] Step 3: ResearchPanel: spread onto `<article className="research-card">`.
- [ ] Step 4: Shipyard + Defence: spread onto each `<article className="item-card">`.
- [ ] Step 5: Manual smoke: open every card type, verify the inner Build/Upgrade button still works without bubbling, verify typing in Solar Satellite input doesn't open the modal.
- [ ] Step 6: Commit:

```bash
git add src/panels/
git commit -m "feat(panels): open card detail modal on article click/keydown across all four panels"
```

---

## Task 11: Component Tests — Test Infra + Per-Type Happy Paths

**Files:**
- Modify: `src/test/test-utils.tsx`
- Create: `src/test/SpyModalProvider.tsx`
- Create: `src/components/CardDetailModal/__tests__/CardDetailModal.test.tsx`

```
TASK: Add modal-aware test infra and one happy-path component test per card type.
ALLOWED WRITES: src/test/test-utils.tsx, src/test/SpyModalProvider.tsx, src/components/CardDetailModal/__tests__/CardDetailModal.test.tsx
READ-ONLY CONTEXT: spec "Test Plan", "Test infra".
DONE MEANS: 4 happy-path tests pass + prereq-nav test using SpyModalProvider passes; npm test green.
```

- [ ] Step 1: Extend `renderWithGame()` to optionally accept `modal?: { selectedCard?: SelectedCard } | { value?: ModalContextValue }`. Default = no modal wrapper (keeps existing tests untouched). Document the two forms inline.
- [ ] Step 2: Create `SpyModalProvider.tsx` exporting both the wrapper component and a `createSpyModalValue(initial?: SelectedCard)` factory that returns `{ value, spies: { open, close, restoreFocus } }`.
- [ ] Step 3: Component tests — see spec "Component tests" for the four cases. Use `vi.useFakeTimers()` for the prereq-nav case. Replace any earlier draft test code that asserted on `useModal().open` directly: now use `spies.open.mock.calls`.
- [ ] Step 4: `npm test`
- [ ] Step 5: Commit:

```bash
git add src/test/ src/components/CardDetailModal/__tests__/
git commit -m "test(modal): add per-type happy-path tests + SpyModalProvider helper"
```

---

## Task 12: Integration Test — Click → Modal → CTA → QUEUE Badge → Escape

**Files:**
- Create: `src/test/integration/cardDetailModal.test.tsx`

```
TASK: Add the single integration test described in spec "Integration test".
ALLOWED WRITES: src/test/integration/cardDetailModal.test.tsx
READ-ONLY CONTEXT: spec "Integration test"; existing integration tests in src/test/integration/.
DONE MEANS: the test passes; existing integration tests still pass.
```

- [ ] Step 1: Write the test per spec — DOM assertions only (`waitFor`, `getByRole`, badge visibility), no direct `gameState` reads.
- [ ] Step 2: `npm test`
- [ ] Step 3: Commit:

```bash
git add src/test/integration/
git commit -m "test(integration): add card-detail-modal end-to-end flow"
```

---

## Task 13: Manual Smoke Test (Human, not Codex)

This is a checklist for the human reviewer after Tasks 1–12 land. Do not dispatch to Codex.

- [ ] `npm run dev`
- [ ] Open the Buildings panel. Click a building card (not the upgrade button) → modal opens with Lv N stats, Next Level block, level table with NOW + NEXT badges.
- [ ] Press Escape → modal closes; focus returns to the card.
- [ ] Click the upgrade button on the same card directly → upgrade queues but modal stays closed (button stopPropagation/guard works).
- [ ] Click the card → modal opens; click upgrade in modal → modal stays open; CTA flips to "Queue → Lv N+1"; level table shows QUEUE badge on the queued row.
- [ ] Click an unmet prereq pill (e.g. on a higher-tier building) → "Navigating to …" toast appears, modal swaps to the prereq's card.
- [ ] Open a Research card → progression rows from Lv 1 to current+3.
- [ ] Open a Ship card (Cruiser) → stat grid, quantity stepper, MAX button, CTA "Build Ships ×N" updates with qty.
- [ ] Open a Defence card → same; for `smallShieldDome` already built or queued, MAX = 0 and CTA disabled.
- [ ] Open Solar Satellite from the Buildings panel → ship modal with Energy/unit stat; underlying inline form still works without triggering the modal when interacting with the input.
- [ ] Watch a tick or two pass with the modal open — no flicker, no animation replay.

If anything fails, file a follow-up issue / amend the relevant task and re-run.

---

## After All Tasks

- [ ] Open a PR from `feat/card-detail-modal` to `main`. PR body should link the spec, both Codex review files, and reference Issue #44.
- [ ] Tag for cleanup follow-up if any TODOs were introduced (none expected).
