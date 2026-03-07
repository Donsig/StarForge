import type { PlanetState } from './Planet.ts';
import type { DebrisField, GalaxyState } from './Galaxy.ts';
import type { CombatLogEntry, EspionageReport, FleetMission, FleetNotification, MissionType } from './Fleet.ts';
import type { GameSettings, PlayerScores, ResearchId, QueueItem } from './types.ts';
import { GAME_CONSTANTS } from './types.ts';
import { createDefaultPlanet } from './Planet.ts';

export type ResearchLevels = Record<ResearchId, number>;

export interface GameStatistics {
  resourcesMined: { metal: number; crystal: number; deuterium: number };
  combat: {
    fought: number;
    won: number;
    lost: number;
    drawn: number;
    totalLoot: number;
    shipsLost: number;
  };
  fleet: {
    sent: Partial<Record<MissionType, number>>;
    totalDistance: number;
  };
  milestones: {
    firstColony?: number;
    firstBattleWon?: number;
    firstEspionage?: number;
  };
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
  fleetNotifications: FleetNotification[];
  research: ResearchLevels;
  researchQueue: QueueItem[];
  settings: GameSettings;
  playerScores: PlayerScores;
  statistics: GameStatistics;
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
    fleetNotifications: [],
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
      astrophysicsTechnology: 0,
      intergalacticResearchNetwork: 0,
    },
    researchQueue: [],
    settings: {
      gameSpeed: 1,
      godMode: false,
      maxProbeCount: 10,
    },
    playerScores: {
      military: 0,
      economy: 0,
      research: 0,
      buildings: 0,
      fleet: 0,
      defence: 0,
      total: 0,
    },
    statistics: {
      resourcesMined: { metal: 0, crystal: 0, deuterium: 0 },
      combat: { fought: 0, won: 0, lost: 0, drawn: 0, totalLoot: 0, shipsLost: 0 },
      fleet: { sent: {}, totalDistance: 0 },
      milestones: {},
    },
  };
}
