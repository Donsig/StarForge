import type { GameState } from '../models/GameState.ts';
import { createNewGameState } from '../models/GameState.ts';
import { GAME_CONSTANTS } from '../models/types.ts';
import { accumulateBulk } from './ResourceEngine.ts';
import { getCompletionEvents } from './BuildQueue.ts';
import type { BuildingId, ResearchId, ShipId } from '../models/types.ts';
import { SHIPS } from '../data/ships.ts';
import { shipBuildTime } from './FormulasEngine.ts';

export function saveState(state: GameState): void {
  state.lastSaveTimestamp = Date.now();
  localStorage.setItem(GAME_CONSTANTS.STORAGE_KEY, JSON.stringify(state));
}

export function loadState(): GameState | null {
  const raw = localStorage.getItem(GAME_CONSTANTS.STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.version < GAME_CONSTANTS.STATE_VERSION) {
      return migrate(parsed);
    }
    return parsed;
  } catch {
    return null;
  }
}

export function newGame(): GameState {
  const state = createNewGameState();
  saveState(state);
  return state;
}

export function resetGame(): GameState {
  localStorage.removeItem(GAME_CONSTANTS.STORAGE_KEY);
  return newGame();
}

export function exportSave(state: GameState): string {
  return JSON.stringify(state);
}

export function importSave(json: string): GameState | null {
  try {
    const parsed = JSON.parse(json) as GameState;
    if (!parsed.version || !parsed.planet) return null;
    if (parsed.version < GAME_CONSTANTS.STATE_VERSION) {
      return migrate(parsed);
    }
    saveState(parsed);
    return parsed;
  } catch {
    return null;
  }
}

function migrate(state: GameState): GameState {
  // Future migrations go here
  // if (state.version < 2) { ... state.version = 2; }
  return state;
}

/**
 * Process offline time: calculate elapsed seconds, process queue completions
 * chronologically, accumulate resources between events.
 */
export function processOfflineTime(state: GameState): { elapsedSeconds: number } {
  const now = Date.now();
  const elapsedMs = now - state.lastSaveTimestamp;
  const elapsedSeconds = Math.min(
    Math.floor(elapsedMs / 1000),
    GAME_CONSTANTS.MAX_OFFLINE_SECONDS,
  );

  if (elapsedSeconds <= 0) return { elapsedSeconds: 0 };

  // Get all queue completion events sorted by time
  const events = getCompletionEvents(state);

  let currentTime = state.lastSaveTimestamp;
  const endTime = state.lastSaveTimestamp + elapsedSeconds * 1000;

  for (const event of events) {
    if (event.completesAt > endTime) break;
    if (event.completesAt <= currentTime) continue;

    // Accumulate resources from currentTime to this event
    // Multiply by gameSpeed since calculateProduction returns base rates
    const segmentSeconds = Math.floor((event.completesAt - currentTime) / 1000);
    if (segmentSeconds > 0) {
      accumulateBulk(state, segmentSeconds * state.settings.gameSpeed);
    }
    currentTime = event.completesAt;

    // Apply the completion
    if (event.type === 'building') {
      state.planet.buildings[event.id as BuildingId] = event.targetLevel!;
      state.planet.buildingQueue = null;
    } else if (event.type === 'research') {
      state.research[event.id as ResearchId] = event.targetLevel!;
      state.researchQueue = null;
    } else if (event.type === 'ship') {
      state.planet.ships[event.id as ShipId] += 1;
      // Update the queue item
      const queueItem = state.planet.shipyardQueue[0];
      if (queueItem && queueItem.id === event.id) {
        queueItem.completed = (queueItem.completed ?? 0) + 1;
        if (queueItem.completed >= queueItem.quantity!) {
          state.planet.shipyardQueue.shift();
        } else {
          const def = SHIPS[event.id as ShipId];
          const perUnitSec = shipBuildTime(
            def.structuralIntegrity,
            state.planet.buildings.shipyard,
            state.planet.buildings.naniteFactory,
            state.settings.gameSpeed,
          );
          queueItem.completesAt = event.completesAt + perUnitSec * 1000;
        }
      }
    }
  }

  // Accumulate remaining time at final production rates
  // Multiply by gameSpeed since calculateProduction returns base rates
  const remainingSeconds = Math.floor((endTime - currentTime) / 1000);
  if (remainingSeconds > 0) {
    accumulateBulk(state, remainingSeconds * state.settings.gameSpeed);
  }

  state.lastSaveTimestamp = now;
  return { elapsedSeconds };
}
