import type { GameState } from '../../models/GameState.ts';
import { createNewGameState } from '../../models/GameState.ts';
import { processTick as processQueueTick, startShipBuild } from '../../engine/BuildQueue.ts';

function completeFrontShipUnit(state: GameState): void {
  const front = state.planets[0].shipyardQueue[0];
  expect(front).toBeDefined();
  if (!front) return;

  const now = Date.now();
  front.completesAt = now - 1;
  processQueueTick(state, now);
}

function grantShipResources(state: GameState): void {
  state.planets[0].resources.metal = 1_000_000;
  state.planets[0].resources.crystal = 1_000_000;
  state.planets[0].resources.deuterium = 1_000_000;
}

describe('Integration: ship production', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('first ship build', () => {
    const state = createNewGameState();
    state.planets[0].buildings.shipyard = 1;
    state.research.combustionDrive = 1;
    state.planets[0].resources.metal = 50_000;
    state.planets[0].resources.crystal = 50_000;
    state.planets[0].resources.deuterium = 0;

    expect(startShipBuild(state, 'lightFighter', 5)).toBe(true);
    expect(state.planets[0].resources.metal).toBe(35_000);
    expect(state.planets[0].resources.crystal).toBe(45_000);
    expect(state.planets[0].shipyardQueue).toHaveLength(1);

    completeFrontShipUnit(state);
    expect(state.planets[0].ships.lightFighter).toBe(1);
    expect(state.planets[0].ships.lightFighter).not.toBe(5);

    completeFrontShipUnit(state);
    completeFrontShipUnit(state);
    completeFrontShipUnit(state);
    completeFrontShipUnit(state);
    expect(state.planets[0].ships.lightFighter).toBe(5);
    expect(state.planets[0].shipyardQueue).toHaveLength(0);
  });

  it('ship prerequisites gate correctly', () => {
    const state = createNewGameState();
    state.planets[0].buildings.shipyard = 1;
    state.research.combustionDrive = 1;
    grantShipResources(state);

    expect(startShipBuild(state, 'lightFighter', 1)).toBe(true);
    expect(startShipBuild(state, 'heavyFighter', 1)).toBe(false);
    expect(startShipBuild(state, 'cruiser', 1)).toBe(false);

    state.planets[0].buildings.shipyard = 3;
    state.research.armourTechnology = 2;
    state.research.impulseDrive = 2;
    expect(startShipBuild(state, 'heavyFighter', 1)).toBe(true);
    expect(state.planets[0].shipyardQueue.some((item) => item.id === 'heavyFighter')).toBe(true);
  });

  it('multiple ship batches queue sequentially', () => {
    const state = createNewGameState();
    state.planets[0].buildings.shipyard = 2;
    state.research.combustionDrive = 2;
    grantShipResources(state);

    expect(startShipBuild(state, 'lightFighter', 3)).toBe(true);
    expect(startShipBuild(state, 'smallCargo', 2)).toBe(true);
    expect(state.planets[0].shipyardQueue).toHaveLength(2);
    expect(state.planets[0].shipyardQueue[0].id).toBe('lightFighter');
    expect(state.planets[0].shipyardQueue[1].id).toBe('smallCargo');

    completeFrontShipUnit(state);
    completeFrontShipUnit(state);
    completeFrontShipUnit(state);
    expect(state.planets[0].ships.lightFighter).toBe(3);
    expect(state.planets[0].shipyardQueue).toHaveLength(1);
    expect(state.planets[0].shipyardQueue[0].id).toBe('smallCargo');

    completeFrontShipUnit(state);
    completeFrontShipUnit(state);
    expect(state.planets[0].ships.smallCargo).toBe(2);
    expect(state.planets[0].shipyardQueue).toHaveLength(0);
  });
});
