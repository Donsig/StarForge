/// <reference types="vitest/globals" />

import { BASE_PRODUCTION, BASE_STORAGE } from '../../data/resources.ts';
import { createNewGameState } from '../../models/GameState.ts';
import {
  crystalMineEnergy,
  crystalProductionPerHour,
  deuteriumProductionPerHour,
  deuteriumSynthEnergy,
  fusionReactorDeuteriumConsumption,
  fusionReactorEnergy,
  metalMineEnergy,
  metalProductionPerHour,
  plasmaCrystalBonus,
  plasmaDeuteriumBonus,
  plasmaMetalBonus,
  solarPlantEnergy,
  storageCapacity,
} from '../FormulasEngine.ts';
import {
  accumulateBulk,
  calculateProduction,
  getStorageCaps,
  processTick,
} from '../ResourceEngine.ts';

describe('ResourceEngine', () => {
  it('processTick increases resources by the correct per-second amount', () => {
    const state = createNewGameState();
    state.planet.resources.metal = 0;
    state.planet.resources.crystal = 0;
    state.planet.resources.deuterium = 0;
    state.planet.buildings.metalMine = 5;
    state.planet.buildings.crystalMine = 4;
    state.planet.buildings.deuteriumSynthesizer = 3;
    state.planet.buildings.solarPlant = 20;

    const rates = calculateProduction(state);
    processTick(state);

    expect(state.planet.resources.metal).toBeCloseTo(rates.metalPerHour / 3600, 10);
    expect(state.planet.resources.crystal).toBeCloseTo(rates.crystalPerHour / 3600, 10);
    expect(state.planet.resources.deuterium).toBeCloseTo(
      rates.deuteriumPerHour / 3600,
      10,
    );
    expect(state.planet.resources.energyProduction).toBeCloseTo(rates.energyProduction, 10);
    expect(state.planet.resources.energyConsumption).toBeCloseTo(
      rates.energyConsumption,
      10,
    );
  });

  it('processTick clamps resources at storage capacity with no overflow', () => {
    const state = createNewGameState();
    state.planet.buildings.metalMine = 20;
    state.planet.buildings.crystalMine = 20;
    state.planet.buildings.deuteriumSynthesizer = 20;
    state.planet.buildings.solarPlant = 30;

    const caps = getStorageCaps(state);
    state.planet.resources.metal = caps.metal - 0.001;
    state.planet.resources.crystal = caps.crystal - 0.001;
    state.planet.resources.deuterium = caps.deuterium - 0.001;

    processTick(state);

    expect(state.planet.resources.metal).toBeCloseTo(caps.metal, 10);
    expect(state.planet.resources.crystal).toBeCloseTo(caps.crystal, 10);
    expect(state.planet.resources.deuterium).toBeCloseTo(caps.deuterium, 10);
  });

  it('processTick applies energy deficit as a proportional reduction across mine output', () => {
    const state = createNewGameState();
    state.planet.resources.metal = 0;
    state.planet.resources.crystal = 0;
    state.planet.resources.deuterium = 0;
    state.planet.buildings.metalMine = 10;
    state.planet.buildings.crystalMine = 8;
    state.planet.buildings.deuteriumSynthesizer = 6;
    state.planet.buildings.solarPlant = 2;

    const rates = calculateProduction(state);
    const factor = rates.energyProduction / rates.energyConsumption;

    expect(factor).toBeGreaterThan(0);
    expect(factor).toBeLessThan(1);

    const expectedMetalPerHour =
      BASE_PRODUCTION.metal + metalProductionPerHour(10) * factor;
    const expectedCrystalPerHour =
      BASE_PRODUCTION.crystal + crystalProductionPerHour(8) * factor;
    const expectedDeutPerHour =
      BASE_PRODUCTION.deuterium +
      deuteriumProductionPerHour(6, state.planet.maxTemperature) * factor;

    expect(rates.metalPerHour).toBeCloseTo(expectedMetalPerHour, 8);
    expect(rates.crystalPerHour).toBeCloseTo(expectedCrystalPerHour, 8);
    expect(rates.deuteriumPerHour).toBeCloseTo(expectedDeutPerHour, 8);

    processTick(state);
    expect(state.planet.resources.metal).toBeCloseTo(expectedMetalPerHour / 3600, 8);
    expect(state.planet.resources.crystal).toBeCloseTo(expectedCrystalPerHour / 3600, 8);
    expect(state.planet.resources.deuterium).toBeCloseTo(expectedDeutPerHour / 3600, 8);
  });

  it('processTick includes base production even with no mines', () => {
    const state = createNewGameState();
    state.planet.resources.metal = 0;
    state.planet.resources.crystal = 0;
    state.planet.resources.deuterium = 0;

    processTick(state);

    expect(state.planet.resources.metal).toBeCloseTo(30 / 3600, 10);
    expect(state.planet.resources.crystal).toBeCloseTo(15 / 3600, 10);
    expect(state.planet.resources.deuterium).toBe(0);
  });

  it('processTick handles fusion reactor deuterium consumption and never drops below zero', () => {
    const state = createNewGameState();
    state.planet.resources.deuterium = 0.1;
    state.planet.buildings.fusionReactor = 20;
    state.planet.buildings.solarPlant = 50;

    const rates = calculateProduction(state);
    expect(rates.deuteriumPerHour).toBeLessThan(0);

    processTick(state);

    expect(state.planet.resources.deuterium).toBe(0);
  });

  it('processTick production is increased by plasma technology bonuses', () => {
    const state = createNewGameState();
    state.planet.buildings.metalMine = 10;
    state.planet.buildings.crystalMine = 10;
    state.planet.buildings.deuteriumSynthesizer = 10;
    state.planet.buildings.solarPlant = 25;

    const baseRates = calculateProduction(state);

    state.research.plasmaTechnology = 10;
    const boostedRates = calculateProduction(state);

    expect(boostedRates.metalPerHour).toBeCloseTo(
      baseRates.metalPerHour * plasmaMetalBonus(10),
      8,
    );
    expect(boostedRates.crystalPerHour).toBeCloseTo(
      baseRates.crystalPerHour * plasmaCrystalBonus(10),
      8,
    );
    expect(boostedRates.deuteriumPerHour).toBeCloseTo(
      baseRates.deuteriumPerHour * plasmaDeuteriumBonus(10),
      8,
    );
  });

  it('accumulateBulk for 3600 seconds equals one hour of production', () => {
    const state = createNewGameState();
    state.planet.resources.metal = 100;
    state.planet.resources.crystal = 200;
    state.planet.resources.deuterium = 300;
    state.planet.buildings.metalMine = 5;
    state.planet.buildings.crystalMine = 4;
    state.planet.buildings.deuteriumSynthesizer = 3;
    state.planet.buildings.solarPlant = 20;

    const rates = calculateProduction(state);
    const start = { ...state.planet.resources };

    accumulateBulk(state, 3600);

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

  it('accumulateBulk respects storage caps', () => {
    const state = createNewGameState();
    state.planet.buildings.metalMine = 20;
    state.planet.buildings.crystalMine = 20;
    state.planet.buildings.deuteriumSynthesizer = 20;
    state.planet.buildings.solarPlant = 30;
    state.planet.resources.metal = 0;
    state.planet.resources.crystal = 0;
    state.planet.resources.deuterium = 0;

    const caps = getStorageCaps(state);

    accumulateBulk(state, 1_000_000);

    expect(state.planet.resources.metal).toBeCloseTo(caps.metal, 10);
    expect(state.planet.resources.crystal).toBeCloseTo(caps.crystal, 10);
    expect(state.planet.resources.deuterium).toBeCloseTo(caps.deuterium, 10);
  });

  it('calculateProduction returns rates that match mines, energy, bonuses, and game speed', () => {
    const state = createNewGameState();
    state.planet.buildings.metalMine = 8;
    state.planet.buildings.crystalMine = 6;
    state.planet.buildings.deuteriumSynthesizer = 5;
    state.planet.buildings.solarPlant = 7;
    state.planet.buildings.fusionReactor = 3;
    state.research.energyTechnology = 4;
    state.research.plasmaTechnology = 5;
    state.settings.gameSpeed = 3;

    const rates = calculateProduction(state);

    const energyProduction =
      solarPlantEnergy(7) + fusionReactorEnergy(3, state.research.energyTechnology);
    const energyConsumption =
      metalMineEnergy(8) + crystalMineEnergy(6) + deuteriumSynthEnergy(5);
    const factor =
      energyConsumption === 0 ? 1 : Math.min(1, energyProduction / energyConsumption);

    // gameSpeed is no longer multiplied in calculateProduction —
    // speed scales the tick rate in the game loop instead.
    const expectedMetal =
      (BASE_PRODUCTION.metal + metalProductionPerHour(8) * factor) *
      plasmaMetalBonus(5);
    const expectedCrystal =
      (BASE_PRODUCTION.crystal + crystalProductionPerHour(6) * factor) *
      plasmaCrystalBonus(5);
    const expectedDeuterium =
      (BASE_PRODUCTION.deuterium +
        deuteriumProductionPerHour(5, state.planet.maxTemperature) * factor -
        fusionReactorDeuteriumConsumption(3)) *
      plasmaDeuteriumBonus(5);

    expect(rates.energyProduction).toBeCloseTo(energyProduction, 8);
    expect(rates.energyConsumption).toBeCloseTo(energyConsumption, 8);
    expect(rates.metalPerHour).toBeCloseTo(expectedMetal, 8);
    expect(rates.crystalPerHour).toBeCloseTo(expectedCrystal, 8);
    expect(rates.deuteriumPerHour).toBeCloseTo(expectedDeuterium, 8);
  });

  it('getStorageCaps returns base storage plus building contribution', () => {
    const state = createNewGameState();
    state.planet.buildings.metalStorage = 2;
    state.planet.buildings.crystalStorage = 1;
    state.planet.buildings.deuteriumTank = 3;

    const caps = getStorageCaps(state);

    expect(caps.metal).toBe(BASE_STORAGE.metal + storageCapacity(2));
    expect(caps.crystal).toBe(BASE_STORAGE.crystal + storageCapacity(1));
    expect(caps.deuterium).toBe(BASE_STORAGE.deuterium + storageCapacity(3));
  });
});
