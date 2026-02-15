import type { GameState } from '../../models/GameState.ts';
import { createNewGameState } from '../../models/GameState.ts';
import { processTick as processQueueTick, startShipBuild } from '../../engine/BuildQueue.ts';

function completeFrontShipUnit(state: GameState): void {
  const front = state.planet.shipyardQueue[0];
  expect(front).toBeDefined();
  if (!front) return;

  const now = Date.now();
  front.completesAt = now - 1;
  processQueueTick(state, now);
}

function grantShipResources(state: GameState): void {
  state.planet.resources.metal = 1_000_000;
  state.planet.resources.crystal = 1_000_000;
  state.planet.resources.deuterium = 1_000_000;
}

describe('Integration: ship production', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('first ship build', () => {
    const state = createNewGameState();
    state.planet.buildings.shipyard = 1;
    state.research.combustionDrive = 1;
    state.planet.resources.metal = 50_000;
    state.planet.resources.crystal = 50_000;
    state.planet.resources.deuterium = 0;

    expect(startShipBuild(state, 'lightFighter', 5)).toBe(true);
    expect(state.planet.resources.metal).toBe(35_000);
    expect(state.planet.resources.crystal).toBe(45_000);
    expect(state.planet.shipyardQueue).toHaveLength(1);

    completeFrontShipUnit(state);
    expect(state.planet.ships.lightFighter).toBe(1);
    expect(state.planet.ships.lightFighter).not.toBe(5);

    completeFrontShipUnit(state);
    completeFrontShipUnit(state);
    completeFrontShipUnit(state);
    completeFrontShipUnit(state);
    expect(state.planet.ships.lightFighter).toBe(5);
    expect(state.planet.shipyardQueue).toHaveLength(0);
  });

  it('ship prerequisites gate correctly', () => {
    const state = createNewGameState();
    state.planet.buildings.shipyard = 1;
    state.research.combustionDrive = 1;
    grantShipResources(state);

    expect(startShipBuild(state, 'lightFighter', 1)).toBe(true);
    expect(startShipBuild(state, 'heavyFighter', 1)).toBe(false);
    expect(startShipBuild(state, 'cruiser', 1)).toBe(false);

    state.planet.buildings.shipyard = 3;
    state.research.armourTechnology = 2;
    state.research.impulseDrive = 2;
    expect(startShipBuild(state, 'heavyFighter', 1)).toBe(true);
    expect(state.planet.shipyardQueue.some((item) => item.id === 'heavyFighter')).toBe(true);
  });

  it('multiple ship batches queue sequentially', () => {
    const state = createNewGameState();
    state.planet.buildings.shipyard = 2;
    state.research.combustionDrive = 2;
    grantShipResources(state);

    expect(startShipBuild(state, 'lightFighter', 3)).toBe(true);
    expect(startShipBuild(state, 'smallCargo', 2)).toBe(true);
    expect(state.planet.shipyardQueue).toHaveLength(2);
    expect(state.planet.shipyardQueue[0].id).toBe('lightFighter');
    expect(state.planet.shipyardQueue[1].id).toBe('smallCargo');

    completeFrontShipUnit(state);
    completeFrontShipUnit(state);
    completeFrontShipUnit(state);
    expect(state.planet.ships.lightFighter).toBe(3);
    expect(state.planet.shipyardQueue).toHaveLength(1);
    expect(state.planet.shipyardQueue[0].id).toBe('smallCargo');

    completeFrontShipUnit(state);
    completeFrontShipUnit(state);
    expect(state.planet.ships.smallCargo).toBe(2);
    expect(state.planet.shipyardQueue).toHaveLength(0);
  });
});
