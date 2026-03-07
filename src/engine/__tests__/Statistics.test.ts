import { createNewGameState } from '../../models/GameState';
import { dispatch, dispatchHarvest } from '../FleetEngine';
import { getStorageCaps, processTick as resourceTick } from '../ResourceEngine';

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
    state.planets[0].buildings.solarPlant = 20;
    state.planets[0].resources.metal = 0;

    const before = state.statistics.resourcesMined.metal;
    resourceTick(state);

    expect(state.statistics.resourcesMined.metal).toBeGreaterThan(before);
  });

  it('resourcesMined does NOT overcount when storage is full', () => {
    const state = createNewGameState();
    state.planets[0].buildings.metalMine = 5;
    state.planets[0].buildings.solarPlant = 20;

    const caps = getStorageCaps(state.planets[0]);
    state.planets[0].resources.metal = caps.metal;

    const before = state.statistics.resourcesMined.metal;
    resourceTick(state);

    expect(state.statistics.resourcesMined.metal).toBe(before);
  });

  it('fleet.sent increments on dispatch', () => {
    const state = createNewGameState();
    state.research.combustionDrive = 6;
    state.planets[0].ships.lightFighter = 5;
    state.planets[0].resources.deuterium = 10000;
    state.planets[0].coordinates = { galaxy: 1, system: 1, slot: 4 };
    const target = { galaxy: 1, system: 3, slot: 5 };

    state.galaxy.npcColonies.push({
      coordinates: target,
      name: 'NPC',
      temperature: 20,
      tier: 1,
      specialty: 'balanced',
      maxTier: 5,
      initialUpgradeIntervalMs: 21_600_000,
      currentUpgradeIntervalMs: 21_600_000,
      targetTier: 1,
      catchUpUpgradeIntervalMs: 5_400_000,
      catchUpProgressTicks: 0,
      lastUpgradeAt: 0,
      upgradeTickCount: 0,
      raidCount: 0,
      recentRaidTimestamps: [],
      buildings: {},
      baseDefences: {},
      baseShips: {},
      currentDefences: {},
      currentShips: {},
      lastRaidedAt: 0,
      resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 },
    });

    dispatch(state, 0, target, { lightFighter: 5 }, 'attack');

    expect(state.statistics.fleet.sent.attack).toBe(1);
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

    expect(state.statistics.fleet.sent.harvest).toBe(1);
  });
});
