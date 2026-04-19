import { useState } from 'react';
import { BUILDING_IMAGES, SHIP_IMAGES } from '../data/assets.ts';
import { BUILDINGS, BUILDING_ORDER, type BuildingCategory } from '../data/buildings.ts';
import { RESEARCH } from '../data/research.ts';
import { SHIPS } from '../data/ships.ts';
import {
  canAfford,
  prerequisitesMet,
  usedFields,
} from '../engine/BuildQueue.ts';
import { buildingCostAtLevel, buildingTime } from '../engine/FormulasEngine.ts';
import { useGame } from '../context/GameContext';
import { PanelBanner } from '../components/PanelBanner';
import { CardImage } from '../components/CardImage';
import { LevelRing } from '../components/LevelRing';
import { CostDisplay } from '../components/CostDisplay';
import { QueueRow, getQueuedItemDuration } from '../components/QueueRow';
import { formatDuration } from '../utils/time.ts';
import type { GameState } from '../models/GameState.ts';
import type {
  BuildingId,
  Prerequisite,
  ResearchId,
  ResourceCost,
} from '../models/types.ts';

const CATEGORY_ORDER: BuildingCategory[] = ['resource', 'facility', 'storage'];

const CATEGORY_LABELS: Record<BuildingCategory, string> = {
  resource: 'Resource Buildings',
  facility: 'Facilities',
  storage: 'Storage',
};

const CATEGORY_ICONS: Record<BuildingCategory, string> = {
  resource: '⬡',
  facility: '◈',
  storage: '▣',
};

function requirementMet(prerequisite: Prerequisite, buildingState: GameState): boolean {
  const planet = buildingState.planets[buildingState.activePlanetIndex];
  if (prerequisite.type === 'building') {
    const level = planet.buildings[prerequisite.id as BuildingId];
    return level >= prerequisite.level;
  }

  const level = buildingState.research[prerequisite.id as ResearchId];
  return level >= prerequisite.level;
}

function requirementLabel(prerequisite: Prerequisite): string {
  if (prerequisite.type === 'building') {
    return `${BUILDINGS[prerequisite.id as BuildingId].name} ${prerequisite.level}`;
  }
  return `${RESEARCH[prerequisite.id as ResearchId].name} ${prerequisite.level}`;
}

