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
import { generateNPCColonies } from './GalaxyEngine.ts';
import { processTick as processFleetTick } from './FleetEngine.ts';

function clampActivePlanetIndex(state: GameState): void {
  if (!Array.isArray(state.planets) || state.planets.length === 0) {
    state.planets = createNewGameState().planets;
  }

  const maxIndex = Math.max(0, state.planets.length - 1);
  state.activePlanetIndex = Math.min(
    Math.max(0, Math.floor(state.activePlanetIndex ?? 0)),
    maxIndex,
  );

  for (const item of state.researchQueue) {
    if (item.type === 'research' && item.sourcePlanetIndex === undefined) {
      item.sourcePlanetIndex = state.activePlanetIndex;
    }
  }
}

export function saveState(state: GameState): void {
  state.lastSaveTimestamp = Date.now();
  localStorage.setItem(GAME_CONSTANTS.STORAGE_KEY, JSON.stringify(state));
}

export function loadState(): GameState | null {
  const raw = localStorage.getItem(GAME_CONSTANTS.STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as GameState;
    const migrated =
      parsed.version < GAME_CONSTANTS.STATE_VERSION ? migrate(parsed) : parsed;
    clampActivePlanetIndex(migrated);
    return migrated;
  } catch {
    return null;
  }
}

