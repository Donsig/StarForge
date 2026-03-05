import type { PlanetState } from './Planet.ts';
import type { DebrisField, GalaxyState } from './Galaxy.ts';
import type { CombatLogEntry, EspionageReport, FleetMission } from './Fleet.ts';
import type { ResearchId, QueueItem } from './types.ts';
import { GAME_CONSTANTS } from './types.ts';
import { createDefaultPlanet } from './Planet.ts';

export type ResearchLevels = Record<ResearchId, number>;

export interface GameSettings {
  gameSpeed: number;
  godMode: boolean;
}

export interface GameState {
  version: number;
  lastSaveTimestamp: number;
  tickCount: number;
  planets: PlanetState[];
  activePlanetIndex: number;
  galaxy: GalaxyState;
  debrisFields: DebrisField[];
  fleetMissions: FleetMission[];
  combatLog: CombatLogEntry[];
  espionageReports: EspionageReport[];
  research: ResearchLevels;
  researchQueue: QueueItem[];
  settings: GameSettings;
}

export function createNewGameState(): GameState {
  return {
    version: GAME_CONSTANTS.STATE_VERSION,
    lastSaveTimestamp: Date.now(),
    tickCount: 0,
    planets: [createDefaultPlanet()],
    activePlanetIndex: 0,
    galaxy: {
      seed: Math.floor(Math.random() * 1_000_000),
      npcColonies: [],
    },
    debrisFields: [],
    fleetMissions: [],
    combatLog: [],
    espionageReports: [],
    research: {
      energyTechnology: 0,
      laserTechnology: 0,
      ionTechnology: 0,
      plasmaTechnology: 0,
      espionageTechnology: 0,
      computerTechnology: 0,
      weaponsTechnology: 0,
      shieldingTechnology: 0,
      armourTechnology: 0,
      combustionDrive: 0,
      impulseDrive: 0,
      hyperspaceDrive: 0,
      hyperspaceTechnology: 0,
    },
    researchQueue: [],
    settings: {
      gameSpeed: 1,
      godMode: false,
    },
  };
}
