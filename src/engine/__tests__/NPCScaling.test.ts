import { generateNPCColonies, getNPCResources } from '../GalaxyEngine';
import { createNewGameState } from '../../models/GameState';
import { computeEffectiveMinTier, processUpgrades } from '../NPCUpgradeEngine';

function makeStateWithColony() {
  const state = createNewGameState();
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
  }];
  return state;
}

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
    const state = makeStateWithColony();
    state.galaxy.npcColonies[0].targetTier = 1;
    state.galaxy.npcColonies[0].initialUpgradeIntervalMs = 1000;
    state.galaxy.npcColonies[0].currentUpgradeIntervalMs = 1000;
    state.galaxy.npcColonies[0].catchUpUpgradeIntervalMs = 250;

    processUpgrades(state, 0, 1000);

    expect(state.galaxy.npcColonies[0].targetTier).toBe(2);
  });
});

describe('computeEffectiveMinTier', () => {
  it('returns 1 for zero score', () => {
    expect(computeEffectiveMinTier(0)).toBe(1);
  });

  it('returns tier equal to floor(playerTotal / 500)', () => {
    expect(computeEffectiveMinTier(500)).toBe(1); // floor(500/500) = 1, then clamp min 1
    expect(computeEffectiveMinTier(1000)).toBe(2);
  });

  it('caps at 10', () => {
    expect(computeEffectiveMinTier(999_999)).toBe(10);
  });
});

describe('catch-up upgrade mode', () => {
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

describe('getNPCResources post-raid state', () => {
  it('respects resourcesAtLastRaid instead of snapping back to a tier floor', () => {
    const now = Date.now();
    const baseline = { metal: 1_000, crystal: 500, deuterium: 0 };
    const colony = {
      ...makeStateWithColony().galaxy.npcColonies[0]!,
      tier: 4,
      lastRaidedAt: now,
      resourcesAtLastRaid: baseline,
    };

    const resources = getNPCResources(colony, now, 1);

    expect(resources).toEqual(baseline);
  });
});
