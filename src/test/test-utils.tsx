/* eslint-disable react-refresh/only-export-components -- test utilities intentionally export render helpers and mock context builders. */
import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { GameContext, type GameContextType } from '../context/GameContext';
import {
  calculateProduction,
  type ProductionRates,
} from '../engine/ResourceEngine.ts';
import {
  createNewGameState,
  type GameState,
} from '../models/GameState.ts';
import { createDefaultPlanet } from '../models/Planet.ts';

export * from '@testing-library/react';

type GameActions = Omit<
  GameContextType,
  'gameState' | 'espionageReports' | 'fleetNotifications' | 'productionRates' | 'storageCaps'
>;
type StorageCaps = GameContextType['storageCaps'];

interface GameStateOverrides
  extends Partial<Omit<GameState, 'planets' | 'research' | 'settings'>> {
  planet?: Partial<Omit<GameState['planets'][0], 'buildings' | 'ships' | 'resources'>> & {
    buildings?: Partial<GameState['planets'][0]['buildings']>;
    ships?: Partial<GameState['planets'][0]['ships']>;
    resources?: Partial<GameState['planets'][0]['resources']>;
  };
  research?: Partial<GameState['research']>;
  settings?: Partial<GameState['settings']>;
}

interface RenderWithGameOptions {
  gameState?: GameStateOverrides;
  productionRates?: Partial<ProductionRates>;
  storageCaps?: Partial<StorageCaps>;
  actions?: Partial<GameActions>;
  withMultiplePlanets?: boolean;
}

const defaultActions: GameActions = {
  upgradeBuilding: () => false,
  startResearchAction: () => false,
  buildShips: () => false,
  buildDefences: () => false,
  colonizeAction: () => false,
  cancelBuilding: () => {},
  cancelResearch: () => {},
  cancelShipyard: () => {},
  resetGameAction: () => {},
  setActivePlanet: () => {},
  fleetTarget: null,
  setFleetTarget: () => {},
  pendingMissionTarget: null,
  setPendingMissionTarget: () => {},
  dispatchFleet: () => null,
  dispatchEspionage: () => null,
  dispatchHarvest: () => null,
  recallFleet: () => {},
  markCombatRead: () => {},
  markAllCombatRead: () => {},
  markEspionageRead: () => {},
  markAllEspionageRead: () => {},
  markFleetRead: () => {},
  markAllFleetRead: () => {},
  deleteCombatEntry: () => {},
  deleteEspionageReport: () => {},
  deleteFleetNotification: () => {},
  setGameSpeed: () => {},
  setMaxProbeCount: () => {},
  setGodMode: () => {},
  adminSetResources: () => {},
  adminAddResources: () => {},
  adminSetBuildings: () => {},
  adminSetShips: () => {},
  adminSetDefences: () => {},
  adminSetResearch: () => {},
  adminForceColonize: () => null,
  adminConvertNPC: () => null,
  adminRemoveNPC: () => {},
  adminAddNPC: () => null,
  adminSetNPCTier: () => {},
  adminSetNPCSpecialty: () => {},
  adminSetNPCBuildings: () => {},
  adminSetNPCCurrentFleet: () => {},
  adminSetNPCCurrentDefences: () => {},
  adminResetNPC: () => {},
  adminWipeNPC: () => {},
  adminNPCTriggerUpgrade: () => {},
  adminClearNPCRaidHistory: () => {},
  adminForceAbandonNPC: () => {},
  adminSetPlanetFieldCount: () => {},
  adminCompleteBuilding: () => {},
  adminCompleteResearch: () => {},
  adminCompleteShipyard: () => {},
  adminCompleteAllQueues: () => {},
  adminResolveMission: () => {},
  adminResolveAllMissions: () => {},
  adminTriggerCombat: () => null,
  adminSimulateTime: () => {},
  adminRegenerateGalaxy: () => {},
  adminClearCombatLog: () => {},
  adminClearEspionageReports: () => {},
  adminClearDebrisFields: () => {},
  exportSaveAction: () => '',
  importSaveAction: () => false,
};

function buildGameState(overrides?: GameStateOverrides, withMultiplePlanets = false): GameState {
  const baseState = createNewGameState();
  const resolvedOverrides = overrides ?? {};

  const basePlanet = baseState.planets[0];
  const planetOverrides = resolvedOverrides.planet;

  const planet = {
    ...basePlanet,
    ...planetOverrides,
    buildings: {
      ...basePlanet.buildings,
      ...planetOverrides?.buildings,
    },
    ships: {
      ...basePlanet.ships,
      ...planetOverrides?.ships,
    },
    resources: {
      ...basePlanet.resources,
      ...planetOverrides?.resources,
    },
    buildingQueue:
      planetOverrides?.buildingQueue === undefined
        ? basePlanet.buildingQueue
        : planetOverrides.buildingQueue,
    shipyardQueue:
      planetOverrides?.shipyardQueue === undefined
        ? basePlanet.shipyardQueue
        : planetOverrides.shipyardQueue,
  };

  const state: GameState = {
    ...baseState,
    ...resolvedOverrides,
    planets: [planet],
    research: {
      ...baseState.research,
      ...resolvedOverrides.research,
    },
    settings: {
      ...baseState.settings,
      ...resolvedOverrides.settings,
    },
    researchQueue:
      resolvedOverrides.researchQueue === undefined
        ? baseState.researchQueue
        : resolvedOverrides.researchQueue,
  };

  if (withMultiplePlanets) {
    const colony = createDefaultPlanet();
    colony.name = 'Colony 2';
    colony.coordinates = { galaxy: 1, system: 1, slot: 5 };
    state.planets.push(colony);
  }

  return state;
}

export function createMockGameContext(
  options: RenderWithGameOptions = {},
): GameContextType {
  const gameState = buildGameState(options.gameState, options.withMultiplePlanets ?? false);
  const productionRates: ProductionRates = {
    ...calculateProduction(gameState),
    ...options.productionRates,
  };
  const storageCaps: StorageCaps = {
    metal: 10000,
    crystal: 10000,
    deuterium: 10000,
    ...options.storageCaps,
  };

  return {
    gameState,
    espionageReports: gameState.espionageReports,
    fleetNotifications: gameState.fleetNotifications,
    productionRates,
    storageCaps,
    ...defaultActions,
    ...options.actions,
  };
}

export function renderWithGame(
  ui: ReactElement,
  options: RenderWithGameOptions = {},
  renderOptions?: Omit<RenderOptions, 'wrapper'>,
) {
  let gameContext = createMockGameContext(options);

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <GameContext.Provider value={gameContext}>{children}</GameContext.Provider>
  );

  const result = render(ui, {
    wrapper: Wrapper,
    ...renderOptions,
  });

  const rerenderWithGame = (
    nextUi: ReactElement = ui,
    nextOptions: RenderWithGameOptions = options,
  ) => {
    gameContext = createMockGameContext(nextOptions);
    result.rerender(
      <GameContext.Provider value={gameContext}>{nextUi}</GameContext.Provider>,
    );
  };

  return {
    ...result,
    gameContext,
    rerenderWithGame,
  };
}
