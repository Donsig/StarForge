/// <reference types="vitest/globals" />

// Tests for catch-up metadata returned by StateManager.load() (v17+).
//
// These tests FAIL against current production code because:
//   1. loadState() currently returns `GameState | null` — not the new
//      `{ state: GameState; catchUp: CatchUpBatch } | null` shape.
//   2. The catch-up batch tracking infrastructure doesn't exist yet.
//
// When the dev subagent picks a different return API shape they may minimally
// update these tests to match — the INTENT (not the exact API) is what matters.
//
// Assumed API shape (dev subagent may adjust):
//   interface CatchUpBatch {
//     combat: CombatLogEntry[];
//     fleet:  FleetNotification[];
//     espionage: EspionageReport[];
//   }
//   loadState(): { state: GameState; catchUp: CatchUpBatch } | null
//
// Import paths below reference the current StateManager — vitest will import
// the production file and the tests will fail with assertion errors once the
// new return type ships.

import { GAME_CONSTANTS } from '../../models/types.ts';
import type { CombatLogEntry, EspionageReport, FleetNotification } from '../../models/Fleet.ts';

// ---------------------------------------------------------------------------
// Local type declarations mirroring the upcoming loadState() return shape.
// Delete these when StateManager.ts ships the v17 catch-up API.
// ---------------------------------------------------------------------------
interface CatchUpBatch {
  combat: CombatLogEntry[];
  fleet: FleetNotification[];
  espionage: EspionageReport[];
}

interface LoadResult {
  state: {
    version: number;
    combatLog: CombatLogEntry[];
    fleetNotifications: FleetNotification[];
    espionageReports: EspionageReport[];
    [key: string]: unknown;
  };
  catchUp: CatchUpBatch;
}

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeBaseV17Save(overrides: Record<string, unknown> = {}) {
  return {
    version: 17,
    lastSaveTimestamp: Date.now(),
    tickCount: 0,
    planets: [],
    activePlanetIndex: 0,
    galaxy: { seed: 42, npcColonies: [] },
    debrisFields: [],
    fleetMissions: [],
    combatLog: [] as CombatLogEntry[],
    espionageReports: [] as EspionageReport[],
    fleetNotifications: [] as FleetNotification[],
    research: {
      energyTechnology: 0, laserTechnology: 0, ionTechnology: 0,
      plasmaTechnology: 0, espionageTechnology: 0, computerTechnology: 0,
      weaponsTechnology: 0, shieldingTechnology: 0, armourTechnology: 0,
      combustionDrive: 0, impulseDrive: 0, hyperspaceDrive: 0,
      hyperspaceTechnology: 0, astrophysicsTechnology: 0,
      intergalacticResearchNetwork: 0,
    },
    researchQueue: [],
    settings: {
      gameSpeed: 1, godMode: false, maxProbeCount: 10,
      notifications: { enabled: true, combat: true, fleet: true, espionage: true },
    },
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
    ...overrides,
  };
}

function makeCombatEntry(id: string, timestamp: number): CombatLogEntry {
  return {
    id,
    timestamp,
    targetCoordinates: { galaxy: 1, system: 2, slot: 3 },
    result: {
      attackerWon: true,
      rounds: [],
      loot: { metal: 100, crystal: 50, deuterium: 0 },
      attackerLosses: { metal: 0, crystal: 0, deuterium: 0 },
      defenderLosses: { metal: 500, crystal: 250, deuterium: 0 },
      debrisField: { metal: 0, crystal: 0 },
    },
    read: false,
  };
}

function makeFleetNotification(id: string, timestamp: number): FleetNotification {
  return {
    id,
    missionId: `mission_${id}`,
    timestamp,
    missionType: 'harvest',
    targetCoordinates: { galaxy: 1, system: 3, slot: 6 },
    targetName: 'Debris Field',
    loot: { metal: 1000, crystal: 500, deuterium: 0 },
    read: false,
  };
}

