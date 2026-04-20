/// <reference types="vitest/globals" />

// Tests for production sampling logic.
// These tests drive the creation of a new exported function in the engine.
// Expected API (to be created in src/engine/ProductionSampling.ts):
//
//   export function sampleProduction(state: GameState, now: number): void
//
// Called once per game tick after ResourceEngine.processTick().
// Pushes a sample to productionHistory when gameSpeed-scaled 24h has elapsed.
//
// All tests FAIL until ProductionSampling.ts is created and wired in.

// Local types mirror the upcoming v16 GameStatistics shape.
// Delete these when models/GameState.ts ships v16.
interface ProductionHistory {
  metal: number[];
  crystal: number[];
  deuterium: number[];
  lastSampleAt: number;
}

interface StatisticsV16 extends Record<string, unknown> {
  resourcesMined: { metal: number; crystal: number; deuterium: number };
  combat: { fought: number; won: number; lost: number; drawn: number; totalLoot: number; shipsLost: number };
  fleet: { sent: Record<string, number>; totalDistance: number };
  milestones: Record<string, unknown>;
  productionHistory: ProductionHistory;
  totalBuilt: Partial<Record<string, number>>;
}

import { createNewGameState, type GameState } from '../../models/GameState.ts';
import { createDefaultPlanet } from '../../models/Planet.ts';

// Import the yet-to-exist sampling function.
// This import will cause the test to fail with a module-not-found error,
// which is the desired "failing" state.
import { sampleProduction } from '../ProductionSampling.ts';

/** Attach productionHistory and totalBuilt to a fresh game state's statistics.
 *  Mirrors what the v16 migration will do. */
function withV16Statistics(state: GameState): GameState & { statistics: StatisticsV16 } {
  const extended = state as GameState & { statistics: StatisticsV16 };
  extended.statistics = {
    ...state.statistics,
    productionHistory: { metal: [], crystal: [], deuterium: [], lastSampleAt: 0 },
    totalBuilt: {},
  };
  return extended;
}

const ONE_DAY_MS = 86_400_000;

