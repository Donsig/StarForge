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

type GameActions = Omit<GameContextType, 'gameState' | 'productionRates' | 'storageCaps'>;
type StorageCaps = GameContextType['storageCaps'];

interface GameStateOverrides
  extends Partial<Omit<GameState, 'planet' | 'research' | 'settings'>> {
  planet?: Partial<Omit<GameState['planet'], 'buildings' | 'ships' | 'resources'>> & {
    buildings?: Partial<GameState['planet']['buildings']>;
    ships?: Partial<GameState['planet']['ships']>;
    resources?: Partial<GameState['planet']['resources']>;
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
  cancelBuilding: () => {},
  cancelResearch: () => {},
  resetGameAction: () => {},
  setGameSpeed: () => {},
  exportSaveAction: () => '',
  importSaveAction: () => false,
};

function buildGameState(overrides?: GameStateOverrides): GameState {
  const baseState = createNewGameState();

  if (!overrides) {
    return baseState;
  }

  return {
    ...baseState,
    ...overrides,
    planet: {
      ...baseState.planet,
      ...overrides.planet,
      buildings: {
        ...baseState.planet.buildings,
        ...overrides.planet?.buildings,
      },
      ships: {
        ...baseState.planet.ships,
        ...overrides.planet?.ships,
      },
      resources: {
        ...baseState.planet.resources,
        ...overrides.planet?.resources,
      },
      buildingQueue:
        overrides.planet?.buildingQueue === undefined
          ? baseState.planet.buildingQueue
          : overrides.planet.buildingQueue,
      shipyardQueue:
        overrides.planet?.shipyardQueue === undefined
          ? baseState.planet.shipyardQueue
          : overrides.planet.shipyardQueue,
    },
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
