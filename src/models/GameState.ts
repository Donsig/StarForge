import type { PlanetState } from './Planet.ts';
import type { ResearchId, QueueItem } from './types.ts';
import { createDefaultPlanet } from './Planet.ts';

export type ResearchLevels = Record<ResearchId, number>;

export interface GameSettings {
  gameSpeed: number;
}

export interface GameState {
  version: number;
  lastSaveTimestamp: number;
  tickCount: number;
  planet: PlanetState;
  research: ResearchLevels;
  researchQueue: QueueItem | null;
  settings: GameSettings;
}

export function createNewGameState(): GameState {
  return {
    version: 1,
    lastSaveTimestamp: Date.now(),
    tickCount: 0,
    planet: createDefaultPlanet(),
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
    researchQueue: null,
    settings: {
      gameSpeed: 1,
    },
  };
}
