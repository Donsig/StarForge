/// <reference types="vitest/globals" />

import { createNewGameState } from '../../models/GameState.ts';
import type { NPCColony, NPCSpecialty } from '../../models/Galaxy.ts';
import { createNPCColonyForTier } from '../GalaxyEngine.ts';
import {
  applyUpgradeIncrement,
  processUpgrades,
  recordRaid,
} from '../NPCUpgradeEngine.ts';
import { SHIPS } from '../../data/ships.ts';

function createColony(
  specialty: NPCSpecialty,
  overrides: Partial<NPCColony> = {},
): NPCColony {
  return {
    coordinates: { galaxy: 1, system: 5, slot: 8 },
    name: 'NPC',
    tier: 6,
    specialty,
    maxTier: 8,
    initialUpgradeIntervalMs: 10_000,
    currentUpgradeIntervalMs: 10_000,
    lastUpgradeAt: 0,
    upgradeTickCount: 0,
    raidCount: 0,
    recentRaidTimestamps: [],
    abandonedAt: undefined,
    buildings: {
      metalMine: 1,
      crystalMine: 1,
      deuteriumSynthesizer: 1,
      metalStorage: 1,
      researchLab: 1,
    },
    baseDefences: {
      rocketLauncher: 0,
      lightLaser: 0,
      heavyLaser: 0,
      ionCannon: 0,
      plasmaTurret: 0,
    },
    baseShips: {
      lightFighter: 0,
      cruiser: 0,
      battleship: 0,
      battlecruiser: 0,
      solarSatellite: 0,
    },
    currentDefences: {
      rocketLauncher: 0,
      lightLaser: 0,
      heavyLaser: 0,
      ionCannon: 0,
      plasmaTurret: 0,
    },
    currentShips: {
      lightFighter: 0,
      cruiser: 0,
      battleship: 0,
      battlecruiser: 0,
      solarSatellite: 0,
    },
    lastRaidedAt: 0,
    resources: { metal: 10_000_000, crystal: 10_000_000, deuterium: 10_000_000 },
    targetTier: 6,
    catchUpUpgradeIntervalMs: 2_500,
    catchUpProgressTicks: 0,
    ...overrides,
    temperature: overrides.temperature ?? 20,
  };
}

