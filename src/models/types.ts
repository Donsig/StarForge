// Shared types, enums, and constants

export interface ResourceCost {
  metal: number;
  crystal: number;
  deuterium: number;
}

export interface ResourceDelta {
  metal: number;
  crystal: number;
  deuterium: number;
}

export interface Prerequisite {
  type: 'building' | 'research';
  id: string;
  level: number;
}

export type BuildingId =
  | 'metalMine'
  | 'crystalMine'
  | 'deuteriumSynthesizer'
  | 'solarPlant'
  | 'fusionReactor'
  | 'metalStorage'
  | 'crystalStorage'
  | 'deuteriumTank'
  | 'roboticsFactory'
  | 'naniteFactory'
  | 'shipyard'
  | 'researchLab';

export type ResearchId =
  | 'energyTechnology'
  | 'laserTechnology'
  | 'ionTechnology'
  | 'plasmaTechnology'
  | 'espionageTechnology'
  | 'computerTechnology'
  | 'weaponsTechnology'
  | 'shieldingTechnology'
  | 'armourTechnology'
  | 'combustionDrive'
  | 'impulseDrive'
  | 'hyperspaceDrive'
  | 'hyperspaceTechnology';

export type ShipId =
  | 'lightFighter'
  | 'heavyFighter'
  | 'cruiser'
  | 'battleship'
  | 'smallCargo'
  | 'largeCargo'
  | 'colonyShip'
  | 'recycler'
  | 'espionageProbe'
  | 'bomber'
  | 'destroyer'
  | 'battlecruiser';

export type DefenceId =
  | 'rocketLauncher'
  | 'lightLaser'
  | 'heavyLaser'
  | 'gaussCannon'
  | 'ionCannon'
  | 'plasmaTurret'
  | 'smallShieldDome'
  | 'largeShieldDome';

export type QueueItemType = 'building' | 'research' | 'ship' | 'defence';

export interface QueueItem {
  type: QueueItemType;
  id: string;
  targetLevel?: number; // for buildings/research
  quantity?: number;     // for ships/defences (total ordered)
  completed?: number;    // for ships/defences (how many done)
  startedAt: number;     // timestamp ms
  completesAt: number;   // timestamp ms (for current unit if ship/defence)
}

export type NavId =
  | 'overview'
  | 'buildings'
  | 'research'
  | 'shipyard'
  | 'defence'
  | 'fleet'
  | 'galaxy'
  | 'settings'
  | 'admin';

export type ActivePanel = NavId;

export const GAME_CONSTANTS = {
  BASE_METAL_PRODUCTION: 30,    // per hour with no mines
  BASE_CRYSTAL_PRODUCTION: 15,  // per hour with no mines
  TICK_INTERVAL_MS: 1000,
  AUTO_SAVE_TICKS: 30,
  MAX_OFFLINE_SECONDS: 7 * 24 * 3600, // 7 days
  STORAGE_KEY: 'starforge_save',
  STATE_VERSION: 8,
} as const;
