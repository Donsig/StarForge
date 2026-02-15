import type { DefenceId, ResourceCost, Prerequisite } from '../models/types.ts';

export interface DefenceDefinition {
  id: DefenceId;
  name: string;
  description: string;
  cost: ResourceCost;
  structuralIntegrity: number;
  shieldPower: number;
  weaponPower: number;
  maxCount?: number;
  requires: Prerequisite[];
}

export const DEFENCES: Record<DefenceId, DefenceDefinition> = {
  rocketLauncher: {
    id: 'rocketLauncher',
    name: 'Rocket Launcher',
    description: 'Basic planetary defense with low cost and rapid build speed.',
    cost: { metal: 2000, crystal: 0, deuterium: 0 },
    structuralIntegrity: 2000,
    shieldPower: 20,
    weaponPower: 80,
    requires: [{ type: 'building', id: 'shipyard', level: 1 }],
  },
  lightLaser: {
    id: 'lightLaser',
    name: 'Light Laser',
    description: 'Improved turret with stronger firepower than rocket launchers.',
    cost: { metal: 1500, crystal: 500, deuterium: 0 },
    structuralIntegrity: 2000,
    shieldPower: 25,
    weaponPower: 100,
    requires: [
      { type: 'building', id: 'shipyard', level: 2 },
      { type: 'research', id: 'energyTechnology', level: 1 },
      { type: 'research', id: 'laserTechnology', level: 3 },
    ],
  },
  heavyLaser: {
    id: 'heavyLaser',
    name: 'Heavy Laser',
    description: 'Armored laser emplacement with high durability and output.',
    cost: { metal: 6000, crystal: 2000, deuterium: 0 },
    structuralIntegrity: 8000,
    shieldPower: 100,
    weaponPower: 250,
    requires: [
      { type: 'building', id: 'shipyard', level: 4 },
      { type: 'research', id: 'energyTechnology', level: 3 },
      { type: 'research', id: 'laserTechnology', level: 6 },
    ],
  },
  gaussCannon: {
    id: 'gaussCannon',
    name: 'Gauss Cannon',
    description: 'High-caliber electromagnetic cannon effective versus heavy ships.',
    cost: { metal: 20000, crystal: 15000, deuterium: 2000 },
    structuralIntegrity: 35000,
    shieldPower: 200,
    weaponPower: 1100,
    requires: [
      { type: 'building', id: 'shipyard', level: 6 },
      { type: 'research', id: 'energyTechnology', level: 6 },
      { type: 'research', id: 'weaponsTechnology', level: 3 },
      { type: 'research', id: 'shieldingTechnology', level: 1 },
    ],
  },
  ionCannon: {
    id: 'ionCannon',
    name: 'Ion Cannon',
    description: 'Defensive turret with exceptional shielding and steady damage.',
    cost: { metal: 5000, crystal: 3000, deuterium: 0 },
    structuralIntegrity: 8000,
    shieldPower: 500,
    weaponPower: 150,
    requires: [
      { type: 'building', id: 'shipyard', level: 4 },
      { type: 'research', id: 'ionTechnology', level: 4 },
    ],
  },
  plasmaTurret: {
    id: 'plasmaTurret',
    name: 'Plasma Turret',
    description: 'Top-tier fixed defense with devastating firepower.',
    cost: { metal: 50000, crystal: 50000, deuterium: 30000 },
    structuralIntegrity: 100000,
    shieldPower: 300,
    weaponPower: 3000,
    requires: [
      { type: 'building', id: 'shipyard', level: 8 },
      { type: 'research', id: 'plasmaTechnology', level: 7 },
    ],
  },
  smallShieldDome: {
    id: 'smallShieldDome',
    name: 'Small Shield Dome',
    description: 'Planetary shield generator that can only be constructed once.',
    cost: { metal: 10000, crystal: 10000, deuterium: 0 },
    structuralIntegrity: 20000,
    shieldPower: 2000,
    weaponPower: 1,
    maxCount: 1,
    requires: [
      { type: 'building', id: 'shipyard', level: 1 },
      { type: 'research', id: 'shieldingTechnology', level: 2 },
    ],
  },
  largeShieldDome: {
    id: 'largeShieldDome',
    name: 'Large Shield Dome',
    description: 'Massive defensive shield generator limited to one per planet.',
    cost: { metal: 50000, crystal: 50000, deuterium: 0 },
    structuralIntegrity: 100000,
    shieldPower: 10000,
    weaponPower: 1,
    maxCount: 1,
    requires: [
      { type: 'building', id: 'shipyard', level: 6 },
      { type: 'research', id: 'shieldingTechnology', level: 6 },
    ],
  },
};

export const DEFENCE_ORDER: DefenceId[] = [
  'rocketLauncher',
  'lightLaser',
  'heavyLaser',
  'gaussCannon',
  'ionCannon',
  'plasmaTurret',
  'smallShieldDome',
  'largeShieldDome',
];
