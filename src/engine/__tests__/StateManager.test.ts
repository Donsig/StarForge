/// <reference types="vitest/globals" />

import { createNewGameState } from '../../models/GameState.ts';
import { createDefaultPlanet } from '../../models/Planet.ts';
import { GAME_CONSTANTS } from '../../models/types.ts';
import { calculateProduction } from '../ResourceEngine.ts';
import {
  exportSave,
  importSave,
  loadState,
  newGame,
  processOfflineTime,
  resetGame,
  saveState,
} from '../StateManager.ts';

describe('StateManager', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('newGame creates a valid initial state with expected defaults', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);

    const state = newGame();

    expect(state.version).toBe(GAME_CONSTANTS.STATE_VERSION);
    expect(state.tickCount).toBe(0);
    expect(state.settings.gameSpeed).toBe(1);
    expect(state.settings.maxProbeCount).toBe(10);
    expect(state.planets[0].name).toBe('Homeworld');
    expect(state.planets[0].resources.metal).toBe(500);
    expect(state.planets[0].resources.crystal).toBe(500);
    expect(state.planets[0].resources.deuterium).toBe(0);
    expect(state.planets[0].buildingQueue).toEqual([]);
    expect(state.researchQueue).toEqual([]);
    expect(state.galaxy.npcColonies.length).toBeGreaterThan(0);
    expect(state.debrisFields).toEqual([]);

    const storedRaw = localStorage.getItem(GAME_CONSTANTS.STORAGE_KEY);
    expect(storedRaw).not.toBeNull();
    expect(JSON.parse(storedRaw!)).toEqual(state);
  });

  it('saveState writes to localStorage and loadState reads it back identically', () => {
    const state = createNewGameState();
    state.planets[0].buildings.metalMine = 4;
    state.research.energyTechnology = 2;
    state.planets[0].resources.deuterium = 250;

    vi.spyOn(Date, 'now').mockReturnValue(2_000_000);
    saveState(state);

    const loaded = loadState();
    expect(loaded).toEqual(state);
  });

  it('loadState returns null when no save exists', () => {
    expect(loadState()).toBeNull();
  });

  it('loadState returns null on corrupted JSON', () => {
    localStorage.setItem(GAME_CONSTANTS.STORAGE_KEY, '{broken');
    expect(loadState()).toBeNull();
  });

  it('resetGame clears prior data and returns a fresh saved state', () => {
    localStorage.setItem(GAME_CONSTANTS.STORAGE_KEY, '{"old":"data"}');
    vi.spyOn(Date, 'now').mockReturnValue(3_000_000);

    const state = resetGame();
    const loaded = loadState();

    expect(state.lastSaveTimestamp).toBe(3_000_000);
    expect(state.planets[0].resources.metal).toBe(500);
    expect(loaded).not.toBeNull();
    expect(JSON.parse(JSON.stringify(loaded))).toEqual(JSON.parse(JSON.stringify(state)));
  });

  it('exportSave returns JSON and importSave restores state from it', () => {
    const source = createNewGameState();
    source.planets[0].buildings.metalMine = 7;
    source.research.energyTechnology = 3;
    source.planets[0].resources.deuterium = 1234;

    const exported = exportSave(source);
    expect(typeof exported).toBe('string');
    expect(JSON.parse(exported)).toEqual(source);

    vi.spyOn(Date, 'now').mockReturnValue(4_000_000);
    const imported = importSave(exported);

    expect(imported).not.toBeNull();
    expect(imported!.planets[0].buildings.metalMine).toBe(7);
    expect(imported!.research.energyTechnology).toBe(3);
    expect(imported!.planets[0].resources.deuterium).toBe(1234);
    expect(imported!.lastSaveTimestamp).toBe(4_000_000);
    expect(imported!.settings.maxProbeCount).toBe(10);
    expect(loadState()).toEqual(imported);
  });

  it('importSave rejects invalid JSON gracefully', () => {
    const result = importSave('{not-valid-json');
    expect(result).toBeNull();
    expect(localStorage.getItem(GAME_CONSTANTS.STORAGE_KEY)).toBeNull();
  });

  it('processOfflineTime accumulates resources for elapsed time', () => {
    const state = createNewGameState();
    state.planets[0].buildings.metalMine = 5;
    state.planets[0].buildings.crystalMine = 4;
    state.planets[0].buildings.deuteriumSynthesizer = 3;
    state.planets[0].buildings.solarPlant = 20;

    const start = { ...state.planets[0].resources };
    const rates = calculateProduction(state);
    const startTime = 5_000_000;
    state.lastSaveTimestamp = startTime;
    vi.spyOn(Date, 'now').mockReturnValue(startTime + 3600 * 1000);

    const result = processOfflineTime(state);

    expect(result.elapsedSeconds).toBe(3600);
    expect(state.planets[0].resources.metal).toBeCloseTo(start.metal + rates.metalPerHour, 8);
    expect(state.planets[0].resources.crystal).toBeCloseTo(
      start.crystal + rates.crystalPerHour,
      8,
    );
    expect(state.planets[0].resources.deuterium).toBeCloseTo(
      start.deuterium + rates.deuteriumPerHour,
      8,
    );
  });

  it('processOfflineTime completes buildings finished during offline period', () => {
    const state = createNewGameState();
    const startTime = 6_000_000;
    state.lastSaveTimestamp = startTime;
    state.planets[0].buildingQueue = [
      {
        type: 'building',
        id: 'metalMine',
        targetLevel: 1,
        startedAt: startTime,
        completesAt: startTime + 10_000,
      },
    ];

    vi.spyOn(Date, 'now').mockReturnValue(startTime + 20_000);
    processOfflineTime(state);

    expect(state.planets[0].buildings.metalMine).toBe(1);
    expect(state.planets[0].buildingQueue).toEqual([]);
  });

  it('processOfflineTime caps elapsed time at 7 days maximum', () => {
    const state = createNewGameState();
    const startMetal = state.planets[0].resources.metal;
    const rate = calculateProduction(state).metalPerHour;
    const startTime = 7_000_000;
    const cappedSeconds = GAME_CONSTANTS.MAX_OFFLINE_SECONDS;
    state.lastSaveTimestamp = startTime;

    vi.spyOn(Date, 'now').mockReturnValue(startTime + (cappedSeconds + 3600) * 1000);
    const result = processOfflineTime(state);

    expect(result.elapsedSeconds).toBe(cappedSeconds);
    expect(state.planets[0].resources.metal).toBeCloseTo(
      startMetal + (rate / 3600) * cappedSeconds,
      8,
    );
  });

  it('processOfflineTime with zero elapsed time leaves state unchanged', () => {
    const state = createNewGameState();
    state.planets[0].buildings.metalMine = 5;
    const snapshot = structuredClone(state);

    vi.spyOn(Date, 'now').mockReturnValue(state.lastSaveTimestamp);
    const result = processOfflineTime(state);

    expect(result.elapsedSeconds).toBe(0);
    expect(state).toEqual(snapshot);
  });

  it('after offline building completion, later accumulation uses the upgraded production rate', () => {
    const state = createNewGameState();
    state.planets[0].resources.metal = 0;
    state.planets[0].buildings.solarPlant = 10;
    const startTime = 8_000_000;
    state.lastSaveTimestamp = startTime;
    state.planets[0].buildingQueue = [
      {
        type: 'building',
        id: 'metalMine',
        targetLevel: 1,
        startedAt: startTime,
        completesAt: startTime + 1800 * 1000,
      },
    ];

    const beforeRate = calculateProduction(state).metalPerHour;
    const afterState = structuredClone(state);
    afterState.planets[0].buildingQueue = [];
    afterState.planets[0].buildings.metalMine = 1;
    const afterRate = calculateProduction(afterState).metalPerHour;

    vi.spyOn(Date, 'now').mockReturnValue(startTime + 3600 * 1000);
    const result = processOfflineTime(state);

    const expectedMetal = (beforeRate / 3600) * 1800 + (afterRate / 3600) * 1800;

    expect(result.elapsedSeconds).toBe(3600);
    expect(state.planets[0].buildings.metalMine).toBe(1);
    expect(state.planets[0].resources.metal).toBeCloseTo(expectedMetal, 8);
  });

  it('processOfflineTime completes building events for non-active planets', () => {
    const state = createNewGameState();
    const colony = createDefaultPlanet();
    colony.name = 'Colony 2';
    state.planets.push(colony);
    state.activePlanetIndex = 0;

    const startTime = 9_000_000;
    state.lastSaveTimestamp = startTime;
    state.planets[1].buildingQueue = [
      {
        type: 'building',
        id: 'crystalMine',
        targetLevel: 1,
        startedAt: startTime,
        completesAt: startTime + 10_000,
      },
    ];

    vi.spyOn(Date, 'now').mockReturnValue(startTime + 20_000);
    processOfflineTime(state);

    expect(state.planets[1].buildings.crystalMine).toBe(1);
    expect(state.planets[1].buildingQueue).toEqual([]);
  });

  it('processOfflineTime completes shipyard events for non-active planets', () => {
    const state = createNewGameState();
    const colony = createDefaultPlanet();
    colony.name = 'Colony 2';
    state.planets.push(colony);
    state.activePlanetIndex = 0;

    const startTime = 10_000_000;
    state.lastSaveTimestamp = startTime;
    state.planets[1].shipyardQueue = [
      {
        type: 'ship',
        id: 'lightFighter',
        quantity: 1,
        completed: 0,
        startedAt: startTime,
        completesAt: startTime + 10_000,
      },
    ];

    vi.spyOn(Date, 'now').mockReturnValue(startTime + 20_000);
    processOfflineTime(state);

    expect(state.planets[1].ships.lightFighter).toBe(1);
    expect(state.planets[1].shipyardQueue).toEqual([]);
  });

  it('processOfflineTime resolves outbound espionage missions through return legs created during catch-up', () => {
    const state = createNewGameState();
    const startTime = 12_000_000;
    const targetCoordinates = { galaxy: 1, system: 1, slot: 9 };

    state.lastSaveTimestamp = startTime;
    state.planets[0].ships.espionageProbe = 0;
    state.galaxy.npcColonies = [
      {
        coordinates: targetCoordinates,
        name: 'Scout Target',
        tier: 1,
        specialty: 'balanced',
        maxTier: 5,
        initialUpgradeIntervalMs: 21_600_000,
        currentUpgradeIntervalMs: 21_600_000,
        lastUpgradeAt: 0,
        upgradeTickCount: 0,
        raidCount: 0,
        recentRaidTimestamps: [],
        abandonedAt: undefined,
        buildings: {
          metalMine: 2,
          crystalMine: 1,
          deuteriumSynthesizer: 1,
          solarPlant: 4,
        },
        baseDefences: {},
        baseShips: {},
        currentDefences: {},
        currentShips: {},
        lastRaidedAt: 0,
        resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 },
      },
    ];
    state.fleetMissions = [
      {
        id: 'mission_deadbeef',
        type: 'espionage',
        status: 'outbound',
        sourcePlanetIndex: 0,
        targetCoordinates,
        targetType: 'npc_colony',
        ships: { espionageProbe: 1 },
        cargo: { metal: 0, crystal: 0, deuterium: 0 },
        fuelCost: 1,
        departureTime: startTime,
        arrivalTime: startTime + 2_000,
        returnTime: 0,
      },
    ];

    vi.spyOn(Date, 'now').mockReturnValue(startTime + 30_000);
    processOfflineTime(state);

    expect(state.espionageReports).toHaveLength(1);
    expect(state.espionageReports[0].detected).toBe(false);
    expect(state.fleetMissions[0].status).toBe('completed');
    expect(state.fleetMissions[0].espionageReportId).toBe(state.espionageReports[0].id);
    expect(state.planets[0].ships.espionageProbe).toBe(1);
  });
});

