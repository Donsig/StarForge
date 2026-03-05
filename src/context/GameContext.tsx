import { createContext, useContext, type ReactNode } from 'react';
import type { GameState } from '../models/GameState.ts';
import type { EspionageReport, FleetMission, MissionType } from '../models/Fleet.ts';
import type { CombatResult } from '../models/Combat.ts';
import type { Coordinates, NPCColony, NPCSpecialty } from '../models/Galaxy.ts';
import type { PlanetState } from '../models/Planet.ts';
import type { BuildingId, DefenceId, ResearchId, ShipId } from '../models/types.ts';
import type { ProductionRates } from '../engine/ResourceEngine.ts';
import { useGameEngine } from '../hooks/useGameEngine';

export interface GameContextType {
  gameState: GameState;
  espionageReports: EspionageReport[];
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
    coords: Coordinates,
  ) => FleetMission | null;
  recallFleet: (missionId: string) => void;
  markReportRead: (reportId: string) => void;
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
  adminMarkAllRead: () => void;
  exportSaveAction: () => string;
  importSaveAction: (json: string) => boolean;
}

export const GameContext = createContext<GameContextType | null>(null);

interface GameProviderProps {
  children: ReactNode;
}

export function GameProvider({ children }: GameProviderProps) {
  const gameEngine = useGameEngine();
  return <GameContext.Provider value={gameEngine}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextType {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
