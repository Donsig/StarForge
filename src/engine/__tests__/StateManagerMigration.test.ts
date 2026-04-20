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

// ─── v17 → v18 migration: NPCColony.resources running balance ────────────────
//
// These tests FAIL against current production code (v17). They drive:
//   • STATE_VERSION bump 17 → 18 in src/models/types.ts
//   • NPCColony.resources field (replaces resourcesAtLastRaid) in src/models/Galaxy.ts
//   • v17→v18 migrator in src/engine/StateManager.ts

// Local types mirror the upcoming v18 NPCColony shape.
// Delete these when Galaxy.ts ships v18.
interface NPCColonyV18Shape {
  coordinates: { galaxy: number; system: number; slot: number };
  name: string;
  temperature: number;
  tier: number;
  specialty: string;
  maxTier: number;
  initialUpgradeIntervalMs: number;
  currentUpgradeIntervalMs: number;
  targetTier: number;
  catchUpUpgradeIntervalMs: number;
  catchUpProgressTicks: number;
  lastUpgradeAt: number;
  upgradeTickCount: number;
  raidCount: number;
  recentRaidTimestamps: number[];
  abandonedAt?: number;
  buildings: Record<string, number>;
  baseDefences: Record<string, number>;
  baseShips: Record<string, number>;
  currentDefences: Record<string, number>;
  currentShips: Record<string, number>;
  lastRaidedAt: number;
  // v18 field — resourcesAtLastRaid is gone, replaced by resources
  resources?: { metal: number; crystal: number; deuterium: number };
  // v17 field — will be removed in v18
  resourcesAtLastRaid?: { metal: number; crystal: number; deuterium: number };
}

function makeMinimalNPCColony(
  overrides: Partial<NPCColonyV18Shape> = {},
): NPCColonyV18Shape {
  return {
    coordinates: { galaxy: 1, system: 3, slot: 7 },
    name: 'Test NPC',
    temperature: 50,
    tier: 4,
    specialty: 'balanced',
    maxTier: 8,
    initialUpgradeIntervalMs: 10_800_000,
    currentUpgradeIntervalMs: 10_800_000,
    targetTier: 4,
    catchUpUpgradeIntervalMs: 2_700_000,
    catchUpProgressTicks: 0,
    lastUpgradeAt: 0,
    upgradeTickCount: 0,
    raidCount: 0,
    recentRaidTimestamps: [],
    abandonedAt: undefined,
    buildings: {
      metalMine: 8,
      crystalMine: 6,
      deuteriumSynthesizer: 5,
      solarPlant: 10,
      fusionReactor: 0,
      metalStorage: 2,
      crystalStorage: 2,
      deuteriumTank: 1,
      roboticsFactory: 1,
      naniteFactory: 0,
      shipyard: 2,
      researchLab: 0,
    },
    baseDefences: { rocketLauncher: 32, lightLaser: 12 },
    baseShips: { smallCargo: 8, lightFighter: 20, solarSatellite: 6 },
    currentDefences: { rocketLauncher: 32, lightLaser: 12 },
    currentShips: { smallCargo: 8, lightFighter: 20, solarSatellite: 6 },
    lastRaidedAt: 0,
    resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 },
    ...overrides,
  };
}

