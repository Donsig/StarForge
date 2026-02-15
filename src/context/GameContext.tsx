import { createContext, useContext, type ReactNode } from 'react';
import type { GameState } from '../models/GameState.ts';
import type { BuildingId, ResearchId, ShipId } from '../models/types.ts';
import type { ProductionRates } from '../engine/ResourceEngine.ts';
import { useGameEngine } from '../hooks/useGameEngine';

export interface GameContextType {
  gameState: GameState;
  productionRates: ProductionRates;
  upgradeBuilding: (id: BuildingId) => boolean;
  startResearchAction: (id: ResearchId) => boolean;
  buildShips: (id: ShipId, qty: number) => boolean;
  cancelBuilding: () => void;
  cancelResearch: () => void;
  resetGameAction: () => void;
  setGameSpeed: (n: number) => void;
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
