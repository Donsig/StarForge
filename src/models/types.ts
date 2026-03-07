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
  | 'hyperspaceTechnology'
  | 'astrophysicsTechnology'
  | 'intergalacticResearchNetwork';

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
  | 'battlecruiser'
  | 'solarSatellite';

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
  sourcePlanetIndex?: number; // for research timing
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
  | 'messages'
  | 'settings'
  | 'admin';

export type ActivePanel = NavId;

export interface GameSettings {
  gameSpeed: number;
  godMode: boolean;
  maxProbeCount: number;
}

export const GAME_CONSTANTS = {
  BASE_METAL_PRODUCTION: 30,    // per hour with no mines
  BASE_CRYSTAL_PRODUCTION: 15,  // per hour with no mines
  TICK_INTERVAL_MS: 1000,
  AUTO_SAVE_TICKS: 30,
  MAX_OFFLINE_SECONDS: 7 * 24 * 3600, // 7 days
  STORAGE_KEY: 'starforge_save',
  STATE_VERSION: 15,
} as const;

export interface PlayerScores {
  military: number;
  economy: number;
  research: number;
  buildings: number;
  fleet: number;
  defence: number;
  total: number;
}