function makeV17Save(colonies: NPCColonyV18Shape[] = []) {
  return {
    version: 17,
    lastSaveTimestamp: Date.now(),
    tickCount: 0,
    planets: [],
    activePlanetIndex: 0,
    galaxy: { seed: 42, npcColonies: colonies },
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
    settings: {
      gameSpeed: 1,
      godMode: false,
      maxProbeCount: 10,
      notifications: { enabled: true, combat: true, fleet: true, espionage: true },
    },
    playerScores: { military: 0, economy: 0, research: 0, buildings: 0, fleet: 0, defence: 0, total: 0 },
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

describe('StateManager migration v17 → v18', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('migrates v17 to v18 renaming resourcesAtLastRaid to resources with formula continuity', async () => {
    // This test will FAIL until STATE_VERSION is bumped to 18 and the v17→v18
    // migrator is added to StateManager.ts.
    const { loadState } = await import('../StateManager.ts');

    const colony = makeMinimalNPCColony({
      // A colony that was raided 1 hour ago, with resources set at that raid
      lastRaidedAt: Date.now() - 3_600_000,
      resourcesAtLastRaid: { metal: 100, crystal: 50, deuterium: 10 },
    });

    const v17Save = makeV17Save([colony]);
    localStorage.setItem(GAME_CONSTANTS.STORAGE_KEY, JSON.stringify(v17Save));

    const state = loadState();
    expect(state).not.toBeNull();
    // Must be migrated to v18
    expect(state!.version).toBe(18);

    const migratedColony = (state!.galaxy.npcColonies[0] as unknown as NPCColonyV18Shape);

    // v18: must have `resources` field
    expect(migratedColony.resources).toBeDefined();
    // The legacy formula computed: baseline + production * elapsed, capped at 48h.
    // After migration the balance must be >= the old resourcesAtLastRaid baseline.
    expect(migratedColony.resources!.metal).toBeGreaterThanOrEqual(100);
    expect(migratedColony.resources!.crystal).toBeGreaterThanOrEqual(50);
    expect(migratedColony.resources!.deuterium).toBeGreaterThanOrEqual(10);
  });

  it('preserves colony.resources if already present (idempotent on repeated migration)', async () => {
    // A colony that already has `resources` (v18 shape) — the migrator must not
    // overwrite it if the field already exists.
    const { loadState, saveState } = await import('../StateManager.ts');

    const colony = makeMinimalNPCColony();
    // Inject v18-style resources field
    (colony as Record<string, unknown>)['resources'] = { metal: 999, crystal: 888, deuterium: 777 };
    delete colony.resourcesAtLastRaid;

    const v17Save = makeV17Save([colony]);
    localStorage.setItem(GAME_CONSTANTS.STORAGE_KEY, JSON.stringify(v17Save));

    const firstPass = loadState();
    expect(firstPass).not.toBeNull();
    expect(firstPass!.version).toBe(18);

    const c1 = firstPass!.galaxy.npcColonies[0] as unknown as NPCColonyV18Shape;
    expect(c1.resources!.metal).toBe(999);
    expect(c1.resources!.crystal).toBe(888);
    expect(c1.resources!.deuterium).toBe(777);

    // Save and reload — idempotency
    saveState(firstPass!);
    const secondPass = loadState();
    expect(secondPass).not.toBeNull();
    expect(secondPass!.version).toBe(18);

    const c2 = secondPass!.galaxy.npcColonies[0] as unknown as NPCColonyV18Shape;
    expect(c2.resources!.metal).toBe(999);
    expect(c2.resources!.crystal).toBe(888);
    expect(c2.resources!.deuterium).toBe(777);
  });

  it('handles multiple colonies in v17 → v18 migration', async () => {
    const { loadState } = await import('../StateManager.ts');

    const colonies = [
      makeMinimalNPCColony({
        coordinates: { galaxy: 1, system: 1, slot: 2 },
        resourcesAtLastRaid: { metal: 500, crystal: 250, deuterium: 75 },
      }),
      makeMinimalNPCColony({
        coordinates: { galaxy: 1, system: 2, slot: 5 },
        resourcesAtLastRaid: { metal: 1000, crystal: 600, deuterium: 200 },
      }),
      makeMinimalNPCColony({
        coordinates: { galaxy: 1, system: 3, slot: 9 },
        resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 },
      }),
    ];

    const v17Save = makeV17Save(colonies);
    localStorage.setItem(GAME_CONSTANTS.STORAGE_KEY, JSON.stringify(v17Save));

    const state = loadState();
    expect(state).not.toBeNull();
    expect(state!.version).toBe(18);
    expect(state!.galaxy.npcColonies).toHaveLength(3);

    // All three colonies must have the `resources` field set
    for (const c of state!.galaxy.npcColonies) {
      const colony = c as unknown as NPCColonyV18Shape;
      expect(colony.resources).toBeDefined();
      expect(typeof colony.resources!.metal).toBe('number');
      expect(typeof colony.resources!.crystal).toBe('number');
      expect(typeof colony.resources!.deuterium).toBe('number');
    }
  });

  it('drops resourcesAtLastRaid field after v17 → v18 migration', async () => {
    const { loadState } = await import('../StateManager.ts');

    const colony = makeMinimalNPCColony({
      resourcesAtLastRaid: { metal: 200, crystal: 100, deuterium: 30 },
    });

    const v17Save = makeV17Save([colony]);
    localStorage.setItem(GAME_CONSTANTS.STORAGE_KEY, JSON.stringify(v17Save));

    const state = loadState();
    expect(state).not.toBeNull();
    expect(state!.version).toBe(18);

    const migratedColony = state!.galaxy.npcColonies[0] as unknown as NPCColonyV18Shape;

    // The old field must be absent (or undefined) after migration
    expect(migratedColony.resourcesAtLastRaid).toBeUndefined();
  });

  it('migrates a colony that has never been raided (lastRaidedAt === 0)', async () => {
    const { loadState } = await import('../StateManager.ts');

    const colony = makeMinimalNPCColony({
      lastRaidedAt: 0,
      resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 },
    });

    const v17Save = makeV17Save([colony]);
    localStorage.setItem(GAME_CONSTANTS.STORAGE_KEY, JSON.stringify(v17Save));

    const state = loadState();
    expect(state).not.toBeNull();
    expect(state!.version).toBe(18);

    const c = state!.galaxy.npcColonies[0] as unknown as NPCColonyV18Shape;
    expect(c.resources).toBeDefined();
    // Colony was never raided — elapsed since "last raid" at t=0 would be huge,
    // but the 48h cap in the legacy formula bounds it. After migration resources
    // should be non-negative.
    expect(c.resources!.metal).toBeGreaterThanOrEqual(0);
    expect(c.resources!.crystal).toBeGreaterThanOrEqual(0);
    expect(c.resources!.deuterium).toBeGreaterThanOrEqual(0);
  });
});
