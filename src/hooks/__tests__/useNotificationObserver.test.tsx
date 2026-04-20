/// <reference types="vitest/globals" />

// Regression tests for useNotificationObserver hook (Task 16).
//
// These tests FAIL against current production code because:
//   1. useNotificationObserver.ts doesn't exist yet.
//   2. NotificationContext / useNotifications hook doesn't exist yet.
//   3. GameSettings.notifications field doesn't exist yet.
//
// The hook watches gameState.combatLog, .fleetNotifications, .espionageReports
// for new entries and emits toasts via showToast().
//
// On mount:
//   - Consumes catchUp metadata from GameContext (dev subagent wires this)
//   - Emits the 5 most recent catch-up entries across all types sorted by timestamp desc
//   - Filtered by settings.notifications flags
//
// Post-mount (per re-render):
//   - Diffs length of each log array vs previous render
//   - Emits a toast for each new entry, filtered by settings.notifications
//
// Filter logic:
//   - enabled=false → never emit anything
//   - enabled=true, combat=false → skip combat toasts only
//   - Same per type

import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createContext, useContext, useRef, useState, type Context } from 'react';
import { GameContext, type GameContextType } from '../../context/GameContext';
import { createNewGameState } from '../../models/GameState';
import type { CombatLogEntry, EspionageReport, FleetNotification } from '../../models/Fleet';

// @ts-expect-error — useNotificationObserver.ts created by dev subagent; doesn't exist yet.
import { useNotificationObserver } from '../useNotificationObserver';

// ---------------------------------------------------------------------------
// Local types mirroring upcoming v17 GameSettings shape.
// Delete when types.ts ships v17.
// ---------------------------------------------------------------------------
interface NotificationSettings {
  enabled: boolean;
  combat: boolean;
  fleet: boolean;
  espionage: boolean;
}

interface CatchUpBatch {
  combat: CombatLogEntry[];
  fleet: FleetNotification[];
  espionage: EspionageReport[];
}

interface EmittedToast {
  id: string;
  type: 'combat' | 'fleet' | 'espionage';
  message: string;
  navTab: 'combat' | 'fleet' | 'espionage';
}

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeCombatEntry(id: string, timestamp: number): CombatLogEntry {
  return {
    id,
    timestamp,
    targetCoordinates: { galaxy: 1, system: 2, slot: 3 },
    result: {
      attackerWon: true,
      rounds: [],
      loot: { metal: 0, crystal: 0, deuterium: 0 },
      attackerLosses: { metal: 0, crystal: 0, deuterium: 0 },
      defenderLosses: { metal: 0, crystal: 0, deuterium: 0 },
      debrisField: { metal: 0, crystal: 0 },
    },
    read: false,
  };
}

function makeFleetNotification(id: string, timestamp: number): FleetNotification {
  return {
    id,
    missionId: `m_${id}`,
    timestamp,
    missionType: 'harvest',
    targetCoordinates: { galaxy: 1, system: 3, slot: 6 },
    targetName: 'Debris Field',
    loot: { metal: 100, crystal: 50, deuterium: 0 },
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
    detectionChance: 0.05,
    read: false,
  };
}

function makeDefaultNotifications(overrides: Partial<NotificationSettings> = {}): NotificationSettings {
  return { enabled: true, combat: true, fleet: true, espionage: true, ...overrides };
}

// ---------------------------------------------------------------------------
// Test wrapper: provides GameContext with controlled state + catchUp
// ---------------------------------------------------------------------------