describe('NPCUpgradeEngine', () => {
  describe('applyUpgradeIncrement', () => {
    it('applies turtle speciality defence increment', () => {
      const colony = createColony('turtle', { tier: 4, upgradeTickCount: 0 });
      applyUpgradeIncrement(colony, () => 0.5);
      expect(colony.baseDefences.rocketLauncher).toBe(5);
    });

    it('applies fleeter speciality ship increment', () => {
      const colony = createColony('fleeter', { tier: 6, upgradeTickCount: 1 });
      applyUpgradeIncrement(colony, () => 0.5);
      expect(colony.baseShips.cruiser).toBe(2);
    });

    it('miner specialty builds satellites on tick%3===2', () => {
      const colony = createColony('miner', { upgradeTickCount: 5 });
      colony.currentShips.solarSatellite = 0;
      colony.baseShips.solarSatellite = 0;
      applyUpgradeIncrement(colony, () => 0.5);
      expect(colony.baseShips.solarSatellite).toBeGreaterThan(0);
    });

    it('caps miner building growth during long catch-up runs', () => {
      const colony = createNPCColonyForTier({ galaxy: 1, system: 12, slot: 7 }, 8, 12345);
      colony.specialty = 'miner';
      colony.maxTier = 10;

      for (let tick = 0; tick < 300; tick += 1) {
        applyUpgradeIncrement(colony, () => 0.5);
        colony.upgradeTickCount += 1;
      }

      expect(colony.buildings.deuteriumSynthesizer).toBeLessThanOrEqual(colony.maxTier * 2);
      expect(colony.buildings.metalMine).toBeLessThanOrEqual(colony.maxTier * 2);
      expect(colony.buildings.crystalMine).toBeLessThanOrEqual(colony.maxTier * 2);
    });

    it('applies balanced speciality defence branch at phase 2', () => {
      const colony = createColony('balanced', { tier: 6, upgradeTickCount: 2 });
      applyUpgradeIncrement(colony, () => 0.5);
      expect(colony.baseDefences.ionCannon).toBe(1);
    });

    it('applies raider speciality high-tier battlecruiser increment', () => {
      const colony = createColony('raider', { tier: 8, upgradeTickCount: 0 });
      applyUpgradeIncrement(colony, () => 0.5);
      expect(colony.baseShips.battlecruiser).toBe(2);
    });

    it('applies researcher lab increment at phase 4', () => {
      const colony = createColony('researcher', { tier: 6, upgradeTickCount: 4 });
      applyUpgradeIncrement(colony, () => 0.5);
      expect(colony.buildings.researchLab).toBe(2);
    });
  });

  describe('recordRaid', () => {
    it('applies long-term adaptation after 10 raids', () => {
      const colony = createColony('balanced', {
        raidCount: 9,
        initialUpgradeIntervalMs: 10_000,
        currentUpgradeIntervalMs: 10_000,
      });

      recordRaid(colony, 100_000, 1);

      expect(colony.raidCount).toBe(10);
      expect(colony.currentUpgradeIntervalMs).toBe(8000);
    });

    it('respecialises to turtle and collapses after repeated short-term raids', () => {
      const now = 200_000;
      const colony = createColony('fleeter', {
        raidCount: 14,
        recentRaidTimestamps: [now - 1000, now - 2000],
      });

      recordRaid(colony, now, 1);

      expect(colony.raidCount).toBe(15);
      expect(colony.specialty).toBe('turtle');
      expect(colony.abandonedAt).toBe(now);
    });
  });

  describe('processUpgrades', () => {
    it('runs catch-up loops for elapsed upgrade intervals', () => {
      const state = createNewGameState();
      state.settings.gameSpeed = 1;
      state.galaxy.seed = 42;
      state.galaxy.npcColonies = [
        createColony('miner', {
          initialUpgradeIntervalMs: 10_000,
          currentUpgradeIntervalMs: 10_000,
          lastUpgradeAt: 0,
          upgradeTickCount: 0,
        }),
      ];

      processUpgrades(state, 30_000, 0);

      const colony = state.galaxy.npcColonies[0];
      expect(colony.upgradeTickCount).toBe(3);
      expect(colony.lastUpgradeAt).toBe(30_000);
      expect(colony.buildings.metalMine).toBe(2);
      expect(colony.buildings.crystalMine).toBe(2);
      expect(colony.buildings.deuteriumSynthesizer).toBe(1);
      expect(colony.baseShips.solarSatellite).toBeGreaterThan(0);
    });

    it('removes expired abandoning colonies and recalls missions to target coordinates', () => {
      const now = 300_000;
      const state = createNewGameState();
      state.settings.gameSpeed = 1;
      state.galaxy.npcColonies = [
        createColony('balanced', {
          coordinates: { galaxy: 1, system: 9, slot: 2 },
          abandonedAt: now - (49 * 3600 * 1000),
        }),
      ];
      state.fleetMissions = [
        {
          id: 'mission_expired',
          type: 'attack',
          status: 'outbound',
          sourcePlanetIndex: 0,
          targetCoordinates: { galaxy: 1, system: 9, slot: 2 },
          targetType: 'npc_colony',
          ships: { smallCargo: 1 },
          cargo: { metal: 0, crystal: 0, deuterium: 0 },
          fuelCost: 10,
          departureTime: now - 1000,
          arrivalTime: now + 1000,
          returnTime: 0,
        },
      ];

      processUpgrades(state, now, 0);

      expect(state.galaxy.npcColonies).toHaveLength(0);
      expect(state.fleetMissions[0].status).toBe('returning');
      expect(state.fleetMissions[0].returnTime).toBe(now + 30_000);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cost-gated upgrade tests (Task 20)
// These tests drive the v18 cost-gating changes to NPCUpgradeEngine.
// They will FAIL against the current production code because:
//   1. NPCColony has `resourcesAtLastRaid`, not `resources` (v17 schema).
//   2. addShip/addDefence/upgradeBuilding don't debit resources yet.
//   3. maxShipsForTier / maxDefencesForTier caps still apply.
// ─────────────────────────────────────────────────────────────────────────────

// Helper: build a colony that carries a v18-style `resources` field.
// We patch it onto the existing NPCColony shape with `as any` until v18 ships.
function createV18Colony(
  specialty: NPCSpecialty,
  resources: { metal: number; crystal: number; deuterium: number },
  overrides: Partial<NPCColony> = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const base = createColony(specialty, overrides);
  // Remove v17 field, add v18 field
  const colony = base as Record<string, unknown>;
  delete colony['resourcesAtLastRaid'];
  colony['resources'] = { ...resources };
  return colony;
}

describe('NPCUpgradeEngine – cost-gated upgrades (Task 20)', () => {
  // Cost reference: lightFighter = 3000 metal + 1000 crystal + 0 deuterium
  const LIGHT_FIGHTER_COST = SHIPS.lightFighter.cost;   // { metal: 3000, crystal: 1000, deuterium: 0 }
  // cruiser = 20000 metal + 7000 crystal + 2000 deuterium
  const CRUISER_COST = SHIPS.cruiser.cost;
  // battleship = 45000 metal + 15000 crystal + 5000 deuterium
  const BATTLESHIP_COST = SHIPS.battleship.cost;

  it('does NOT add ship when colony cannot afford it', () => {
    // Colony has 0 resources — cannot afford even a light fighter.
    const colony = createV18Colony('fleeter', { metal: 0, crystal: 0, deuterium: 0 }, {
      tier: 4,
      upgradeTickCount: 0, // fleeter step 0 → lightFighter (tier≤4)
    });

    applyUpgradeIncrement(colony, () => 0.5);

    expect(colony.baseShips.lightFighter ?? 0).toBe(0);
    // Resources must be unchanged
    expect(colony.resources.metal).toBe(0);
    expect(colony.resources.crystal).toBe(0);
  });

  it('adds ship and debits resources when colony can afford it', () => {
    // Fleeter at tier 4, step 0 → tries to add lightFighter (quantity=3)
    // lightFighter cost: 3000 metal + 1000 crystal per unit, so 3 units = 9000m + 3000c
    const metalNeeded = LIGHT_FIGHTER_COST.metal * 3;
    const crystalNeeded = LIGHT_FIGHTER_COST.crystal * 3;

    const colony = createV18Colony('fleeter', {
      metal: metalNeeded + 5000,   // plenty
      crystal: crystalNeeded + 2000,
      deuterium: 0,
    }, {
      tier: 4,
      upgradeTickCount: 0,
    });

    const metalBefore = colony.resources.metal;
    const crystalBefore = colony.resources.crystal;

    applyUpgradeIncrement(colony, () => 0.5);

    // Ship count should have increased
    expect(colony.baseShips.lightFighter).toBeGreaterThan(0);
    // Resources should be debited
    expect(colony.resources.metal).toBeLessThan(metalBefore);
    expect(colony.resources.crystal).toBeLessThan(crystalBefore);
  });

  it('fleeter specialty falls back to cruiser when battleship is unaffordable', () => {
    // Tier 7+ fleeter step 0/1 → tries battleship (45000m+15000c+5000d per unit)
    // Give enough for a cruiser (20000m+7000c+2000d) but not battleship
    const cruiserMetal = CRUISER_COST.metal + 2000;       // just enough for 1 cruiser
    const cruiserCrystal = CRUISER_COST.crystal + 1000;
    const cruiserDeuterium = CRUISER_COST.deuterium + 500;

    const colony = createV18Colony('fleeter', {
      metal: cruiserMetal,
      crystal: cruiserCrystal,
      deuterium: cruiserDeuterium,
    }, {
      tier: 7,
      upgradeTickCount: 0, // fleeter step 0 → battleship planned (tier>6)
    });

    const cruiserBefore = colony.baseShips.cruiser ?? 0;
    const battleshipBefore = colony.baseShips.battleship ?? 0;

    applyUpgradeIncrement(colony, () => 0.5);

    // Battleship must NOT be built (too expensive)
    expect(colony.baseShips.battleship ?? 0).toBe(battleshipBefore);
    // Cruiser must be built as fallback
    expect(colony.baseShips.cruiser ?? 0).toBeGreaterThan(cruiserBefore);
    // Resources debited by cruiser cost
    expect(colony.resources.metal).toBeLessThan(cruiserMetal);
  });

  it('banks resources when nothing is affordable', () => {
    // Colony with zero resources — no ship, defence, or building upgrade can happen.
    const colony = createV18Colony('balanced', { metal: 0, crystal: 0, deuterium: 0 }, {
      tier: 5,
      upgradeTickCount: 0,
    });

    const baseShipsBefore = JSON.stringify(colony.baseShips);
    const baseDefencesBefore = JSON.stringify(colony.baseDefences);
    const buildingsBefore = JSON.stringify(colony.buildings);

    applyUpgradeIncrement(colony, () => 0.5);

    // Nothing should have changed
    expect(JSON.stringify(colony.baseShips)).toBe(baseShipsBefore);
    expect(JSON.stringify(colony.baseDefences)).toBe(baseDefencesBefore);
    expect(JSON.stringify(colony.buildings)).toBe(buildingsBefore);
    // Resources still zero
    expect(colony.resources.metal).toBe(0);
    expect(colony.resources.crystal).toBe(0);
    expect(colony.resources.deuterium).toBe(0);
  });

  it('building upgrade is blocked when colony cannot afford it', () => {
    // Turtle specialty at step 2 (phase % 3 === 2) → upgradeBuilding metalMine
    // metalMine upgrade cost (level 2): baseCost 60m 15c * multiplier^1 ≈ 120m 30c
    // Give 0 resources to guarantee failure.
    const colony = createV18Colony('turtle', { metal: 0, crystal: 0, deuterium: 0 }, {
      tier: 4,
      upgradeTickCount: 2, // step = 2 → upgradeBuilding metalMine
      buildings: {
        metalMine: 1, crystalMine: 1, deuteriumSynthesizer: 1,
        solarPlant: 0, fusionReactor: 0, metalStorage: 0,
        crystalStorage: 0, deuteriumTank: 0, roboticsFactory: 0,
        naniteFactory: 0, shipyard: 0, researchLab: 0,
      },
    });

    const metalMineBefore = colony.buildings.metalMine;

    applyUpgradeIncrement(colony, () => 0.5);

    // Building must NOT have upgraded
    expect(colony.buildings.metalMine).toBe(metalMineBefore);
  });

  it('removes maxShipsForTier caps — a large-economy colony can build beyond old tier*25 limit', () => {
    // The old code capped lightFighter at tier * 25 = 150 for tier 6.
    // With cost gating and no artificial cap, a colony with vast resources can exceed 150.
    const LOTS_OF_RESOURCES = 50_000_000;
    const colony = createV18Colony('fleeter', {
      metal: LOTS_OF_RESOURCES,
      crystal: LOTS_OF_RESOURCES,
      deuterium: LOTS_OF_RESOURCES,
    }, {
      tier: 6,
      upgradeTickCount: 0,
    });

    // Run 200 upgrade ticks (tier 6, fleeter step 0/1 → cruiser/lightFighter)
    for (let tick = 0; tick < 200; tick += 1) {
      applyUpgradeIncrement(colony, () => 0.5);
      colony.upgradeTickCount += 1;
    }

    // Old cap was tier * 25 = 150 for lightFighter. Post-Task-20 there is no cap,
    // so with huge resources the count should exceed 150.
    // (For cruiser the old cap was tier * 10 = 60 — also check that.)
    const totalFighters = (colony.baseShips.lightFighter ?? 0) + (colony.baseShips.cruiser ?? 0);
    expect(totalFighters).toBeGreaterThan(150);
  });

  it('randomness occasionally skips upgrades even when affordable', () => {
    // Feed a controlled rng that always returns values < 0.1 (below the 10% bank threshold).
    // Over many ticks, some ticks should be skipped (resources unchanged despite being affordable).
    const alwaysLow = () => 0.05; // below 0.1 → always triggers "bank" behaviour

    const metalPerTick = LIGHT_FIGHTER_COST.metal * 3;  // enough for each intended upgrade
    const crystalPerTick = LIGHT_FIGHTER_COST.crystal * 3;

    // Provide very large resources so affordability is never the bottleneck
    const colony = createV18Colony('fleeter', {
      metal: metalPerTick * 500,
      crystal: crystalPerTick * 500,
      deuterium: 0,
    }, {
      tier: 4,
      upgradeTickCount: 0,
    });

    const resourcesSpentPerActualUpgrade = metalPerTick;
    let skippedTicks = 0;

    for (let tick = 0; tick < 100; tick += 1) {
      const metalBefore = colony.resources.metal;
      applyUpgradeIncrement(colony, alwaysLow);
      colony.upgradeTickCount += 1;
      if (colony.resources.metal === metalBefore) {
        skippedTicks += 1;
      }
      void resourcesSpentPerActualUpgrade; // suppress unused warning
    }

    // If the randomness feature is implemented, at least some ticks should be skipped.
    // With alwaysLow rng (0.05 < 0.1 threshold), ideally ALL 100 ticks are skipped.
    // We assert at least 1 skip to detect presence of the feature without being fragile.
    expect(skippedTicks).toBeGreaterThan(0);
  });

  it('cost gating does not affect abandoned colonies', () => {
    // An abandoned colony should not be touched by applyUpgradeIncrement at all.
    // This remains valid regardless of cost gating.
    const colony = createV18Colony('fleeter', {
      metal: 10_000_000,
      crystal: 10_000_000,
      deuterium: 10_000_000,
    }, {
      tier: 6,
      upgradeTickCount: 0,
      abandonedAt: Date.now() - 1000,
    });

    const shipsBefore = JSON.stringify(colony.baseShips);
    const defencesBefore = JSON.stringify(colony.baseDefences);

    // processUpgrades skips abandoned colonies at the iteration level, but
    // applyUpgradeIncrement itself may or may not guard against it.
    // We call it directly and verify the colony is not mutated.
    applyUpgradeIncrement(colony, () => 0.5);

    expect(JSON.stringify(colony.baseShips)).toBe(shipsBefore);
    expect(JSON.stringify(colony.baseDefences)).toBe(defencesBefore);
  });
});
