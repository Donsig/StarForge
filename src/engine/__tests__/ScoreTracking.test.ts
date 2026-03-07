import { BUILDINGS } from '../../data/buildings';
import { createNewGameState } from '../../models/GameState';
import { buildingCostAtLevel } from '../FormulasEngine';
import { processTick } from '../BuildQueue';

describe('Accumulated score tracking in BuildQueue.processTick', () => {
  it('increments buildings score when a building completes', () => {
    const state = createNewGameState();
    const now = Date.now();
    const targetLevel = 8;
    state.planets[0].buildingQueue = [
      {
        type: 'building',
        id: 'metalMine',
        targetLevel,
        startedAt: now - 2000,
        completesAt: now - 1000,
      },
    ];

    processTick(state, now);

    const def = BUILDINGS.metalMine;
    const cost = buildingCostAtLevel(def.baseCost, def.costMultiplier, targetLevel);
    const expectedPoints = Math.floor((cost.metal + cost.crystal + cost.deuterium) / 1000);
    expect(state.playerScores.buildings).toBe(expectedPoints);
    expect(state.playerScores.buildings).toBeGreaterThan(0);
  });

  it('increments fleet score when a ship completes', () => {
    const state = createNewGameState();
    const now = Date.now();
    state.planets[0].buildings.shipyard = 4;
    state.planets[0].shipyardQueue = [
      {
        type: 'ship',
        id: 'lightFighter',
        quantity: 1,
        completed: 0,
        startedAt: now - 2000,
        completesAt: now - 1000,
      },
    ];

    processTick(state, now);

    expect(state.playerScores.fleet).toBeGreaterThan(0);
  });

  it('increments defence score when a defence completes', () => {
    const state = createNewGameState();
    const now = Date.now();
    state.planets[0].buildings.shipyard = 2;
    state.planets[0].shipyardQueue = [
      {
        type: 'defence',
        id: 'rocketLauncher',
        quantity: 1,
        completed: 0,
        startedAt: now - 2000,
        completesAt: now - 1000,
      },
    ];

    processTick(state, now);

    expect(state.playerScores.defence).toBeGreaterThan(0);
  });

  it('does NOT track research in accumulated scores (research stays snapshot-only)', () => {
    const state = createNewGameState();
    const now = Date.now();
    state.researchQueue = [
      {
        type: 'research',
        id: 'energyTechnology',
        targetLevel: 1,
        sourcePlanetIndex: 0,
        startedAt: now - 2000,
        completesAt: now - 1000,
      },
    ];

    processTick(state, now);

    expect(state.playerScores.buildings).toBe(0);
    expect(state.playerScores.fleet).toBe(0);
    expect(state.playerScores.defence).toBe(0);
  });
});
