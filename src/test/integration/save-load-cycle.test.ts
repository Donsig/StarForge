import type { GameState } from '../../models/GameState.ts';
import { createNewGameState } from '../../models/GameState.ts';
import { calculateProduction } from '../../engine/ResourceEngine.ts';
import { startBuildingUpgrade } from '../../engine/BuildQueue.ts';
import {
  exportSave,
  importSave,
  loadState,
  processOfflineTime,
  resetGame,
  saveState,
} from '../../engine/StateManager.ts';

function shiftQueueTimestamps(state: GameState, shiftSeconds: number): void {
  const deltaMs = shiftSeconds * 1000;
  state.lastSaveTimestamp -= deltaMs;
  if (state.planet.buildingQueue) {
    state.planet.buildingQueue.startedAt -= deltaMs;
    state.planet.buildingQueue.completesAt -= deltaMs;
  }
  if (state.researchQueue) {
    state.researchQueue.startedAt -= deltaMs;
    state.researchQueue.completesAt -= deltaMs;
  }
  for (const item of state.planet.shipyardQueue) {
    item.startedAt -= deltaMs;
    item.completesAt -= deltaMs;
  }
}

describe('Integration: save/load cycle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('save mid-build, load, and construction completes', () => {
    const state = createNewGameState();
    state.planet.buildings.solarPlant = 1;

    expect(startBuildingUpgrade(state, 'metalMine')).toBe(true);
    expect(state.planet.buildingQueue).not.toBeNull();

    saveState(state);
    const loaded = loadState();
    expect(loaded).not.toBeNull();
    if (!loaded || !loaded.planet.buildingQueue) return;

    const simulatedOfflineSeconds = 300;
    shiftQueueTimestamps(loaded, simulatedOfflineSeconds);

    const metalAtSave = loaded.planet.resources.metal;
    const crystalAtSave = loaded.planet.resources.crystal;
    const oldRates = calculateProduction(loaded);
    const secondsToCompletion = Math.floor(
      (loaded.planet.buildingQueue.completesAt - loaded.lastSaveTimestamp) / 1000,
    );

    const { elapsedSeconds } = processOfflineTime(loaded);
    expect(loaded.planet.buildingQueue).toBeNull();
    expect(loaded.planet.buildings.metalMine).toBe(1);

    const newRates = calculateProduction(loaded);
    const secondsAfterCompletion = elapsedSeconds - secondsToCompletion;
    expect(secondsAfterCompletion).toBeGreaterThan(0);
    expect(newRates.metalPerHour).toBeGreaterThan(oldRates.metalPerHour);

    const expectedMetal =
      metalAtSave +
      (oldRates.metalPerHour / 3600) * secondsToCompletion +
      (newRates.metalPerHour / 3600) * secondsAfterCompletion;
    const expectedCrystal =
      crystalAtSave +
      (oldRates.crystalPerHour / 3600) * secondsToCompletion +
      (newRates.crystalPerHour / 3600) * secondsAfterCompletion;

    expect(Math.abs(loaded.planet.resources.metal - expectedMetal)).toBeLessThan(0.1);
    expect(Math.abs(loaded.planet.resources.crystal - expectedCrystal)).toBeLessThan(0.1);
  });

  it('offline for 1 hour with active production', () => {
    const state = createNewGameState();
    state.planet.buildings.metalMine = 5;
    state.planet.buildings.crystalMine = 3;
    state.planet.buildings.solarPlant = 4;
    state.planet.resources.metal = 1000;
    state.planet.resources.crystal = 1000;
    state.planet.resources.deuterium = 500;

    saveState(state);
    state.lastSaveTimestamp -= 3600 * 1000;

    const rates = calculateProduction(state);
    const startMetal = state.planet.resources.metal;
    const startCrystal = state.planet.resources.crystal;
    const startDeuterium = state.planet.resources.deuterium;

    const { elapsedSeconds } = processOfflineTime(state);
    const expectedMetal = startMetal + (rates.metalPerHour / 3600) * elapsedSeconds;
    const expectedCrystal = startCrystal + (rates.crystalPerHour / 3600) * elapsedSeconds;
    const expectedDeuterium =
      startDeuterium + (rates.deuteriumPerHour / 3600) * elapsedSeconds;

    expect(state.planet.resources.metal).toBeCloseTo(expectedMetal, 5);
    expect(state.planet.resources.crystal).toBeCloseTo(expectedCrystal, 5);
    expect(state.planet.resources.deuterium).toBeCloseTo(expectedDeuterium, 5);
  });

  it('offline for 8 days caps at 7 days', () => {
    const state = createNewGameState();
    state.planet.buildings.metalMine = 6;
    state.planet.buildings.crystalMine = 4;
    state.planet.buildings.solarPlant = 6;
    saveState(state);

    state.lastSaveTimestamp = Date.now() - 8 * 24 * 3600 * 1000;
    const { elapsedSeconds } = processOfflineTime(state);
    expect(elapsedSeconds).toBe(7 * 24 * 3600);
  });

  it('export/import round-trip preserves everything', () => {
    const state = createNewGameState();
    const now = Date.now();

    state.tickCount = 1234;
    state.lastSaveTimestamp = now - 55_000;
    state.settings.gameSpeed = 2.5;
    state.planet.name = 'Forge Prime';
    state.planet.maxTemperature = -20;
    state.planet.maxFields = 200;

    state.planet.buildings.metalMine = 8;
    state.planet.buildings.crystalMine = 6;
    state.planet.buildings.deuteriumSynthesizer = 4;
    state.planet.buildings.solarPlant = 7;
    state.planet.buildings.roboticsFactory = 3;
    state.planet.buildings.shipyard = 4;
    state.planet.buildings.researchLab = 5;
    state.planet.buildings.metalStorage = 2;
    state.planet.buildings.crystalStorage = 1;
    state.planet.buildings.deuteriumTank = 1;

    state.research.energyTechnology = 5;
    state.research.laserTechnology = 6;
    state.research.ionTechnology = 2;
    state.research.combustionDrive = 3;
    state.research.impulseDrive = 2;
    state.research.armourTechnology = 2;

    state.planet.ships.lightFighter = 12;
    state.planet.ships.smallCargo = 4;
    state.planet.ships.heavyFighter = 2;

    state.planet.resources.metal = 54321.5;
    state.planet.resources.crystal = 32109.25;
    state.planet.resources.deuterium = 12000.75;
    state.planet.resources.energyProduction = 260;
    state.planet.resources.energyConsumption = 200;

    state.planet.buildingQueue = {
      type: 'building',
      id: 'solarPlant',
      targetLevel: 8,
      startedAt: now - 2000,
      completesAt: now + 10_000,
    };
    state.researchQueue = {
      type: 'research',
      id: 'hyperspaceTechnology',
      targetLevel: 1,
      startedAt: now - 1000,
      completesAt: now + 20_000,
    };
    state.planet.shipyardQueue = [
      {
        type: 'ship',
        id: 'lightFighter',
        quantity: 4,
        completed: 1,
        startedAt: now - 500,
        completesAt: now + 3000,
      },
      {
        type: 'ship',
        id: 'smallCargo',
        quantity: 2,
        completed: 0,
        startedAt: now - 250,
        completesAt: now + 8000,
      },
    ];

    const originalSnapshot = JSON.parse(JSON.stringify(state)) as GameState;
    const exported = exportSave(state);

    resetGame();
    const imported = importSave(exported);
    expect(imported).not.toBeNull();
    if (!imported) return;

    expect(imported.lastSaveTimestamp).toBeGreaterThan(originalSnapshot.lastSaveTimestamp);
    const normalizedImported: GameState = {
      ...imported,
      lastSaveTimestamp: originalSnapshot.lastSaveTimestamp,
    };
    expect(normalizedImported).toEqual(originalSnapshot);

    const persisted = loadState();
    expect(persisted).not.toBeNull();
    if (!persisted) return;
    const normalizedPersisted: GameState = {
      ...persisted,
      lastSaveTimestamp: originalSnapshot.lastSaveTimestamp,
    };
    expect(normalizedPersisted).toEqual(originalSnapshot);
  });
});
