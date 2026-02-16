import type { GameState } from '../models/GameState.ts';
import type { PlanetState } from '../models/Planet.ts';

/** Get the active planet from the game state */
export function activePlanet(state: GameState): PlanetState {
  return state.planets[state.activePlanetIndex];
}
