import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '../models/GameState.ts';
import type { CombatResult } from '../models/Combat.ts';
import type {
  EspionageReport,
  FleetMission,
  FleetNotification,
  MissionType,
} from '../models/Fleet.ts';
import type { Coordinates, NPCColony, NPCSpecialty } from '../models/Galaxy.ts';
import { createDefaultPlanet, type PlanetState } from '../models/Planet.ts';
import type { BuildingId, DefenceId, ResearchId, ShipId } from '../models/types.ts';
import { GAME_CONSTANTS } from '../models/types.ts';
import { BUILDINGS, BUILDING_ORDER } from '../data/buildings.ts';
import { DEFENCE_ORDER, DEFENCES } from '../data/defences.ts';
import { RESEARCH, RESEARCH_ORDER } from '../data/research.ts';
import { SHIP_ORDER, SHIPS } from '../data/ships.ts';
import type { ProductionRates } from '../engine/ResourceEngine.ts';
import {
  calculateProduction,
  getStorageCaps,
  processTick as processResourceTick,
} from '../engine/ResourceEngine.ts';
import {
  cancelBuildingAtIndex,
  cancelResearchAtIndex,
  cancelShipyardAtIndex,
  processTick as processQueueTick,
  rescaleQueueTimes,
  startBuildingUpgrade,
  startDefenceBuild,
  startResearch,
  startShipBuild,
} from '../engine/BuildQueue.ts';
import {
  adminAddNPC as addNPCToGalaxy,
  addDebris,
  buildNPCBuildingsForTier,
  buildNPCDefencesForTier,
  buildNPCShipsForTier,
  colonize,
  generateNPCColonies,
  getNPCCurrentForce,
  getNPCResources,
  isSlotEmpty,
} from '../engine/GalaxyEngine.ts';
import {
  applyUpgradeIncrement,
  processUpgrades as processNPCUpgrades,
  recordRaid,
} from '../engine/NPCUpgradeEngine.ts';
import { simulate as simulateCombat } from '../engine/CombatEngine.ts';
import {
  buildingCostAtLevel,
  buildingTime,
  defenceBuildTime,
  researchCostAtLevel,
  researchTime,
  shipBuildTime,
} from '../engine/FormulasEngine.ts';
import {
  calcLoot,
  dispatch as dispatchMission,
  dispatchHarvest as dispatchHarvestMission,
  processTick as processFleetTick,
  recallMission,
  resolveMissionToCompletion,
  rescaleMissionETAs,
} from '../engine/FleetEngine.ts';
import {
  exportSave,
  importSave,
  loadState,
  newGame,
  processOfflineTime,
  resetGame,
  saveState,
} from '../engine/StateManager.ts';

export interface GameEngineState {
  gameState: GameState;
  espionageReports: EspionageReport[];
  fleetNotifications: FleetNotification[];
  productionRates: ProductionRates;
  storageCaps: { metal: number; crystal: number; deuterium: number };
  upgradeBuilding: (id: BuildingId) => boolean;
  startResearchAction: (id: ResearchId) => boolean;
  buildShips: (id: ShipId, qty: number) => boolean;
  buildDefences: (id: DefenceId, qty: number) => boolean;
  colonizeAction: (coords: Coordinates) => boolean;
  cancelBuilding: (index: number) => void;
  cancelResearch: (index: number) => void;
  cancelShipyard: (index: number) => void;
  resetGameAction: () => void;
  setActivePlanet: (index: number) => void;
  fleetTarget: Coordinates | null;
  setFleetTarget: (coords: Coordinates | null) => void;
  pendingMissionTarget: { type: MissionType; coords: Coordinates } | null;
  setPendingMissionTarget: (
    target: { type: MissionType; coords: Coordinates } | null,
  ) => void;
  dispatchFleet: (
    sourcePlanetIndex: number,
    targetCoords: Coordinates,
    ships: Record<string, number>,
    missionType?: MissionType,
    cargo?: { metal: number; crystal: number; deuterium: number },
  ) => FleetMission | null;
  dispatchEspionage: (
    sourcePlanetIndex: number,
    targetCoords: Coordinates,
    probeCount: number,
  ) => FleetMission | null;
  dispatchHarvest: (
    sourcePlanetIndex: number,
    targetCoords: Coordinates,
  ) => FleetMission | null;
  recallFleet: (missionId: string) => void;
  markCombatRead: (id: string) => void;
  markAllCombatRead: () => void;
  markEspionageRead: (id: string) => void;
  markAllEspionageRead: () => void;
  markFleetRead: (id: string) => void;
  markAllFleetRead: () => void;
  deleteCombatEntry: (id: string) => void;
  deleteEspionageReport: (id: string) => void;
  deleteFleetNotification: (id: string) => void;
  setGameSpeed: (n: number) => void;
  setMaxProbeCount: (n: number) => void;
  setGodMode: (enabled: boolean) => void;
  adminSetResources: (
    planetIndex: number,
    metal: number,
    crystal: number,
    deuterium: number,
  ) => void;
  adminAddResources: (
    planetIndex: number,
    metal: number,
    crystal: number,
    deuterium: number,
  ) => void;
  adminSetBuildings: (
    planetIndex: number,
    buildings: Partial<Record<BuildingId, number>>,
  ) => void;
  adminSetShips: (
    planetIndex: number,
    ships: Partial<Record<ShipId, number>>,
  ) => void;
  adminSetDefences: (
    planetIndex: number,
    defences: Partial<Record<DefenceId, number>>,
  ) => void;
  adminSetResearch: (research: Partial<Record<ResearchId, number>>) => void;
  adminForceColonize: (coords: Coordinates) => PlanetState | null;
  adminConvertNPC: (coords: Coordinates) => PlanetState | null;
  adminRemoveNPC: (coords: Coordinates) => void;
  adminAddNPC: (coords: Coordinates, tier: number) => NPCColony | null;
  adminSetNPCTier: (coords: Coordinates, tier: number) => void;
  adminSetNPCSpecialty: (coords: Coordinates, specialty: NPCSpecialty) => void;
  adminSetNPCBuildings: (
    coords: Coordinates,
    buildings: Partial<Record<BuildingId, number>>,
  ) => void;
  adminSetNPCCurrentFleet: (
    coords: Coordinates,
    ships: Partial<Record<ShipId, number>>,
    applyToBase?: boolean,
  ) => void;
  adminSetNPCCurrentDefences: (
    coords: Coordinates,
    defences: Partial<Record<DefenceId, number>>,
    applyToBase?: boolean,
  ) => void;
  adminResetNPC: (coords: Coordinates) => void;
  adminWipeNPC: (coords: Coordinates) => void;
  adminNPCTriggerUpgrade: (coords: Coordinates) => void;
  adminClearNPCRaidHistory: (coords: Coordinates) => void;
  adminForceAbandonNPC: (coords: Coordinates) => void;
  adminSetPlanetFieldCount: (planetIndex: number, fieldCount: number) => void;
  adminCompleteBuilding: (planetIndex: number) => void;
  adminCompleteResearch: () => void;
  adminCompleteShipyard: (planetIndex: number) => void;
  adminCompleteAllQueues: () => void;
  adminResolveMission: (missionId: string) => void;
  adminResolveAllMissions: () => void;
  adminTriggerCombat: (
    npcCoords: Coordinates,
    ships: Record<string, number>,
  ) => CombatResult | null;
  adminSimulateTime: (seconds: number) => void;
  adminRegenerateGalaxy: (newSeed?: number) => void;
  adminClearCombatLog: () => void;
  adminClearEspionageReports: () => void;
  adminClearDebrisFields: () => void;
  exportSaveAction: () => string;
  importSaveAction: (json: string) => boolean;
}

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clampInt(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function matchingCoords(a: Coordinates, b: Coordinates): boolean {
  return a.galaxy === b.galaxy && a.system === b.system && a.slot === b.slot;
}

function sanitizeResourceValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.floor(value);
}

