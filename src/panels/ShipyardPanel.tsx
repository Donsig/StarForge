import { useState } from 'react';
import { BUILDINGS } from '../data/buildings.ts';
import { DEFENCES } from '../data/defences.ts';
import { RESEARCH } from '../data/research.ts';
import { SHIP_ORDER, SHIPS } from '../data/ships.ts';
import { canAfford, prerequisitesMet } from '../engine/BuildQueue.ts';
import { shipBuildTime } from '../engine/FormulasEngine.ts';
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
  ShipId,
} from '../models/types.ts';

const DEFAULT_QUANTITIES: Record<ShipId, string> = SHIP_ORDER.reduce(
  (accumulator, shipId) => {
    accumulator[shipId] = '1';
    return accumulator;
  },
  {} as Record<ShipId, string>,
);

function requirementMet(prerequisite: Prerequisite, gameState: GameState): boolean {
  if (prerequisite.type === 'building') {
    const level = gameState.planet.buildings[prerequisite.id as BuildingId];
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

export function ShipyardPanel() {
  const { gameState, buildShips, cancelShipyard } = useGame();
  const [quantities, setQuantities] = useState<Record<ShipId, string>>(DEFAULT_QUANTITIES);

  return (
    <section className="panel">
      <h1 className="panel-title">Shipyard</h1>
      <p className="panel-subtitle">
        Queue ship construction batches. Each batch builds one unit at a time in the shipyard.
      </p>

      <div className="items-grid">
        {SHIP_ORDER.map((shipId) => {
          const definition = SHIPS[shipId];
          const quantityInput = quantities[shipId];
          const parsedQuantity = Number.parseInt(quantityInput, 10);
          const quantity = Number.isInteger(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 0;
          const unlocked = prerequisitesMet(definition.requires, gameState);
          const totalCost: ResourceCost = {
            metal: definition.cost.metal * quantity,
            crystal: definition.cost.crystal * quantity,
            deuterium: definition.cost.deuterium * quantity,
          };
          const affordable = quantity > 0 && canAfford(totalCost, gameState);
          const canBuild = unlocked && affordable && quantity > 0;
          const unitBuildSeconds = shipBuildTime(
            definition.structuralIntegrity,
            gameState.planet.buildings.shipyard,
            gameState.planet.buildings.naniteFactory,
            gameState.settings.gameSpeed,
          );

          return (
            <article key={shipId} className="item-card">
              <div className="item-header">
                <h3>{definition.name}</h3>
                <span className="item-level number">
                  Owned: {gameState.planet.ships[shipId]}
                </span>
              </div>

              <p className="item-description">{definition.description}</p>

              <div className="ship-stats">
                <span className="ship-stat number">ATK {definition.weaponPower}</span>
                <span className="ship-stat number">SHD {definition.shieldPower}</span>
                <span className="ship-stat number">HULL {definition.structuralIntegrity}</span>
                <span className="ship-stat number">SPD {definition.speed}</span>
                <span className="ship-stat number">CARGO {definition.cargoCapacity}</span>
              </div>

              <div className="item-meta">
                <span className="label">Unit Build Time</span>
                <span className="number">{formatDuration(unitBuildSeconds)}</span>
              </div>

              <div className="item-meta">
                <span className="label">Batch Quantity</span>
                <input
                  className="input quantity-input number"
                  type="number"
                  min={1}
                  step={1}
                  value={quantityInput}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setQuantities((current) => ({
                      ...current,
                      [shipId]: nextValue,
                    }));
                  }}
                />
              </div>

              <div className="item-meta">
                <span className="label">Batch Cost</span>
                <CostDisplay cost={totalCost} available={gameState.planet.resources} />
              </div>

              {!unlocked && (
                <div className="requirements locked">
                  {definition.requires.map((prerequisite) => (
                    <span
                      key={`${shipId}-${prerequisite.type}-${prerequisite.id}`}
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
                      buildShips(shipId, quantity);
                    }
                  }}
                >
                  {unlocked ? 'Queue Build' : 'Locked'}
                </button>
                {quantity <= 0 && <span className="hint danger">Enter a valid quantity</span>}
                {quantity > 0 && !affordable && <span className="hint danger">Insufficient resources</span>}
              </div>
            </article>
          );
        })}
      </div>

      {gameState.planet.shipyardQueue.length > 0 && (
        <section className="panel-group">
          <h2 className="section-title">Shipyard Queue</h2>
          <div className="queue-list">
            {gameState.planet.shipyardQueue.map((item, index) => {
              const name = item.type === 'ship'
                ? SHIPS[item.id as ShipId].name
                : DEFENCES[item.id as DefenceId].name;
              const progress = index === 0
                ? `${(item.completed ?? 0) + 1}/${item.quantity}`
                : `0/${item.quantity}`;
              return (
                <div key={`${item.id}-${index}`} className="queue-entry">
                  <span className="queue-name">{name} ({progress})</span>
                  {index === 0 && (
                    <span className="queue-timer number">
                      {formatDuration(Math.max(0, (item.completesAt - Date.now()) / 1000))}
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => cancelShipyard(index)}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </section>
  );
}
