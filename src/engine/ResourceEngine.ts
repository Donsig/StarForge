import type { GameState } from '../models/GameState.ts';
import type { PlanetState } from '../models/Planet.ts';
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

export interface StorageCaps {
  metal: number;
  crystal: number;
  deuterium: number;
}

/** Calculate current production rates (does not mutate) */
export function calculateProduction(state: GameState): ProductionRates;
export function calculateProduction(
  planet: PlanetState,
  research: GameState['research'],
): ProductionRates;
export function calculateProduction(
  stateOrPlanet: GameState | PlanetState,
  research?: GameState['research'],
): ProductionRates {
  const planet: PlanetState =
    'planets' in stateOrPlanet ? activePlanet(stateOrPlanet) : stateOrPlanet;
  const researchLevels =
    'planets' in stateOrPlanet ? stateOrPlanet.research : research;
  if (!researchLevels) {
    throw new Error('calculateProduction requires research levels for planet input');
  }

  const { buildings } = planet;
  const plasmaLevel = researchLevels.plasmaTechnology;
  const energyTechLevel = researchLevels.energyTechnology;

  // Energy
  const satelliteEnergy =
    Math.floor((planet.ships.solarSatellite ?? 0) *
    Math.max(0, Math.floor((planet.maxTemperature + 140) / 6)));

  const eProd =
    solarPlantEnergy(buildings.solarPlant) +
    fusionReactorEnergy(buildings.fusionReactor, energyTechLevel) +
    satelliteEnergy;

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

/** Get storage caps */
export function getStorageCaps(state: GameState): StorageCaps;
export function getStorageCaps(planet: PlanetState): StorageCaps;
export function getStorageCaps(stateOrPlanet: GameState | PlanetState): StorageCaps {
  const planet: PlanetState =
    'planets' in stateOrPlanet ? activePlanet(stateOrPlanet) : stateOrPlanet;
  const { buildings } = planet;
  return {
    metal: BASE_STORAGE.metal + storageCapacity(buildings.metalStorage),
    crystal: BASE_STORAGE.crystal + storageCapacity(buildings.crystalStorage),
    deuterium: BASE_STORAGE.deuterium + storageCapacity(buildings.deuteriumTank),
  };
}

/** Process one tick (1 second) of resource production. Mutates state. */
export function processTick(state: GameState): void {
  for (const planet of state.planets) {
    const rates = calculateProduction(planet, state.research);
    const caps = getStorageCaps(planet);

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
}

/** Accumulate resources for `seconds` at current rates. Mutates state. */
export function accumulateBulk(state: GameState, seconds: number): void {
  for (const planet of state.planets) {
    const rates = calculateProduction(planet, state.research);
    const caps = getStorageCaps(planet);

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
}