function sanitizeShipCounts(input: Partial<Record<ShipId, number>>): Record<string, number> {
  const normalized: Record<string, number> = {};
  for (const shipId of SHIP_ORDER) {
    normalized[shipId] = Math.max(0, Math.floor(input[shipId] ?? 0));
  }
  return normalized;
}

function sanitizeBuildingLevels(
  input: Partial<Record<BuildingId, number>>,
): Partial<Record<BuildingId, number>> {
  const normalized: Partial<Record<BuildingId, number>> = {};
  for (const buildingId of BUILDING_ORDER) {
    const level = input[buildingId];
    if (level === undefined) continue;
    normalized[buildingId] = Math.max(0, Math.floor(level));
  }
  return normalized;
}

function sanitizeResearchLevels(
  input: Partial<Record<ResearchId, number>>,
): Partial<Record<ResearchId, number>> {
  const normalized: Partial<Record<ResearchId, number>> = {};
  for (const researchId of RESEARCH_ORDER) {
    const level = input[researchId];
    if (level === undefined) continue;
    normalized[researchId] = Math.max(0, Math.floor(level));
  }
  return normalized;
}

function countSelectedShips(ships: Record<string, number>): number {
  return Object.values(ships).reduce(
    (total, count) => total + Math.max(0, Math.floor(count ?? 0)),
    0,
  );
}

function applyNpcForceResult(
  base: Record<string, number>,
  end: Partial<Record<string, number>> | undefined,
): Record<string, number> {
  const updated: Record<string, number> = {};
  for (const id of Object.keys(base)) {
    updated[id] = Math.max(0, Math.floor(end?.[id] ?? 0));
  }
  return updated;
}

function createAdminPlanet(state: GameState, coords: Coordinates): PlanetState {
  const planet = createDefaultPlanet();
  planet.name = `Colony ${state.planets.length + 1}`;
  planet.coordinates = { ...coords };

  const coordSeed = state.galaxy.seed ^ (coords.system * 100 + coords.slot);
  const tempRng = mulberry32(coordSeed);
  planet.maxTemperature = 20 + Math.floor(tempRng() * 30);

  return planet;
}

function refreshArrayReferences(state: GameState): void {
  state.planets = [...state.planets];
  state.fleetMissions = [...state.fleetMissions];
  state.galaxy = {
    ...state.galaxy,
    npcColonies: [...state.galaxy.npcColonies],
  };
  state.espionageReports = [...state.espionageReports];
  state.fleetNotifications = [...state.fleetNotifications];
  state.combatLog = [...state.combatLog];
  state.debrisFields = [...state.debrisFields];
}

function initializeState(): GameState {
  const state = loadState() ?? newGame();
  processOfflineTime(state);
  saveState(state);
  return state;
}

