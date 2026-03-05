import type { GameState } from '../models/GameState.ts';
import type { PlanetState } from '../models/Planet.ts';

/** Get the active planet from the game state */
export function activePlanet(state: GameState): PlanetState {
  const fallback = state.planets[0];
  if (!fallback) {
    throw new Error('GameState has no planets');
  }

  const clampedIndex = Math.min(
    Math.max(0, Math.floor(state.activePlanetIndex)),
    state.planets.length - 1,
  );
  return state.planets[clampedIndex] ?? fallback;
}
