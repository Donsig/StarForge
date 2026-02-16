import type { GameState } from '../models/GameState.ts';
import { BASE_PRODUCTION, BASE_STORAGE } from '../data/resources.ts';
import {
  metalProductionPerHour,
  crystalProductionPerHour,
  deuteriumProductionPerHour,
  solarPlantEnergy,
  fusionReactorEnergy,
  fusionReactorDeuteriumConsumption,
  metalMineEnergy,
  crystalMineEnergy,
  deuteriumSynthEnergy,
  energyFactor,
  storageCapacity,
  plasmaMetalBonus,
  plasmaCrystalBonus,
  plasmaDeuteriumBonus,
} from './FormulasEngine.ts';
import { activePlanet } from './helpers.ts';

export interface ProductionRates {
  metalPerHour: number;
  crystalPerHour: number;
  deuteriumPerHour: number;
  energyProduction: number;
  energyConsumption: number;
}

/** Calculate current production rates from state (does not mutate) */
export function calculateProduction(state: GameState): ProductionRates {
  const planet = activePlanet(state);
  const { buildings } = planet;
  const plasmaLevel = state.research.plasmaTechnology;
  const energyTechLevel = state.research.energyTechnology;

  // Energy
  const eProd =
    solarPlantEnergy(buildings.solarPlant) +
    fusionReactorEnergy(buildings.fusionReactor, energyTechLevel);

  const eCons =
    metalMineEnergy(buildings.metalMine) +
    crystalMineEnergy(buildings.crystalMine) +
    deuteriumSynthEnergy(buildings.deuteriumSynthesizer);

  const eFactor = energyFactor(eProd, eCons);

  // Resource production (base + mines * energy factor * plasma bonus)
  // Note: gameSpeed is NOT multiplied here. Instead the game loop ticks
  // gameSpeed× faster, so production naturally scales with speed.
  const metalPerHour =
    (BASE_PRODUCTION.metal +
      metalProductionPerHour(buildings.metalMine) * eFactor) *
    plasmaMetalBonus(plasmaLevel);

  const crystalPerHour =
    (BASE_PRODUCTION.crystal +
      crystalProductionPerHour(buildings.crystalMine) * eFactor) *
    plasmaCrystalBonus(plasmaLevel);

  const deutPerHour =
    (BASE_PRODUCTION.deuterium +
      deuteriumProductionPerHour(
        buildings.deuteriumSynthesizer,
        planet.maxTemperature,
      ) *
        eFactor -
      fusionReactorDeuteriumConsumption(buildings.fusionReactor)) *
    plasmaDeuteriumBonus(plasmaLevel);

  return {
    metalPerHour,
    crystalPerHour,
    deuteriumPerHour: deutPerHour,
    energyProduction: eProd,
    energyConsumption: eCons,
  };
}

/** Get storage caps for the current state */
export function getStorageCaps(state: GameState) {
  const planet = activePlanet(state);
  const { buildings } = planet;
  return {
    metal: BASE_STORAGE.metal + storageCapacity(buildings.metalStorage),
    crystal: BASE_STORAGE.crystal + storageCapacity(buildings.crystalStorage),
    deuterium: BASE_STORAGE.deuterium + storageCapacity(buildings.deuteriumTank),
  };
}

/** Process one tick (1 second) of resource production. Mutates state. */
export function processTick(state: GameState): void {
  const planet = activePlanet(state);
  const rates = calculateProduction(state);
  const caps = getStorageCaps(state);

  const res = planet.resources;
  res.metal = Math.min(caps.metal, res.metal + rates.metalPerHour / 3600);
  res.crystal = Math.min(caps.crystal, res.crystal + rates.crystalPerHour / 3600);
  res.deuterium = Math.min(
    caps.deuterium,
    Math.max(0, res.deuterium + rates.deuteriumPerHour / 3600),
  );
  res.energyProduction = rates.energyProduction;
  res.energyConsumption = rates.energyConsumption;
}

/** Accumulate resources for `seconds` at current rates. Mutates state. */
export function accumulateBulk(state: GameState, seconds: number): void {
  const planet = activePlanet(state);
  const rates = calculateProduction(state);
  const caps = getStorageCaps(state);

  const res = planet.resources;
  res.metal = Math.min(caps.metal, res.metal + (rates.metalPerHour / 3600) * seconds);
  res.crystal = Math.min(
    caps.crystal,
    res.crystal + (rates.crystalPerHour / 3600) * seconds,
  );
  res.deuterium = Math.min(
    caps.deuterium,
    Math.max(0, res.deuterium + (rates.deuteriumPerHour / 3600) * seconds),
  );
  res.energyProduction = rates.energyProduction;
  res.energyConsumption = rates.energyConsumption;
}