export function useGameEngine(): GameEngineState {
  const [gameState, setGameState] = useState<GameState>(() => initializeState());
  const [fleetTarget, setFleetTarget] = useState<Coordinates | null>(null);
  const [pendingMissionTarget, setPendingMissionTarget] = useState<{
    type: MissionType;
    coords: Coordinates;
  } | null>(null);
  const [productionRates, setProductionRates] = useState<ProductionRates>(() =>
    calculateProduction(gameState),
  );
  const [storageCaps, setStorageCaps] = useState(() => getStorageCaps(gameState));
  const stateRef = useRef<GameState>(gameState);

  const syncReactState = useCallback((): void => {
    const currentState = stateRef.current;
    refreshArrayReferences(currentState);
    setGameState({ ...currentState });
    setProductionRates(calculateProduction(currentState));
    setStorageCaps(getStorageCaps(currentState));
  }, []);

  useEffect(() => {
    let rafId = 0;
    let accumulator = 0;
    let lastFrameTime = performance.now();

    const MAX_TICKS_PER_FRAME = 20;

    const frame = (frameTime: number): void => {
      const deltaMs = frameTime - lastFrameTime;
      lastFrameTime = frameTime;

      const currentState = stateRef.current;
      // Scale delta time by gameSpeed so the game clock runs faster
      accumulator += deltaMs * currentState.settings.gameSpeed;
      let didProcessTick = false;
      let ticksThisFrame = 0;

      while (
        accumulator >= GAME_CONSTANTS.TICK_INTERVAL_MS &&
        ticksThisFrame < MAX_TICKS_PER_FRAME
      ) {
        const now = Date.now();
        processResourceTick(currentState);
        processQueueTick(currentState, now);
        processFleetTick(currentState, now);
        processNPCUpgrades(currentState, now);
        currentState.tickCount += 1;

        if (currentState.tickCount % GAME_CONSTANTS.AUTO_SAVE_TICKS === 0) {
          saveState(currentState);
        }

        accumulator -= GAME_CONSTANTS.TICK_INTERVAL_MS;
        ticksThisFrame += 1;
        didProcessTick = true;
      }

      // At very high speeds, drain excess accumulator to prevent runaway buildup
      if (accumulator > GAME_CONSTANTS.TICK_INTERVAL_MS * MAX_TICKS_PER_FRAME) {
        accumulator = GAME_CONSTANTS.TICK_INTERVAL_MS * MAX_TICKS_PER_FRAME;
      }

      if (didProcessTick) {
        syncReactState();
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    const handleBeforeUnload = (): void => {
      saveState(stateRef.current);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cancelAnimationFrame(rafId);
      saveState(stateRef.current);
    };
  }, [syncReactState]);

  const upgradeBuilding = useCallback(
    (id: BuildingId): boolean => {
      const success = startBuildingUpgrade(stateRef.current, id);
      syncReactState();
      if (success) {
        saveState(stateRef.current);
      }
      return success;
    },
    [syncReactState],
  );

  const startResearchAction = useCallback(
    (id: ResearchId): boolean => {
      const success = startResearch(stateRef.current, id);
      syncReactState();
      if (success) {
        saveState(stateRef.current);
      }
      return success;
    },
    [syncReactState],
  );

  const buildShips = useCallback(
    (id: ShipId, qty: number): boolean => {
      const success = startShipBuild(stateRef.current, id, qty);
      syncReactState();
      if (success) {
        saveState(stateRef.current);
      }
      return success;
    },
    [syncReactState],
  );

  const buildDefences = useCallback(
    (id: DefenceId, qty: number): boolean => {
      const success = startDefenceBuild(stateRef.current, id, qty);
      syncReactState();
      if (success) {
        saveState(stateRef.current);
      }
      return success;
    },
    [syncReactState],
  );

  const colonizeAction = useCallback(
    (coords: Coordinates): boolean => {
      const result = colonize(stateRef.current, coords);
      syncReactState();
      if (result) {
        saveState(stateRef.current);
      }
      return result !== null;
    },
    [syncReactState],
  );

  const cancelBuildingAction = useCallback((index: number): void => {
    cancelBuildingAtIndex(stateRef.current, index);
    syncReactState();
    saveState(stateRef.current);
  }, [syncReactState]);

  const cancelResearchAction = useCallback((index: number): void => {
    cancelResearchAtIndex(stateRef.current, index);
    syncReactState();
    saveState(stateRef.current);
  }, [syncReactState]);

  const cancelShipyardAction = useCallback((index: number): void => {
    cancelShipyardAtIndex(stateRef.current, index);
    syncReactState();
    saveState(stateRef.current);
  }, [syncReactState]);

  const resetGameAction = useCallback((): void => {
    const resetState = resetGame();
    stateRef.current = resetState;
    refreshArrayReferences(resetState);
    setFleetTarget(null);
    setPendingMissionTarget(null);
    setGameState({ ...resetState });
    setProductionRates(calculateProduction(resetState));
    setStorageCaps(getStorageCaps(resetState));
  }, []);

  const setActivePlanetAction = useCallback((index: number): void => {
    if (index >= 0 && index < stateRef.current.planets.length) {
      stateRef.current.activePlanetIndex = index;
      syncReactState();
      saveState(stateRef.current);
    }
  }, [syncReactState]);

  const setGameSpeed = useCallback(
    (n: number): void => {
      const oldSpeed = stateRef.current.settings.gameSpeed;
      const clampedSpeed = clampInt(1, n, 100);
      const now = Date.now();
      rescaleQueueTimes(stateRef.current, oldSpeed, clampedSpeed, now);
      rescaleMissionETAs(stateRef.current, oldSpeed, clampedSpeed, now);
      stateRef.current.settings.gameSpeed = clampedSpeed;
      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const setMaxProbeCount = useCallback(
    (n: number): void => {
      stateRef.current.settings.maxProbeCount = clampInt(1, n, 999);
      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const setGodMode = useCallback(
    (enabled: boolean): void => {
      stateRef.current.settings.godMode = enabled;
      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminSetResources = useCallback(
    (
      planetIndex: number,
      metal: number,
      crystal: number,
      deuterium: number,
    ): void => {
      const planet = stateRef.current.planets[planetIndex];
      if (!planet) return;

      const caps = getStorageCaps(planet);
      planet.resources.metal = clampInt(0, sanitizeResourceValue(metal), caps.metal);
      planet.resources.crystal = clampInt(0, sanitizeResourceValue(crystal), caps.crystal);
      planet.resources.deuterium = clampInt(
        0,
        sanitizeResourceValue(deuterium),
        caps.deuterium,
      );
      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminAddResources = useCallback(
    (
      planetIndex: number,
      metal: number,
      crystal: number,
      deuterium: number,
    ): void => {
      const planet = stateRef.current.planets[planetIndex];
      if (!planet) return;

      const caps = getStorageCaps(planet);
      planet.resources.metal = clampInt(
        0,
        planet.resources.metal + sanitizeResourceValue(metal),
        caps.metal,
      );
      planet.resources.crystal = clampInt(
        0,
        planet.resources.crystal + sanitizeResourceValue(crystal),
        caps.crystal,
      );
      planet.resources.deuterium = clampInt(
        0,
        planet.resources.deuterium + sanitizeResourceValue(deuterium),
        caps.deuterium,
      );
      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminSetBuildings = useCallback(
    (
      planetIndex: number,
      buildings: Partial<Record<BuildingId, number>>,
    ): void => {
      const planet = stateRef.current.planets[planetIndex];
      if (!planet) return;

      const patch = sanitizeBuildingLevels(buildings);
      for (const buildingId of BUILDING_ORDER) {
        const value = patch[buildingId];
        if (value === undefined) continue;
        planet.buildings[buildingId] = value;
      }

      const caps = getStorageCaps(planet);
      planet.resources.metal = clampInt(0, planet.resources.metal, caps.metal);
      planet.resources.crystal = clampInt(0, planet.resources.crystal, caps.crystal);
      planet.resources.deuterium = clampInt(
        0,
        planet.resources.deuterium,
        caps.deuterium,
      );

      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminSetShips = useCallback(
    (
      planetIndex: number,
      ships: Partial<Record<ShipId, number>>,
    ): void => {
      const planet = stateRef.current.planets[planetIndex];
      if (!planet) return;

      for (const shipId of SHIP_ORDER) {
        const value = ships[shipId];
        if (value === undefined) continue;
        planet.ships[shipId] = Math.max(0, Math.floor(value));
      }

      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminSetDefences = useCallback(
    (
      planetIndex: number,
      defences: Partial<Record<DefenceId, number>>,
    ): void => {
      const planet = stateRef.current.planets[planetIndex];
      if (!planet) return;

      for (const defenceId of DEFENCE_ORDER) {
        const value = defences[defenceId];
        if (value === undefined) continue;
        planet.defences[defenceId] = Math.max(0, Math.floor(value));
      }

      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminSetResearch = useCallback(
    (research: Partial<Record<ResearchId, number>>): void => {
      const patch = sanitizeResearchLevels(research);
      for (const researchId of RESEARCH_ORDER) {
        const value = patch[researchId];
        if (value === undefined) continue;
        stateRef.current.research[researchId] = value;
      }

      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminForceColonize = useCallback(
    (coords: Coordinates): PlanetState | null => {
      if (!isSlotEmpty(stateRef.current, coords)) {
        return null;
      }

      const planet = createAdminPlanet(stateRef.current, coords);
      stateRef.current.planets.push(planet);
      syncReactState();
      saveState(stateRef.current);
      return planet;
    },
    [syncReactState],
  );

  const adminConvertNPC = useCallback(
    (coords: Coordinates): PlanetState | null => {
      const npcIndex = stateRef.current.galaxy.npcColonies.findIndex((colony) =>
        matchingCoords(colony.coordinates, coords),
      );
      if (npcIndex < 0) {
        return null;
      }

      const hasPlayerPlanet = stateRef.current.planets.some((planet) =>
        matchingCoords(planet.coordinates, coords),
      );
      if (hasPlayerPlanet) {
        return null;
      }

      stateRef.current.galaxy.npcColonies.splice(npcIndex, 1);
      const planet = createAdminPlanet(stateRef.current, coords);
      stateRef.current.planets.push(planet);
      syncReactState();
      saveState(stateRef.current);
      return planet;
    },
    [syncReactState],
  );

  const adminRemoveNPC = useCallback(
    (coords: Coordinates): void => {
      const npcIndex = stateRef.current.galaxy.npcColonies.findIndex((colony) =>
        matchingCoords(colony.coordinates, coords),
      );
      if (npcIndex < 0) return;

      stateRef.current.galaxy.npcColonies.splice(npcIndex, 1);
      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminAddNPC = useCallback(
    (coords: Coordinates, tier: number): NPCColony | null => {
      const colony = addNPCToGalaxy(
        stateRef.current,
        coords,
        clampInt(1, tier, 10),
      );
      if (!colony) {
        return null;
      }
      syncReactState();
      saveState(stateRef.current);
      return colony;
    },
    [syncReactState],
  );

  const adminSetNPCTier = useCallback(
    (coords: Coordinates, tier: number): void => {
      const colony = stateRef.current.galaxy.npcColonies.find((item) =>
        matchingCoords(item.coordinates, coords),
      );
      if (!colony) return;

      const safeTier = clampInt(1, tier, 10);
      const baseDefences = buildNPCDefencesForTier(safeTier);
      const baseShips = buildNPCShipsForTier(safeTier);
      const intervalMs =
        safeTier <= 3 ? 21_600_000 : safeTier <= 6 ? 10_800_000 : 5_400_000;
      const maxTier = safeTier <= 3 ? 5 : safeTier <= 6 ? 8 : 10;

      colony.tier = safeTier;
      colony.maxTier = maxTier;
      colony.initialUpgradeIntervalMs = intervalMs;
      colony.currentUpgradeIntervalMs = intervalMs;
      colony.buildings = buildNPCBuildingsForTier(safeTier);
      colony.baseDefences = { ...baseDefences };
      colony.baseShips = { ...baseShips };
      colony.currentDefences = { ...baseDefences };
      colony.currentShips = { ...baseShips };
      colony.lastRaidedAt = 0;
      colony.lastUpgradeAt = 0;
      colony.upgradeTickCount = 0;
      colony.raidCount = 0;
      colony.recentRaidTimestamps = [];
      colony.abandonedAt = undefined;
      colony.resourcesAtLastRaid = { metal: 0, crystal: 0, deuterium: 0 };
      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminSetNPCSpecialty = useCallback(
    (coords: Coordinates, specialty: NPCSpecialty): void => {
      const colony = stateRef.current.galaxy.npcColonies.find((item) =>
        matchingCoords(item.coordinates, coords),
      );
      if (!colony) return;

      colony.specialty = specialty;
      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminNPCTriggerUpgrade = useCallback(
    (coords: Coordinates): void => {
      const colony = stateRef.current.galaxy.npcColonies.find((item) =>
        matchingCoords(item.coordinates, coords),
      );
      if (!colony) return;

      const rng = mulberry32(
        stateRef.current.galaxy.seed ^
          (coords.system * 100 + coords.slot) ^
          colony.upgradeTickCount,
      );
      applyUpgradeIncrement(colony, rng);
      colony.upgradeTickCount += 1;
      colony.lastUpgradeAt = Date.now();
      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminClearNPCRaidHistory = useCallback(
    (coords: Coordinates): void => {
      const colony = stateRef.current.galaxy.npcColonies.find((item) =>
        matchingCoords(item.coordinates, coords),
      );
      if (!colony) return;

      colony.raidCount = 0;
      colony.recentRaidTimestamps = [];
      colony.abandonedAt = undefined;
      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminForceAbandonNPC = useCallback(
    (coords: Coordinates): void => {
      const colony = stateRef.current.galaxy.npcColonies.find((item) =>
        matchingCoords(item.coordinates, coords),
      );
      if (!colony) return;

      colony.abandonedAt = Date.now();
      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminSetPlanetFieldCount = useCallback(
    (planetIndex: number, fieldCount: number): void => {
      const planet = stateRef.current.planets[planetIndex];
      if (!planet) return;

      planet.maxFields = clampInt(40, fieldCount, 250);
      planet.fieldCount = clampInt(40, fieldCount, 250);
      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminSetNPCBuildings = useCallback(
    (
      coords: Coordinates,
      buildings: Partial<Record<BuildingId, number>>,
    ): void => {
      const colony = stateRef.current.galaxy.npcColonies.find((item) =>
        matchingCoords(item.coordinates, coords),
      );
      if (!colony) return;

      for (const buildingId of Object.keys(BUILDINGS) as BuildingId[]) {
        const value = buildings[buildingId];
        if (value === undefined) continue;
        colony.buildings[buildingId] = Math.max(0, Math.floor(value));
      }
      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminSetNPCCurrentFleet = useCallback(
    (
      coords: Coordinates,
      ships: Partial<Record<ShipId, number>>,
      applyToBase = false,
    ): void => {
      const colony = stateRef.current.galaxy.npcColonies.find((item) =>
        matchingCoords(item.coordinates, coords),
      );
      if (!colony) return;

      for (const shipId of SHIP_ORDER) {
        const value = ships[shipId];
        if (value === undefined) continue;
        const safeValue = Math.max(0, Math.floor(value));
        colony.currentShips[shipId] = safeValue;
        if (applyToBase) {
          colony.baseShips[shipId] = safeValue;
        }
      }

      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminSetNPCCurrentDefences = useCallback(
    (
      coords: Coordinates,
      defences: Partial<Record<DefenceId, number>>,
      applyToBase = false,
    ): void => {
      const colony = stateRef.current.galaxy.npcColonies.find((item) =>
        matchingCoords(item.coordinates, coords),
      );
      if (!colony) return;

      for (const defenceId of DEFENCE_ORDER) {
        const value = defences[defenceId];
        if (value === undefined) continue;
        const safeValue = Math.max(0, Math.floor(value));
        colony.currentDefences[defenceId] = safeValue;
        if (applyToBase) {
          colony.baseDefences[defenceId] = safeValue;
        }
      }

      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminResetNPC = useCallback(
    (coords: Coordinates): void => {
      const colony = stateRef.current.galaxy.npcColonies.find((item) =>
        matchingCoords(item.coordinates, coords),
      );
      if (!colony) return;

      colony.currentDefences = { ...colony.baseDefences };
      colony.currentShips = { ...colony.baseShips };
      colony.lastRaidedAt = 0;
      colony.abandonedAt = undefined;
      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminWipeNPC = useCallback(
    (coords: Coordinates): void => {
      const colony = stateRef.current.galaxy.npcColonies.find((item) =>
        matchingCoords(item.coordinates, coords),
      );
      if (!colony) return;

      const fleetKeys = new Set([
        ...Object.keys(colony.baseShips),
        ...Object.keys(colony.currentShips),
      ]);
      const defenceKeys = new Set([
        ...Object.keys(colony.baseDefences),
        ...Object.keys(colony.currentDefences),
      ]);

      for (const key of fleetKeys) {
        colony.currentShips[key] = 0;
      }
      for (const key of defenceKeys) {
        colony.currentDefences[key] = 0;
      }

      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminCompleteBuilding = useCallback(
    (planetIndex: number): void => {
      const planet = stateRef.current.planets[planetIndex];
      if (!planet || planet.buildingQueue.length === 0) return;

      const now = Date.now();
      const currentItem = planet.buildingQueue[0];
      if (currentItem.targetLevel !== undefined) {
        planet.buildings[currentItem.id as BuildingId] = currentItem.targetLevel;
      }
      planet.buildingQueue.shift();

      const nextItem = planet.buildingQueue[0];
      if (nextItem && nextItem.targetLevel !== undefined) {
        const definition = BUILDINGS[nextItem.id as BuildingId];
        const nextCost = buildingCostAtLevel(
          definition.baseCost,
          definition.costMultiplier,
          nextItem.targetLevel,
        );
        const nextDuration = buildingTime(
          nextCost.metal,
          nextCost.crystal,
          planet.buildings.roboticsFactory,
          planet.buildings.naniteFactory,
          stateRef.current.settings.gameSpeed,
        );
        nextItem.startedAt = now;
        nextItem.completesAt = now + nextDuration * 1000;
      }

      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminCompleteResearch = useCallback((): void => {
    if (stateRef.current.researchQueue.length === 0) return;

    const now = Date.now();
    const currentItem = stateRef.current.researchQueue[0];
    if (currentItem.targetLevel !== undefined) {
      stateRef.current.research[currentItem.id as ResearchId] = currentItem.targetLevel;
    }
    stateRef.current.researchQueue.shift();

    const nextItem = stateRef.current.researchQueue[0];
    if (nextItem && nextItem.targetLevel !== undefined) {
      const sourcePlanet =
        stateRef.current.planets[
          nextItem.sourcePlanetIndex ?? stateRef.current.activePlanetIndex
        ] ??
        stateRef.current.planets[stateRef.current.activePlanetIndex] ??
        stateRef.current.planets[0];
      const definition = RESEARCH[nextItem.id as ResearchId];
      const nextCost = researchCostAtLevel(
        definition.baseCost,
        definition.costMultiplier,
        nextItem.targetLevel,
      );
      const nextDuration = researchTime(
        nextCost.metal,
        nextCost.crystal,
        sourcePlanet?.buildings.researchLab ?? 0,
        stateRef.current.settings.gameSpeed,
      );
      nextItem.startedAt = now;
      nextItem.completesAt = now + nextDuration * 1000;
    }

    syncReactState();
    saveState(stateRef.current);
  }, [syncReactState]);

  const adminCompleteShipyard = useCallback(
    (planetIndex: number): void => {
      const planet = stateRef.current.planets[planetIndex];
      if (!planet || planet.shipyardQueue.length === 0) return;

      const now = Date.now();
      const currentItem = planet.shipyardQueue[0];
      const quantity = currentItem.quantity ?? 0;
      const completed = currentItem.completed ?? 0;
      const remaining = Math.max(0, quantity - completed);

      if (remaining > 0) {
        if (currentItem.type === 'defence') {
          planet.defences[currentItem.id as DefenceId] += remaining;
        } else {
          planet.ships[currentItem.id as ShipId] += remaining;
        }
      }

      currentItem.completed = quantity;
      planet.shipyardQueue.shift();

      const nextItem = planet.shipyardQueue[0];
      if (nextItem) {
        const nextDuration =
          nextItem.type === 'defence'
            ? defenceBuildTime(
                DEFENCES[nextItem.id as DefenceId].structuralIntegrity,
                planet.buildings.shipyard,
                planet.buildings.naniteFactory,
                stateRef.current.settings.gameSpeed,
              )
            : shipBuildTime(
                SHIPS[nextItem.id as ShipId].structuralIntegrity,
                planet.buildings.shipyard,
                planet.buildings.naniteFactory,
                stateRef.current.settings.gameSpeed,
              );
        nextItem.startedAt = now;
        nextItem.completesAt = now + nextDuration * 1000;
      }

      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminCompleteAllQueues = useCallback((): void => {
    for (const planet of stateRef.current.planets) {
      while (planet.buildingQueue.length > 0) {
        const item = planet.buildingQueue.shift();
        if (!item || item.targetLevel === undefined) {
          continue;
        }

        const buildingId = item.id as BuildingId;
        if (planet.buildings[buildingId] !== undefined) {
          // eslint-disable-next-line react-hooks/immutability -- useGameEngine owns a mutable engine state object behind stateRef.
          planet.buildings[buildingId] = item.targetLevel;
        }
      }

      while (planet.shipyardQueue.length > 0) {
        const item = planet.shipyardQueue.shift();
        if (!item) continue;

        const quantity = Math.max(0, Math.floor(item.quantity ?? 0));
        const completed = Math.max(0, Math.floor(item.completed ?? 0));
        const remaining = Math.max(0, quantity - completed);
        if (remaining <= 0) continue;

        if (item.type === 'defence') {
          const defenceId = item.id as DefenceId;
          if (planet.defences[defenceId] !== undefined) {
            planet.defences[defenceId] += remaining;
          }
        } else if (item.type === 'ship') {
          const shipId = item.id as ShipId;
          if (planet.ships[shipId] !== undefined) {
            planet.ships[shipId] += remaining;
          }
        }
      }
    }

    while (stateRef.current.researchQueue.length > 0) {
      const item = stateRef.current.researchQueue.shift();
      if (!item || item.targetLevel === undefined) {
        continue;
      }

      const researchId = item.id as ResearchId;
      if (stateRef.current.research[researchId] !== undefined) {
        stateRef.current.research[researchId] = item.targetLevel;
      }
    }

    syncReactState();
    saveState(stateRef.current);
  }, [syncReactState]);

  const adminResolveMission = useCallback(
    (missionId: string): void => {
      const mission = stateRef.current.fleetMissions.find((item) => item.id === missionId);
      if (!mission || mission.status === 'completed') return;

      const now = Date.now();
      resolveMissionToCompletion(stateRef.current, mission, now);
      if (mission.status === 'returning') {
        resolveMissionToCompletion(stateRef.current, mission, now);
      }
      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminResolveAllMissions = useCallback((): void => {
    const now = Date.now();
    for (const mission of stateRef.current.fleetMissions) {
      if (mission.status === 'completed') {
        continue;
      }
      resolveMissionToCompletion(stateRef.current, mission, now);
      if (mission.status === 'returning') {
        resolveMissionToCompletion(stateRef.current, mission, now);
      }
    }

    syncReactState();
    saveState(stateRef.current);
  }, [syncReactState]);

  const adminTriggerCombat = useCallback(
    (npcCoords: Coordinates, ships: Record<string, number>): CombatResult | null => {
      const colony = stateRef.current.galaxy.npcColonies.find((item) =>
        matchingCoords(item.coordinates, npcCoords),
      );
      const sourcePlanet = stateRef.current.planets[stateRef.current.activePlanetIndex];
      if (!colony || !sourcePlanet) {
        return null;
      }

      const requestedShips = sanitizeShipCounts(ships as Partial<Record<ShipId, number>>);
      if (countSelectedShips(requestedShips) <= 0) {
        return null;
      }

      const attackerShips: Record<string, number> = {};
      for (const shipId of SHIP_ORDER) {
        const available = Math.max(0, Math.floor(sourcePlanet.ships[shipId] ?? 0));
        const requested = Math.max(0, Math.floor(requestedShips[shipId] ?? 0));
        attackerShips[shipId] = Math.min(available, requested);
      }

      if (countSelectedShips(attackerShips) <= 0) {
        return null;
      }

      const now = Date.now();
      const npcResources = getNPCResources(colony, now, stateRef.current.settings.gameSpeed);
      const npcForce = getNPCCurrentForce(colony, now);
      const seed = (now ^ (stateRef.current.combatLog.length + 1) ^ (npcCoords.system << 8)) >>> 0;

      const result = simulateCombat(
        {
          ships: attackerShips,
          techs: {
            weaponsTechnology: stateRef.current.research.weaponsTechnology,
            shieldingTechnology: stateRef.current.research.shieldingTechnology,
            armourTechnology: stateRef.current.research.armourTechnology,
          },
        },
        {
          ships: npcForce.ships,
          defences: npcForce.defences,
          techs: {
            weaponsTechnology: 0,
            shieldingTechnology: 0,
            armourTechnology: 0,
          },
        },
        seed,
      );

      const survivingShips = sanitizeShipCounts(result.attackerEnd.ships as Partial<Record<ShipId, number>>);
      const loot = calcLoot(npcResources, survivingShips);
      const resultWithLoot: CombatResult = {
        ...result,
        loot,
      };

      colony.currentDefences = applyNpcForceResult(
        colony.baseDefences,
        resultWithLoot.defenderEnd.defences,
      );
      colony.currentShips = applyNpcForceResult(colony.baseShips, resultWithLoot.defenderEnd.ships);
      colony.resourcesAtLastRaid = {
        metal: Math.max(0, Math.floor(npcResources.metal - resultWithLoot.loot.metal)),
        crystal: Math.max(0, Math.floor(npcResources.crystal - resultWithLoot.loot.crystal)),
        deuterium: Math.max(
          0,
          Math.floor(npcResources.deuterium - resultWithLoot.loot.deuterium),
        ),
      };
      colony.lastRaidedAt = now;
      recordRaid(colony, now, stateRef.current.settings.gameSpeed);

      for (const shipId of SHIP_ORDER) {
        const loss = Math.max(0, Math.floor(resultWithLoot.attackerLosses.ships[shipId] ?? 0));
        if (loss <= 0) continue;
        sourcePlanet.ships[shipId] = Math.max(0, sourcePlanet.ships[shipId] - loss);
      }

      const caps = getStorageCaps(sourcePlanet);
      sourcePlanet.resources.metal = clampInt(
        0,
        sourcePlanet.resources.metal + resultWithLoot.loot.metal,
        caps.metal,
      );
      sourcePlanet.resources.crystal = clampInt(
        0,
        sourcePlanet.resources.crystal + resultWithLoot.loot.crystal,
        caps.crystal,
      );
      sourcePlanet.resources.deuterium = clampInt(
        0,
        sourcePlanet.resources.deuterium + resultWithLoot.loot.deuterium,
        caps.deuterium,
      );

      addDebris(
        stateRef.current,
        npcCoords,
        resultWithLoot.debrisCreated.metal,
        resultWithLoot.debrisCreated.crystal,
      );

      const combatLogId = `combat_admin_${now.toString(16)}_${stateRef.current.combatLog.length}`;
      stateRef.current.combatLog.push({
        id: combatLogId,
        timestamp: now,
        targetCoordinates: { ...npcCoords },
        result: resultWithLoot,
        read: false,
      });

      syncReactState();
      saveState(stateRef.current);
      return resultWithLoot;
    },
    [syncReactState],
  );

  const adminSimulateTime = useCallback(
    (seconds: number): void => {
      const safeSeconds = Math.max(0, Math.floor(seconds));
      if (safeSeconds <= 0) {
        return;
      }

      stateRef.current.lastSaveTimestamp -= safeSeconds * 1000;
      processOfflineTime(stateRef.current);
      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminRegenerateGalaxy = useCallback(
    (newSeed?: number): void => {
      const rawSeed = Number.isFinite(newSeed) ? Math.floor(newSeed as number) : Date.now();
      const normalizedSeed = ((rawSeed % 1_000_000) + 1_000_000) % 1_000_000;

      stateRef.current.galaxy.seed = normalizedSeed;
      stateRef.current.galaxy.npcColonies = generateNPCColonies(normalizedSeed);
      stateRef.current.fleetMissions = [];
      stateRef.current.combatLog = [];
      stateRef.current.espionageReports = [];
      stateRef.current.fleetNotifications = [];
      stateRef.current.debrisFields = [];

      setFleetTarget(null);
      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const adminClearCombatLog = useCallback((): void => {
    stateRef.current.combatLog = [];
    syncReactState();
    saveState(stateRef.current);
  }, [syncReactState]);

  const adminClearEspionageReports = useCallback((): void => {
    stateRef.current.espionageReports = [];
    syncReactState();
    saveState(stateRef.current);
  }, [syncReactState]);

  const adminClearDebrisFields = useCallback((): void => {
    stateRef.current.debrisFields = [];
    syncReactState();
    saveState(stateRef.current);
  }, [syncReactState]);

  const markCombatRead = useCallback((id: string): void => {
    const entry = stateRef.current.combatLog.find((item) => item.id === id);
    if (!entry || entry.read) {
      return;
    }

    entry.read = true;
    syncReactState();
    saveState(stateRef.current);
  }, [syncReactState]);

  const markAllCombatRead = useCallback((): void => {
    stateRef.current.combatLog = stateRef.current.combatLog.map((entry) => ({
      ...entry,
      read: true,
    }));
    syncReactState();
    saveState(stateRef.current);
  }, [syncReactState]);

  const markEspionageRead = useCallback((id: string): void => {
    const report = stateRef.current.espionageReports.find((item) => item.id === id);
    if (!report || report.read) {
      return;
    }

    report.read = true;
    syncReactState();
    saveState(stateRef.current);
  }, [syncReactState]);

  const markAllEspionageRead = useCallback((): void => {
    stateRef.current.espionageReports = stateRef.current.espionageReports.map((report) => ({
      ...report,
      read: true,
    }));
    syncReactState();
    saveState(stateRef.current);
  }, [syncReactState]);

  const markFleetRead = useCallback((id: string): void => {
    const notification = stateRef.current.fleetNotifications.find((item) => item.id === id);
    if (!notification || notification.read) {
      return;
    }

    notification.read = true;
    syncReactState();
    saveState(stateRef.current);
  }, [syncReactState]);

  const markAllFleetRead = useCallback((): void => {
    stateRef.current.fleetNotifications = stateRef.current.fleetNotifications.map(
      (notification) => ({
        ...notification,
        read: true,
      }),
    );
    syncReactState();
    saveState(stateRef.current);
  }, [syncReactState]);

  const dispatchFleet = useCallback(
    (
      sourcePlanetIndex: number,
      targetCoords: Coordinates,
      ships: Record<string, number>,
      missionType: MissionType = 'attack',
      cargo?: { metal: number; crystal: number; deuterium: number },
    ): FleetMission | null => {
      const mission = dispatchMission(
        stateRef.current,
        sourcePlanetIndex,
        targetCoords,
        ships,
        missionType,
        cargo,
      );
      syncReactState();
      if (mission) {
        saveState(stateRef.current);
      }
      return mission;
    },
    [syncReactState],
  );

  const recallFleet = useCallback(
    (missionId: string): void => {
      recallMission(stateRef.current, missionId);
      syncReactState();
      saveState(stateRef.current);
    },
    [syncReactState],
  );

  const dispatchEspionage = useCallback(
    (
      sourcePlanetIndex: number,
      targetCoords: Coordinates,
      probeCount: number,
    ): FleetMission | null => {
      const sourcePlanet = stateRef.current.planets[sourcePlanetIndex];
      if (!sourcePlanet) {
        return null;
      }
      const maxProbes = Math.min(
        sourcePlanet.ships.espionageProbe ?? 0,
        stateRef.current.settings.maxProbeCount,
      );
      const safeProbeCount = clampInt(0, probeCount, maxProbes);
      if (safeProbeCount <= 0) {
        return null;
      }

      const mission = dispatchMission(
        stateRef.current,
        sourcePlanetIndex,
        targetCoords,
        { espionageProbe: safeProbeCount },
        'espionage',
      );
      syncReactState();
      if (mission) {
        saveState(stateRef.current);
      }
      return mission;
    },
    [syncReactState],
  );

  const dispatchHarvest = useCallback(
    (
      sourcePlanetIndex: number,
      targetCoords: Coordinates,
    ): FleetMission | null => {
      const mission = dispatchHarvestMission(
        stateRef.current,
        sourcePlanetIndex,
        targetCoords,
      );
      syncReactState();
      if (mission) {
        saveState(stateRef.current);
      }
      return mission;
    },
    [syncReactState],
  );

  const deleteCombatEntry = useCallback((id: string): void => {
    const nextEntries = stateRef.current.combatLog.filter((entry) => entry.id !== id);
    if (nextEntries.length === stateRef.current.combatLog.length) {
      return;
    }

    stateRef.current.combatLog = nextEntries;
    syncReactState();
    saveState(stateRef.current);
  }, [syncReactState]);

  const deleteEspionageReport = useCallback((id: string): void => {
    const nextReports = stateRef.current.espionageReports.filter((report) => report.id !== id);
    if (nextReports.length === stateRef.current.espionageReports.length) {
      return;
    }

    stateRef.current.espionageReports = nextReports;
    syncReactState();
    saveState(stateRef.current);
  }, [syncReactState]);

  const deleteFleetNotification = useCallback((id: string): void => {
    const nextNotifications = stateRef.current.fleetNotifications.filter(
      (notification) => notification.id !== id,
    );
    if (nextNotifications.length === stateRef.current.fleetNotifications.length) {
      return;
    }

    stateRef.current.fleetNotifications = nextNotifications;
    syncReactState();
    saveState(stateRef.current);
  }, [syncReactState]);

  const exportSaveAction = useCallback((): string => {
    return exportSave(stateRef.current);
  }, []);

  const importSaveAction = useCallback((json: string): boolean => {
    const importedState = importSave(json);
    if (!importedState) return false;

    processOfflineTime(importedState);
    saveState(importedState);
    stateRef.current = importedState;
    refreshArrayReferences(importedState);
    setFleetTarget(null);
    setPendingMissionTarget(null);
    setGameState({ ...importedState });
    setProductionRates(calculateProduction(importedState));
    setStorageCaps(getStorageCaps(importedState));

    return true;
  }, []);

  return {
    gameState,
    espionageReports: gameState.espionageReports,
    fleetNotifications: gameState.fleetNotifications,
    productionRates,
    storageCaps,
    upgradeBuilding,
    startResearchAction,
    buildShips,
    buildDefences,
    colonizeAction,
    cancelBuilding: cancelBuildingAction,
    cancelResearch: cancelResearchAction,
    cancelShipyard: cancelShipyardAction,
    resetGameAction,
    setActivePlanet: setActivePlanetAction,
    fleetTarget,
    setFleetTarget,
    pendingMissionTarget,
    setPendingMissionTarget,
    dispatchFleet,
    dispatchEspionage,
    dispatchHarvest,
    recallFleet,
    markCombatRead,
    markAllCombatRead,
    markEspionageRead,
    markAllEspionageRead,
    markFleetRead,
    markAllFleetRead,
    deleteCombatEntry,
    deleteEspionageReport,
    deleteFleetNotification,
    setGameSpeed,
    setMaxProbeCount,
    setGodMode,
    adminSetResources,
    adminAddResources,
    adminSetBuildings,
    adminSetShips,
    adminSetDefences,
    adminSetResearch,
    adminForceColonize,
    adminConvertNPC,
    adminRemoveNPC,
    adminAddNPC,
    adminSetNPCTier,
    adminSetNPCSpecialty,
    adminSetNPCBuildings,
    adminSetNPCCurrentFleet,
    adminSetNPCCurrentDefences,
    adminResetNPC,
    adminWipeNPC,
    adminNPCTriggerUpgrade,
    adminClearNPCRaidHistory,
    adminForceAbandonNPC,
    adminSetPlanetFieldCount,
    adminCompleteBuilding,
    adminCompleteResearch,
    adminCompleteShipyard,
    adminCompleteAllQueues,
    adminResolveMission,
    adminResolveAllMissions,
    adminTriggerCombat,
    adminSimulateTime,
    adminRegenerateGalaxy,
    adminClearCombatLog,
    adminClearEspionageReports,
    adminClearDebrisFields,
    exportSaveAction,
    importSaveAction,
  };
}
