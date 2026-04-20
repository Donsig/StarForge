import type { GameState } from '../models/GameState.ts';
import { calculateProduction } from './ResourceEngine.ts';

const MAX_HISTORY_LENGTH = 7;

/**
 * Pushes a production sample into state.statistics.productionHistory when the
 * gameSpeed-scaled 24-hour window has elapsed since the last sample.
 *
 * Sample interval = 86_400_000 ms / gameSpeed
 * (At gameSpeed 1 → once per real 24h. At gameSpeed 8 → once per real 3h.)
 *
 * Mutates state.statistics.productionHistory in place.
 */
export function sampleProduction(state: GameState, now: number): void {
  const ph = state.statistics.productionHistory;
  const sampleIntervalMs = 86_400_000 / state.settings.gameSpeed;

  const elapsed = now - ph.lastSampleAt;
  const isFirstSample = ph.lastSampleAt === 0;

  if (!isFirstSample && elapsed < sampleIntervalMs) {
    return;
  }

  // Sum production rates across ALL player planets.
  let totalMetal = 0;
  let totalCrystal = 0;
  let totalDeuterium = 0;

  for (const planet of state.planets) {
    const rates = calculateProduction(planet, state.research);
    totalMetal += rates.metalPerHour;
    totalCrystal += rates.crystalPerHour;
    totalDeuterium += rates.deuteriumPerHour;
  }

  ph.metal.push(totalMetal);
  ph.crystal.push(totalCrystal);
  ph.deuterium.push(totalDeuterium);

  // Trim each buffer to MAX_HISTORY_LENGTH entries (oldest first, shift oldest off).
  while (ph.metal.length > MAX_HISTORY_LENGTH) ph.metal.shift();
  while (ph.crystal.length > MAX_HISTORY_LENGTH) ph.crystal.shift();
  while (ph.deuterium.length > MAX_HISTORY_LENGTH) ph.deuterium.shift();

  ph.lastSampleAt = now;
}
