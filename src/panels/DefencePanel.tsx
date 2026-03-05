import { useState } from 'react';
import { BUILDINGS } from '../data/buildings.ts';
import { DEFENCES, DEFENCE_ORDER } from '../data/defences.ts';
import { RESEARCH } from '../data/research.ts';
import { canAfford, prerequisitesMet } from '../engine/BuildQueue.ts';
import { defenceBuildTime } from '../engine/FormulasEngine.ts';
import { useGame } from '../context/GameContext';
import { CostDisplay } from '../components/CostDisplay';
import { formatDuration } from '../utils/time.ts';
import type { GameState } from '../models/GameState.ts';
import type {
  BuildingId,
  DefenceId,
  Prerequisite,
  ResearchId,
  ResourceCost,
} from '../models/types.ts';

const DEFAULT_QUANTITIES: Record<DefenceId, string> = DEFENCE_ORDER.reduce(
  (accumulator, defenceId) => {
    accumulator[defenceId] = '1';
    return accumulator;
  },
  {} as Record<DefenceId, string>,
);

function requirementMet(prerequisite: Prerequisite, gameState: GameState): boolean {
  const planet = gameState.planets[gameState.activePlanetIndex];
  if (prerequisite.type === 'building') {
    const level = planet.buildings[prerequisite.id as BuildingId];
    return level >= prerequisite.level;
  }

  const level = gameState.research[prerequisite.id as ResearchId];
  return level >= prerequisite.level;
}

function requirementLabel(prerequisite: Prerequisite): string {
  if (prerequisite.type === 'building') {
    return `${BUILDINGS[prerequisite.id as BuildingId].name} ${prerequisite.level}`;
  }

  return `${RESEARCH[prerequisite.id as ResearchId].name} ${prerequisite.level}`;
}

export function DefencePanel() {
  const { gameState, buildDefences } = useGame();
  const [quantities, setQuantities] = useState<Record<DefenceId, string>>(DEFAULT_QUANTITIES);
  const planet = gameState.planets[gameState.activePlanetIndex];

  return (
    <section className="panel">
      <h1 className="panel-title">Defence</h1>
      <p className="panel-subtitle">
        Build planetary defenses in the shared shipyard queue.
      </p>

      <div className="items-grid">
        {DEFENCE_ORDER.map((defenceId) => {
          const definition = DEFENCES[defenceId];
          const quantityInput = quantities[defenceId];
          const parsedQuantity = Number.parseInt(quantityInput, 10);
          const quantity = Number.isInteger(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 0;
          const unlocked = prerequisitesMet(definition.requires, gameState);
          const ownedCount = planet.defences[defenceId];
          const queuedCount = planet.shipyardQueue.reduce((total, item) => {
            if (item.type !== 'defence' || item.id !== defenceId) {
              return total;
            }
            const quantityValue = Math.max(0, Math.floor(item.quantity ?? 0));
            const completedValue = Math.max(0, Math.floor(item.completed ?? 0));
            return total + Math.max(0, quantityValue - completedValue);
          }, 0);
          const remainingMax =
            definition.maxCount === undefined
              ? null
              : Math.max(definition.maxCount - (ownedCount + queuedCount), 0);
          const maxReached = remainingMax !== null && remainingMax === 0;
          const exceedsMax = remainingMax !== null && quantity > remainingMax;

          const totalCost: ResourceCost = {
            metal: definition.cost.metal * quantity,
            crystal: definition.cost.crystal * quantity,
            deuterium: definition.cost.deuterium * quantity,
          };
          const affordable = quantity > 0 && canAfford(totalCost, gameState);
          const canBuild =
            unlocked &&
            affordable &&
            quantity > 0 &&
            !maxReached &&
            !exceedsMax;
          const unitBuildSeconds = defenceBuildTime(
            definition.structuralIntegrity,
            planet.buildings.shipyard,
            planet.buildings.naniteFactory,
            gameState.settings.gameSpeed,
          );

          return (
            <article key={defenceId} className="item-card">
              <div className="item-header">
                <h3>{definition.name}</h3>
                <span className="item-level number">Owned: {ownedCount}</span>
              </div>

              <p className="item-description">{definition.description}</p>

              <div className="ship-stats">
                <span className="ship-stat number">ATK {definition.weaponPower}</span>
                <span className="ship-stat number">SHD {definition.shieldPower}</span>
                <span className="ship-stat number">HULL {definition.structuralIntegrity}</span>
              </div>

              <div className="item-meta">
                <span className="label">Unit Build Time</span>
                <span className="number">{formatDuration(unitBuildSeconds)}</span>
              </div>

              {definition.maxCount !== undefined && (
                <div className="item-meta">
                  <span className="label">Limit</span>
                  <span className="number">
                    Max: {definition.maxCount} (Queued: {queuedCount})
                  </span>
                </div>
              )}

              <div className="item-meta">
                <span className="label">Batch Quantity</span>
                <input
                  className="input quantity-input number"
                  type="number"
                  min={1}
                  step={1}
                  max={remainingMax ?? undefined}
                  value={quantityInput}
                  disabled={maxReached}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setQuantities((current) => ({
                      ...current,
                      [defenceId]: nextValue,
                    }));
                  }}
                />
              </div>

              <div className="item-meta">
                <span className="label">Batch Cost</span>
                <CostDisplay cost={totalCost} available={planet.resources} />
              </div>

              {!unlocked && (
                <div className="requirements locked">
                  {definition.requires.map((prerequisite) => (
                    <span
                      key={`${defenceId}-${prerequisite.type}-${prerequisite.id}`}
                      className={`requirement ${
                        requirementMet(prerequisite, gameState) ? 'met' : 'unmet'
                      }`}
                    >
                      {requirementLabel(prerequisite)}
                    </span>
                  ))}
                </div>
              )}

              <div className="item-footer">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!canBuild}
                  onClick={() => {
                    if (quantity > 0) {
                      buildDefences(defenceId, quantity);
                    }
                  }}
                >
                  {unlocked ? 'Queue Build' : 'Locked'}
                </button>
                {quantity <= 0 && <span className="hint danger">Enter a valid quantity</span>}
                {maxReached && <span className="hint danger">Maximum built</span>}
                {!maxReached && exceedsMax && (
                  <span className="hint danger">Max remaining: {remainingMax}</span>
                )}
                {quantity > 0 && !exceedsMax && !affordable && (
                  <span className="hint danger">Insufficient resources</span>
                )}
              </div>
            </article>
          );
        })}
      </div>

    </section>
  );
}