export function newGame(): GameState {
  const state = createNewGameState();
  state.galaxy.npcColonies = generateNPCColonies(state.galaxy.seed);
  state.debrisFields = [];
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
    const migrated =
      parsed.version < GAME_CONSTANTS.STATE_VERSION ? migrate(parsed) : parsed;
    clampActivePlanetIndex(migrated);
    saveState(migrated);
    return migrated;
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
      { seed: Math.floor(Date.now() % 1_000_000), npcColonies: [] };
    state.version = 4;
  }

  if (state.version < 5) {
    state.galaxy.npcColonies = generateNPCColonies(state.galaxy.seed);
    state.debrisFields = [];
    state.version = 5;
  }

  if (state.version < 6) {
    (state as any).fleetMissions = [];
    (state as any).combatLog = [];
    state.version = 6;
  }

  if (state.version < 7) {
    (state as any).espionageReports = [];
    state.version = 7;
  }

  if (state.version < 8) {
    (state as any).settings = (state as any).settings ?? { gameSpeed: 1 };
    (state as any).settings.godMode = false;
    state.version = 8;
  }

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

  type QueueCompletionEvent = ReturnType<typeof getCompletionEvents>[number];
  type OfflineEvent =
    | { time: number; type: 'queue'; queueEvent: QueueCompletionEvent }
    | { time: number; type: 'mission_arrive' | 'mission_return'; missionId: string };

  const queueEvents: OfflineEvent[] = getCompletionEvents(state).map((event) => ({
    time: event.completesAt,
    type: 'queue',
    queueEvent: event,
  }));
  const missionArrivalEvents: OfflineEvent[] = state.fleetMissions
    .filter((mission) => mission.status === 'outbound')
    .map((mission) => ({
      time: mission.arrivalTime,
      type: 'mission_arrive',
      missionId: mission.id,
    }));
  const missionReturnEvents: OfflineEvent[] = state.fleetMissions
    .filter((mission) => mission.status === 'returning' && mission.returnTime > 0)
    .map((mission) => ({
      time: mission.returnTime,
      type: 'mission_return',
      missionId: mission.id,
    }));
  const events = [...queueEvents, ...missionArrivalEvents, ...missionReturnEvents];
  events.sort((a, b) => a.time - b.time);

  let currentTime = state.lastSaveTimestamp;
  const endTime = state.lastSaveTimestamp + elapsedSeconds * 1000;

  const queueMissionReturnEvent = (
    missionId: string,
    returnTime: number,
    fromIndex: number,
  ) => {
    if (returnTime <= 0 || returnTime > endTime) {
      return;
    }

    const alreadyQueued = events.some(
      (queued, index) =>
        index >= fromIndex &&
        queued.type === 'mission_return' &&
        queued.missionId === missionId &&
        queued.time === returnTime,
    );
    if (alreadyQueued) {
      return;
    }

    events.push({
      time: returnTime,
      type: 'mission_return',
      missionId,
    });
    events.sort((a, b) => a.time - b.time);
  };

  for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
    const event = events[eventIndex];
    if (event.time > endTime) break;
    if (event.time < currentTime) continue;

    // Accumulate resources from currentTime to this event
    // Multiply by gameSpeed since calculateProduction returns base rates
    const segmentSeconds = Math.floor((event.time - currentTime) / 1000);
    if (segmentSeconds > 0) {
      accumulateBulk(state, segmentSeconds * state.settings.gameSpeed);
    }
    currentTime = event.time;

    if (event.type !== 'queue') {
      processFleetTick(state, event.time);
      if (event.type === 'mission_arrive') {
        const mission = state.fleetMissions.find((item) => item.id === event.missionId);
        if (mission?.status === 'returning' && mission.returnTime > 0) {
          queueMissionReturnEvent(mission.id, mission.returnTime, eventIndex + 1);
        }
      }
      continue;
    }

    const queueEvent = event.queueEvent;
    // Apply the completion
    if (queueEvent.type === 'building') {
      if (queueEvent.planetIndex === undefined) continue;
      const planet = state.planets[queueEvent.planetIndex];
      if (!planet) continue;

      planet.buildings[queueEvent.id as BuildingId] = queueEvent.targetLevel!;
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
        nextBuilding.startedAt = queueEvent.completesAt;
        nextBuilding.completesAt = queueEvent.completesAt + nextBuildingDuration * 1000;
      }
    } else if (queueEvent.type === 'research') {
      state.research[queueEvent.id as ResearchId] = queueEvent.targetLevel!;
      if (state.researchQueue.length > 0) {
        state.researchQueue.shift();
      }
      const nextResearch = state.researchQueue[0];
      if (nextResearch) {
        const sourcePlanet =
          state.planets[nextResearch.sourcePlanetIndex ?? state.activePlanetIndex] ??
          state.planets[state.activePlanetIndex] ??
          state.planets[0];
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
          sourcePlanet?.buildings.researchLab ?? 0,
          state.settings.gameSpeed,
        );
        nextResearch.startedAt = queueEvent.completesAt;
        nextResearch.completesAt = queueEvent.completesAt + nextResearchDuration * 1000;
      }
    } else if (queueEvent.type === 'ship' || queueEvent.type === 'defence') {
      if (queueEvent.planetIndex === undefined) continue;
      const planet = state.planets[queueEvent.planetIndex];
      if (!planet) continue;

      if (queueEvent.type === 'defence') {
        planet.defences[queueEvent.id as DefenceId] += 1;
      } else {
        planet.ships[queueEvent.id as ShipId] += 1;
      }

      // Update the queue item
      const queueItem = planet.shipyardQueue[0];
      if (
        queueItem &&
        queueItem.id === queueEvent.id &&
        queueItem.type === queueEvent.type
      ) {
        queueItem.completed = (queueItem.completed ?? 0) + 1;
        if (queueItem.completed >= queueItem.quantity!) {
          planet.shipyardQueue.shift();
        } else {
          const perUnitSec =
            queueEvent.type === 'defence'
              ? defenceBuildTime(
                  DEFENCES[queueEvent.id as DefenceId].structuralIntegrity,
                  planet.buildings.shipyard,
                  planet.buildings.naniteFactory,
                  state.settings.gameSpeed,
                )
              : shipBuildTime(
                  SHIPS[queueEvent.id as ShipId].structuralIntegrity,
                  planet.buildings.shipyard,
                  planet.buildings.naniteFactory,
                  state.settings.gameSpeed,
                );
          queueItem.completesAt = queueEvent.completesAt + perUnitSec * 1000;
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
