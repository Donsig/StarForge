import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '../models/GameState.ts';
import type { BuildingId, DefenceId, ResearchId, ShipId } from '../models/types.ts';
import { GAME_CONSTANTS } from '../models/types.ts';
import type { ProductionRates } from '../engine/ResourceEngine.ts';
import {
  calculateProduction,
  getStorageCaps,
  processTick as processResourceTick,
} from '../engine/ResourceEngine.ts';
import {
  cancelBuildingAtIndex,
  cancelResearchAtIndex,
  processTick as processQueueTick,
  rescaleQueueTimes,
  startBuildingUpgrade,
  startDefenceBuild,
  startResearch,
  startShipBuild,
} from '../engine/BuildQueue.ts';
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
  productionRates: ProductionRates;
  storageCaps: { metal: number; crystal: number; deuterium: number };
  upgradeBuilding: (id: BuildingId) => boolean;
  startResearchAction: (id: ResearchId) => boolean;
  buildShips: (id: ShipId, qty: number) => boolean;
  buildDefences: (id: DefenceId, qty: number) => boolean;
  cancelBuilding: () => void;
  cancelResearch: () => void;
  resetGameAction: () => void;
  setGameSpeed: (n: number) => void;
  exportSaveAction: () => string;
  importSaveAction: (json: string) => boolean;
}

function initializeState(): GameState {
  const state = loadState() ?? newGame();
  processOfflineTime(state);
  saveState(state);
  return state;
}

export function useGameEngine(): GameEngineState {
  const [gameState, setGameState] = useState<GameState>(() => initializeState());
  const [productionRates, setProductionRates] = useState<ProductionRates>(() =>
    calculateProduction(gameState),
  );
  const [storageCaps, setStorageCaps] = useState(() => getStorageCaps(gameState));
  const stateRef = useRef<GameState>(gameState);

  const syncReactState = useCallback((): void => {
    const currentState = stateRef.current;
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
        processResourceTick(currentState);
        processQueueTick(currentState, Date.now());
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
        setGameState({ ...currentState });
        setProductionRates(calculateProduction(currentState));
        setStorageCaps(getStorageCaps(currentState));
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
  }, []);

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

  const cancelBuildingAction = useCallback((): void => {
    cancelBuildingAtIndex(stateRef.current, 0);
    syncReactState();
    saveState(stateRef.current);
  }, [syncReactState]);

  const cancelResearchAction = useCallback((): void => {
    cancelResearchAtIndex(stateRef.current, 0);
    syncReactState();
    saveState(stateRef.current);
  }, [syncReactState]);

  const resetGameAction = useCallback((): void => {
    const resetState = resetGame();
    stateRef.current = resetState;
    setGameState({ ...resetState });
    setProductionRates(calculateProduction(resetState));
    setStorageCaps(getStorageCaps(resetState));
  }, []);

  const setGameSpeed = useCallback(
    (n: number): void => {
      const oldSpeed = stateRef.current.settings.gameSpeed;
      const clampedSpeed = Math.min(100, Math.max(0.5, n));
      rescaleQueueTimes(stateRef.current, oldSpeed, clampedSpeed);
      stateRef.current.settings.gameSpeed = clampedSpeed;
      syncReactState();
    },
    [syncReactState],
  );

  const exportSaveAction = useCallback((): string => {
    return exportSave(stateRef.current);
  }, []);

  const importSaveAction = useCallback((json: string): boolean => {
    const importedState = importSave(json);
    if (!importedState) return false;

    processOfflineTime(importedState);
    saveState(importedState);
    stateRef.current = importedState;
    setGameState({ ...importedState });
    setProductionRates(calculateProduction(importedState));
    setStorageCaps(getStorageCaps(importedState));

    return true;
  }, []);

  return {
    gameState,
    productionRates,
    storageCaps,
    upgradeBuilding,
    startResearchAction,
    buildShips,
    buildDefences,
    cancelBuilding: cancelBuildingAction,
    cancelResearch: cancelResearchAction,
    resetGameAction,
    setGameSpeed,
    exportSaveAction,
    importSaveAction,
  };
}