export function BuildingsPanel() {
  const { gameState, upgradeBuilding, buildShips, adminCompleteBuilding } = useGame();
  const [satelliteQuantityInput, setSatelliteQuantityInput] = useState('1');
  const planet = gameState.planets[gameState.activePlanetIndex];

  const fieldsUsed = usedFields(gameState);
  const queuedUpgrades = planet.buildingQueue.length;
  const maxFieldsReached = fieldsUsed + queuedUpgrades >= planet.maxFields;
  const satelliteDefinition = SHIPS.solarSatellite;
  const parsedSatelliteQuantity = Number.parseInt(satelliteQuantityInput, 10);
  const satelliteQuantity =
    Number.isInteger(parsedSatelliteQuantity) && parsedSatelliteQuantity > 0
      ? parsedSatelliteQuantity
      : 0;
  const satelliteTotalCost: ResourceCost = {
    metal: satelliteDefinition.cost.metal * satelliteQuantity,
    crystal: satelliteDefinition.cost.crystal * satelliteQuantity,
    deuterium: satelliteDefinition.cost.deuterium * satelliteQuantity,
  };
  const satelliteUnlocked = planet.buildings.shipyard >= 1;
  const canBuildSatellites =
    satelliteUnlocked &&
    satelliteQuantity > 0 &&
    canAfford(satelliteTotalCost, gameState) &&
    prerequisitesMet(satelliteDefinition.requires, gameState);
  const satelliteEnergyPerUnit = Math.floor((planet.maxTemperature + 140) / 6);

  return (
    <section className="panel">
      <PanelBanner
        panel="buildings"
        title="Buildings"
        subtitle="Construct and upgrade structures that power your economy."
      />

      {planet.buildingQueue.length > 0 && (
        <div className="construction-queue">
          <div className="construction-queue__title">Construction Queue</div>
          {planet.buildingQueue.map((item, index) => (
            <QueueRow
              key={`${item.id}-${item.targetLevel}-${index}`}
              label={`Building: ${BUILDINGS[item.id as BuildingId].name}`}
              subtitle={`Lv ${item.targetLevel ?? 0}${index > 0 ? ' (queued)' : ''}`}
              completesAt={index === 0 ? item.completesAt : null}
              duration={index > 0 ? getQueuedItemDuration(item) : undefined}
              action={gameState.settings.godMode && index === 0 && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => adminCompleteBuilding(gameState.activePlanetIndex)}
                >
                  ⚡ Complete
                </button>
              )}
            />
          ))}
        </div>
      )}

      {CATEGORY_ORDER.map((category) => (
        <section key={category} className="panel-group">
          <div className="category-header">
            <span className="category-header__icon" aria-hidden="true">
              {CATEGORY_ICONS[category]}
            </span>
            <h2 className="category-header__label">{CATEGORY_LABELS[category]}</h2>
            <div className="category-header__rule" />
          </div>

          <div className="items-grid">
            {BUILDING_ORDER.filter((buildingId) => BUILDINGS[buildingId].category === category).map(
              (buildingId) => {
                const definition = BUILDINGS[buildingId];
                const currentLevel = planet.buildings[buildingId];
                const queuedCount = planet.buildingQueue.filter((q) => q.id === buildingId).length;
                const nextLevel = currentLevel + queuedCount + 1;
                const cost = buildingCostAtLevel(
                  definition.baseCost,
                  definition.costMultiplier,
                  nextLevel,
                );
                const timeSeconds = buildingTime(
                  cost.metal,
                  cost.crystal,
                  planet.buildings.roboticsFactory,
                  planet.buildings.naniteFactory,
                  gameState.settings.gameSpeed,
                );
                const affordable = canAfford(cost, gameState);
                const prereqMet = prerequisitesMet(definition.requires, gameState);
                const inQueue = planet.buildingQueue.some(q => q.id === buildingId);
                const disabled =
                  !affordable ||
                  !prereqMet ||
                  maxFieldsReached;

                return (
                  <article key={buildingId} className="item-card">
                    <CardImage
                      src={BUILDING_IMAGES[buildingId]}
                      label={buildingId}
                      height={110}
                    />
                    <div className="item-card__content">
                      <div className="item-header">
                        <h3>{definition.name}</h3>
                        <div className="item-level">
                          <LevelRing level={currentLevel} />
                        </div>
                      </div>

                      <p className="item-description">{definition.description}</p>

                      <div className="item-card__actions">
                        <div className="item-meta">
                          <span className="label">Upgrade Cost</span>
                          <span className="number">{formatDuration(timeSeconds)}</span>
                        </div>
                        <CostDisplay cost={cost} available={planet.resources} />

                        {definition.requires.length > 0 && (
                          <div className="requirements">
                            {definition.requires.map((prerequisite) => (
                              <span
                                key={`${buildingId}-${prerequisite.type}-${prerequisite.id}`}
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
                            className="item-action"
                            disabled={disabled}
                            onClick={() => {
                              upgradeBuilding(buildingId);
                            }}
                          >
                            {inQueue ? `Queue → Lv ${nextLevel}` : `Upgrade to Lv ${nextLevel}`}
                          </button>
                          {maxFieldsReached && (
                            <span className="hint danger">No free fields available</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              },
            )}
          </div>

          {category === 'resource' && (
            <>
              <h3 className="section-title">Energy</h3>
              <div className="items-grid">
                <article className="item-card">
                  <CardImage
                    src={SHIP_IMAGES.solarSatellite}
                    label="solarSatellite"
                    height={110}
                  />
                  <div className="item-card__content">
                    <div className="item-header">
                      <h3>Solar Satellites</h3>
                      <span className="item-level number">
                        Owned: {planet.ships.solarSatellite}
                      </span>
                    </div>

                    <p className="item-description">{satelliteDefinition.description}</p>

                    <div className="item-card__actions">
                      <div className="item-meta">
                        <span className="label">Cost per Satellite</span>
                        <CostDisplay cost={satelliteDefinition.cost} available={planet.resources} />
                      </div>

                      <div className="item-meta">
                        <span className="label">Energy per Satellite</span>
                        <span className="number">{satelliteEnergyPerUnit}</span>
                      </div>

                      <div className="item-meta">
                        <label className="label" htmlFor="solar-satellite-quantity">
                          Build Quantity
                        </label>
                        <input
                          id="solar-satellite-quantity"
                          className="input quantity-input number"
                          type="number"
                          min={1}
                          step={1}
                          value={satelliteQuantityInput}
                          onChange={(event) => {
                            setSatelliteQuantityInput(event.target.value);
                          }}
                        />
                      </div>

                      <div className="item-meta">
                        <span className="label">Batch Cost</span>
                        <CostDisplay cost={satelliteTotalCost} available={planet.resources} />
                      </div>

                      <div className="requirements">
                        <span className={`requirement ${satelliteUnlocked ? 'met' : 'unmet'}`}>
                          Shipyard 1
                        </span>
                      </div>

                      <div className="item-footer">
                        <button
                          type="button"
                          className="item-action"
                          disabled={!canBuildSatellites}
                          onClick={() => {
                            if (satelliteQuantity > 0) {
                              buildShips('solarSatellite', satelliteQuantity);
                            }
                          }}
                        >
                          {satelliteUnlocked ? 'Build' : 'Locked'}
                        </button>
                        {satelliteQuantity <= 0 && (
                          <span className="hint danger">Enter a valid quantity</span>
                        )}
                        {satelliteQuantity > 0 &&
                          satelliteUnlocked &&
                          !canAfford(satelliteTotalCost, gameState) && (
                            <span className="hint danger">Insufficient resources</span>
                          )}
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            </>
          )}
        </section>
      ))}
    </section>
  );
}
