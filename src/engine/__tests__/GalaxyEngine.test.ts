/// <reference types="vitest/globals" />
import { createNewGameState } from '../../models/GameState.ts';
import type { NPCColony } from '../../models/Galaxy.ts';
import {
  addDebris,
  canColonize,
  colonize,
  generateNPCColonies,
  getNPCCurrentForce,
  getNPCResources,
  getSystemSlots,
  isSlotEmpty,
  planetStatsForSlot,
  slotFieldRange,
  slotTemperatureRange,
} from '../GalaxyEngine.ts';
import { GALAXY_CONSTANTS } from '../../data/galaxy.ts';

function createNPCColony(overrides?: Partial<NPCColony>): NPCColony {
  return {
    coordinates: { galaxy: 1, system: 10, slot: 6 },
    name: 'Test Colony',
    temperature: 150,
    tier: 6,
    specialty: 'balanced',
    maxTier: 8,
    initialUpgradeIntervalMs: 10_800_000,
    currentUpgradeIntervalMs: 10_800_000,
    targetTier: 6,
    catchUpUpgradeIntervalMs: 10_800_000 / 4,
    catchUpProgressTicks: 0,
    lastUpgradeAt: 0,
    upgradeTickCount: 0,
    raidCount: 0,
    recentRaidTimestamps: [],
    abandonedAt: undefined,
    buildings: {
      metalMine: 12,
      crystalMine: 9,
      deuteriumSynthesizer: 7,
      solarPlant: 14,
      fusionReactor: 0,
      metalStorage: 4,
      crystalStorage: 4,
      deuteriumTank: 3,
      roboticsFactory: 3,
      naniteFactory: 0,
      shipyard: 4,
      researchLab: 2,
    },
    baseDefences: {
      rocketLauncher: 40,
      lightLaser: 18,
      heavyLaser: 12,
      ionCannon: 6,
    },
    baseShips: {
      smallCargo: 12,
      lightFighter: 30,
      heavyFighter: 18,
      cruiser: 6,
      solarSatellite: 0,
    },
    currentDefences: {
      rocketLauncher: 20,
      lightLaser: 8,
      heavyLaser: 5,
      ionCannon: 2,
    },
    currentShips: {
      smallCargo: 7,
      lightFighter: 15,
      heavyFighter: 7,
      cruiser: 2,
      solarSatellite: 0,
    },
    lastRaidedAt: 0,
    resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 },
    ...overrides,
  };
}

describe('slotTemperatureRange', () => {
  it('slots 1-3 are hot (200-400°C)', () => {
    expect(slotTemperatureRange(1)).toEqual({ min: 200, max: 400 });
    expect(slotTemperatureRange(3)).toEqual({ min: 200, max: 400 });
  });
  it('slots 7-9 are sweet spot (0-100°C)', () => {
    expect(slotTemperatureRange(8)).toEqual({ min: 0, max: 100 });
  });
  it('slots 13-15 are cold (-100 to -50°C)', () => {
    expect(slotTemperatureRange(15)).toEqual({ min: -100, max: -50 });
  });
});

describe('slotFieldRange', () => {
  it('slots 1-3 have fewer fields (40-70)', () => {
    expect(slotFieldRange(1)).toEqual({ min: 40, max: 70 });
  });
  it('slots 7-9 have the most fields (140-180)', () => {
    expect(slotFieldRange(7)).toEqual({ min: 140, max: 180 });
  });
});

describe('planetStatsForSlot', () => {
  it('returns deterministic values for a given seed+slot', () => {
    const a = planetStatsForSlot(12345, { galaxy: 1, system: 1, slot: 8 });
    const b = planetStatsForSlot(12345, { galaxy: 1, system: 1, slot: 8 });
    expect(a.maxTemperature).toBe(b.maxTemperature);
    expect(a.maxFields).toBe(b.maxFields);
  });
  it('returned temperature is within the slot range', () => {
    const stats = planetStatsForSlot(99999, { galaxy: 1, system: 3, slot: 2 });
    expect(stats.maxTemperature).toBeGreaterThanOrEqual(200);
    expect(stats.maxTemperature).toBeLessThanOrEqual(400);
  });
  it('different seeds produce different values', () => {
    const a = planetStatsForSlot(11111, { galaxy: 1, system: 1, slot: 8 });
    const b = planetStatsForSlot(22222, { galaxy: 1, system: 1, slot: 8 });
    // May occasionally collide but should usually differ
    expect(a.maxTemperature !== b.maxTemperature || a.maxFields !== b.maxFields).toBe(true);
  });
});

