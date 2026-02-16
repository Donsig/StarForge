import type { GameState } from '../../models/GameState.ts';
import { createNewGameState } from '../../models/GameState.ts';
import {
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
