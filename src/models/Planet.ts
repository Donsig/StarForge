import type { BuildingId, ShipId, DefenceId, QueueItem } from './types.ts';
import type { Coordinates } from './Galaxy.ts';

export type BuildingLevels = Record<BuildingId, number>;
export type ShipCounts = Record<ShipId, number>;
export type DefenceCounts = Record<DefenceId, number>;

export interface ResourcesState {
  metal: number;
  crystal: number;
  deuterium: number;
  energyProduction: number;
  energyConsumption: number;
}

export interface PlanetState {
  name: string;
  coordinates: Coordinates;
  maxTemperature: number;
  maxFields: number;
  fieldCount: number;
  buildings: BuildingLevels;
  ships: ShipCounts;
  defences: DefenceCounts;
  resources: ResourcesState;
  buildingQueue: QueueItem[];
  shipyardQueue: QueueItem[];
}

export function createDefaultPlanet(): PlanetState {
  return {
    name: 'Homeworld',
    coordinates: { galaxy: 1, system: 1, slot: 4 },
    maxTemperature: 35,
    maxFields: 163,
    fieldCount: 163,
    buildings: {
      metalMine: 0,
      crystalMine: 0,
      deuteriumSynthesizer: 0,
      solarPlant: 0,
      fusionReactor: 0,
      metalStorage: 0,
      crystalStorage: 0,
      deuteriumTank: 0,
      roboticsFactory: 0,
      naniteFactory: 0,
      shipyard: 0,
      researchLab: 0,
    },
    ships: {
      lightFighter: 0,
      heavyFighter: 0,
      cruiser: 0,
      battleship: 0,
      smallCargo: 0,
      largeCargo: 0,
      colonyShip: 0,
      recycler: 0,
      espionageProbe: 0,
      bomber: 0,
      destroyer: 0,
      battlecruiser: 0,
      solarSatellite: 0,
    },
    defences: {
      rocketLauncher: 0,
      lightLaser: 0,
      heavyLaser: 0,
      gaussCannon: 0,
      ionCannon: 0,
      plasmaTurret: 0,
      smallShieldDome: 0,
      largeShieldDome: 0,
    },
    resources: {
      metal: 500,
      crystal: 500,
      deuterium: 0,
      energyProduction: 0,
      energyConsumption: 0,
    },
    buildingQueue: [],
    shipyardQueue: [],
  };
}