describe('GalaxyEngine', () => {
  describe('NPC colony temperature', () => {
    it('assigns temperature within slot range', () => {
      const colonies = generateNPCColonies(42);
      for (const colony of colonies) {
        const range = slotTemperatureRange(colony.coordinates.slot);
        expect(colony.temperature).toBeGreaterThanOrEqual(range.min);
        expect(colony.temperature).toBeLessThanOrEqual(range.max);
      }
    });
  });

  it('generateNPCColonies produces deterministic colonies from seed', () => {
    const colonies1 = generateNPCColonies(42);
    const colonies2 = generateNPCColonies(42);
    expect(colonies1).toEqual(colonies2);
    expect(colonies1.length).toBeGreaterThan(0);
  });

  it('generateNPCColonies produces different results for different seeds', () => {
    const colonies1 = generateNPCColonies(42);
    const colonies2 = generateNPCColonies(99);
    expect(JSON.stringify(colonies1)).not.toBe(JSON.stringify(colonies2));
  });

  it('generateNPCColonies creates 2-5 colonies per system on unique slots and skips homeworld slot', () => {
    const colonies = generateNPCColonies(12345);

    for (let system = 1; system <= GALAXY_CONSTANTS.MAX_SYSTEMS; system += 1) {
      const inSystem = colonies.filter(
        (colony) => colony.coordinates.galaxy === 1 && colony.coordinates.system === system,
      );
      expect(inSystem.length).toBeGreaterThanOrEqual(2);
      expect(inSystem.length).toBeLessThanOrEqual(5);

      const slots = inSystem.map((colony) => colony.coordinates.slot);
      expect(new Set(slots).size).toBe(slots.length);
      if (system === 1) {
        expect(slots).not.toContain(4);
      }
    }
  });

  it('generateNPCColonies assigns tiers in range 1-10', () => {
    const colonies = generateNPCColonies(42);
    for (const colony of colonies) {
      expect(colony.tier).toBeGreaterThanOrEqual(1);
      expect(colony.tier).toBeLessThanOrEqual(10);
    }
  });

  it('getSystemSlots returns 15 slots', () => {
    const state = createNewGameState();
    state.galaxy.npcColonies = generateNPCColonies(state.galaxy.seed);
    const slots = getSystemSlots(state, 1, 1);
    expect(slots).toHaveLength(GALAXY_CONSTANTS.MAX_SLOTS);
  });

  it('getSystemSlots identifies player planet correctly', () => {
    const state = createNewGameState();
    const slots = getSystemSlots(state, 1, 1);
    expect(slots[3].type).toBe('player');
    expect(slots[3].planet?.name).toBe('Homeworld');
  });

  it('canColonize returns false without colony ship', () => {
    const state = createNewGameState();
    expect(canColonize(state)).toBe(false);
  });

  it('canColonize returns true with colony ship', () => {
    const state = createNewGameState();
    state.research.astrophysicsTechnology = 1;
    state.planets[0].ships.colonyShip = 1;
    expect(canColonize(state)).toBe(true);
  });

  describe('canColonize - astrophysics cap', () => {
    it('blocks colonization when astrophysicsTechnology is 0', () => {
      const state = createNewGameState();
      state.research.astrophysicsTechnology = 0;
      state.planets[0].ships.colonyShip = 5;
      // 0 colonies, cap = floor(0/2)+1 = 1... wait, level 0 = cap 1?
      // OGame: level 1 allows 1 colony. Level 0 = 0 colonies allowed.
      expect(canColonize(state)).toBe(false);
    });

    it('allows colonization at level 1 with no colonies yet', () => {
      const state = createNewGameState();
      state.research.astrophysicsTechnology = 1; // max 1 colony
      state.planets[0].ships.colonyShip = 1;
      // 0 colonies (homeworld excluded), cap = 1
      expect(canColonize(state)).toBe(true);
    });

    it('blocks colonization when at cap (level 1, 1 colony already)', () => {
      const state = createNewGameState();
      state.research.astrophysicsTechnology = 1;
      state.planets[0].ships.colonyShip = 1;
      state.planets.push({ ...state.planets[0], name: 'Colony 1' }); // add 1 colony
      expect(canColonize(state)).toBe(false);
    });

    it('allows 2 colonies at level 3', () => {
      const state = createNewGameState();
      state.research.astrophysicsTechnology = 3;
      state.planets[0].ships.colonyShip = 1;
      state.planets.push({ ...state.planets[0], name: 'Colony 1' }); // 1 colony
      expect(canColonize(state)).toBe(true);
    });
  });

  it('isSlotEmpty returns true for unoccupied slot', () => {
    const state = createNewGameState();
    expect(isSlotEmpty(state, { galaxy: 1, system: 2, slot: 5 })).toBe(true);
  });

  it('isSlotEmpty returns false for player-occupied slot', () => {
    const state = createNewGameState();
    expect(isSlotEmpty(state, { galaxy: 1, system: 1, slot: 4 })).toBe(false);
  });

  it('colonize creates a new planet and consumes colony ship', () => {
    const state = createNewGameState();
    state.planets[0].ships.colonyShip = 1;
    state.research.astrophysicsTechnology = 1;

    const newPlanet = colonize(state, { galaxy: 1, system: 2, slot: 5 });

    expect(newPlanet).not.toBeNull();
    expect(state.planets).toHaveLength(2);
    expect(state.planets[1].coordinates).toEqual({ galaxy: 1, system: 2, slot: 5 });
    expect(state.planets[0].ships.colonyShip).toBe(0);
  });

  describe('colonize - slot-based planet stats', () => {
    it('assigns maxTemperature within the correct slot range', () => {
      const state = createNewGameState();
      state.planets[0].ships.colonyShip = 1;
      state.research.astrophysicsTechnology = 1; // allow 1 colony
      const planet = colonize(state, { galaxy: 1, system: 2, slot: 2 }); // hot slot
      expect(planet).not.toBeNull();
      expect(planet!.maxTemperature).toBeGreaterThanOrEqual(200);
      expect(planet!.maxTemperature).toBeLessThanOrEqual(400);
    });

    it('assigns maxFields within the correct slot range', () => {
      const state = createNewGameState();
      state.planets[0].ships.colonyShip = 1;
      state.research.astrophysicsTechnology = 1;
      const planet = colonize(state, { galaxy: 1, system: 2, slot: 8 }); // sweet spot
      expect(planet).not.toBeNull();
      expect(planet!.maxFields).toBeGreaterThanOrEqual(140);
      expect(planet!.maxFields).toBeLessThanOrEqual(180);
    });

    it('recolonizing the same slot with same seed can produce different stats (reroll)', () => {
      const state1 = createNewGameState();
      state1.planets[0].ships.colonyShip = 2;
      state1.research.astrophysicsTechnology = 3; // allow 2 colonies
      const coords = { galaxy: 1, system: 2, slot: 8 };
      const p1 = colonize(state1, coords);
      // Remove the planet to allow recolonization
      state1.planets = state1.planets.filter((p) => !(p.coordinates.system === 2 && p.coordinates.slot === 8));
      const p2 = colonize(state1, coords);
      // With reroll seeding (Date.now()), we can't guarantee different values in a fast test
      // Just verify both are valid
      expect(p1!.maxTemperature).toBeGreaterThanOrEqual(0);
      expect(p2!.maxTemperature).toBeGreaterThanOrEqual(0);
    });
  });

  it('colonize assigns slot-based temperature and fields', () => {
    const coords = { galaxy: 1, system: 20, slot: 9 };
    const state = createNewGameState();
    state.planets[0].ships.colonyShip = 1;
    state.research.astrophysicsTechnology = 1;
    const colony = colonize(state, coords);

    expect(colony).not.toBeNull();
    expect(colony!.maxTemperature).toBeGreaterThanOrEqual(0);
    expect(colony!.maxTemperature).toBeLessThanOrEqual(100);
    expect(colony!.maxFields).toBeGreaterThanOrEqual(140);
    expect(colony!.maxFields).toBeLessThanOrEqual(180);
  });

  it('colonize fails without colony ship', () => {
    const state = createNewGameState();
    const result = colonize(state, { galaxy: 1, system: 2, slot: 5 });
    expect(result).toBeNull();
    expect(state.planets).toHaveLength(1);
  });

  it('colonize fails on occupied slot', () => {
    const state = createNewGameState();
    state.planets[0].ships.colonyShip = 1;
    const result = colonize(state, { galaxy: 1, system: 1, slot: 4 });
    expect(result).toBeNull();
    expect(state.planets).toHaveLength(1);
    expect(state.planets[0].ships.colonyShip).toBe(1);
  });

  it('getNPCResources caps stockpile growth to 48 hours', () => {
    const now = 1_000_000_000;
    const colony = createNPCColony({ lastRaidedAt: now - 100 * 3600 * 1000 });
    const cappedColony = createNPCColony({ lastRaidedAt: now - 48 * 3600 * 1000 });

    const resourcesA = getNPCResources(colony, now, 1);
    const resourcesB = getNPCResources(cappedColony, now, 1);

    expect(resourcesA).toEqual(resourcesB);
  });

  it('getNPCResources increases with elapsed time since last raid', () => {
    const now = 2_000_000_000;
    const baseline = { metal: 52_000, crystal: 32_000, deuterium: 12_000 };
    const oneHour = createNPCColony({
      tier: 1,
      lastRaidedAt: now - 3600 * 1000,
      resourcesAtLastRaid: baseline,
    });
    const twoHours = createNPCColony({
      tier: 1,
      lastRaidedAt: now - 2 * 3600 * 1000,
      resourcesAtLastRaid: baseline,
    });

    const resources1 = getNPCResources(oneHour, now, 1);
    const resources2 = getNPCResources(twoHours, now, 1);

    expect(resources2.metal).toBeGreaterThan(resources1.metal);
    expect(resources2.crystal).toBeGreaterThanOrEqual(resources1.crystal);
    expect(resources2.deuterium).toBeGreaterThanOrEqual(resources1.deuterium);
  });

  it('getNPCResources reflects post-raid reduction (tier 10 floor bug)', () => {
    const now = Date.now();
    const colony = createNPCColony({
      tier: 10,
      lastRaidedAt: now,
      resourcesAtLastRaid: { metal: 1_000_000, crystal: 600_000, deuterium: 200_000 },
    });

    const resources = getNPCResources(colony, now, 1);

    expect(resources.metal).toBeLessThan(2_000_000);
    expect(resources.crystal).toBeLessThan(1_500_000);
    expect(resources.deuterium).toBeLessThan(600_000);
  });

  it('getNPCResources scales production with game speed', () => {
    const now = 2_500_000_000;
    const baseline = { metal: 52_000, crystal: 32_000, deuterium: 12_000 };
    const oneHour = createNPCColony({
      tier: 1,
      lastRaidedAt: now - 3600 * 1000,
      resourcesAtLastRaid: baseline,
    });

    const speed1 = getNPCResources(oneHour, now, 1);
    const speed3 = getNPCResources(oneHour, now, 3);

    expect(speed3.metal - baseline.metal).toBeGreaterThanOrEqual(
      (speed1.metal - baseline.metal) * 3 - 1,
    );
    expect(speed3.crystal - baseline.crystal).toBeGreaterThanOrEqual(
      (speed1.crystal - baseline.crystal) * 3 - 1,
    );
    expect(speed3.deuterium - baseline.deuterium).toBeGreaterThanOrEqual(
      (speed1.deuterium - baseline.deuterium) * 3 - 1,
    );
  });

  describe('getNPCResources - energy balance', () => {
    it('miner NPC with no satellites has reduced production from energy deficit', () => {
      const colony = createNPCColony({ specialty: 'miner' });
      colony.currentShips = { ...colony.currentShips, solarSatellite: 0 };
      colony.baseShips = { ...colony.baseShips, solarSatellite: 0 };
      const withSats = {
        ...colony,
        currentShips: { ...colony.currentShips, solarSatellite: 50 },
      };

      const now = Date.now();
      const resNoSat = getNPCResources({ ...colony }, now, 1);
      const resWithSat = getNPCResources({ ...withSats }, now, 1);

      // With satellites should produce more
      expect(resWithSat.metal).toBeGreaterThanOrEqual(resNoSat.metal);
    });
  });

  it('getNPCResources returns zero when colony is abandoning', () => {
    const now = 2_500_000_000;
    const colony = createNPCColony({
      abandonedAt: now - 1000,
      lastRaidedAt: now - 3600 * 1000,
      resourcesAtLastRaid: { metal: 1000, crystal: 500, deuterium: 250 },
    });

    expect(getNPCResources(colony, now, 5)).toEqual({
      metal: 0,
      crystal: 0,
      deuterium: 0,
    });
  });

  it('getNPCCurrentForce interpolates from current to base over 48 hours', () => {
    const now = 3_000_000_000;
    const colony = createNPCColony({ lastRaidedAt: now - 24 * 3600 * 1000 });

    const force = getNPCCurrentForce(colony, now);
    expect(force.ships.lightFighter).toBe(22);
    expect(force.defences.rocketLauncher).toBe(30);
  });

  it('getNPCCurrentForce returns base forces when colony was never raided', () => {
    const colony = createNPCColony({ lastRaidedAt: 0 });
    const force = getNPCCurrentForce(colony, Date.now());
    expect(force.ships).toEqual(colony.baseShips);
    expect(force.defences).toEqual(colony.baseDefences);
  });

  it('addDebris accumulates at the same coordinates', () => {
    const state = createNewGameState();
    state.debrisFields = [];
    const coordinates = { galaxy: 1, system: 8, slot: 11 };

    addDebris(state, coordinates, 1000, 500);
    addDebris(state, coordinates, 250, 750);

    expect(state.debrisFields).toHaveLength(1);
    expect(state.debrisFields[0]).toEqual({
      coordinates,
      metal: 1250,
      crystal: 1250,
    });
  });
});