describe('sampleProduction', () => {
  it('pushes an initial sample when lastSampleAt is 0', () => {
    const raw = createNewGameState();
    raw.planets[0].buildings.metalMine = 5;
    raw.planets[0].buildings.solarPlant = 20;
    const state = withV16Statistics(raw);

    const now = 1_000_000;
    sampleProduction(state, now);

    expect(state.statistics.productionHistory.metal).toHaveLength(1);
    expect(state.statistics.productionHistory.crystal).toHaveLength(1);
    expect(state.statistics.productionHistory.deuterium).toHaveLength(1);
    expect(state.statistics.productionHistory.lastSampleAt).toBe(now);
  });

  it('pushes a sample with a positive metal value reflecting mine production', () => {
    const raw = createNewGameState();
    raw.planets[0].buildings.metalMine = 5;
    raw.planets[0].buildings.solarPlant = 20;
    const state = withV16Statistics(raw);

    sampleProduction(state, 1_000_000);

    expect(state.statistics.productionHistory.metal[0]).toBeGreaterThan(0);
  });

  it('does not push another sample within the gameSpeed-scaled 24h window', () => {
    const raw = createNewGameState();
    raw.settings.gameSpeed = 1;
    raw.planets[0].buildings.metalMine = 3;
    raw.planets[0].buildings.solarPlant = 10;
    const state = withV16Statistics(raw);

    const firstNow = 1_000_000;
    sampleProduction(state, firstNow);
    expect(state.statistics.productionHistory.metal).toHaveLength(1);

    // Advance by less than 24h (only 12h)
    const secondNow = firstNow + ONE_DAY_MS / 2;
    sampleProduction(state, secondNow);

    // Should NOT have pushed a second entry
    expect(state.statistics.productionHistory.metal).toHaveLength(1);
  });

  it('pushes a new sample when exactly one gameSpeed-1 scaled 24h window elapses', () => {
    const raw = createNewGameState();
    raw.settings.gameSpeed = 1;
    raw.planets[0].buildings.metalMine = 3;
    raw.planets[0].buildings.solarPlant = 10;
    const state = withV16Statistics(raw);

    const firstNow = 2_000_000;
    sampleProduction(state, firstNow);
    expect(state.statistics.productionHistory.metal).toHaveLength(1);

    // Advance exactly 24h
    const secondNow = firstNow + ONE_DAY_MS;
    sampleProduction(state, secondNow);

    expect(state.statistics.productionHistory.metal).toHaveLength(2);
  });

  it('pushes a new sample after only 3h when gameSpeed=8 (24h / 8 = 3h)', () => {
    const raw = createNewGameState();
    raw.settings.gameSpeed = 8;
    raw.planets[0].buildings.metalMine = 3;
    raw.planets[0].buildings.solarPlant = 10;
    const state = withV16Statistics(raw);

    const firstNow = 3_000_000;
    sampleProduction(state, firstNow);
    expect(state.statistics.productionHistory.metal).toHaveLength(1);

    // Advance by 3h = 10_800_000 ms (= 24h/8)
    const threeHoursMs = ONE_DAY_MS / 8;
    const secondNow = firstNow + threeHoursMs;
    sampleProduction(state, secondNow);

    expect(state.statistics.productionHistory.metal).toHaveLength(2);
  });

  it('does NOT push after only 2h when gameSpeed=8', () => {
    const raw = createNewGameState();
    raw.settings.gameSpeed = 8;
    raw.planets[0].buildings.metalMine = 3;
    raw.planets[0].buildings.solarPlant = 10;
    const state = withV16Statistics(raw);

    const firstNow = 4_000_000;
    sampleProduction(state, firstNow);

    // 2h < 3h threshold
    const twoHoursMs = 2 * 3_600_000;
    sampleProduction(state, firstNow + twoHoursMs);

    expect(state.statistics.productionHistory.metal).toHaveLength(1);
  });

  it('truncates buffer to 7 entries after 8 samples — oldest dropped, newest last', () => {
    const raw = createNewGameState();
    raw.settings.gameSpeed = 1;
    raw.planets[0].buildings.metalMine = 3;
    raw.planets[0].buildings.solarPlant = 10;
    const state = withV16Statistics(raw);

    // Push 8 samples, one per 24h interval
    for (let i = 0; i < 8; i++) {
      const sampleNow = i * ONE_DAY_MS;
      sampleProduction(state, sampleNow);
    }

    expect(state.statistics.productionHistory.metal).toHaveLength(7);
    expect(state.statistics.productionHistory.crystal).toHaveLength(7);
    expect(state.statistics.productionHistory.deuterium).toHaveLength(7);
  });

  it('samples sum production rates across ALL player planets', () => {
    const raw = createNewGameState();
    // Planet 0: metalMine 5 with energy
    raw.planets[0].buildings.metalMine = 5;
    raw.planets[0].buildings.solarPlant = 20;
    raw.planets[0].buildings.crystalMine = 0;
    raw.planets[0].buildings.deuteriumSynthesizer = 0;

    // Planet 1: same metalMine setup
    const colony = createDefaultPlanet();
    colony.name = 'Colony 2';
    colony.coordinates = { galaxy: 1, system: 1, slot: 5 };
    colony.buildings.metalMine = 5;
    colony.buildings.solarPlant = 20;
    colony.buildings.crystalMine = 0;
    colony.buildings.deuteriumSynthesizer = 0;
    raw.planets.push(colony);

    const state = withV16Statistics(raw);

    // Single-planet version for comparison
    const singleRaw = createNewGameState();
    singleRaw.planets[0].buildings.metalMine = 5;
    singleRaw.planets[0].buildings.solarPlant = 20;
    const singleState = withV16Statistics(singleRaw);

    const now = 5_000_000;
    sampleProduction(state, now);
    sampleProduction(singleState, now);

    // Two identical planets should produce ~2x the rate of one
    expect(state.statistics.productionHistory.metal[0]).toBeGreaterThan(
      singleState.statistics.productionHistory.metal[0],
    );
    // Approximately 2x (allow small floating-point tolerance)
    expect(state.statistics.productionHistory.metal[0]).toBeCloseTo(
      singleState.statistics.productionHistory.metal[0] * 2,
      0,
    );
  });

  it('does not mutate ships, buildings, research, or other statistics fields when sampling', () => {
    const raw = createNewGameState();
    raw.planets[0].buildings.metalMine = 3;
    raw.planets[0].buildings.solarPlant = 10;
    raw.planets[0].ships.lightFighter = 5;
    const state = withV16Statistics(raw);

    const shipsBefore = state.planets[0].ships.lightFighter;
    const mineBefore = state.planets[0].buildings.metalMine;
    const resourcesMinedBefore = state.statistics.resourcesMined.metal;
    const totalBuiltBefore = { ...state.statistics.totalBuilt };

    sampleProduction(state, 6_000_000);

    expect(state.planets[0].ships.lightFighter).toBe(shipsBefore);
    expect(state.planets[0].buildings.metalMine).toBe(mineBefore);
    expect(state.statistics.resourcesMined.metal).toBe(resourcesMinedBefore);
    expect(state.statistics.totalBuilt).toEqual(totalBuiltBefore);
  });

  it('first sample sets lastSampleAt to the provided now timestamp', () => {
    const raw = createNewGameState();
    raw.planets[0].buildings.solarPlant = 5;
    const state = withV16Statistics(raw);

    const now = 7_654_321;
    sampleProduction(state, now);

    expect(state.statistics.productionHistory.lastSampleAt).toBe(now);
  });

  it('subsequent sample updates lastSampleAt to the new timestamp', () => {
    const raw = createNewGameState();
    raw.planets[0].buildings.solarPlant = 5;
    const state = withV16Statistics(raw);

    const first = 1_000_000;
    const second = first + ONE_DAY_MS;
    sampleProduction(state, first);
    sampleProduction(state, second);

    expect(state.statistics.productionHistory.lastSampleAt).toBe(second);
  });
});
