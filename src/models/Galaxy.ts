export interface Coordinates {
  galaxy: number;
  system: number;
  slot: number;
}

export interface NPCColony {
  name: string;
  coordinates: Coordinates;
  strength: number; // combat difficulty rating
}

export interface GalaxyState {
  seed: number;
  npcColonies: NPCColony[];
}
