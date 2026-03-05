export interface Coordinates {
  galaxy: number;
  system: number;
  slot: number;
}

export interface NPCColony {
  coordinates: Coordinates;
  name: string;
  tier: number;
  buildings: Record<string, number>;
  baseDefences: Record<string, number>;
  baseShips: Record<string, number>;
  currentDefences: Record<string, number>;
  currentShips: Record<string, number>;
  lastRaidedAt: number;
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
