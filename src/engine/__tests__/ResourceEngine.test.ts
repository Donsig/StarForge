/// <reference types="vitest/globals" />

import { BASE_PRODUCTION, BASE_STORAGE } from '../../data/resources.ts';
import { createNewGameState } from '../../models/GameState.ts';
import { createDefaultPlanet } from '../../models/Planet.ts';
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
  describe('solar satellite energy', () => {
    it('contributes energy based on planet temperature', () => {
      const planet = createDefaultPlanet();
      planet.maxTemperature = 50; // expected output = floor((50+140)/6) = floor(31.67) = 31 per satellite
      planet.ships.solarSatellite = 10;
      const research = createNewGameState().research;

      const rates = calculateProduction(planet, research);
      // 10 satellites * 31 = 310 energy
      expect(rates.energyProduction).toBeGreaterThanOrEqual(310);
    });

    it('produces more energy on hotter planets', () => {
      const hot = createDefaultPlanet();
      hot.maxTemperature = 300;
      hot.ships.solarSatellite = 1;

      const cold = createDefaultPlanet();
      cold.maxTemperature = -80;
      cold.ships.solarSatellite = 1;

      const research = createNewGameState().research;

      const hotRates = calculateProduction(hot, research);
      const coldRates = calculateProduction(cold, research);
      expect(hotRates.energyProduction).toBeGreaterThan(coldRates.energyProduction);
    });
  });

  it('processTick increases resources by the correct per-second amount', () => {
    const state = createNewGameState();
    state.planets[0].resources.metal = 0;
    state.planets[0].resources.crystal = 0;
    state.planets[0].resources.deuterium = 0;
    state.planets[0].buildings.metalMine = 5;
    state.planets[0].buildings.crystalMine = 4;
    state.planets[0].buildings.deuteriumSynthesizer = 3;
    state.planets[0].buildings.solarPlant = 20;

    const rates = calculateProduction(state);
    processTick(state);

    expect(state.planets[0].resources.metal).toBeCloseTo(rates.metalPerHour / 3600, 10);
    expect(state.planets[0].resources.crystal).toBeCloseTo(rates.crystalPerHour / 3600, 10);
    expect(state.planets[0].resources.deuterium).toBeCloseTo(
      rates.deuteriumPerHour / 3600,
      10,
    );
    expect(state.planets[0].resources.energyProduction).toBeCloseTo(rates.energyProduction, 10);
    expect(state.planets[0].resources.energyConsumption).toBeCloseTo(
      rates.energyConsumption,
      10,
    );
  });

  it('processTick clamps resources at storage capacity with no overflow', () => {
    const state = createNewGameState();
    state.planets[0].buildings.metalMine = 20;
    state.planets[0].buildings.crystalMine = 20;
    state.planets[0].buildings.deuteriumSynthesizer = 20;
    state.planets[0].buildings.solarPlant = 30;

    const caps = getStorageCaps(state);
    state.planets[0].resources.metal = caps.metal - 0.001;
    state.planets[0].resources.crystal = caps.crystal - 0.001;
    state.planets[0].resources.deuterium = caps.deuterium - 0.001;

    processTick(state);

    expect(state.planets[0].resources.metal).toBeCloseTo(caps.metal, 10);
    expect(state.planets[0].resources.crystal).toBeCloseTo(caps.crystal, 10);
    expect(state.planets[0].resources.deuterium).toBeCloseTo(caps.deuterium, 10);
  });

  it('processTick applies energy deficit as a proportional reduction across mine output', () => {
    const state = createNewGameState();
    state.planets[0].resources.metal = 0;
    state.planets[0].resources.crystal = 0;
    state.planets[0].resources.deuterium = 0;
    state.planets[0].buildings.metalMine = 10;
    state.planets[0].buildings.crystalMine = 8;
    state.planets[0].buildings.deuteriumSynthesizer = 6;
    state.planets[0].buildings.solarPlant = 2;

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
      deuteriumProductionPerHour(6, state.planets[0].maxTemperature) * factor;

    expect(rates.metalPerHour).toBeCloseTo(expectedMetalPerHour, 8);
    expect(rates.crystalPerHour).toBeCloseTo(expectedCrystalPerHour, 8);
    expect(rates.deuteriumPerHour).toBeCloseTo(expectedDeutPerHour, 8);

    processTick(state);
    expect(state.planets[0].resources.metal).toBeCloseTo(expectedMetalPerHour / 3600, 8);
    expect(state.planets[0].resources.crystal).toBeCloseTo(expectedCrystalPerHour / 3600, 8);
    expect(state.planets[0].resources.deuterium).toBeCloseTo(expectedDeutPerHour / 3600, 8);
  });

  it('processTick includes base production even with no mines', () => {
    const state = createNewGameState();
    state.planets[0].resources.metal = 0;
    state.planets[0].resources.crystal = 0;
    state.planets[0].resources.deuterium = 0;

    processTick(state);

    expect(state.planets[0].resources.metal).toBeCloseTo(30 / 3600, 10);
    expect(state.planets[0].resources.crystal).toBeCloseTo(15 / 3600, 10);
    expect(state.planets[0].resources.deuterium).toBe(0);
  });

  it('processTick handles fusion reactor deuterium consumption and never drops below zero', () => {
    const state = createNewGameState();
    state.planets[0].resources.deuterium = 0.1;
    state.planets[0].buildings.fusionReactor = 20;
    state.planets[0].buildings.solarPlant = 50;

    const rates = calculateProduction(state);
    expect(rates.deuteriumPerHour).toBeLessThan(0);

    processTick(state);

    expect(state.planets[0].resources.deuterium).toBe(0);
  });

  it('processTick production is increased by plasma technology bonuses', () => {
    const state = createNewGameState();
    state.planets[0].buildings.metalMine = 10;
    state.planets[0].buildings.crystalMine = 10;
    state.planets[0].buildings.deuteriumSynthesizer = 10;
    state.planets[0].buildings.solarPlant = 25;

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
    state.planets[0].resources.metal = 100;
    state.planets[0].resources.crystal = 200;
    state.planets[0].resources.deuterium = 300;
    state.planets[0].buildings.metalMine = 5;
    state.planets[0].buildings.crystalMine = 4;
    state.planets[0].buildings.deuteriumSynthesizer = 3;
    state.planets[0].buildings.solarPlant = 20;

    const rates = calculateProduction(state);
    const start = { ...state.planets[0].resources };

    accumulateBulk(state, 3600);

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

  it('accumulateBulk respects storage caps', () => {
    const state = createNewGameState();
    state.planets[0].buildings.metalMine = 20;
    state.planets[0].buildings.crystalMine = 20;
    state.planets[0].buildings.deuteriumSynthesizer = 20;
    state.planets[0].buildings.solarPlant = 30;
    state.planets[0].resources.metal = 0;
    state.planets[0].resources.crystal = 0;
    state.planets[0].resources.deuterium = 0;

    const caps = getStorageCaps(state);

    accumulateBulk(state, 1_000_000);

    expect(state.planets[0].resources.metal).toBeCloseTo(caps.metal, 10);
    expect(state.planets[0].resources.crystal).toBeCloseTo(caps.crystal, 10);
    expect(state.planets[0].resources.deuterium).toBeCloseTo(caps.deuterium, 10);
  });

  it('calculateProduction returns rates that match mines, energy, bonuses, and game speed', () => {
    const state = createNewGameState();
    state.planets[0].buildings.metalMine = 8;
    state.planets[0].buildings.crystalMine = 6;
    state.planets[0].buildings.deuteriumSynthesizer = 5;
    state.planets[0].buildings.solarPlant = 7;
    state.planets[0].buildings.fusionReactor = 3;
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
        deuteriumProductionPerHour(5, state.planets[0].maxTemperature) * factor -
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
    state.planets[0].buildings.metalStorage = 2;
    state.planets[0].buildings.crystalStorage = 1;
    state.planets[0].buildings.deuteriumTank = 3;

    const caps = getStorageCaps(state);

    expect(caps.metal).toBe(BASE_STORAGE.metal + storageCapacity(2));
    expect(caps.crystal).toBe(BASE_STORAGE.crystal + storageCapacity(1));
    expect(caps.deuterium).toBe(BASE_STORAGE.deuterium + storageCapacity(3));
  });

  it('processTick updates resources on all planets, not just the active one', () => {
    const state = createNewGameState();
    const colony = createDefaultPlanet();
    colony.name = 'Colony 2';
    colony.maxTemperature = 5;
    state.planets.push(colony);

    state.planets[0].resources.metal = 0;
    state.planets[0].resources.crystal = 0;
    state.planets[0].resources.deuterium = 0;
    state.planets[0].buildings.metalMine = 3;
    state.planets[0].buildings.crystalMine = 2;
    state.planets[0].buildings.solarPlant = 10;

    state.planets[1].resources.metal = 0;
    state.planets[1].resources.crystal = 0;
    state.planets[1].resources.deuterium = 0;
    state.planets[1].buildings.metalMine = 7;
    state.planets[1].buildings.crystalMine = 4;
    state.planets[1].buildings.deuteriumSynthesizer = 2;
    state.planets[1].buildings.solarPlant = 20;

    const rates0 = calculateProduction(state.planets[0], state.research);
    const rates1 = calculateProduction(state.planets[1], state.research);

    processTick(state);

    expect(state.planets[0].resources.metal).toBeCloseTo(rates0.metalPerHour / 3600, 10);
    expect(state.planets[1].resources.metal).toBeCloseTo(rates1.metalPerHour / 3600, 10);
    expect(state.planets[1].resources.crystal).toBeCloseTo(
      rates1.crystalPerHour / 3600,
      10,
    );
  });

  it('accumulateBulk applies production independently for every planet', () => {
    const state = createNewGameState();
    const colony = createDefaultPlanet();
    colony.name = 'Colony 2';
    state.planets.push(colony);

    state.planets[0].resources.metal = 0;
    state.planets[0].buildings.metalMine = 4;
    state.planets[0].buildings.solarPlant = 10;

    state.planets[1].resources.metal = 0;
    state.planets[1].buildings.metalMine = 8;
    state.planets[1].buildings.solarPlant = 20;

    const rates0 = calculateProduction(state.planets[0], state.research);
    const rates1 = calculateProduction(state.planets[1], state.research);

    accumulateBulk(state, 3600);

    expect(state.planets[0].resources.metal).toBeCloseTo(rates0.metalPerHour, 8);
    expect(state.planets[1].resources.metal).toBeCloseTo(rates1.metalPerHour, 8);
  });
});
