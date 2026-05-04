import { useState } from 'react';
import { SHIP_IMAGES } from '../data/assets.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { DEFENCES } from '../data/defences.ts';
import { RESEARCH } from '../data/research.ts';
import { SHIP_ORDER, SHIPS } from '../data/ships.ts';
import { canAfford, prerequisitesMet } from '../engine/BuildQueue.ts';
import { shipBuildTime } from '../engine/FormulasEngine.ts';
import { useGame } from '../context/GameContext';
import { useModal } from '../context/ModalContext';
import { PanelBanner } from '../components/PanelBanner';
import { CardImage } from '../components/CardImage';
import { CostDisplay } from '../components/CostDisplay';
import { QueueRow, getQueuedItemDuration } from '../components/QueueRow';
import { formatCompact } from '../utils/format.ts';
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

const INTERACTIVE_SELECTOR = 'button, input, select, textarea, a';

const FALLBACK_MODAL: ReturnType<typeof useModal> = {
  selectedCard: null,
  open: () => {},
  close: () => {},
  restoreFocus: () => {},
};

function usePanelModal(): ReturnType<typeof useModal> {
  try {
    return useModal();
  } catch (error) {
    if (error instanceof Error && error.message === 'useModal must be used within a ModalProvider') {
      return FALLBACK_MODAL;
    }
    throw error;
  }
}

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

export function ShipyardPanel() {
  const {
    gameState,
    buildShips,
    adminCompleteShipyard,
    cancelShipyard,
  } = useGame();
  const { open } = usePanelModal();
  const [quantities, setQuantities] = useState<Record<ShipId, string>>(DEFAULT_QUANTITIES);
  const planet = gameState.planets[gameState.activePlanetIndex];
  const shipStats = [
    {
      key: 'ATK',
      value: (shipId: ShipId) => SHIPS[shipId].weaponPower,
      colorClass: 'ship-stat-chip__value--attack',
    },
    {
      key: 'SHD',
      value: (shipId: ShipId) => SHIPS[shipId].shieldPower,
      colorClass: 'ship-stat-chip__value--shield',
    },
    {
      key: 'HULL',
      value: (shipId: ShipId) => SHIPS[shipId].structuralIntegrity,
      colorClass: 'ship-stat-chip__value--hull',
    },
    {
      key: 'CARGO',
      value: (shipId: ShipId) => SHIPS[shipId].cargoCapacity,
      colorClass: 'ship-stat-chip__value--cargo',
    },
    {
      key: 'SPD',
      value: (shipId: ShipId) => SHIPS[shipId].speed,
      colorClass: 'ship-stat-chip__value--speed',
    },
  ];

  return (
    <section className="panel">
      <PanelBanner
        panel="shipyard"
        title="Shipyard"
        subtitle="Construct vessels for combat, colonisation, and logistics."
      />

      {planet.shipyardQueue.length > 0 && (
        <div className="construction-queue">
          <div className="construction-queue__title">Shipyard Queue</div>
          {planet.shipyardQueue.map((item, index) => (
            <QueueRow
              key={`${item.id}-${item.type}-${index}`}
              label={`Shipyard: ${item.type === 'defence'
                ? DEFENCES[item.id as DefenceId].name
                : SHIPS[item.id as ShipId].name}`}
              subtitle={`${index === 0 ? `${(item.completed ?? 0) + 1}/${item.quantity}` : `0/${item.quantity}`}${index > 0 ? ' (queued)' : ''}`}
              completesAt={index === 0 ? item.completesAt : null}
              duration={index > 0 ? getQueuedItemDuration(item) : undefined}
              startedAt={item.startedAt}
              totalDurationMs={item.completesAt - item.startedAt}
              onCancel={() => cancelShipyard(index)}
              action={gameState.settings.godMode && index === 0 && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => adminCompleteShipyard(gameState.activePlanetIndex)}
                >
                  ⚡ Complete
                </button>
              )}
            />
          ))}
        </div>
      )}

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
            planet.buildings.shipyard,
            planet.buildings.naniteFactory,
            gameState.settings.gameSpeed,
          );

          return (
            <article
              key={shipId}
              className="item-card item-card--ship"
              role="button"
              tabIndex={0}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
                open('ship', shipId);
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
                e.preventDefault();
                open('ship', shipId);
              }}
            >
              <CardImage
                src={SHIP_IMAGES[shipId]}
                label={shipId}
                height={100}
              />
              <div className="item-card__content">
                <div className="item-header">
                  <h3>{definition.name}</h3>
                  <span className="item-level item-level--owned">
                    ×{formatCompact(planet.ships[shipId])}
                  </span>
                </div>

                <p className="item-description item-description--ship">{definition.description}</p>

                <div className="ship-stat-strip">
                  {shipStats.map((stat) => (
                    <div key={`${shipId}-${stat.key}`} className="ship-stat-chip">
                      <span className={`ship-stat-chip__value ${stat.colorClass}`}>
                        {formatCompact(stat.value(shipId))}
                      </span>
                      <span className="ship-stat-chip__label">{stat.key}</span>
                    </div>
                  ))}
                </div>

                <div className="item-card__actions item-card__actions--ship">
                  <div className="ship-cost-row">
                    <CostDisplay cost={totalCost} available={planet.resources} />
                    <span className="ship-cost-row__time">
                      {formatDuration(unitBuildSeconds)}
                      /unit
                    </span>
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

                  <div className="ship-build-row">
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
                    <button
                      type="button"
                      className="item-action item-action--ship"
                      disabled={!canBuild}
                      onClick={() => {
                        if (quantity > 0) {
                          buildShips(shipId, quantity);
                        }
                      }}
                    >
                      {unlocked ? `Build ${quantity > 0 ? quantity : '?'}` : 'Locked'}
                    </button>
                    <button
                      type="button"
                      className="ship-max-button"
                      onClick={() => {
                        const { metal, crystal, deuterium } = planet.resources;
                        const { cost } = definition;
                        const limits: number[] = [];
                        if (cost.metal > 0) limits.push(Math.floor(metal / cost.metal));
                        if (cost.crystal > 0) limits.push(Math.floor(crystal / cost.crystal));
                        if (cost.deuterium > 0) limits.push(Math.floor(deuterium / cost.deuterium));
                        const max = limits.length > 0 ? Math.max(0, Math.min(...limits)) : 0;
                        setQuantities((current) => ({ ...current, [shipId]: String(max) }));
                      }}
                    >
                      Max
                    </button>
                  </div>

                  {quantity <= 0 && <span className="hint danger">Enter a valid quantity</span>}
                  {quantity > 0 && !affordable && (
                    <span className="hint danger">Insufficient resources</span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