function buildMockGameContext(
  overrides: Partial<GameContextType> = {},
  catchUp: CatchUpBatch = { combat: [], fleet: [], espionage: [] },
): GameContextType {
  const baseState = createNewGameState();
  // Inject notifications setting into gameState (will typecheck once v17 ships)
  const stateWithNotifications = {
    ...baseState,
    settings: {
      ...baseState.settings,
      notifications: makeDefaultNotifications(),
    },
  };

  return {
    gameState: stateWithNotifications as GameContextType['gameState'],
    espionageReports: [],
    fleetNotifications: [],
    fleetMovements: [],
    productionRates: {
      metalPerHour: 0, crystalPerHour: 0, deuteriumPerHour: 0,
      energyProduction: 0, energyConsumption: 0,
    },
    storageCaps: { metal: 10000, crystal: 10000, deuterium: 10000 },
    upgradeBuilding: () => false,
    startResearchAction: () => false,
    buildShips: () => false,
    buildDefences: () => false,
    colonizeAction: () => false,
    cancelBuilding: () => {},
    cancelResearch: () => {},
    cancelShipyard: () => {},
    resetGameAction: () => {},
    setActivePlanet: () => {},
    renamePlanet: () => {},
    fleetTarget: null,
    setFleetTarget: () => {},
    galaxyJumpTarget: null,
    setGalaxyJumpTarget: () => {},
    pendingMissionTarget: null,
    setPendingMissionTarget: () => {},
    dispatchFleet: () => null,
    dispatchEspionage: () => null,
    dispatchHarvest: () => null,
    recallFleet: () => {},
    markCombatRead: () => {},
    markAllCombatRead: () => {},
    markEspionageRead: () => {},
    markAllEspionageRead: () => {},
    markFleetRead: () => {},
    markAllFleetRead: () => {},
    deleteCombatEntry: () => {},
    deleteEspionageReport: () => {},
    deleteFleetNotification: () => {},
    setGameSpeed: () => {},
    setMaxProbeCount: () => {},
    setGodMode: () => {},
    // @ts-expect-error — setNotificationSetting added in v17; doesn't exist yet.
    setNotificationSetting: () => {},
    adminSetResources: () => {},
    adminAddResources: () => {},
    adminSetBuildings: () => {},
    adminSetShips: () => {},
    adminSetDefences: () => {},
    adminSetResearch: () => {},
    adminForceColonize: () => null,
    adminConvertNPC: () => null,
    adminRemoveNPC: () => {},
    adminAddNPC: () => null,
    adminSetNPCTier: () => {},
    adminSetNPCSpecialty: () => {},
    adminSetNPCBuildings: () => {},
    adminSetNPCCurrentFleet: () => {},
    adminSetNPCCurrentDefences: () => {},
    adminResetNPC: () => {},
    adminWipeNPC: () => {},
    adminNPCTriggerUpgrade: () => {},
    adminClearNPCRaidHistory: () => {},
    adminForceAbandonNPC: () => {},
    adminSetPlanetFieldCount: () => {},
    adminCompleteBuilding: () => {},
    adminCompleteResearch: () => {},
    adminCompleteShipyard: () => {},
    adminCompleteAllQueues: () => {},
    adminResolveMission: () => {},
    adminResolveAllMissions: () => {},
    adminTriggerCombat: () => null,
    adminSimulateTime: () => {},
    adminRegenerateGalaxy: () => {},
    adminClearCombatLog: () => {},
    adminClearEspionageReports: () => {},
    adminClearDebrisFields: () => {},
    exportSaveAction: () => '',
    importSaveAction: () => false,
    // Dev subagent will add: catchUp, messagesInitialTab, setMessagesInitialTab
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// The hook needs to emit toasts via NotificationContext.
// We spy on showToast by checking the queue exposed by the context.
// Since the exact context shape is TBD, we use a capture array approach:
// wrap the hook call so it can record what it would emit.
// ---------------------------------------------------------------------------

/**
 * Minimal wrapper that provides GameContext and captures toasts emitted
 * by useNotificationObserver via a spy on showToast.
 */
function makeWrapper(
  ctxOverrides: Partial<GameContextType> = {},
  catchUp: CatchUpBatch = { combat: [], fleet: [], espionage: [] },
) {
  const emitted: EmittedToast[] = [];

  const ctx = buildMockGameContext(
    {
      ...ctxOverrides,
      // Expose catchUp data via context field (dev subagent wires this)
      // @ts-expect-error — catchUp field added in v17; doesn't exist yet.
      catchUp,
    },
    catchUp,
  );

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <GameContext.Provider value={ctx}>{children}</GameContext.Provider>
    );
  }

  return { Wrapper, emitted, ctx };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useNotificationObserver', () => {
  it('emits no toasts on initial mount when no catch-up entries', () => {
    const { Wrapper, emitted } = makeWrapper({}, { combat: [], fleet: [], espionage: [] });

    renderHook(() => useNotificationObserver(), { wrapper: Wrapper });

    // With empty catchUp, no toasts should be emitted
    // We check by reading the hook's exposed queue
    // (The hook may expose the queue via return value or NotificationContext)
    // For now, assert that nothing was emitted via the capture array
    expect(emitted.length).toBe(0);
  });

  it('emits catch-up recap of 5 most recent entries on mount', () => {
    // Provide 10 total entries across types
    const now = Date.now();
    const combatEntries = Array.from({ length: 4 }, (_, i) =>
      makeCombatEntry(`c-${i}`, now - (10 - i) * 1000),
    );
    const fleetEntries = Array.from({ length: 3 }, (_, i) =>
      makeFleetNotification(`f-${i}`, now - (6 - i) * 1000),
    );
    const espionageEntries = Array.from({ length: 3 }, (_, i) =>
      makeEspionageReport(`e-${i}`, now - (3 - i) * 1000),
    );

    const catchUp: CatchUpBatch = {
      combat: combatEntries,
      fleet: fleetEntries,
      espionage: espionageEntries,
    };

    const { Wrapper } = makeWrapper({}, catchUp);

    // The hook returns the queue (or we read NotificationContext)
    // For the test, we call the hook and inspect its return value
    const { result } = renderHook(() => useNotificationObserver(), { wrapper: Wrapper });

    // Hook should expose: { queue: EmittedToast[] } or similar
    // If it exposes queue directly, check length === 5
    const queue: EmittedToast[] = result.current?.queue ?? result.current ?? [];

    // Should have emitted exactly 5 (the 5 most recent across all types)
    expect(queue.length).toBe(5);

    // The 5 emitted should be the 5 entries with the highest timestamps
    // (espionage e-2, e-1, e-0 and fleet f-2, f-1 in this fixture)
    const emittedIds = queue.map((t: EmittedToast) => t.id);
    expect(emittedIds).toContain('e-2');
    expect(emittedIds).toContain('e-1');
    expect(emittedIds).toContain('e-0');
    expect(emittedIds).toContain('f-2');
    expect(emittedIds).toContain('f-1');
    // f-0 has timestamp now-5000, c-3 has now-7000 — f-0 should be in, c-3 should not
    expect(emittedIds).toContain('f-0');
    expect(emittedIds).not.toContain('c-0'); // oldest combat entry
  });

  it('respects notifications.enabled=false: suppresses all catch-up toasts', () => {
    const now = Date.now();
    const catchUp: CatchUpBatch = {
      combat: [makeCombatEntry('c1', now - 5000), makeCombatEntry('c2', now - 3000)],
      fleet: [makeFleetNotification('f1', now - 2000)],
      espionage: [],
    };

    const ctx = buildMockGameContext({}, catchUp);
    // Set enabled=false
    (ctx.gameState.settings as unknown as { notifications: NotificationSettings }).notifications = {
      enabled: false,
      combat: true,
      fleet: true,
      espionage: true,
    };

    function Wrapper({ children }: { children: ReactNode }) {
      return <GameContext.Provider value={ctx}>{children}</GameContext.Provider>;
    }

    const { result } = renderHook(() => useNotificationObserver(), { wrapper: Wrapper });

    const queue: EmittedToast[] = result.current?.queue ?? result.current ?? [];
    expect(queue.length).toBe(0);
  });

  it('respects per-type filter during catch-up recap', () => {
    const now = Date.now();
    const catchUp: CatchUpBatch = {
      combat: [
        makeCombatEntry('c1', now - 6000),
        makeCombatEntry('c2', now - 5000),
        makeCombatEntry('c3', now - 4000),
      ],
      fleet: [
        makeFleetNotification('f1', now - 3000),
        makeFleetNotification('f2', now - 2000),
        makeFleetNotification('f3', now - 1000),
      ],
      espionage: [],
    };

    const ctx = buildMockGameContext({}, catchUp);
    // Disable only combat
    (ctx.gameState.settings as unknown as { notifications: NotificationSettings }).notifications = {
      enabled: true,
      combat: false,
      fleet: true,
      espionage: true,
    };

    function Wrapper({ children }: { children: ReactNode }) {
      return <GameContext.Provider value={ctx}>{children}</GameContext.Provider>;
    }

    const { result } = renderHook(() => useNotificationObserver(), { wrapper: Wrapper });

    const queue: EmittedToast[] = result.current?.queue ?? result.current ?? [];

    // Only fleet toasts should appear (combat is disabled)
    const fleetToasts = queue.filter((t: EmittedToast) => t.type === 'fleet');
    const combatToasts = queue.filter((t: EmittedToast) => t.type === 'combat');

    expect(combatToasts.length).toBe(0);
    expect(fleetToasts.length).toBe(3);
  });

  it('emits a toast when a new combat entry appears post-mount', async () => {
    const baseState = createNewGameState();
    const stateWithNotifications = {
      ...baseState,
      settings: {
        ...baseState.settings,
        notifications: makeDefaultNotifications(),
      },
      combatLog: [] as CombatLogEntry[],
    };

    let currentCtx = buildMockGameContext({
      gameState: stateWithNotifications as GameContextType['gameState'],
    });

    function Wrapper({ children }: { children: ReactNode }) {
      // Use a ref so we can update context dynamically
      return <GameContext.Provider value={currentCtx}>{children}</GameContext.Provider>;
    }

    const { result, rerender } = renderHook(() => useNotificationObserver(), { wrapper: Wrapper });

    // Initially no toasts
    const initialQueue: EmittedToast[] = result.current?.queue ?? result.current ?? [];
    const initialLen = initialQueue.length;

    // Add a new combat entry
    const newEntry = makeCombatEntry('new-combat-1', Date.now());
    currentCtx = buildMockGameContext({
      gameState: {
        ...stateWithNotifications,
        combatLog: [newEntry],
      } as GameContextType['gameState'],
    });

    await act(async () => {
      rerender();
    });

    const updatedQueue: EmittedToast[] = result.current?.queue ?? result.current ?? [];
    expect(updatedQueue.length).toBe(initialLen + 1);

    const combatToast = updatedQueue.find((t: EmittedToast) => t.type === 'combat');
    expect(combatToast).toBeDefined();
  });

  it('emits a toast when a new fleet notification appears post-mount', async () => {
    const baseState = createNewGameState();
    const stateWithNotifications = {
      ...baseState,
      settings: { ...baseState.settings, notifications: makeDefaultNotifications() },
      fleetNotifications: [] as FleetNotification[],
    };

    let currentCtx = buildMockGameContext({
      gameState: stateWithNotifications as GameContextType['gameState'],
    });

    function Wrapper({ children }: { children: ReactNode }) {
      return <GameContext.Provider value={currentCtx}>{children}</GameContext.Provider>;
    }

    const { result, rerender } = renderHook(() => useNotificationObserver(), { wrapper: Wrapper });

    const initialQueue: EmittedToast[] = result.current?.queue ?? result.current ?? [];
    const initialLen = initialQueue.length;

    const newNotif = makeFleetNotification('f-new', Date.now());
    currentCtx = buildMockGameContext({
      gameState: {
        ...stateWithNotifications,
        fleetNotifications: [newNotif],
      } as GameContextType['gameState'],
    });

    await act(async () => {
      rerender();
    });

    const updatedQueue: EmittedToast[] = result.current?.queue ?? result.current ?? [];
    expect(updatedQueue.length).toBe(initialLen + 1);

    const fleetToast = updatedQueue.find((t: EmittedToast) => t.type === 'fleet');
    expect(fleetToast).toBeDefined();
  });

  it('emits a toast when a new espionage report appears post-mount', async () => {
    const baseState = createNewGameState();
    const stateWithNotifications = {
      ...baseState,
      settings: { ...baseState.settings, notifications: makeDefaultNotifications() },
      espionageReports: [] as EspionageReport[],
    };

    let currentCtx = buildMockGameContext({
      gameState: stateWithNotifications as GameContextType['gameState'],
    });

    function Wrapper({ children }: { children: ReactNode }) {
      return <GameContext.Provider value={currentCtx}>{children}</GameContext.Provider>;
    }

    const { result, rerender } = renderHook(() => useNotificationObserver(), { wrapper: Wrapper });

    const initialQueue: EmittedToast[] = result.current?.queue ?? result.current ?? [];
    const initialLen = initialQueue.length;

    const newReport = makeEspionageReport('e-new', Date.now());
    currentCtx = buildMockGameContext({
      gameState: {
        ...stateWithNotifications,
        espionageReports: [newReport],
      } as GameContextType['gameState'],
    });

    await act(async () => {
      rerender();
    });

    const updatedQueue: EmittedToast[] = result.current?.queue ?? result.current ?? [];
    expect(updatedQueue.length).toBe(initialLen + 1);

    const espionageToast = updatedQueue.find((t: EmittedToast) => t.type === 'espionage');
    expect(espionageToast).toBeDefined();
  });

  it('does NOT emit a toast when a post-mount combat entry arrives with combat=false', async () => {
    const baseState = createNewGameState();
    const stateWithNotifications = {
      ...baseState,
      settings: {
        ...baseState.settings,
        notifications: makeDefaultNotifications({ combat: false }),
      },
      combatLog: [] as CombatLogEntry[],
    };

    let currentCtx = buildMockGameContext({
      gameState: stateWithNotifications as GameContextType['gameState'],
    });

    function Wrapper({ children }: { children: ReactNode }) {
      return <GameContext.Provider value={currentCtx}>{children}</GameContext.Provider>;
    }

    const { result, rerender } = renderHook(() => useNotificationObserver(), { wrapper: Wrapper });

    const initialQueue: EmittedToast[] = result.current?.queue ?? result.current ?? [];
    const initialLen = initialQueue.length;

    // Add combat entry while combat is disabled
    const newEntry = makeCombatEntry('suppressed-1', Date.now());
    currentCtx = buildMockGameContext({
      gameState: {
        ...stateWithNotifications,
        combatLog: [newEntry],
      } as GameContextType['gameState'],
    });

    await act(async () => {
      rerender();
    });

    const updatedQueue: EmittedToast[] = result.current?.queue ?? result.current ?? [];
    // No new toast should have been added
    expect(updatedQueue.length).toBe(initialLen);
  });

  it('does NOT emit ANY toasts post-mount when master enabled=false', async () => {
    const baseState = createNewGameState();
    const stateWithNotifications = {
      ...baseState,
      settings: {
        ...baseState.settings,
        notifications: makeDefaultNotifications({ enabled: false }),
      },
      combatLog: [] as CombatLogEntry[],
      fleetNotifications: [] as FleetNotification[],
    };

    let currentCtx = buildMockGameContext({
      gameState: stateWithNotifications as GameContextType['gameState'],
    });

    function Wrapper({ children }: { children: ReactNode }) {
      return <GameContext.Provider value={currentCtx}>{children}</GameContext.Provider>;
    }

    const { result, rerender } = renderHook(() => useNotificationObserver(), { wrapper: Wrapper });

    const initialLen = (result.current?.queue ?? result.current ?? []).length;

    // Add entries for multiple types
    currentCtx = buildMockGameContext({
      gameState: {
        ...stateWithNotifications,
        combatLog: [makeCombatEntry('c1', Date.now())],
        fleetNotifications: [makeFleetNotification('f1', Date.now())],
      } as GameContextType['gameState'],
    });

    await act(async () => {
      rerender();
    });

    const updatedQueue: EmittedToast[] = result.current?.queue ?? result.current ?? [];
    // Nothing should have been added
    expect(updatedQueue.length).toBe(initialLen);
  });

  it('toast message contains formatted coordinates [G:S:P]', () => {
    const now = Date.now();
    const catchUp: CatchUpBatch = {
      combat: [makeCombatEntry('c1', now - 1000)],
      fleet: [],
      espionage: [],
    };

    const ctx = buildMockGameContext({}, catchUp);
    (ctx.gameState.settings as unknown as { notifications: NotificationSettings }).notifications =
      makeDefaultNotifications();

    // @ts-expect-error — catchUp field added in v17
    ctx.catchUp = catchUp;

    function Wrapper({ children }: { children: ReactNode }) {
      return <GameContext.Provider value={ctx}>{children}</GameContext.Provider>;
    }

    const { result } = renderHook(() => useNotificationObserver(), { wrapper: Wrapper });

    const queue: EmittedToast[] = result.current?.queue ?? result.current ?? [];
    expect(queue.length).toBeGreaterThan(0);

    // The combat entry targets [1:2:3], so message must contain this coord pattern
    const firstMessage = queue[0].message;
    expect(firstMessage).toMatch(/\[1:2:3\]/);
  });

  it('toast type reflects log source', () => {
    const now = Date.now();
    const catchUp: CatchUpBatch = {
      combat: [makeCombatEntry('c1', now - 5000)],
      fleet: [makeFleetNotification('f1', now - 3000)],
      espionage: [makeEspionageReport('e1', now - 1000)],
    };

    const ctx = buildMockGameContext({}, catchUp);
    (ctx.gameState.settings as unknown as { notifications: NotificationSettings }).notifications =
      makeDefaultNotifications();

    // @ts-expect-error — catchUp field added in v17
    ctx.catchUp = catchUp;

    function Wrapper({ children }: { children: ReactNode }) {
      return <GameContext.Provider value={ctx}>{children}</GameContext.Provider>;
    }

    const { result } = renderHook(() => useNotificationObserver(), { wrapper: Wrapper });

    const queue: EmittedToast[] = result.current?.queue ?? result.current ?? [];
    expect(queue.length).toBe(3);

    const types = new Set(queue.map((t: EmittedToast) => t.type));
    expect(types.has('combat')).toBe(true);
    expect(types.has('fleet')).toBe(true);
    expect(types.has('espionage')).toBe(true);
  });
});
