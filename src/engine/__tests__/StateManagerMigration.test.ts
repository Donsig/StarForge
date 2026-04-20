/// <reference types="vitest/globals" />

// Tests for v15 → v16 migration that adds productionHistory and totalBuilt
// to GameStatistics. These tests FAIL until StateManager.ts ships v16 migration.

import { GAME_CONSTANTS } from '../../models/types.ts';

// Local types mirror the upcoming v16 GameStatistics shape.
// Delete these when models/GameState.ts ships v16.
interface ProductionHistory {
  metal: number[];
  crystal: number[];
  deuterium: number[];
  lastSampleAt: number;
}

interface StatisticsV16 {
  resourcesMined: { metal: number; crystal: number; deuterium: number };
  combat: { fought: number; won: number; lost: number; drawn: number; totalLoot: number; shipsLost: number };
  fleet: { sent: Record<string, number>; totalDistance: number };
  milestones: Record<string, unknown>;
  productionHistory: ProductionHistory;
  totalBuilt: Partial<Record<string, number>>;
}

interface GameStateV15 {
  version: number;
  lastSaveTimestamp: number;
  tickCount: number;
  planets: unknown[];
  activePlanetIndex: number;
  galaxy: { seed: number; npcColonies: unknown[] };
  debrisFields: unknown[];
  fleetMissions: unknown[];
  combatLog: unknown[];
  espionageReports: unknown[];
  fleetNotifications: unknown[];
  research: Record<string, number>;
  researchQueue: unknown[];
  settings: { gameSpeed: number; godMode: boolean; maxProbeCount: number };
  playerScores: { military: number; economy: number; research: number; buildings: number; fleet: number; defence: number; total: number };
  statistics: Omit<StatisticsV16, 'productionHistory' | 'totalBuilt'>;
}

function makeV15Save(): GameStateV15 {
  return {
    version: 15,
    lastSaveTimestamp: Date.now(),
    tickCount: 0,
    planets: [],
    activePlanetIndex: 0,
    galaxy: { seed: 42, npcColonies: [] },
    debrisFields: [],
    fleetMissions: [],
    combatLog: [],
    espionageReports: [],
    fleetNotifications: [],
    research: {
      energyTechnology: 0,
      laserTechnology: 0,
      ionTechnology: 0,
      plasmaTechnology: 0,
      espionageTechnology: 0,
      computerTechnology: 0,
      weaponsTechnology: 0,
      shieldingTechnology: 0,
      armourTechnology: 0,
      combustionDrive: 0,
      impulseDrive: 0,
      hyperspaceDrive: 0,
      hyperspaceTechnology: 0,
      astrophysicsTechnology: 0,
      intergalacticResearchNetwork: 0,
    },
    researchQueue: [],
    settings: { gameSpeed: 1, godMode: false, maxProbeCount: 10 },
    playerScores: { military: 0, economy: 0, research: 0, buildings: 0, fleet: 0, defence: 0, total: 0 },
    statistics: {
      resourcesMined: { metal: 0, crystal: 0, deuterium: 0 },
      combat: { fought: 0, won: 0, lost: 0, drawn: 0, totalLoot: 0, shipsLost: 0 },
      fleet: { sent: {}, totalDistance: 0 },
      milestones: {},
    },
  };
}

describe('StateManager migration v15 → v16', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('migrates v15 to v16 adding default productionHistory', async () => {
    const { loadState } = await import('../StateManager.ts');

    const v15Save = makeV15Save();
    localStorage.setItem(GAME_CONSTANTS.STORAGE_KEY, JSON.stringify(v15Save));

    const state = loadState();
    expect(state).not.toBeNull();
    expect(state!.version).toBe(GAME_CONSTANTS.STATE_VERSION);

    const stats = state!.statistics as StatisticsV16;
    expect(stats.productionHistory).toBeDefined();
    expect(stats.productionHistory.metal).toEqual([]);
    expect(stats.productionHistory.crystal).toEqual([]);
    expect(stats.productionHistory.deuterium).toEqual([]);
    expect(stats.productionHistory.lastSampleAt).toBe(0);
  });

  it('migrates v15 to v16 adding default totalBuilt', async () => {
    const { loadState } = await import('../StateManager.ts');

    const v15Save = makeV15Save();
    localStorage.setItem(GAME_CONSTANTS.STORAGE_KEY, JSON.stringify(v15Save));

    const state = loadState();
    expect(state).not.toBeNull();

    const stats = state!.statistics as StatisticsV16;
    expect(stats.totalBuilt).toBeDefined();
    expect(stats.totalBuilt).toEqual({});
  });

  it('preserves existing statistics fields during v15 to v16 migration', async () => {
    const { loadState } = await import('../StateManager.ts');

    const v15Save = makeV15Save();
    v15Save.statistics.resourcesMined.metal = 12345;
    v15Save.statistics.combat.won = 7;
    v15Save.statistics.fleet.totalDistance = 999;
    localStorage.setItem(GAME_CONSTANTS.STORAGE_KEY, JSON.stringify(v15Save));

    const state = loadState();
    expect(state).not.toBeNull();
    expect(state!.statistics.resourcesMined.metal).toBe(12345);
    expect(state!.statistics.combat.won).toBe(7);
    expect(state!.statistics.fleet.totalDistance).toBe(999);
  });

  it('migration is idempotent — running migrate twice yields the same result', async () => {
    const { loadState, saveState } = await import('../StateManager.ts');

    const v15Save = makeV15Save();
    v15Save.statistics.resourcesMined.metal = 9999;
    localStorage.setItem(GAME_CONSTANTS.STORAGE_KEY, JSON.stringify(v15Save));

    const firstPass = loadState();
    expect(firstPass).not.toBeNull();

    // Save the already-migrated state then load again — should be identical
    saveState(firstPass!);
    const secondPass = loadState();
    expect(secondPass).not.toBeNull();

    const stats1 = firstPass!.statistics as StatisticsV16;
    const stats2 = secondPass!.statistics as StatisticsV16;

    expect(stats2.productionHistory).toEqual(stats1.productionHistory);
    expect(stats2.totalBuilt).toEqual(stats1.totalBuilt);
    expect(stats2.resourcesMined.metal).toBe(stats1.resourcesMined.metal);
  });

  it('createNewGameState initializes productionHistory with empty arrays and lastSampleAt=0', async () => {
    const { createNewGameState } = await import('../../models/GameState.ts');

    const state = createNewGameState();
    const stats = state.statistics as StatisticsV16;

    expect(stats.productionHistory).toBeDefined();
    expect(stats.productionHistory.metal).toEqual([]);
    expect(stats.productionHistory.crystal).toEqual([]);
    expect(stats.productionHistory.deuterium).toEqual([]);
    expect(stats.productionHistory.lastSampleAt).toBe(0);
  });

  it('createNewGameState initializes totalBuilt as empty object', async () => {
    const { createNewGameState } = await import('../../models/GameState.ts');

    const state = createNewGameState();
    const stats = state.statistics as StatisticsV16;

    expect(stats.totalBuilt).toBeDefined();
    expect(stats.totalBuilt).toEqual({});
  });
});
