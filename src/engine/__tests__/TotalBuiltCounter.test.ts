/// <reference types="vitest/globals" />

// Tests for the totalBuilt counter that increments whenever a queue item completes.
// These tests drive changes to BuildQueue.processTick() to populate
// state.statistics.totalBuilt when ships, defences, and buildings complete.
//
// All tests FAIL until BuildQueue.processTick() is updated to increment totalBuilt.

// Local types mirror the upcoming v16 GameStatistics shape.
// Delete these when models/GameState.ts ships v16.
interface StatisticsV16 extends Record<string, unknown> {
  resourcesMined: { metal: number; crystal: number; deuterium: number };
  combat: { fought: number; won: number; lost: number; drawn: number; totalLoot: number; shipsLost: number };
  fleet: { sent: Record<string, number>; totalDistance: number };
  milestones: Record<string, unknown>;
  productionHistory: {
    metal: number[];
    crystal: number[];
    deuterium: number[];
    lastSampleAt: number;
  };
  totalBuilt: Partial<Record<string, number>>;
}

import { createNewGameState, type GameState } from '../../models/GameState.ts';
import { processTick } from '../BuildQueue.ts';

/** Attach v16 statistics fields to a fresh game state. */
function withV16Statistics(state: GameState): GameState & { statistics: StatisticsV16 } {
  const extended = state as GameState & { statistics: StatisticsV16 };
  extended.statistics = {
    ...state.statistics,
    productionHistory: { metal: [], crystal: [], deuterium: [], lastSampleAt: 0 },
    totalBuilt: {},
  };
  return extended;
}

describe('totalBuilt counter in BuildQueue.processTick', () => {
  it('increments totalBuilt when a ship build completes', () => {
    const raw = createNewGameState();
    raw.planets[0].buildings.shipyard = 4;
    const state = withV16Statistics(raw);

    const now = Date.now();
    state.planets[0].shipyardQueue = [
      {
        type: 'ship',
        id: 'lightFighter',
        quantity: 3,
        completed: 0,
        startedAt: now - 10_000,
        completesAt: now - 1_000,
      },
    ];

    // Tick until all 3 complete (quantity = 3, each unit completes at completesAt)
    // First tick completes unit 1
    processTick(state, now);
    // Second tick completes unit 2
    processTick(state, now + 1);
    // Third tick completes unit 3
    processTick(state, now + 2);

    expect(state.statistics.totalBuilt['lightFighter']).toBe(3);
  });

  it('increments totalBuilt when a defence build completes', () => {
    const raw = createNewGameState();
    raw.planets[0].buildings.shipyard = 2;
    const state = withV16Statistics(raw);

    const now = Date.now();
    state.planets[0].shipyardQueue = [
      {
        type: 'defence',
        id: 'rocketLauncher',
        quantity: 5,
        completed: 0,
        startedAt: now - 10_000,
        completesAt: now - 1_000,
      },
    ];

    // Tick 5 times to complete all 5 units
    for (let i = 0; i < 5; i++) {
      processTick(state, now + i);
    }

    expect(state.statistics.totalBuilt['rocketLauncher']).toBe(5);
  });

  it('increments totalBuilt by 1 per building upgrade completion', () => {
    const raw = createNewGameState();
    const state = withV16Statistics(raw);

    const now = Date.now();
    state.planets[0].buildingQueue = [
      {
        type: 'building',
        id: 'metalMine',
        targetLevel: 1,
        startedAt: now - 10_000,
        completesAt: now - 1_000,
      },
    ];

    processTick(state, now);

    expect(state.statistics.totalBuilt['metalMine']).toBe(1);
  });

  it('accumulates totalBuilt across multiple building completions for the same building', () => {
    const raw = createNewGameState();
    const state = withV16Statistics(raw);

    const now = Date.now();

    // First upgrade: metalMine level 1
    state.planets[0].buildingQueue = [
      {
        type: 'building',
        id: 'metalMine',
        targetLevel: 1,
        startedAt: now - 10_000,
        completesAt: now - 2_000,
      },
    ];
    processTick(state, now);
    expect(state.statistics.totalBuilt['metalMine']).toBe(1);

    // Second upgrade: metalMine level 2
    state.planets[0].buildingQueue = [
      {
        type: 'building',
        id: 'metalMine',
        targetLevel: 2,
        startedAt: now,
        completesAt: now + 1,
      },
    ];
    processTick(state, now + 2);
    expect(state.statistics.totalBuilt['metalMine']).toBe(2);
  });

  it('does NOT increment totalBuilt for research completions', () => {
    const raw = createNewGameState();
    const state = withV16Statistics(raw);

    const now = Date.now();
    state.researchQueue = [
      {
        type: 'research',
        id: 'energyTechnology',
        targetLevel: 1,
        sourcePlanetIndex: 0,
        startedAt: now - 10_000,
        completesAt: now - 1_000,
      },
    ];

    processTick(state, now);

    // research completes but totalBuilt stays empty
    expect(state.research.energyTechnology).toBe(1); // sanity: research did complete
    expect(state.statistics.totalBuilt['energyTechnology']).toBeUndefined();
    expect(Object.keys(state.statistics.totalBuilt)).toHaveLength(0);
  });

  it('accumulates totalBuilt across multiple ship types independently', () => {
    const raw = createNewGameState();
    raw.planets[0].buildings.shipyard = 5;
    const state = withV16Statistics(raw);

    const now = Date.now();

    // Build 2 light fighters
    state.planets[0].shipyardQueue = [
      {
        type: 'ship',
        id: 'lightFighter',
        quantity: 2,
        completed: 0,
        startedAt: now - 10_000,
        completesAt: now - 1_000,
      },
    ];
    processTick(state, now);
    processTick(state, now + 1);

    // Now queue 1 cruiser
    state.planets[0].shipyardQueue = [
      {
        type: 'ship',
        id: 'cruiser',
        quantity: 1,
        completed: 0,
        startedAt: now + 2,
        completesAt: now + 3,
      },
    ];
    processTick(state, now + 4);

    expect(state.statistics.totalBuilt['lightFighter']).toBe(2);
    expect(state.statistics.totalBuilt['cruiser']).toBe(1);
  });

  it('increments totalBuilt correctly when a queue item starts with already-completed units', () => {
    // Simulate a partially-completed batch (completed=2, quantity=5) —
    // only the 3 remaining should be newly counted.
    const raw = createNewGameState();
    raw.planets[0].buildings.shipyard = 4;
    const state = withV16Statistics(raw);

    const now = Date.now();
    // Set up a partially done batch
    state.planets[0].shipyardQueue = [
      {
        type: 'ship',
        id: 'heavyFighter',
        quantity: 5,
        completed: 2,
        startedAt: now - 10_000,
        completesAt: now - 1_000,
      },
    ];
    // The 3 remaining units should all be counted
    // (implementation may tick them one at a time)
    processTick(state, now);
    processTick(state, now + 1);
    processTick(state, now + 2);

    // 3 new completions (units 3, 4, 5 of the batch)
    expect(state.statistics.totalBuilt['heavyFighter']).toBe(3);
  });
});
