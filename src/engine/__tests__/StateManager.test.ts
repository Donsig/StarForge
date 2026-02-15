/// <reference types="vitest/globals" />

import { createNewGameState } from '../../models/GameState.ts';
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
    expect(state.planet.name).toBe('Homeworld');
    expect(state.planet.resources.metal).toBe(500);
    expect(state.planet.resources.crystal).toBe(500);
    expect(state.planet.resources.deuterium).toBe(0);
    expect(state.planet.buildingQueue).toEqual([]);
    expect(state.researchQueue).toEqual([]);

    const storedRaw = localStorage.getItem(GAME_CONSTANTS.STORAGE_KEY);
    expect(storedRaw).not.toBeNull();
    expect(JSON.parse(storedRaw!)).toEqual(state);
  });

  it('saveState writes to localStorage and loadState reads it back identically', () => {
    const state = createNewGameState();
    state.planet.buildings.metalMine = 4;
    state.research.energyTechnology = 2;
    state.planet.resources.deuterium = 250;

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
    expect(state.planet.resources.metal).toBe(500);
    expect(loaded).toEqual(state);
  });

  it('exportSave returns JSON and importSave restores state from it', () => {
    const source = createNewGameState();
    source.planet.buildings.metalMine = 7;
    source.research.energyTechnology = 3;
    source.planet.resources.deuterium = 1234;

    const exported = exportSave(source);
    expect(typeof exported).toBe('string');
    expect(JSON.parse(exported)).toEqual(source);

    vi.spyOn(Date, 'now').mockReturnValue(4_000_000);
    const imported = importSave(exported);

    expect(imported).not.toBeNull();
    expect(imported!.planet.buildings.metalMine).toBe(7);
    expect(imported!.research.energyTechnology).toBe(3);
    expect(imported!.planet.resources.deuterium).toBe(1234);
    expect(imported!.lastSaveTimestamp).toBe(4_000_000);
    expect(loadState()).toEqual(imported);
  });

  it('importSave rejects invalid JSON gracefully', () => {
    const result = importSave('{not-valid-json');
    expect(result).toBeNull();
    expect(localStorage.getItem(GAME_CONSTANTS.STORAGE_KEY)).toBeNull();
  });

  it('processOfflineTime accumulates resources for elapsed time', () => {
    const state = createNewGameState();
    state.planet.buildings.metalMine = 5;
    state.planet.buildings.crystalMine = 4;
    state.planet.buildings.deuteriumSynthesizer = 3;
    state.planet.buildings.solarPlant = 20;

    const start = { ...state.planet.resources };
    const rates = calculateProduction(state);
    const startTime = 5_000_000;
    state.lastSaveTimestamp = startTime;
    vi.spyOn(Date, 'now').mockReturnValue(startTime + 3600 * 1000);

    const result = processOfflineTime(state);

    expect(result.elapsedSeconds).toBe(3600);
    expect(state.planet.resources.metal).toBeCloseTo(start.metal + rates.metalPerHour, 8);
    expect(state.planet.resources.crystal).toBeCloseTo(
      start.crystal + rates.crystalPerHour,
      8,
    );
    expect(state.planet.resources.deuterium).toBeCloseTo(
      start.deuterium + rates.deuteriumPerHour,
      8,
    );
  });

  it('processOfflineTime completes buildings finished during offline period', () => {
    const state = createNewGameState();
    const startTime = 6_000_000;
    state.lastSaveTimestamp = startTime;
    state.planet.buildingQueue = [
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

    expect(state.planet.buildings.metalMine).toBe(1);
    expect(state.planet.buildingQueue).toEqual([]);
  });

  it('processOfflineTime caps elapsed time at 7 days maximum', () => {
    const state = createNewGameState();
    const startMetal = state.planet.resources.metal;
    const rate = calculateProduction(state).metalPerHour;
    const startTime = 7_000_000;
    const cappedSeconds = GAME_CONSTANTS.MAX_OFFLINE_SECONDS;
    state.lastSaveTimestamp = startTime;

    vi.spyOn(Date, 'now').mockReturnValue(startTime + (cappedSeconds + 3600) * 1000);
    const result = processOfflineTime(state);

    expect(result.elapsedSeconds).toBe(cappedSeconds);
    expect(state.planet.resources.metal).toBeCloseTo(
      startMetal + (rate / 3600) * cappedSeconds,
      8,
    );
  });

  it('processOfflineTime with zero elapsed time leaves state unchanged', () => {
    const state = createNewGameState();
    state.planet.buildings.metalMine = 5;
    const snapshot = structuredClone(state);

    vi.spyOn(Date, 'now').mockReturnValue(state.lastSaveTimestamp);
    const result = processOfflineTime(state);

    expect(result.elapsedSeconds).toBe(0);
    expect(state).toEqual(snapshot);
  });

  it('after offline building completion, later accumulation uses the upgraded production rate', () => {
    const state = createNewGameState();
    state.planet.resources.metal = 0;
    state.planet.buildings.solarPlant = 10;
    const startTime = 8_000_000;
    state.lastSaveTimestamp = startTime;
    state.planet.buildingQueue = [
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
    afterState.planet.buildingQueue = [];
    afterState.planet.buildings.metalMine = 1;
    const afterRate = calculateProduction(afterState).metalPerHour;

    vi.spyOn(Date, 'now').mockReturnValue(startTime + 3600 * 1000);
    const result = processOfflineTime(state);

    const expectedMetal = (beforeRate / 3600) * 1800 + (afterRate / 3600) * 1800;

    expect(result.elapsedSeconds).toBe(3600);
    expect(state.planet.buildings.metalMine).toBe(1);
    expect(state.planet.resources.metal).toBeCloseTo(expectedMetal, 8);
  });
});
