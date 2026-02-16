import type { GameState } from '../models/GameState.ts';
import { createNewGameState } from '../models/GameState.ts';
import { GAME_CONSTANTS } from '../models/types.ts';
import { accumulateBulk } from './ResourceEngine.ts';
import { getCompletionEvents } from './BuildQueue.ts';
import type { BuildingId, DefenceId, ResearchId, ShipId } from '../models/types.ts';
import { DEFENCES } from '../data/defences.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { RESEARCH } from '../data/research.ts';
import { SHIPS } from '../data/ships.ts';
import {
  buildingCostAtLevel,
  buildingTime,
  defenceBuildTime,
  researchCostAtLevel,
  researchTime,
  shipBuildTime,
} from './FormulasEngine.ts';
import { activePlanet } from './helpers.ts';

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
    if (!parsed.version || !parsed.planets) return null;
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
  if (state.version < 2) {
    const existingDefences = (state as any).planet.defences as
      | Partial<Record<DefenceId, number>>
      | undefined;
    (state as any).planet.defences = {
      rocketLauncher: 0,
      lightLaser: 0,
      heavyLaser: 0,
      gaussCannon: 0,
      ionCannon: 0,
      plasmaTurret: 0,
      smallShieldDome: 0,
      largeShieldDome: 0,
      ...existingDefences,
    };
    state.version = 2;
  }

  if (state.version < 3) {
    // Convert single-item queues to arrays
    if (
      (state as any).planet.buildingQueue === null ||
      (state as any).planet.buildingQueue === undefined
    ) {
      (state as any).planet.buildingQueue = [];
    } else if (!Array.isArray((state as any).planet.buildingQueue)) {
      (state as any).planet.buildingQueue = [(state as any).planet.buildingQueue];
    }
    if ((state as any).researchQueue === null || (state as any).researchQueue === undefined) {
      (state as any).researchQueue = [];
    } else if (!Array.isArray((state as any).researchQueue)) {
      (state as any).researchQueue = [(state as any).researchQueue];
    }
    state.version = 3;
  }

  if (state.version < 4) {
    const oldPlanet = (state as any).planet;
    if (oldPlanet) {
      if (!oldPlanet.coordinates) {
        oldPlanet.coordinates = { galaxy: 1, system: 1, slot: 4 };
      }
      (state as any).planets = [oldPlanet];
      delete (state as any).planet;
    }
    (state as any).activePlanetIndex = (state as any).activePlanetIndex ?? 0;
    (state as any).galaxy =
      (state as any).galaxy ??
      { seed: Math.floor(Math.random() * 1_000_000), npcColonies: [] };
    state.version = 4;
  }

  return state;
}

/**
 * Process offline time: calculate elapsed seconds, process queue completions
 * chronologically, accumulate resources between events.
 */
export function processOfflineTime(state: GameState): { elapsedSeconds: number } {
  const planet = activePlanet(state);
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
      planet.buildings[event.id as BuildingId] = event.targetLevel!;
      if (planet.buildingQueue.length > 0) {
        planet.buildingQueue.shift();
      }
      const nextBuilding = planet.buildingQueue[0];
      if (nextBuilding) {
        const nextBuildingId = nextBuilding.id as BuildingId;
        const buildingDef = BUILDINGS[nextBuildingId];
        const nextBuildingCost = buildingCostAtLevel(
          buildingDef.baseCost,
          buildingDef.costMultiplier,
          nextBuilding.targetLevel!,
        );
        const nextBuildingDuration = buildingTime(
          nextBuildingCost.metal,
          nextBuildingCost.crystal,
          planet.buildings.roboticsFactory,
          planet.buildings.naniteFactory,
          state.settings.gameSpeed,
        );
        nextBuilding.startedAt = event.completesAt;
        nextBuilding.completesAt = event.completesAt + nextBuildingDuration * 1000;
      }
    } else if (event.type === 'research') {
      state.research[event.id as ResearchId] = event.targetLevel!;
      if (state.researchQueue.length > 0) {
        state.researchQueue.shift();
      }
      const nextResearch = state.researchQueue[0];
      if (nextResearch) {
        const nextResearchId = nextResearch.id as ResearchId;
        const researchDef = RESEARCH[nextResearchId];
        const nextResearchCost = researchCostAtLevel(
          researchDef.baseCost,
          researchDef.costMultiplier,
          nextResearch.targetLevel!,
        );
        const nextResearchDuration = researchTime(
          nextResearchCost.metal,
          nextResearchCost.crystal,
          planet.buildings.researchLab,
          state.settings.gameSpeed,
        );
        nextResearch.startedAt = event.completesAt;
        nextResearch.completesAt = event.completesAt + nextResearchDuration * 1000;
      }
    } else if (event.type === 'ship' || event.type === 'defence') {
      if (event.type === 'defence') {
        planet.defences[event.id as DefenceId] += 1;
      } else {
        planet.ships[event.id as ShipId] += 1;
      }

      // Update the queue item
      const queueItem = planet.shipyardQueue[0];
      if (
        queueItem &&
        queueItem.id === event.id &&
        queueItem.type === event.type
      ) {
        queueItem.completed = (queueItem.completed ?? 0) + 1;
        if (queueItem.completed >= queueItem.quantity!) {
          planet.shipyardQueue.shift();
        } else {
          const perUnitSec =
            event.type === 'defence'
              ? defenceBuildTime(
                  DEFENCES[event.id as DefenceId].structuralIntegrity,
                  planet.buildings.shipyard,
                  planet.buildings.naniteFactory,
                  state.settings.gameSpeed,
                )
              : shipBuildTime(
                  SHIPS[event.id as ShipId].structuralIntegrity,
                  planet.buildings.shipyard,
                  planet.buildings.naniteFactory,
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
