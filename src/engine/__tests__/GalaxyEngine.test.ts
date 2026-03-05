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
} from '../GalaxyEngine.ts';
import { GALAXY_CONSTANTS } from '../../data/galaxy.ts';

function createNPCColony(overrides?: Partial<NPCColony>): NPCColony {
  return {
    coordinates: { galaxy: 1, system: 10, slot: 6 },
    name: 'Test Colony',
    tier: 6,
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
    },
    lastRaidedAt: 0,
    ...overrides,
  };
}

describe('GalaxyEngine', () => {
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
    state.planets[0].ships.colonyShip = 1;
    expect(canColonize(state)).toBe(true);
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

    const newPlanet = colonize(state, { galaxy: 1, system: 2, slot: 5 });

    expect(newPlanet).not.toBeNull();
    expect(state.planets).toHaveLength(2);
    expect(state.planets[1].coordinates).toEqual({ galaxy: 1, system: 2, slot: 5 });
    expect(state.planets[0].ships.colonyShip).toBe(0);
  });

  it('colonize uses deterministic temperature from seed and coordinates', () => {
    const coords = { galaxy: 1, system: 20, slot: 9 };

    const stateA = createNewGameState();
    stateA.galaxy.seed = 98765;
    stateA.planets[0].ships.colonyShip = 1;
    const colonyA = colonize(stateA, coords);

    const stateB = createNewGameState();
    stateB.galaxy.seed = 98765;
    stateB.planets[0].ships.colonyShip = 2;
    colonize(stateB, { galaxy: 1, system: 2, slot: 6 });
    const colonyB = colonize(stateB, coords);

    expect(colonyA).not.toBeNull();
    expect(colonyB).not.toBeNull();
    expect(colonyA!.maxTemperature).toBe(colonyB!.maxTemperature);
    expect(colonyA!.maxTemperature).toBeGreaterThanOrEqual(20);
    expect(colonyA!.maxTemperature).toBeLessThan(50);
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

    const resourcesA = getNPCResources(colony, now);
    const resourcesB = getNPCResources(cappedColony, now);

    expect(resourcesA).toEqual(resourcesB);
  });

  it('getNPCResources increases with elapsed time since last raid', () => {
    const now = 2_000_000_000;
    const oneHour = createNPCColony({ lastRaidedAt: now - 3600 * 1000 });
    const twoHours = createNPCColony({ lastRaidedAt: now - 2 * 3600 * 1000 });

    const resources1 = getNPCResources(oneHour, now);
    const resources2 = getNPCResources(twoHours, now);

    expect(resources2.metal).toBeGreaterThan(resources1.metal);
    expect(resources2.crystal).toBeGreaterThan(resources1.crystal);
    expect(resources2.deuterium).toBeGreaterThan(resources1.deuterium);
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
