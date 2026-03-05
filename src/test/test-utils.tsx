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

export * from '@testing-library/react';

type GameActions = Omit<
  GameContextType,
  'gameState' | 'espionageReports' | 'productionRates' | 'storageCaps'
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
}

const defaultActions: GameActions = {
  upgradeBuilding: () => false,
  startResearchAction: () => false,
  buildShips: () => false,
  buildDefences: () => false,
  colonizeAction: () => false,
  cancelBuilding: (_index: number) => {},
  cancelResearch: (_index: number) => {},
  cancelShipyard: (_index: number) => {},
  resetGameAction: () => {},
  setActivePlanet: (_index: number) => {},
  fleetTarget: null,
  setFleetTarget: (_coords) => {},
  dispatchFleet: (_sourcePlanetIndex, _targetCoords, _ships) => null,
  dispatchEspionage: (_sourcePlanetIndex, _targetCoords, _probeCount) => null,
  recallFleet: (_missionId) => {},
  markReportRead: (_reportId) => {},
  setGameSpeed: () => {},
  setGodMode: () => {},
  adminSetResources: (_planetIndex, _metal, _crystal, _deuterium) => {},
  adminAddResources: (_planetIndex, _metal, _crystal, _deuterium) => {},
  adminSetBuildings: (_planetIndex, _buildings) => {},
  adminSetShips: (_planetIndex, _ships) => {},
  adminSetDefences: (_planetIndex, _defences) => {},
  adminSetResearch: (_research) => {},
  adminForceColonize: (_coords) => null,
  adminConvertNPC: (_coords) => null,
  adminRemoveNPC: (_coords) => {},
  adminAddNPC: (_coords, _tier) => null,
  adminSetNPCTier: (_coords, _tier) => {},
  adminSetNPCBuildings: (_coords, _buildings) => {},
  adminSetNPCCurrentFleet: (_coords, _ships, _applyToBase) => {},
  adminSetNPCCurrentDefences: (_coords, _defences, _applyToBase) => {},
  adminResetNPC: (_coords) => {},
  adminWipeNPC: (_coords) => {},
  adminCompleteBuilding: (_planetIndex) => {},
  adminCompleteResearch: () => {},
  adminCompleteShipyard: (_planetIndex) => {},
  adminCompleteAllQueues: () => {},
  adminResolveMission: (_missionId) => {},
  adminResolveAllMissions: () => {},
  adminTriggerCombat: (_npcCoords, _ships) => null,
  adminSimulateTime: (_seconds) => {},
  adminRegenerateGalaxy: (_newSeed) => {},
  adminClearCombatLog: () => {},
  adminClearEspionageReports: () => {},
  adminClearDebrisFields: () => {},
  adminMarkAllRead: () => {},
  exportSaveAction: () => '',
  importSaveAction: () => false,
};

function buildGameState(overrides?: GameStateOverrides): GameState {
  const baseState = createNewGameState();

  if (!overrides) return baseState;

  const basePlanet = baseState.planets[0];
  const planetOverrides = overrides.planet;

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

  return {
    ...baseState,
    ...overrides,
    planets: [planet],
    research: {
      ...baseState.research,
      ...overrides.research,
    },
    settings: {
      ...baseState.settings,
      ...overrides.settings,
    },
    researchQueue:
      overrides.researchQueue === undefined
        ? baseState.researchQueue
        : overrides.researchQueue,
  };
}

export function createMockGameContext(
  options: RenderWithGameOptions = {},
): GameContextType {
  const gameState = buildGameState(options.gameState);
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
