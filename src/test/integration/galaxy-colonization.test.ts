/// <reference types="vitest/globals" />
import { createNewGameState } from '../../models/GameState.ts';
import { colonize, canColonize, generateNPCColonies, getSystemSlots } from '../../engine/GalaxyEngine.ts';
import { startShipBuild, processTick } from '../../engine/BuildQueue.ts';
import { GALAXY_CONSTANTS } from '../../data/galaxy.ts';

describe('Galaxy colonization flow', () => {
  it('full flow: build colony ship → colonize → switch planet → verify', () => {
    const state = createNewGameState();
    
    // Give resources and prerequisites for colony ship
    state.planets[0].resources.metal = 10_000_000;
    state.planets[0].resources.crystal = 10_000_000;
    state.planets[0].resources.deuterium = 10_000_000;
    state.planets[0].buildings.shipyard = 4;
    state.research.combustionDrive = 1;
    state.research.impulseDrive = 3;
    state.research.astrophysicsTechnology = 1;
    
    // Build a colony ship
    expect(startShipBuild(state, 'colonyShip', 1)).toBe(true);
    expect(state.planets[0].shipyardQueue).toHaveLength(1);
    
    // Complete the build
    const completionTime = state.planets[0].shipyardQueue[0].completesAt;
    processTick(state, completionTime);
    expect(state.planets[0].ships.colonyShip).toBe(1);
    expect(state.planets[0].shipyardQueue).toHaveLength(0);
    
    // Verify we can now colonize
    expect(canColonize(state)).toBe(true);
    
    // Colonize a new planet
    const coords = { galaxy: 1, system: 3, slot: 7 };
    const newPlanet = colonize(state, coords);
    
    expect(newPlanet).not.toBeNull();
    expect(state.planets).toHaveLength(2);
    expect(state.planets[1].coordinates).toEqual(coords);
    expect(state.planets[0].ships.colonyShip).toBe(0);
    
    // Switch active planet
    state.activePlanetIndex = 1;
    expect(state.planets[state.activePlanetIndex].name).toBe('Colony 2');
    expect(state.planets[state.activePlanetIndex].coordinates).toEqual(coords);
    
    // Verify the new planet has default starting values
    expect(state.planets[1].buildings.metalMine).toBe(0);
    expect(state.planets[1].resources.metal).toBe(500);
    expect(state.planets[1].resources.crystal).toBe(500);
  });

  it('generates NPC colonies and shows them in system view', () => {
    const state = createNewGameState();
    state.galaxy.npcColonies = generateNPCColonies(state.galaxy.seed);
    
    // Check a system with potential NPCs
    let foundNpc = false;
    for (let sys = 1; sys <= GALAXY_CONSTANTS.MAX_SYSTEMS; sys++) {
      const slots = getSystemSlots(state, 1, sys);
      for (const slot of slots) {
        if (slot.type === 'npc') {
          foundNpc = true;
          expect(slot.npc).toBeDefined();
          expect(slot.npc!.name).toBeTruthy();
          expect(slot.npc!.tier).toBeGreaterThan(0);
          break;
        }
      }
      if (foundNpc) break;
    }
    expect(foundNpc).toBe(true);
  });

  it('cannot colonize an NPC-occupied slot', () => {
    const state = createNewGameState();
    state.planets[0].ships.colonyShip = 1;
    state.research.astrophysicsTechnology = 1;
    state.galaxy.npcColonies = [
      {
        name: 'TestNPC',
        temperature: 18,
        coordinates: { galaxy: 1, system: 5, slot: 3 },
        tier: 5,
        specialty: 'balanced',
        maxTier: 8,
        initialUpgradeIntervalMs: 10_800_000,
        currentUpgradeIntervalMs: 10_800_000,
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
    ];
    
    const result = colonize(state, { galaxy: 1, system: 5, slot: 3 });
    expect(result).toBeNull();
    expect(state.planets).toHaveLength(1);
    expect(state.planets[0].ships.colonyShip).toBe(1);
  });
});
