import { useState } from 'react';
import { DEFENCE_IMAGES } from '../data/assets.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { DEFENCES, DEFENCE_ORDER } from '../data/defences.ts';
import { RESEARCH } from '../data/research.ts';
import { canAfford, prerequisitesMet } from '../engine/BuildQueue.ts';
import { defenceBuildTime } from '../engine/FormulasEngine.ts';
import { useGame } from '../context/GameContext';
import { PanelBanner } from '../components/PanelBanner';
import { CardImage } from '../components/CardImage';
import { CostDisplay } from '../components/CostDisplay';
import { formatCompact } from '../utils/format.ts';
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
  const defenceSummary = DEFENCE_ORDER.reduce(
    (totals, defenceId) => {
      const count = planet.defences[defenceId];
      const definition = DEFENCES[defenceId];

      totals.firepower += definition.weaponPower * count;
      totals.shield += definition.shieldPower * count;
      totals.units += count;

      return totals;
    },
    { firepower: 0, shield: 0, units: 0 },
  );
  const defenceStats = [
    {
      key: 'ATK',
      value: (defenceId: DefenceId) => DEFENCES[defenceId].weaponPower,
      colorClass: 'ship-stat-chip__value--attack',
    },
    {
      key: 'SHD',
      value: (defenceId: DefenceId) => DEFENCES[defenceId].shieldPower,
      colorClass: 'ship-stat-chip__value--shield',
    },
    {
      key: 'HULL',
      value: (defenceId: DefenceId) => DEFENCES[defenceId].structuralIntegrity,
      colorClass: 'ship-stat-chip__value--hull',
    },
  ];

  return (
    <section className="panel">
      <PanelBanner
        panel="defence"
        title="Defence"
        subtitle="Fortify your world against enemy incursions."
      />

      <div className="defence-summary">
        <div className="defence-summary__card">
          <div className="defence-summary__value defence-summary__value--attack">
            {formatCompact(defenceSummary.firepower)}
          </div>
          <div className="defence-summary__label">Total Firepower</div>
        </div>
        <div className="defence-summary__card">
          <div className="defence-summary__value defence-summary__value--shield">
            {formatCompact(defenceSummary.shield)}
          </div>
          <div className="defence-summary__label">Shield Rating</div>
        </div>
        <div className="defence-summary__card">
          <div className="defence-summary__value defence-summary__value--units">
            {formatCompact(defenceSummary.units)}
          </div>
          <div className="defence-summary__label">Defence Units</div>
        </div>
      </div>

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
          const buildLabel = !unlocked
            ? 'Locked'
            : maxReached
              ? 'Maxed'
              : `Build ${quantity > 0 ? quantity : '?'}`;

          return (
            <article key={defenceId} className="item-card item-card--defence">
              <CardImage
                src={DEFENCE_IMAGES[defenceId]}
                label={definition.name}
                height={90}
              />
              <div className="item-card__content">
                <div className="item-header">
                  <h3>{definition.name}</h3>
                  <span className="item-level item-level--owned item-level--owned-defence">
                    ×{formatCompact(ownedCount)}
                  </span>
                </div>

                <p className="item-description item-description--defence">{definition.description}</p>

                {definition.maxCount !== undefined && (
                  <div className="defence-limit-hint">
                    Max: {definition.maxCount} (Queued: {queuedCount})
                  </div>
                )}

                <div className="ship-stat-strip ship-stat-strip--defence">
                  {defenceStats.map((stat) => (
                    <div key={`${defenceId}-${stat.key}`} className="ship-stat-chip">
                      <span className={`ship-stat-chip__value ${stat.colorClass}`}>
                        {formatCompact(stat.value(defenceId))}
                      </span>
                      <span className="ship-stat-chip__label">{stat.key}</span>
                    </div>
                  ))}
                  <div className="ship-stat-strip__spacer" />
                  <div className="ship-stat-strip__time">
                    <span className="ship-stat-strip__time-value">
                      {formatDuration(unitBuildSeconds)}
                      /unit
                    </span>
                  </div>
                </div>

                <div className="item-card__actions item-card__actions--defence">
                  <div className="defence-cost-row">
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

                  <div className="ship-build-row">
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
                    <button
                      type="button"
                      className="item-action item-action--ship item-action--defence"
                      disabled={!canBuild}
                      onClick={() => {
                        if (quantity > 0) {
                          buildDefences(defenceId, quantity);
                        }
                      }}
                    >
                      {buildLabel}
                    </button>
                    <button
                      type="button"
                      className="ship-max-button"
                      disabled={maxReached}
                      onClick={() => {
                        const { metal, crystal, deuterium } = planet.resources;
                        const { cost } = definition;
                        const limits: number[] = [];
                        if (cost.metal > 0) limits.push(Math.floor(metal / cost.metal));
                        if (cost.crystal > 0) limits.push(Math.floor(crystal / cost.crystal));
                        if (cost.deuterium > 0) limits.push(Math.floor(deuterium / cost.deuterium));
                        let max = limits.length > 0 ? Math.max(0, Math.min(...limits)) : 0;
                        if (remainingMax !== null) {
                          max = Math.min(max, remainingMax);
                        }
                        setQuantities((current) => ({ ...current, [defenceId]: String(max) }));
                      }}
                    >
                      Max
                    </button>
                  </div>

                  {quantity <= 0 && <span className="hint danger">Enter a valid quantity</span>}
                  {maxReached && <span className="hint danger">Maximum built</span>}
                  {!maxReached && exceedsMax && (
                    <span className="hint danger">Max remaining: {remainingMax}</span>
                  )}
                  {quantity > 0 && !exceedsMax && !affordable && (
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
