/// <reference types="vitest/globals" />

import { BUILDINGS } from '../../data/buildings.ts';
import {
  buildingCostAtLevel,
  buildingTime,
  crystalMineEnergy,
  crystalProductionPerHour,
  deuteriumProductionPerHour,
  deuteriumSynthEnergy,
  energyFactor,
  fusionReactorDeuteriumConsumption,
  fusionReactorEnergy,
  metalMineEnergy,
  metalProductionPerHour,
  plasmaCrystalBonus,
  plasmaDeuteriumBonus,
  plasmaMetalBonus,
  researchTime,
  shipBuildTime,
  solarPlantEnergy,
  storageCapacity,
} from '../FormulasEngine.ts';

describe('FormulasEngine', () => {
  it('metal/crystal/deuterium production scales correctly with mine levels 0, 1, 5, 10, 20', () => {
    const levels = [0, 1, 5, 10, 20];
    const metal = levels.map((level) => metalProductionPerHour(level));
    const crystal = levels.map((level) => crystalProductionPerHour(level));
    const deuterium = levels.map((level) => deuteriumProductionPerHour(level, 35));

    expect(metal[0]).toBe(0);
    expect(crystal[0]).toBe(0);
    expect(deuterium[0]).toBe(0);

    for (let i = 1; i < levels.length; i += 1) {
      expect(metal[i]).toBeGreaterThan(metal[i - 1]);
      expect(crystal[i]).toBeGreaterThan(crystal[i - 1]);
      expect(deuterium[i]).toBeGreaterThan(deuterium[i - 1]);
    }

    expect(metal[1]).toBeCloseTo(33, 6);
    expect(crystal[1]).toBeCloseTo(22, 6);
    expect(deuterium[1]).toBeCloseTo(13.31, 6);
  });

  it('deuterium production is higher on colder planets than hot planets', () => {
    const level = 10;
    const hotPlanet = deuteriumProductionPerHour(level, 80);
    const coldPlanet = deuteriumProductionPerHour(level, -120);

    expect(coldPlanet).toBeGreaterThan(hotPlanet);
  });

  it('solar plant energy output scales with level', () => {
    const values = [0, 1, 5, 10].map((level) => solarPlantEnergy(level));
    expect(values[0]).toBe(0);
    expect(values[1]).toBeGreaterThan(values[0]);
    expect(values[2]).toBeGreaterThan(values[1]);
    expect(values[3]).toBeGreaterThan(values[2]);
  });

  it('fusion reactor energy scales with reactor level and energy technology', () => {
    const levelFiveTechZero = fusionReactorEnergy(5, 0);
    const levelSixTechZero = fusionReactorEnergy(6, 0);
    const levelFiveTechEight = fusionReactorEnergy(5, 8);

    expect(levelSixTechZero).toBeGreaterThan(levelFiveTechZero);
    expect(levelFiveTechEight).toBeGreaterThan(levelFiveTechZero);
  });

  it('energy factor returns 1 when sufficient and proportional reduction when insufficient', () => {
    expect(energyFactor(100, 0)).toBe(1);
    expect(energyFactor(100, 90)).toBe(1);
    expect(energyFactor(50, 100)).toBeCloseTo(0.5, 10);
  });

  it('building costs grow exponentially from base cost', () => {
    const def = BUILDINGS.metalMine;
    const levelOne = buildingCostAtLevel(def.baseCost, def.costMultiplier, 1);
    const levelTen = buildingCostAtLevel(def.baseCost, def.costMultiplier, 10);

    expect(levelOne).toEqual(def.baseCost);
    expect(levelTen.metal).toBeGreaterThan(levelOne.metal * 10);
    expect(levelTen.crystal).toBeGreaterThan(levelOne.crystal * 10);
  });

  it('building times decrease with higher robotics factory and nanite factory', () => {
    const metalCost = 200_000;
    const crystalCost = 100_000;

    const baseTime = buildingTime(metalCost, crystalCost, 0, 0, 1);
    const roboticsBoost = buildingTime(metalCost, crystalCost, 8, 0, 1);
    const naniteBoost = buildingTime(metalCost, crystalCost, 0, 2, 1);

    expect(roboticsBoost).toBeLessThan(baseTime);
    expect(naniteBoost).toBeLessThan(baseTime);
  });

  it('building times scale with game speed multiplier', () => {
    const speedOne = buildingTime(1_000_000, 500_000, 2, 1, 1);
    const speedFour = buildingTime(1_000_000, 500_000, 2, 1, 4);

    expect(speedFour).toBeLessThan(speedOne);
    expect(speedFour).toBeLessThanOrEqual(Math.ceil(speedOne / 4));
  });

  it('storage capacity grows with level', () => {
    const levelOne = storageCapacity(1);
    const levelFive = storageCapacity(5);
    const levelTen = storageCapacity(10);

    expect(levelFive).toBeGreaterThan(levelOne);
    expect(levelTen).toBeGreaterThan(levelFive);
  });

  it('plasma technology bonuses are correct per level', () => {
    expect(plasmaMetalBonus(0)).toBe(1);
    expect(plasmaCrystalBonus(0)).toBe(1);
    expect(plasmaDeuteriumBonus(0)).toBe(1);

    expect(plasmaMetalBonus(10)).toBeCloseTo(1.1, 10);
    expect(plasmaCrystalBonus(10)).toBeCloseTo(1.066, 10);
    expect(plasmaDeuteriumBonus(10)).toBeCloseTo(1.033, 10);
  });

  it('edge cases: level 0 returns 0, and build/research/ship times have a 1 second minimum', () => {
    expect(metalProductionPerHour(0)).toBe(0);
    expect(crystalProductionPerHour(0)).toBe(0);
    expect(deuteriumProductionPerHour(0, 35)).toBe(0);
    expect(solarPlantEnergy(0)).toBe(0);
    expect(fusionReactorEnergy(0, 5)).toBe(0);
    expect(fusionReactorDeuteriumConsumption(0)).toBe(0);
    expect(metalMineEnergy(0)).toBe(0);
    expect(crystalMineEnergy(0)).toBe(0);
    expect(deuteriumSynthEnergy(0)).toBe(0);

    expect(buildingTime(1, 1, 20, 5, 10)).toBe(1);
    expect(researchTime(1, 1, 20, 10)).toBe(1);
    expect(shipBuildTime(1, 20, 5, 10)).toBe(1);
  });
});
