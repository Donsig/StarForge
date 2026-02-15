import { BUILDINGS, BUILDING_ORDER, type BuildingCategory } from '../data/buildings.ts';
import { RESEARCH } from '../data/research.ts';
import {
  canAfford,
  prerequisitesMet,
  usedFields,
} from '../engine/BuildQueue.ts';
import { buildingCostAtLevel, buildingTime } from '../engine/FormulasEngine.ts';
import { useGame } from '../context/GameContext';
import { CostDisplay } from '../components/CostDisplay';
import { formatDuration } from '../utils/time.ts';
import type { GameState } from '../models/GameState.ts';
import type {
  BuildingId,
  Prerequisite,
  ResearchId,
} from '../models/types.ts';

const CATEGORY_ORDER: BuildingCategory[] = ['resource', 'storage', 'facility'];

const CATEGORY_LABELS: Record<BuildingCategory, string> = {
  resource: 'Resource Buildings',
  storage: 'Storage Buildings',
  facility: 'Facilities',
};

function requirementMet(prerequisite: Prerequisite, buildingState: GameState): boolean {
  if (prerequisite.type === 'building') {
    const level = buildingState.planet.buildings[prerequisite.id as BuildingId];
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
  const { gameState, upgradeBuilding } = useGame();

  const buildingQueueOccupied = gameState.planet.buildingQueue.length > 0;
  const fieldsUsed = usedFields(gameState);
  const maxFieldsReached = fieldsUsed >= gameState.planet.maxFields;

  return (
    <section className="panel">
      <h1 className="panel-title">Buildings</h1>
      <p className="panel-subtitle">
        Construct and upgrade structures that power your economy and unlock advanced capabilities.
      </p>

      {CATEGORY_ORDER.map((category) => (
        <section key={category} className="panel-group">
          <h2 className="section-title">{CATEGORY_LABELS[category]}</h2>
          <div className="items-grid">
            {BUILDING_ORDER.filter((buildingId) => BUILDINGS[buildingId].category === category).map(
              (buildingId) => {
                const definition = BUILDINGS[buildingId];
                const currentLevel = gameState.planet.buildings[buildingId];
                const nextLevel = currentLevel + 1;
                const cost = buildingCostAtLevel(
                  definition.baseCost,
                  definition.costMultiplier,
                  nextLevel,
                );
                const timeSeconds = buildingTime(
                  cost.metal,
                  cost.crystal,
                  gameState.planet.buildings.roboticsFactory,
                  gameState.planet.buildings.naniteFactory,
                  gameState.settings.gameSpeed,
                );
                const affordable = canAfford(cost, gameState);
                const prereqMet = prerequisitesMet(definition.requires, gameState);
                const currentlyUpgrading = gameState.planet.buildingQueue[0]?.id === buildingId;
                const disabled =
                  !affordable ||
                  !prereqMet ||
                  buildingQueueOccupied ||
                  maxFieldsReached ||
                  currentlyUpgrading;

                return (
                  <article key={buildingId} className="item-card">
                    <div className="item-header">
                      <h3>{definition.name}</h3>
                      <span className="item-level number">Lv {currentLevel}</span>
                    </div>

                    <p className="item-description">{definition.description}</p>

                    <div className="item-meta">
                      <span className="label">Upgrade Cost</span>
                      <CostDisplay cost={cost} available={gameState.planet.resources} />
                    </div>

                    <div className="item-meta">
                      <span className="label">Build Time</span>
                      <span className="number">{formatDuration(timeSeconds)}</span>
                    </div>

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
                        className="btn btn-primary"
                        disabled={disabled}
                        onClick={() => {
                          upgradeBuilding(buildingId);
                        }}
                      >
                        {currentlyUpgrading ? 'In Progress' : `Upgrade to Lv ${nextLevel}`}
                      </button>
                      {buildingQueueOccupied && !currentlyUpgrading && (
                        <span className="hint">Building queue occupied</span>
                      )}
                      {maxFieldsReached && (
                        <span className="hint danger">No free fields available</span>
                      )}
                    </div>
                  </article>
                );
              },
            )}
          </div>
        </section>
      ))}
    </section>
  );
}
