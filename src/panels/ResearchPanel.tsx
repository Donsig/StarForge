import { BUILDINGS } from '../data/buildings.ts';
import { RESEARCH, RESEARCH_ORDER } from '../data/research.ts';
import { canAfford, prerequisitesMet } from '../engine/BuildQueue.ts';
import { researchCostAtLevel, researchTime } from '../engine/FormulasEngine.ts';
import { useGame } from '../context/GameContext';
import { CostDisplay } from '../components/CostDisplay';
import { formatDuration } from '../utils/time.ts';
import type { GameState } from '../models/GameState.ts';
import type {
  BuildingId,
  Prerequisite,
  ResearchId,
} from '../models/types.ts';

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

export function ResearchPanel() {
  const { gameState, startResearchAction, adminCompleteResearch } = useGame();
  const planet = gameState.planets[gameState.activePlanetIndex];
  return (
    <section className="panel">
      <h1 className="panel-title">Research</h1>
      <p className="panel-subtitle">
        Unlock technologies that expand production, ship access, and combat capability.
      </p>

      {gameState.researchQueue.length > 0 && (
        <div className="panel-card">
          <h2 className="section-title">Research Queue</h2>
          {gameState.researchQueue.map((item, index) => (
            <div key={`${item.id}-${item.targetLevel}-${index}`} className="item-footer">
              <span>
                {RESEARCH[item.id as ResearchId].name} Lv {item.targetLevel ?? 0}
              </span>
              {gameState.settings.godMode && index === 0 && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => adminCompleteResearch()}
                >
                  ⚡ Complete
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="items-grid">
        {RESEARCH_ORDER.map((researchId) => {
          const definition = RESEARCH[researchId];
          const currentLevel = gameState.research[researchId];
          const nextLevel = currentLevel + 1;
          const cost = researchCostAtLevel(
            definition.baseCost,
            definition.costMultiplier,
            nextLevel,
          );
          const timeSeconds = researchTime(
            cost.metal,
            cost.crystal,
            planet.buildings.researchLab,
            gameState.settings.gameSpeed,
          );
          const affordable = canAfford(cost, gameState);
          const prereqMet = prerequisitesMet(definition.requires, gameState);
          const inQueue = gameState.researchQueue.some(q => q.id === researchId);
          const disabled = !affordable || !prereqMet;

          return (
            <article key={researchId} className="item-card">
              <div className="item-header">
                <h3>{definition.name}</h3>
                <span className="item-level number">Lv {currentLevel}</span>
              </div>

              <p className="item-description">{definition.description}</p>

              <div className="item-meta">
                <span className="label">Research Cost</span>
                <CostDisplay cost={cost} available={planet.resources} />
              </div>

              <div className="item-meta">
                <span className="label">Research Time</span>
                <span className="number">{formatDuration(timeSeconds)}</span>
              </div>

              {definition.requires.length > 0 && (
                <div className="requirements">
                  {definition.requires.map((prerequisite) => (
                    <span
                      key={`${researchId}-${prerequisite.type}-${prerequisite.id}`}
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
                    startResearchAction(researchId);
                  }}
                >
                  {inQueue ? `Queue Lv ${nextLevel}` : `Research Lv ${nextLevel}`}
                </button>
              </div>
            </article>
          );
        })}
      </div>

    </section>
  );
}
