import type { ResearchId, ResourceCost, Prerequisite } from '../models/types.ts';

export interface ResearchDefinition {
  id: ResearchId;
  name: string;
  description: string;
  baseCost: ResourceCost;
  costMultiplier: number;
  requires: Prerequisite[];
}

export const RESEARCH: Record<ResearchId, ResearchDefinition> = {
  energyTechnology: {
    id: 'energyTechnology',
    name: 'Energy Technology',
    description: 'Advanced energy generation techniques. Required for fusion reactors and higher technologies.',
    baseCost: { metal: 0, crystal: 800, deuterium: 400 },
    costMultiplier: 2,
    requires: [{ type: 'building', id: 'researchLab', level: 1 }],
  },
  laserTechnology: {
    id: 'laserTechnology',
    name: 'Laser Technology',
    description: 'Focused light amplification. Foundation for advanced weapon systems.',
    baseCost: { metal: 200, crystal: 100, deuterium: 0 },
    costMultiplier: 2,
    requires: [
      { type: 'building', id: 'researchLab', level: 1 },
      { type: 'research', id: 'energyTechnology', level: 2 },
    ],
  },
  ionTechnology: {
    id: 'ionTechnology',
    name: 'Ion Technology',
    description: 'Charged particle manipulation. Enables ion-based weapons and advanced ship systems.',
    baseCost: { metal: 1000, crystal: 300, deuterium: 100 },
    costMultiplier: 2,
    requires: [
      { type: 'building', id: 'researchLab', level: 4 },
      { type: 'research', id: 'energyTechnology', level: 4 },
      { type: 'research', id: 'laserTechnology', level: 5 },
    ],
  },
  plasmaTechnology: {
    id: 'plasmaTechnology',
    name: 'Plasma Technology',
    description: 'Superheated matter containment. Each level boosts resource production.',
    baseCost: { metal: 2000, crystal: 4000, deuterium: 1000 },
    costMultiplier: 2,
    requires: [
      { type: 'building', id: 'researchLab', level: 4 },
      { type: 'research', id: 'energyTechnology', level: 8 },
      { type: 'research', id: 'laserTechnology', level: 10 },
      { type: 'research', id: 'ionTechnology', level: 5 },
    ],
  },
  espionageTechnology: {
    id: 'espionageTechnology',
    name: 'Espionage Technology',
    description: 'Advanced sensor arrays and stealth systems for intelligence gathering.',
    baseCost: { metal: 200, crystal: 1000, deuterium: 200 },
    costMultiplier: 2,
    requires: [{ type: 'building', id: 'researchLab', level: 3 }],
  },
  computerTechnology: {
    id: 'computerTechnology',
    name: 'Computer Technology',
    description: 'Processing power for fleet coordination. Each level allows one additional fleet slot.',
    baseCost: { metal: 0, crystal: 400, deuterium: 600 },
    costMultiplier: 2,
    requires: [{ type: 'building', id: 'researchLab', level: 1 }],
  },
  weaponsTechnology: {
    id: 'weaponsTechnology',
    name: 'Weapons Technology',
    description: 'Improved weapon systems. Each level increases attack power by 10%.',
    baseCost: { metal: 800, crystal: 200, deuterium: 0 },
    costMultiplier: 2,
    requires: [{ type: 'building', id: 'researchLab', level: 4 }],
  },
  shieldingTechnology: {
    id: 'shieldingTechnology',
    name: 'Shielding Technology',
    description: 'Deflector shield improvements. Each level increases shield strength by 10%.',
    baseCost: { metal: 200, crystal: 600, deuterium: 0 },
    costMultiplier: 2,
    requires: [
      { type: 'building', id: 'researchLab', level: 6 },
      { type: 'research', id: 'energyTechnology', level: 3 },
    ],
  },
  armourTechnology: {
    id: 'armourTechnology',
    name: 'Armour Technology',
    description: 'Hull reinforcement techniques. Each level increases structural integrity by 10%.',
    baseCost: { metal: 1000, crystal: 0, deuterium: 0 },
    costMultiplier: 2,
    requires: [{ type: 'building', id: 'researchLab', level: 2 }],
  },
  combustionDrive: {
    id: 'combustionDrive',
    name: 'Combustion Drive',
    description: 'Chemical propulsion systems. Powers small cargo ships and light fighters.',
    baseCost: { metal: 400, crystal: 0, deuterium: 600 },
    costMultiplier: 2,
    requires: [
      { type: 'building', id: 'researchLab', level: 1 },
      { type: 'research', id: 'energyTechnology', level: 1 },
    ],
  },
  impulseDrive: {
    id: 'impulseDrive',
    name: 'Impulse Drive',
    description: 'Fusion-powered engines for medium-range travel. Enables cruisers and bombers.',
    baseCost: { metal: 2000, crystal: 4000, deuterium: 600 },
    costMultiplier: 2,
    requires: [
      { type: 'building', id: 'researchLab', level: 2 },
      { type: 'research', id: 'energyTechnology', level: 1 },
    ],
  },
  hyperspaceDrive: {
    id: 'hyperspaceDrive',
    name: 'Hyperspace Drive',
    description: 'Faster-than-light propulsion. Required for battleships and destroyers.',
    baseCost: { metal: 10000, crystal: 20000, deuterium: 6000 },
    costMultiplier: 2,
    requires: [
      { type: 'building', id: 'researchLab', level: 7 },
      { type: 'research', id: 'hyperspaceTechnology', level: 3 },
    ],
  },
  hyperspaceTechnology: {
    id: 'hyperspaceTechnology',
    name: 'Hyperspace Technology',
    description: 'Theoretical framework for bending space-time. Foundation for hyperspace drives.',
    baseCost: { metal: 0, crystal: 4000, deuterium: 2000 },
    costMultiplier: 2,
    requires: [
      { type: 'building', id: 'researchLab', level: 7 },
      { type: 'research', id: 'energyTechnology', level: 5 },
      { type: 'research', id: 'shieldingTechnology', level: 5 },
    ],
  },
  astrophysicsTechnology: {
    id: 'astrophysicsTechnology',
    name: 'Astrophysics',
    description: 'Advanced stellar cartography. Each two levels allow an additional colony.',
    baseCost: { metal: 4000, crystal: 8000, deuterium: 4000 },
    costMultiplier: 1.75,
    requires: [
      { type: 'research', id: 'espionageTechnology', level: 4 },
      { type: 'research', id: 'impulseDrive', level: 3 },
    ],
  },
  intergalacticResearchNetwork: {
    id: 'intergalacticResearchNetwork',
    name: 'Intergalactic Research Network',
    description: 'Links research laboratories across colonies. Each level adds one more lab to the network, increasing effective research speed.',
    baseCost: { metal: 240_000, crystal: 400_000, deuterium: 160_000 },
    costMultiplier: 2.0,
    requires: [
      { type: 'research', id: 'astrophysicsTechnology', level: 4 },
      { type: 'research', id: 'hyperspaceTechnology', level: 8 },
      { type: 'research', id: 'computerTechnology', level: 8 },
    ],
  },
};

export const RESEARCH_ORDER: ResearchId[] = [
  'energyTechnology',
  'laserTechnology',
  'ionTechnology',
  'plasmaTechnology',
  'espionageTechnology',
  'computerTechnology',
  'weaponsTechnology',
  'shieldingTechnology',
  'armourTechnology',
  'combustionDrive',
  'impulseDrive',
  'hyperspaceTechnology',
  'hyperspaceDrive',
  'astrophysicsTechnology',
  'intergalacticResearchNetwork',
];
