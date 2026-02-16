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
  const queueItem = state.planets[0].buildingQueue[0];
  expect(state.planets[0].buildingQueue.length).toBeGreaterThan(0);
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
    expect(state.planets[0].resources.metal).toBe(500);
    expect(state.planets[0].resources.crystal).toBe(500);
    expect(state.planets[0].resources.deuterium).toBe(0);

    const initialRates = calculateProduction(state);

    expect(startBuildingUpgrade(state, 'metalMine')).toBe(true);
    expect(state.planets[0].resources.metal).toBe(440);
    expect(state.planets[0].resources.crystal).toBe(485);

    completeCurrentBuilding(state);
    expect(state.planets[0].buildings.metalMine).toBe(1);

    const afterMetalMineRates = calculateProduction(state);
    expect(afterMetalMineRates.energyConsumption).toBeGreaterThan(
      initialRates.energyConsumption,
    );
    expect(metalProductionPerHour(state.planets[0].buildings.metalMine)).toBeGreaterThan(
      metalProductionPerHour(0),
    );

    const metalBeforeFiveMinutes = state.planets[0].resources.metal;
    const crystalBeforeFiveMinutes = state.planets[0].resources.crystal;
    accumulateBulk(state, 5 * 60);
    expect(state.planets[0].resources.metal).toBeCloseTo(
      metalBeforeFiveMinutes + (afterMetalMineRates.metalPerHour / 3600) * 300,
      6,
    );
    expect(state.planets[0].resources.crystal).toBeCloseTo(
      crystalBeforeFiveMinutes + (afterMetalMineRates.crystalPerHour / 3600) * 300,
      6,
    );

    expect(startBuildingUpgrade(state, 'crystalMine')).toBe(true);
    completeCurrentBuilding(state);
    expect(state.planets[0].buildings.crystalMine).toBe(1);

    const afterBothMinesRates = calculateProduction(state);
    expect(afterBothMinesRates.energyConsumption).toBeGreaterThan(
      afterMetalMineRates.energyConsumption,
    );
    expect(crystalProductionPerHour(state.planets[0].buildings.crystalMine)).toBeGreaterThan(
      crystalProductionPerHour(0),
    );

    const deficitFactor = energyFactor(
      afterBothMinesRates.energyProduction,
      afterBothMinesRates.energyConsumption,
    );
    expect(deficitFactor).toBeLessThan(1);

    expect(startBuildingUpgrade(state, 'solarPlant')).toBe(true);
    completeCurrentBuilding(state);
    expect(state.planets[0].buildings.solarPlant).toBe(1);

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
    state.planets[0].resources.metal = 5000;
    state.planets[0].resources.crystal = 5000;
    state.planets[0].buildings.metalMine = 5;
    state.planets[0].buildings.crystalMine = 5;
    state.planets[0].buildings.solarPlant = 3;

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
    expect(state.planets[0].buildings.solarPlant).toBe(5);

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
    state.planets[0].buildings.metalMine = 10;
    state.planets[0].buildings.solarPlant = 10;
    state.planets[0].resources.metal = 50000;
    state.planets[0].resources.crystal = 500;

    expect(state.planets[0].buildings.metalStorage).toBe(0);
    expect(state.planets[0].buildings.crystalStorage).toBe(0);
    expect(state.planets[0].buildings.deuteriumTank).toBe(0);

    const baseCaps = getStorageCaps(state);
    state.planets[0].resources.metal = baseCaps.metal - 50;
    accumulateBulk(state, 3600);
    expect(state.planets[0].resources.metal).toBe(baseCaps.metal);

    expect(startBuildingUpgrade(state, 'metalStorage')).toBe(true);
    completeCurrentBuilding(state);
    expect(state.planets[0].buildings.metalStorage).toBe(1);

    const expandedCaps = getStorageCaps(state);
    expect(expandedCaps.metal).toBeGreaterThan(baseCaps.metal);

    state.planets[0].resources.metal = expandedCaps.metal - 25;
    accumulateBulk(state, 3600);
    expect(state.planets[0].resources.metal).toBe(expandedCaps.metal);
  });
});