describe('StateManager migration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('migrates v3 save to v5 with planets array + npc/debris fields', async () => {
    const { loadState } = await import('../StateManager.ts');

    const v3Save = {
      version: 3,
      lastSaveTimestamp: Date.now(),
      tickCount: 100,
      planet: {
        name: 'Homeworld',
        maxTemperature: 35,
        maxFields: 163,
        buildings: {
          metalMine: 5,
          crystalMine: 3,
          deuteriumSynthesizer: 1,
          solarPlant: 4,
          fusionReactor: 0,
          metalStorage: 2,
          crystalStorage: 1,
          deuteriumTank: 0,
          roboticsFactory: 2,
          naniteFactory: 0,
          shipyard: 1,
          researchLab: 1,
        },
        ships: {
          lightFighter: 10,
          heavyFighter: 0,
          cruiser: 0,
          battleship: 0,
          smallCargo: 5,
          largeCargo: 0,
          colonyShip: 0,
          recycler: 0,
          espionageProbe: 0,
          bomber: 0,
          destroyer: 0,
          battlecruiser: 0,
        },
        defences: {
          rocketLauncher: 3,
          lightLaser: 0,
          heavyLaser: 0,
          gaussCannon: 0,
          ionCannon: 0,
          plasmaTurret: 0,
          smallShieldDome: 0,
          largeShieldDome: 0,
        },
        resources: {
          metal: 5000,
          crystal: 3000,
          deuterium: 1000,
          energyProduction: 50,
          energyConsumption: 30,
        },
        buildingQueue: [],
        shipyardQueue: [],
      },
      research: {
        energyTechnology: 2,
        laserTechnology: 0,
        ionTechnology: 0,
        plasmaTechnology: 0,
        espionageTechnology: 0,
        computerTechnology: 0,
        weaponsTechnology: 0,
        shieldingTechnology: 0,
        armourTechnology: 0,
        combustionDrive: 1,
        impulseDrive: 0,
        hyperspaceDrive: 0,
        hyperspaceTechnology: 0,
      },
      researchQueue: [],
      settings: { gameSpeed: 1 },
    };

    localStorage.setItem(GAME_CONSTANTS.STORAGE_KEY, JSON.stringify(v3Save));
    const loaded = loadState();

    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(GAME_CONSTANTS.STATE_VERSION);
    expect(loaded!.planets).toHaveLength(1);
    expect(loaded!.planets[0].name).toBe('Homeworld');
    expect(loaded!.planets[0].buildings.metalMine).toBe(5);
    expect(loaded!.planets[0].ships.lightFighter).toBe(10);
    expect(loaded!.planets[0].coordinates).toEqual({ galaxy: 1, system: 1, slot: 4 });
    expect(loaded!.planets[0].fieldCount).toBe(loaded!.planets[0].maxFields);
    expect(loaded!.activePlanetIndex).toBe(0);
    expect(loaded!.galaxy).toBeDefined();
    expect(loaded!.galaxy.npcColonies.length).toBeGreaterThan(0);
    expect(loaded!.debrisFields).toEqual([]);
    expect(loaded!.settings.maxProbeCount).toBe(10);
    expect((loaded as any).planet).toBeUndefined();
  });
});
