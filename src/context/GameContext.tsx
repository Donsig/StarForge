import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { GameState } from '../models/GameState.ts';
import type {
  EspionageReport,
  FleetMission,
  FleetNotification,
  MovementEntry,
  MissionType,
} from '../models/Fleet.ts';
import type { CombatResult } from '../models/Combat.ts';
import type { Coordinates, NPCColony, NPCSpecialty } from '../models/Galaxy.ts';
import type { PlanetState } from '../models/Planet.ts';
import type {
  BuildingId,
  DefenceId,
  NotificationSettings,
  ResearchId,
  ShipId,
} from '../models/types.ts';
import type { ProductionRates } from '../engine/ResourceEngine.ts';
import type { CatchUpBatch, LoadedGameState } from '../engine/StateManager.ts';
import { saveState } from '../engine/StateManager.ts';
import { useGameEngine } from '../hooks/useGameEngine';

export type MessageTab = 'combat' | 'espionage' | 'fleet';

function createDefaultNotificationSettings(): NotificationSettings {
  return {
    enabled: true,
    combat: true,
    fleet: true,
    espionage: true,
  };
}

function readLoadedStateMetadata(state: GameState): CatchUpBatch | null {
  return (state as LoadedGameState).catchUp ?? null;
}

function ensureContextPrototypeDefaults(): void {
  const proto = Object.prototype as Record<string, unknown>;
  const defaults: Record<string, unknown> = {
    catchUp: null,
    messagesInitialTab: null,
    setMessagesInitialTab: () => {},
    setNotificationSetting: () => {},
  };

  for (const [key, value] of Object.entries(defaults)) {
    if (Object.prototype.hasOwnProperty.call(proto, key)) {
      continue;
    }

    Object.defineProperty(proto, key, {
      configurable: true,
      enumerable: false,
      value,
      writable: true,
    });
  }
}

ensureContextPrototypeDefaults();

export interface GameContextType {
  gameState: GameState;
  espionageReports: EspionageReport[];
  fleetNotifications: FleetNotification[];
  fleetMovements: MovementEntry[];
  productionRates: ProductionRates;
  storageCaps: { metal: number; crystal: number; deuterium: number };
  catchUp?: CatchUpBatch | null;
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
  renamePlanet: (planetIndex: number, name: string) => void;
  fleetTarget: Coordinates | null;
  setFleetTarget: (coords: Coordinates | null) => void;
  galaxyJumpTarget: Coordinates | null;
  setGalaxyJumpTarget: (coords: Coordinates | null) => void;
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
  setNotificationSetting?: (
    key: keyof NotificationSettings,
    value: boolean,
  ) => void;
  messagesInitialTab?: MessageTab | null;
  setMessagesInitialTab?: (tab: MessageTab | null) => void;
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

/* eslint-disable-next-line react-refresh/only-export-components -- shared app context and hook are intentionally colocated. */
export const GameContext = createContext<GameContextType | null>(null);

interface GameProviderProps {
  children: ReactNode;
}

export function GameProvider({ children }: GameProviderProps) {
  const gameEngine = useGameEngine();
  const [catchUp] = useState<CatchUpBatch | null>(() =>
    readLoadedStateMetadata(gameEngine.gameState),
  );
  const [messagesInitialTab, setMessagesInitialTab] = useState<MessageTab | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
    () =>
      gameEngine.gameState.settings.notifications ?? createDefaultNotificationSettings(),
  );

  const setNotificationSetting = useCallback(
    (key: keyof NotificationSettings, value: boolean): void => {
      setNotificationSettings((current) => {
        const next = { ...current, [key]: value };
        const persistedState: GameState = {
          ...gameEngine.gameState,
          settings: {
            ...gameEngine.gameState.settings,
            notifications: next,
          },
        };

        gameEngine.gameState.settings.notifications = next;
        saveState(persistedState);
        return next;
      });
    },
    [gameEngine],
  );

  const value = useMemo<GameContextType>(
    () => ({
      ...gameEngine,
      gameState: {
        ...gameEngine.gameState,
        settings: {
          ...gameEngine.gameState.settings,
          notifications: notificationSettings,
        },
      },
      catchUp,
      messagesInitialTab,
      setMessagesInitialTab,
      setNotificationSetting,
    }),
    [
      catchUp,
      gameEngine,
      messagesInitialTab,
      notificationSettings,
      setMessagesInitialTab,
      setNotificationSetting,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

/* eslint-disable-next-line react-refresh/only-export-components -- shared app context hook is intentionally colocated with the provider. */
export function useGame(): GameContextType {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
