/// <reference types="vitest/globals" />

// Tests for v15 → v16 migration that adds productionHistory and totalBuilt
// to GameStatistics. These tests FAIL until StateManager.ts ships v16 migration.
//
// Also contains tests for v16 → v17 migration that adds NotificationSettings to
// GameSettings. These tests FAIL until StateManager.ts ships v17 migration.

import { GAME_CONSTANTS } from '../../models/types.ts';

// Local types mirror the upcoming v17 NotificationSettings / GameSettings shape.
// Delete these when types.ts ships v17.
interface NotificationSettings {
  enabled: boolean;
  combat: boolean;
  fleet: boolean;
  espionage: boolean;
}

interface GameSettingsV17 {
  gameSpeed: number;
  godMode: boolean;
  maxProbeCount: number;
  notifications: NotificationSettings;
}

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

// ─── v16 → v17 migration: NotificationSettings ─────────────────────────────
//
// These tests FAIL against the current production code (v16). They drive:
//   • STATE_VERSION bump 16 → 17 in src/models/types.ts
//   • v16→v17 migrator in src/engine/StateManager.ts
//   • notifications field in GameSettings interface in src/models/types.ts
//   • createNewGameState() defaults in src/models/GameState.ts

function makeV16Save() {
  return {
    version: 16,
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
    // v16 settings — no notifications field yet
    settings: { gameSpeed: 2, godMode: true, maxProbeCount: 25 },
    playerScores: {
      military: 0, economy: 0, research: 0,
      buildings: 0, fleet: 0, defence: 0, total: 0,
    },
    statistics: {
      resourcesMined: { metal: 0, crystal: 0, deuterium: 0 },
      combat: { fought: 0, won: 0, lost: 0, drawn: 0, totalLoot: 0, shipsLost: 0 },
      fleet: { sent: {}, totalDistance: 0 },
      milestones: {},
      productionHistory: { metal: [], crystal: [], deuterium: [], lastSampleAt: 0 },
      totalBuilt: {},
    },
  };
}

describe('StateManager migration v16 → v17', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('migrates v16 to v17 adding default notifications settings', async () => {
    const { loadState } = await import('../StateManager.ts');

    const v16Save = makeV16Save();
    localStorage.setItem(GAME_CONSTANTS.STORAGE_KEY, JSON.stringify(v16Save));

    const state = loadState();
    expect(state).not.toBeNull();
    // After migration the version must be 17 (new STATE_VERSION)
    expect(state!.version).toBe(17);

    const settings = state!.settings as unknown as GameSettingsV17;
    expect(settings.notifications).toBeDefined();
    expect(settings.notifications.enabled).toBe(true);
    expect(settings.notifications.combat).toBe(true);
    expect(settings.notifications.fleet).toBe(true);
    expect(settings.notifications.espionage).toBe(true);
  });

  it('preserves existing GameSettings fields during v16 to v17 migration', async () => {
    const { loadState } = await import('../StateManager.ts');

    const v16Save = makeV16Save();
    // gameSpeed=2, godMode=true, maxProbeCount=25 set in makeV16Save
    localStorage.setItem(GAME_CONSTANTS.STORAGE_KEY, JSON.stringify(v16Save));

    const state = loadState();
    expect(state).not.toBeNull();

    expect(state!.settings.gameSpeed).toBe(2);
    expect(state!.settings.godMode).toBe(true);
    expect(state!.settings.maxProbeCount).toBe(25);
  });

  it('v16 to v17 migration is idempotent', async () => {
    const { loadState, saveState } = await import('../StateManager.ts');

    const v16Save = makeV16Save();
    localStorage.setItem(GAME_CONSTANTS.STORAGE_KEY, JSON.stringify(v16Save));

    const firstPass = loadState();
    expect(firstPass).not.toBeNull();
    expect(firstPass!.version).toBe(17);

    // Save the already-migrated state then load again — should still be v17
    saveState(firstPass!);
    const secondPass = loadState();
    expect(secondPass).not.toBeNull();
    expect(secondPass!.version).toBe(17);

    const s1 = firstPass!.settings as unknown as GameSettingsV17;
    const s2 = secondPass!.settings as unknown as GameSettingsV17;
    expect(s2.notifications).toEqual(s1.notifications);
  });

  it('preserves user-set notification values through re-migration of v17 state', async () => {
    const { loadState, saveState } = await import('../StateManager.ts');

    const v16Save = makeV16Save();
    localStorage.setItem(GAME_CONSTANTS.STORAGE_KEY, JSON.stringify(v16Save));

    // First load — produces v17 state with defaults
    const firstPass = loadState();
    expect(firstPass).not.toBeNull();

    // Mutate: disable combat alerts, re-save
    const settings = firstPass!.settings as unknown as GameSettingsV17;
    settings.notifications.combat = false;
    saveState(firstPass!);

    // Second load — already v17, no migration should run; value preserved
    const secondPass = loadState();
    expect(secondPass).not.toBeNull();
    const s2 = secondPass!.settings as unknown as GameSettingsV17;
    expect(s2.notifications.combat).toBe(false);
    // Other flags unchanged
    expect(s2.notifications.enabled).toBe(true);
    expect(s2.notifications.fleet).toBe(true);
    expect(s2.notifications.espionage).toBe(true);
  });

  it('createNewGameState (v17) initializes notifications with all defaults true', async () => {
    const { createNewGameState } = await import('../../models/GameState.ts');

    const state = createNewGameState();
    const settings = state.settings as unknown as GameSettingsV17;

    expect(settings.notifications).toBeDefined();
    expect(settings.notifications.enabled).toBe(true);
    expect(settings.notifications.combat).toBe(true);
    expect(settings.notifications.fleet).toBe(true);
    expect(settings.notifications.espionage).toBe(true);
  });
});
