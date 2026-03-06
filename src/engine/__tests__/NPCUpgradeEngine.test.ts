/// <reference types="vitest/globals" />

import { createNewGameState } from '../../models/GameState.ts';
import type { NPCColony, NPCSpecialty } from '../../models/Galaxy.ts';
import {
  applyUpgradeIncrement,
  processUpgrades,
  recordRaid,
} from '../NPCUpgradeEngine.ts';

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
    resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 },
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
      expect(colony.buildings.deuteriumSynthesizer).toBe(2);
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
