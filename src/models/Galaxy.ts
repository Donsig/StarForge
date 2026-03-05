export interface Coordinates {
  galaxy: number;
  system: number;
  slot: number;
}

export type NPCSpecialty =
  | 'turtle'
  | 'fleeter'
  | 'miner'
  | 'balanced'
  | 'raider'
  | 'researcher';

export type NPCAbandonmentStatus = 'stable' | 'atRisk' | 'imminent';

export interface NPCAbandonmentProximity {
  status: NPCAbandonmentStatus;
  recentRaidCount: number;
  raidThreshold: number;
  progressPct: number;
  windowGameHours: number;
  lastRaidGameHoursAgo?: number;
  pressureWindowExpiresInGameHours?: number;
}

export interface NPCColony {
  coordinates: Coordinates;
  name: string;
  tier: number;
  specialty: NPCSpecialty;
  maxTier: number;
  initialUpgradeIntervalMs: number;
  currentUpgradeIntervalMs: number;
  lastUpgradeAt: number;
  upgradeTickCount: number;
  raidCount: number;
  recentRaidTimestamps: number[];
  abandonedAt?: number;
  buildings: Record<string, number>;
  baseDefences: Record<string, number>;
  baseShips: Record<string, number>;
  currentDefences: Record<string, number>;
  currentShips: Record<string, number>;
  lastRaidedAt: number;
  resourcesAtLastRaid: {
    metal: number;
    crystal: number;
    deuterium: number;
  };
}

export interface DebrisField {
  coordinates: Coordinates;
  metal: number;
  crystal: number;
}

export interface GalaxyState {
  seed: number;
  npcColonies: NPCColony[];
}
