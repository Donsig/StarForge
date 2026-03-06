import type { GameState } from '../../models/GameState.ts';
import { createNewGameState } from '../../models/GameState.ts';
import { createDefaultPlanet } from '../../models/Planet.ts';
import {
  effectiveResearchLabLevel,
  processTick as processQueueTick,
  startBuildingUpgrade,
  startResearch,
} from '../../engine/BuildQueue.ts';
import { RESEARCH } from '../../data/research.ts';

function completeCurrentBuilding(state: GameState): void {
  const queueItem = state.planets[0].buildingQueue[0];
  expect(state.planets[0].buildingQueue.length).toBeGreaterThan(0);
  if (!queueItem) return;

  const now = Date.now();
  queueItem.completesAt = now - 1;
  processQueueTick(state, now);
}

function completeCurrentResearch(state: GameState): void {
  const queueItem = state.researchQueue[0];
  expect(state.researchQueue.length).toBeGreaterThan(0);
  if (!queueItem) return;

  const now = Date.now();
  queueItem.completesAt = now - 1;
  processQueueTick(state, now);
}

function grantAbundantResources(state: GameState): void {
  state.planets[0].resources.metal = 5_000_000;
  state.planets[0].resources.crystal = 5_000_000;
  state.planets[0].resources.deuterium = 5_000_000;
}

describe('Integration: research chains', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('tech tree progression', () => {
    const state = createNewGameState();
    state.planets[0].buildings.researchLab = 1;
    grantAbundantResources(state);

    expect(startResearch(state, 'laserTechnology')).toBe(false);

    expect(startResearch(state, 'energyTechnology')).toBe(true);
    completeCurrentResearch(state);
    expect(startResearch(state, 'energyTechnology')).toBe(true);
    completeCurrentResearch(state);
    expect(state.research.energyTechnology).toBe(2);

    expect(startResearch(state, 'laserTechnology')).toBe(true);
    completeCurrentResearch(state);
    while (state.research.laserTechnology < 5) {
      expect(startResearch(state, 'laserTechnology')).toBe(true);
      completeCurrentResearch(state);
    }
    expect(state.research.laserTechnology).toBe(5);

    expect(startResearch(state, 'ionTechnology')).toBe(false);

    state.planets[0].buildings.researchLab = 4;
    state.research.energyTechnology = 4;
    expect(startResearch(state, 'ionTechnology')).toBe(true);
  });

  it('hyperspace drive requires deep tech tree', () => {
    const state = createNewGameState();
    grantAbundantResources(state);

    expect(RESEARCH.hyperspaceDrive.requires).toEqual([
      { type: 'building', id: 'researchLab', level: 7 },
      { type: 'research', id: 'hyperspaceTechnology', level: 3 },
    ]);
    expect(RESEARCH.hyperspaceTechnology.requires).toEqual([
      { type: 'building', id: 'researchLab', level: 7 },
      { type: 'research', id: 'energyTechnology', level: 5 },
      { type: 'research', id: 'shieldingTechnology', level: 5 },
    ]);

    state.planets[0].buildings.researchLab = 7;
    expect(startResearch(state, 'hyperspaceDrive')).toBe(false);
    expect(startResearch(state, 'hyperspaceTechnology')).toBe(false);

    state.research.energyTechnology = 5;
    state.research.shieldingTechnology = 5;

    expect(startResearch(state, 'hyperspaceTechnology')).toBe(true);
    completeCurrentResearch(state);
    expect(startResearch(state, 'hyperspaceTechnology')).toBe(true);
    completeCurrentResearch(state);
    expect(startResearch(state, 'hyperspaceTechnology')).toBe(true);
    completeCurrentResearch(state);
    expect(state.research.hyperspaceTechnology).toBe(3);

    expect(startResearch(state, 'hyperspaceDrive')).toBe(true);
  });

  it('research and building queues are independent', () => {
    const state = createNewGameState();
    state.planets[0].buildings.researchLab = 1;
    grantAbundantResources(state);

    expect(startBuildingUpgrade(state, 'metalMine')).toBe(true);
    expect(startResearch(state, 'energyTechnology')).toBe(true);
    expect(state.planets[0].buildingQueue.length).toBeGreaterThan(0);
    expect(state.researchQueue.length).toBeGreaterThan(0);

    completeCurrentBuilding(state);
    expect(state.planets[0].buildingQueue).toEqual([]);
    expect(state.researchQueue.length).toBeGreaterThan(0);
    expect(state.planets[0].buildings.metalMine).toBe(1);
    expect(state.research.energyTechnology).toBe(0);

    completeCurrentResearch(state);
    expect(state.researchQueue).toEqual([]);
    expect(state.research.energyTechnology).toBe(1);
  });
});

describe('Integration: Intergalactic Research Network', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('IRN has the correct prerequisites', () => {
    expect(RESEARCH.intergalacticResearchNetwork.requires).toEqual([
      { type: 'research', id: 'astrophysicsTechnology', level: 4 },
      { type: 'research', id: 'hyperspaceTechnology', level: 8 },
      { type: 'research', id: 'computerTechnology', level: 8 },
    ]);
  });

  it('IRN has the correct base cost', () => {
    expect(RESEARCH.intergalacticResearchNetwork.baseCost).toEqual({
      metal: 240_000,
      crystal: 400_000,
      deuterium: 160_000,
    });
  });

  it('cannot research IRN without prerequisites met', () => {
    const state = createNewGameState();
    grantAbundantResources(state);
    state.planets[0].buildings.researchLab = 10;

    expect(startResearch(state, 'intergalacticResearchNetwork')).toBe(false);
  });

  it('can research IRN once prerequisites are met', () => {
    const state = createNewGameState();
    grantAbundantResources(state);
    state.planets[0].buildings.researchLab = 10;
    state.research.astrophysicsTechnology = 4;
    state.research.hyperspaceTechnology = 8;
    state.research.computerTechnology = 8;

    expect(startResearch(state, 'intergalacticResearchNetwork')).toBe(true);
    completeCurrentResearch(state);
    expect(state.research.intergalacticResearchNetwork).toBe(1);
  });

  it('IRN level 1 causes effectiveResearchLabLevel to sum top 2 labs across planets', () => {
    const state = createNewGameState();
    state.planets[0].buildings.researchLab = 10;

    const colony = createDefaultPlanet();
    colony.buildings.researchLab = 7;
    colony.coordinates = { galaxy: 1, system: 1, slot: 5 };
    state.planets.push(colony);

    const colony2 = createDefaultPlanet();
    colony2.buildings.researchLab = 3;
    colony2.coordinates = { galaxy: 1, system: 1, slot: 6 };
    state.planets.push(colony2);

    state.research.intergalacticResearchNetwork = 1;

    const item = {
      type: 'research' as const,
      id: 'energyTechnology',
      targetLevel: 1,
      sourcePlanetIndex: 0,
      startedAt: 0,
      completesAt: 0,
    };

    // IRN 1 → top 2 labs: 10 + 7 = 17
    expect(effectiveResearchLabLevel(state, item)).toBe(17);
  });
});
