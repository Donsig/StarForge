import { generateNPCColonies } from '../GalaxyEngine';
import { createNewGameState } from '../../models/GameState';
import { processUpgrades } from '../NPCUpgradeEngine';

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

describe('NPC upgrade targeting', () => {
  it('raises targetTier from explicit playerTotal before upgrade processing', () => {
    const state = createNewGameState();
    state.galaxy.npcColonies = [
      {
        coordinates: { galaxy: 1, system: 2, slot: 1 },
        name: 'Test Colony',
        temperature: 50,
        tier: 1,
        targetTier: 1,
        specialty: 'balanced',
        maxTier: 5,
        initialUpgradeIntervalMs: 1000,
        currentUpgradeIntervalMs: 1000,
        catchUpUpgradeIntervalMs: 250,
        catchUpProgressTicks: 0,
        lastUpgradeAt: 0,
        upgradeTickCount: 0,
        raidCount: 0,
        recentRaidTimestamps: [],
        abandonedAt: undefined,
        buildings: {
          metalMine: 2,
          crystalMine: 1,
          deuteriumSynthesizer: 0,
          solarPlant: 1,
          fusionReactor: 0,
          roboticsFactory: 0,
          naniteFactory: 0,
          shipyard: 1,
          researchLab: 1,
          metalStorage: 1,
          crystalStorage: 1,
          deuteriumTank: 1,
        },
        baseDefences: {},
        baseShips: {},
        currentDefences: {},
        currentShips: {},
        lastRaidedAt: 0,
        resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 },
      },
    ];

    processUpgrades(state, 0, 1000);

    expect(state.galaxy.npcColonies[0].targetTier).toBe(2);
  });
});
