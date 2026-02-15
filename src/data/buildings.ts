import type { BuildingId, ResourceCost, Prerequisite } from '../models/types.ts';

export type BuildingCategory = 'resource' | 'storage' | 'facility';

export interface BuildingDefinition {
  id: BuildingId;
  name: string;
  description: string;
  category: BuildingCategory;
  baseCost: ResourceCost;
  costMultiplier: number;
  requires: Prerequisite[];
}

export const BUILDINGS: Record<BuildingId, BuildingDefinition> = {
  metalMine: {
    id: 'metalMine',
    name: 'Metal Mine',
    description: 'Extracts metal ore from the planetary crust. The backbone of your economy.',
    category: 'resource',
    baseCost: { metal: 60, crystal: 15, deuterium: 0 },
    costMultiplier: 1.5,
    requires: [],
  },
  crystalMine: {
    id: 'crystalMine',
    name: 'Crystal Mine',
    description: 'Mines crystalline deposits from subsurface veins. Essential for electronics and hull plating.',
    category: 'resource',
    baseCost: { metal: 48, crystal: 24, deuterium: 0 },
    costMultiplier: 1.6,
    requires: [],
  },
  deuteriumSynthesizer: {
    id: 'deuteriumSynthesizer',
    name: 'Deuterium Synthesizer',
    description: 'Filters heavy hydrogen from the atmosphere. Colder planets produce more efficiently.',
    category: 'resource',
    baseCost: { metal: 225, crystal: 75, deuterium: 0 },
    costMultiplier: 1.5,
    requires: [],
  },
  solarPlant: {
    id: 'solarPlant',
    name: 'Solar Plant',
    description: 'Converts stellar radiation into electrical energy to power your mines and facilities.',
    category: 'resource',
    baseCost: { metal: 75, crystal: 30, deuterium: 0 },
    costMultiplier: 1.5,
    requires: [],
  },
  fusionReactor: {
    id: 'fusionReactor',
    name: 'Fusion Reactor',
    description: 'Generates massive energy by fusing deuterium atoms. Consumes deuterium but produces far more energy than solar.',
    category: 'resource',
    baseCost: { metal: 900, crystal: 360, deuterium: 180 },
    costMultiplier: 1.8,
    requires: [
      { type: 'building', id: 'deuteriumSynthesizer', level: 5 },
      { type: 'research', id: 'energyTechnology', level: 3 },
    ],
  },
  metalStorage: {
    id: 'metalStorage',
    name: 'Metal Storage',
    description: 'Warehouses for storing refined metal. Increases maximum metal capacity.',
    category: 'storage',
    baseCost: { metal: 1000, crystal: 0, deuterium: 0 },
    costMultiplier: 2,
    requires: [],
  },
  crystalStorage: {
    id: 'crystalStorage',
    name: 'Crystal Storage',
    description: 'Climate-controlled vaults for crystal preservation. Increases maximum crystal capacity.',
    category: 'storage',
    baseCost: { metal: 1000, crystal: 500, deuterium: 0 },
    costMultiplier: 2,
    requires: [],
  },
  deuteriumTank: {
    id: 'deuteriumTank',
    name: 'Deuterium Tank',
    description: 'Pressurized containment for liquid deuterium. Increases maximum deuterium capacity.',
    category: 'storage',
    baseCost: { metal: 1000, crystal: 1000, deuterium: 0 },
    costMultiplier: 2,
    requires: [],
  },
  roboticsFactory: {
    id: 'roboticsFactory',
    name: 'Robotics Factory',
    description: 'Automated construction drones that accelerate all building times.',
    category: 'facility',
    baseCost: { metal: 400, crystal: 120, deuterium: 200 },
    costMultiplier: 2,
    requires: [],
  },
  naniteFactory: {
    id: 'naniteFactory',
    name: 'Nanite Factory',
    description: 'Molecular-scale assemblers that dramatically reduce construction and ship build times.',
    category: 'facility',
    baseCost: { metal: 1000000, crystal: 500000, deuterium: 100000 },
    costMultiplier: 2,
    requires: [
      { type: 'building', id: 'roboticsFactory', level: 10 },
      { type: 'research', id: 'computerTechnology', level: 10 },
    ],
  },
  shipyard: {
    id: 'shipyard',
    name: 'Shipyard',
    description: 'Orbital construction facility for building spacecraft. Higher levels build ships faster.',
    category: 'facility',
    baseCost: { metal: 400, crystal: 200, deuterium: 100 },
    costMultiplier: 2,
    requires: [{ type: 'building', id: 'roboticsFactory', level: 2 }],
  },
  researchLab: {
    id: 'researchLab',
    name: 'Research Lab',
    description: 'Scientific complex for unlocking new technologies. Higher levels accelerate research.',
    category: 'facility',
    baseCost: { metal: 200, crystal: 400, deuterium: 200 },
    costMultiplier: 2,
    requires: [],
  },
};

/** Building IDs grouped by category for UI display order */
export const BUILDING_ORDER: BuildingId[] = [
  // Resources
  'metalMine',
  'crystalMine',
  'deuteriumSynthesizer',
  'solarPlant',
  'fusionReactor',
  // Storage
  'metalStorage',
  'crystalStorage',
  'deuteriumTank',
  // Facilities
  'roboticsFactory',
  'naniteFactory',
  'shipyard',
  'researchLab',
];
