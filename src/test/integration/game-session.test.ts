import type { GameState } from '../../models/GameState.ts';
import { createNewGameState } from '../../models/GameState.ts';
import {
  processTick as processBuildTick,
  startBuildingUpgrade,
} from '../../engine/BuildQueue.ts';
import {
  accumulateBulk,
  calculateProduction,
  getStorageCaps,
} from '../../engine/ResourceEngine.ts';
import {
  crystalProductionPerHour,
  energyFactor,
  metalProductionPerHour,
} from '../../engine/FormulasEngine.ts';

function completeCurrentBuilding(state: GameState): void {
  const queueItem = state.planet.buildingQueue[0];
  expect(state.planet.buildingQueue.length).toBeGreaterThan(0);
  if (!queueItem) return;

  const now = Date.now();
  queueItem.completesAt = now - 1;
  processBuildTick(state, now);
}

describe('Integration: game session', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('new player first 10 minutes', () => {
    const state = createNewGameState();
    expect(state.planet.resources.metal).toBe(500);
    expect(state.planet.resources.crystal).toBe(500);
    expect(state.planet.resources.deuterium).toBe(0);

    const initialRates = calculateProduction(state);

    expect(startBuildingUpgrade(state, 'metalMine')).toBe(true);
    expect(state.planet.resources.metal).toBe(440);
    expect(state.planet.resources.crystal).toBe(485);

    completeCurrentBuilding(state);
    expect(state.planet.buildings.metalMine).toBe(1);

    const afterMetalMineRates = calculateProduction(state);
    expect(afterMetalMineRates.energyConsumption).toBeGreaterThan(
      initialRates.energyConsumption,
    );
    expect(metalProductionPerHour(state.planet.buildings.metalMine)).toBeGreaterThan(
      metalProductionPerHour(0),
    );

    const metalBeforeFiveMinutes = state.planet.resources.metal;
    const crystalBeforeFiveMinutes = state.planet.resources.crystal;
    accumulateBulk(state, 5 * 60);
    expect(state.planet.resources.metal).toBeCloseTo(
      metalBeforeFiveMinutes + (afterMetalMineRates.metalPerHour / 3600) * 300,
      6,
    );
    expect(state.planet.resources.crystal).toBeCloseTo(
      crystalBeforeFiveMinutes + (afterMetalMineRates.crystalPerHour / 3600) * 300,
      6,
    );

    expect(startBuildingUpgrade(state, 'crystalMine')).toBe(true);
    completeCurrentBuilding(state);
    expect(state.planet.buildings.crystalMine).toBe(1);

    const afterBothMinesRates = calculateProduction(state);
    expect(afterBothMinesRates.energyConsumption).toBeGreaterThan(
      afterMetalMineRates.energyConsumption,
    );
    expect(crystalProductionPerHour(state.planet.buildings.crystalMine)).toBeGreaterThan(
      crystalProductionPerHour(0),
    );

    const deficitFactor = energyFactor(
      afterBothMinesRates.energyProduction,
      afterBothMinesRates.energyConsumption,
    );
    expect(deficitFactor).toBeLessThan(1);

    expect(startBuildingUpgrade(state, 'solarPlant')).toBe(true);
    completeCurrentBuilding(state);
    expect(state.planet.buildings.solarPlant).toBe(1);

    const restoredRates = calculateProduction(state);
    const restoredFactor = energyFactor(
      restoredRates.energyProduction,
      restoredRates.energyConsumption,
    );
    expect(restoredFactor).toBe(1);
    expect(restoredRates.metalPerHour).toBeGreaterThan(initialRates.metalPerHour);
    expect(restoredRates.crystalPerHour).toBeGreaterThan(initialRates.crystalPerHour);
  });

  it('energy crisis', () => {
    const state = createNewGameState();
    state.planet.resources.metal = 5000;
    state.planet.resources.crystal = 5000;
    state.planet.buildings.metalMine = 5;
    state.planet.buildings.crystalMine = 5;
    state.planet.buildings.solarPlant = 3;

    const deficitRates = calculateProduction(state);
    const deficitFactor = energyFactor(
      deficitRates.energyProduction,
      deficitRates.energyConsumption,
    );
    expect(deficitFactor).toBeLessThan(1);

    const fullMetalRate = 30 + metalProductionPerHour(5);
    const fullCrystalRate = 15 + crystalProductionPerHour(5);
    expect(deficitRates.metalPerHour).toBeCloseTo(
      30 + metalProductionPerHour(5) * deficitFactor,
      6,
    );
    expect(deficitRates.crystalPerHour).toBeCloseTo(
      15 + crystalProductionPerHour(5) * deficitFactor,
      6,
    );
    expect(deficitRates.metalPerHour).toBeLessThan(fullMetalRate);
    expect(deficitRates.crystalPerHour).toBeLessThan(fullCrystalRate);

    expect(startBuildingUpgrade(state, 'solarPlant')).toBe(true);
    completeCurrentBuilding(state);
    expect(startBuildingUpgrade(state, 'solarPlant')).toBe(true);
    completeCurrentBuilding(state);
    expect(state.planet.buildings.solarPlant).toBe(5);

    const restoredRates = calculateProduction(state);
    const restoredFactor = energyFactor(
      restoredRates.energyProduction,
      restoredRates.energyConsumption,
    );
    expect(restoredFactor).toBe(1);
    expect(restoredRates.metalPerHour).toBeCloseTo(fullMetalRate, 6);
    expect(restoredRates.crystalPerHour).toBeCloseTo(fullCrystalRate, 6);
  });

  it('storage overflow', () => {
    const state = createNewGameState();
    state.planet.buildings.metalMine = 10;
    state.planet.buildings.solarPlant = 10;
    state.planet.resources.metal = 50000;
    state.planet.resources.crystal = 500;

    expect(state.planet.buildings.metalStorage).toBe(0);
    expect(state.planet.buildings.crystalStorage).toBe(0);
    expect(state.planet.buildings.deuteriumTank).toBe(0);

    const baseCaps = getStorageCaps(state);
    state.planet.resources.metal = baseCaps.metal - 50;
    accumulateBulk(state, 3600);
    expect(state.planet.resources.metal).toBe(baseCaps.metal);

    expect(startBuildingUpgrade(state, 'metalStorage')).toBe(true);
    completeCurrentBuilding(state);
    expect(state.planet.buildings.metalStorage).toBe(1);

    const expandedCaps = getStorageCaps(state);
    expect(expandedCaps.metal).toBeGreaterThan(baseCaps.metal);

    state.planet.resources.metal = expandedCaps.metal - 25;
    accumulateBulk(state, 3600);
    expect(state.planet.resources.metal).toBe(expandedCaps.metal);
  });
});
