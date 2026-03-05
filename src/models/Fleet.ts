import type { CombatResult } from './Combat.ts';
import type { Coordinates } from './Galaxy.ts';

export type MissionType = 'attack' | 'espionage';
export type MissionStatus = 'outbound' | 'at_target' | 'returning' | 'completed';

export interface FleetMission {
  id: string;
  type: MissionType;
  status: MissionStatus;
  sourcePlanetIndex: number;
  targetCoordinates: Coordinates;
  targetType: 'npc_colony';
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
  rebuildStatus?: { defencePct: number; fleetPct: number };
  read: boolean;
}
