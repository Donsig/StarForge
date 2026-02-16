/// <reference types="vitest/globals" />
import { createNewGameState } from '../../models/GameState.ts';
import {
  canColonize,
  colonize,
  generateNPCColonies,
  getSystemSlots,
  isSlotEmpty,
} from '../GalaxyEngine.ts';
import { GALAXY_CONSTANTS } from '../../data/galaxy.ts';

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
    // Very unlikely to be identical
    expect(JSON.stringify(colonies1)).not.toBe(JSON.stringify(colonies2));
  });

  it('getSystemSlots returns 15 slots', () => {
    const state = createNewGameState();
    state.galaxy.npcColonies = generateNPCColonies(state.galaxy.seed);
    const slots = getSystemSlots(state, 1, 1);
    expect(slots).toHaveLength(GALAXY_CONSTANTS.MAX_SLOTS);
  });

  it('getSystemSlots identifies player planet correctly', () => {
    const state = createNewGameState();
    // Default planet is at galaxy:1, system:1, slot:4
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

  it('colonize fails without colony ship', () => {
    const state = createNewGameState();
    const result = colonize(state, { galaxy: 1, system: 2, slot: 5 });
    expect(result).toBeNull();
    expect(state.planets).toHaveLength(1);
  });

  it('colonize fails on occupied slot', () => {
    const state = createNewGameState();
    state.planets[0].ships.colonyShip = 1;
    // Try to colonize the homeworld slot
    const result = colonize(state, { galaxy: 1, system: 1, slot: 4 });
    expect(result).toBeNull();
    expect(state.planets).toHaveLength(1);
    // Colony ship not consumed
    expect(state.planets[0].ships.colonyShip).toBe(1);
  });
});