function makeEspionageReport(id: string, timestamp: number): EspionageReport {
  return {
    id,
    timestamp,
    sourcePlanetIndex: 0,
    targetCoordinates: { galaxy: 1, system: 5, slot: 2 },
    targetName: 'Enemy Planet',
    probesSent: 3,
    probesLost: 0,
    detected: false,
    detectionChance: 0.1,
    resources: { metal: 5000, crystal: 2000, deuterium: 500 },
    read: false,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Cast the return value of loadState() to the expected new API shape.
 * If loadState() still returns GameState | null (old API), these casts will
 * succeed but assertions will fail — which is the desired "red" signal.
 */
function asLoadResult(value: unknown): LoadResult | null {
  if (value === null || value === undefined) return null;
  return value as LoadResult;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StateManager.loadState() catch-up metadata', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('returns empty catch-up batch when state is fresh (no offline time)', async () => {
    const { loadState } = await import('../StateManager.ts');

    // lastSaveTimestamp is right now — effectively zero offline time
    const freshSave = makeBaseV17Save({ lastSaveTimestamp: Date.now() });
    localStorage.setItem(GAME_CONSTANTS.STORAGE_KEY, JSON.stringify(freshSave));

    const raw = loadState();
    const result = asLoadResult(raw);

    expect(result).not.toBeNull();
    expect(result!.catchUp).toBeDefined();
    expect(result!.catchUp.combat).toEqual([]);
    expect(result!.catchUp.fleet).toEqual([]);
    expect(result!.catchUp.espionage).toEqual([]);
  });

  it('returns combat entries added during catch-up', async () => {
    const { loadState } = await import('../StateManager.ts');

    // State saved 1 hour ago — catch-up will run
    const oneHourAgo = Date.now() - 3_600_000;
    const nowMs = Date.now();

    // Pre-existing entries (saved before offline period)
    const existingEntry = makeCombatEntry('existing-1', oneHourAgo - 5000);

    // Entries that would be added during catch-up (timestamped during offline window)
    // In practice the engine adds these during processOfflineTime; we simulate by
    // having them already in the save with timestamps inside the offline window.
    const catchUpEntry1 = makeCombatEntry('catchup-1', oneHourAgo + 10_000);
    const catchUpEntry2 = makeCombatEntry('catchup-2', oneHourAgo + 20_000);
    const catchUpEntry3 = makeCombatEntry('catchup-3', oneHourAgo + 30_000);

    const save = makeBaseV17Save({
      lastSaveTimestamp: oneHourAgo,
      combatLog: [existingEntry, catchUpEntry1, catchUpEntry2, catchUpEntry3],
    });
    localStorage.setItem(GAME_CONSTANTS.STORAGE_KEY, JSON.stringify(save));

    // Mock Date.now to return a stable "now" so processOfflineTime knows the window
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(nowMs);

    const raw = loadState();
    dateSpy.mockRestore();

    const result = asLoadResult(raw);
    expect(result).not.toBeNull();
    expect(result!.catchUp).toBeDefined();
    // The 3 entries timestamped within the offline window should be in catchUp
    expect(result!.catchUp.combat.length).toBe(3);
    expect(result!.catchUp.combat.map((e) => e.id)).toContain('catchup-1');
    expect(result!.catchUp.combat.map((e) => e.id)).toContain('catchup-2');
    expect(result!.catchUp.combat.map((e) => e.id)).toContain('catchup-3');
    // The existing pre-offline entry should NOT appear in catchUp
    expect(result!.catchUp.combat.map((e) => e.id)).not.toContain('existing-1');
  });

  it('returns empty arrays for log types that had no additions during catch-up', async () => {
    const { loadState } = await import('../StateManager.ts');

    const oneHourAgo = Date.now() - 3_600_000;
    const nowMs = Date.now();

    // Only fleet notifications added during catch-up; combat and espionage untouched
    const fleetEntry1 = makeFleetNotification('fleet-1', oneHourAgo + 10_000);
    const fleetEntry2 = makeFleetNotification('fleet-2', oneHourAgo + 20_000);

    const save = makeBaseV17Save({
      lastSaveTimestamp: oneHourAgo,
      combatLog: [],
      espionageReports: [],
      fleetNotifications: [fleetEntry1, fleetEntry2],
    });
    localStorage.setItem(GAME_CONSTANTS.STORAGE_KEY, JSON.stringify(save));

    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(nowMs);
    const raw = loadState();
    dateSpy.mockRestore();

    const result = asLoadResult(raw);
    expect(result).not.toBeNull();
    expect(result!.catchUp.combat).toEqual([]);
    expect(result!.catchUp.fleet.length).toBeGreaterThan(0);
    expect(result!.catchUp.espionage).toEqual([]);
  });

  it('catch-up entries are sorted by timestamp within each type', async () => {
    const { loadState } = await import('../StateManager.ts');

    const oneHourAgo = Date.now() - 3_600_000;
    const nowMs = Date.now();

    // Add entries out of order
    const entry1 = makeCombatEntry('c-30s', oneHourAgo + 30_000);
    const entry2 = makeCombatEntry('c-10s', oneHourAgo + 10_000);
    const entry3 = makeCombatEntry('c-20s', oneHourAgo + 20_000);

    const save = makeBaseV17Save({
      lastSaveTimestamp: oneHourAgo,
      combatLog: [entry1, entry2, entry3],
    });
    localStorage.setItem(GAME_CONSTANTS.STORAGE_KEY, JSON.stringify(save));

    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(nowMs);
    const raw = loadState();
    dateSpy.mockRestore();

    const result = asLoadResult(raw);
    expect(result).not.toBeNull();

    const ids = result!.catchUp.combat.map((e) => e.id);
    // Entries should be sorted ascending by timestamp (earliest first)
    expect(ids[0]).toBe('c-10s');
    expect(ids[1]).toBe('c-20s');
    expect(ids[2]).toBe('c-30s');
  });

  it('load returns null for empty/corrupt save', async () => {
    const { loadState } = await import('../StateManager.ts');

    localStorage.setItem(GAME_CONSTANTS.STORAGE_KEY, 'not-valid-json{{{');

    const raw = loadState();
    expect(raw).toBeNull();
  });

  it('load returns null when storage is empty', async () => {
    const { loadState } = await import('../StateManager.ts');

    // No item in localStorage
    const raw = loadState();
    expect(raw).toBeNull();
  });
});
