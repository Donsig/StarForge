import type { CombatResult } from './Combat.ts';
import type { Coordinates, NPCAbandonmentProximity } from './Galaxy.ts';

export type MissionType = 'attack' | 'espionage' | 'harvest' | 'transport';
export type MissionStatus = 'outbound' | 'at_target' | 'returning' | 'completed';

export interface FleetMission {
  id: string;
  type: MissionType;
  status: MissionStatus;
  sourcePlanetIndex: number;
  targetCoordinates: Coordinates;
  targetType: 'npc_colony' | 'debris_field' | 'player_planet';
  ships: Record<string, number>;
  cargo: { metal: number; crystal: number; deuterium: number };
  fuelCost: number;
  departureTime: number;
  arrivalTime: number;
  returnTime: number;
  combatResultId?: string;
  espionageReportId?: string;
}

export interface CombatLogEntry {
  id: string;
  timestamp: number;
  targetCoordinates: Coordinates;
  result: CombatResult;
  read: boolean;
}

export interface EspionageReport {
  id: string;
  timestamp: number;
  sourcePlanetIndex: number;
  targetCoordinates: Coordinates;
  targetName: string;
  probesSent: number;
  probesLost: number;
  detected: boolean;
  resources?: { metal: number; crystal: number; deuterium: number };
  fleet?: Record<string, number>;
  defences?: Record<string, number>;
  buildings?: Record<string, number>;
  tier?: number;
  specialty?: string;
  rebuildStatus?: { defencePct: number; fleetPct: number };
  abandonmentProximity?: NPCAbandonmentProximity;
  read: boolean;
  detectionChance: number;
}

export interface FleetNotification {
  id: string;
  missionId: string;
  timestamp: number;
  missionType: 'harvest' | 'transport';
  targetCoordinates: Coordinates;
  targetName: string;
  loot: { metal: number; crystal: number; deuterium: number };
  /** Reason why a transport delivered zero resources, if applicable. */
  failureReason?: 'planet_missing' | 'storage_full';
  read: boolean;
}
