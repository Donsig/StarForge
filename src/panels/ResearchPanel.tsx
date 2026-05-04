import type { CSSProperties } from 'react';
import { BUILDINGS } from '../data/buildings.ts';
import { RESEARCH, RESEARCH_ORDER } from '../data/research.ts';
import { canAfford, effectiveResearchLabLevel, prerequisitesMet } from '../engine/BuildQueue.ts';
import { researchCostAtLevel, researchTime } from '../engine/FormulasEngine.ts';
import { useGame } from '../context/GameContext';
import { useModal } from '../context/ModalContext';
import { PanelBanner } from '../components/PanelBanner';
import { LevelRing } from '../components/LevelRing';
import { CostDisplay } from '../components/CostDisplay';
import { QueueRow, getQueuedItemDuration } from '../components/QueueRow';
import { formatDuration } from '../utils/time.ts';
import type { GameState } from '../models/GameState.ts';
import type {
  BuildingId,
  Prerequisite,
  ResearchId,
} from '../models/types.ts';

type ResearchCategoryId = 'drive' | 'combat' | 'military' | 'intel';

const RESEARCH_CATEGORIES: Array<{
  id: ResearchCategoryId;
  label: string;
  color: string;
  icon: string;
}> = [
  { id: 'combat',   label: 'Energy & Weapons',     color: '#f87171', icon: '⬡' },
  { id: 'drive',    label: 'Propulsion',           color: '#30d5c8', icon: '◈' },
  { id: 'military', label: 'Military',             color: '#f0a832', icon: '◈' },
  { id: 'intel',    label: 'Intel & Exploration',  color: '#818cf8', icon: '⬡' },
];

const RESEARCH_CATEGORY: Record<ResearchId, ResearchCategoryId> = {
  energyTechnology:             'combat',
  laserTechnology:              'combat',
  ionTechnology:                'combat',
  plasmaTechnology:             'combat',
  combustionDrive:              'drive',
  impulseDrive:                 'drive',
  hyperspaceDrive:              'drive',
  hyperspaceTechnology:         'drive',
  weaponsTechnology:            'military',
  shieldingTechnology:          'military',
  armourTechnology:             'military',
  espionageTechnology:          'intel',
  computerTechnology:           'intel',
  astrophysicsTechnology:       'intel',
  intergalacticResearchNetwork: 'intel',
};

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

export function ResearchPanel() {
  const {
    gameState,
    startResearchAction,
    adminCompleteResearch,
    cancelResearch,
  } = useGame();
  const { open } = usePanelModal();
  const planet = gameState.planets[gameState.activePlanetIndex];

  return (
    <section className="panel research-panel">
      <PanelBanner
        panel="research"
        title="Research"
        subtitle="Advance your civilization through scientific breakthroughs."
      />

      {gameState.researchQueue.length > 0 && (
        <div className="construction-queue">
          <div className="construction-queue__title">Research Queue</div>
          {gameState.researchQueue.map((item, index) => (
            <QueueRow
              key={`${item.id}-${item.targetLevel}-${index}`}
              label={`Research: ${RESEARCH[item.id as ResearchId].name}`}
              subtitle={`Lv ${item.targetLevel ?? 0}${index > 0 ? ' (queued)' : ''}`}
              completesAt={index === 0 ? item.completesAt : null}
              duration={index > 0 ? getQueuedItemDuration(item) : undefined}
              startedAt={item.startedAt}
              totalDurationMs={item.completesAt - item.startedAt}
              onCancel={() => cancelResearch(index)}
              action={gameState.settings.godMode && index === 0 && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => adminCompleteResearch()}
                >
                  ⚡ Complete
                </button>
              )}
            />
          ))}
        </div>
      )}

      {RESEARCH_CATEGORIES.map((category) => {
        const categoryItems = RESEARCH_ORDER.filter((id) => RESEARCH_CATEGORY[id] === category.id);

        return (
          <section
            key={category.id}
            className={`panel-group research-section research-section--${category.id}`}
            style={{ '--cat-color': category.color } as CSSProperties}
          >
            <div className="category-header">
              <span className="category-header__icon" aria-hidden="true">
                {category.icon}
              </span>
              <h2 className="category-header__label">{category.label}</h2>
              <div className="category-header__rule" />
              <span className="research-section__count">{categoryItems.length} techs</span>
            </div>

            <div className="research-grid">
              {categoryItems.map((researchId) => {
                const definition = RESEARCH[researchId];
                const currentLevel = gameState.research[researchId];
                const queuedCount = gameState.researchQueue.filter((q) => q.id === researchId).length;
                const nextLevel = currentLevel + queuedCount + 1;
                const cost = researchCostAtLevel(
                  definition.baseCost,
                  definition.costMultiplier,
                  nextLevel,
                );
                const timeSeconds = researchTime(
                  cost.metal,
                  cost.crystal,
                  effectiveResearchLabLevel(gameState, {
                    type: 'research',
                    id: researchId,
                    targetLevel: nextLevel,
                    sourcePlanetIndex: gameState.activePlanetIndex,
                    startedAt: 0,
                    completesAt: 0,
                  }),
                  gameState.settings.gameSpeed,
                );
                const affordable = canAfford(cost, gameState);
                const prereqMet = prerequisitesMet(definition.requires, gameState);
                const inQueue = gameState.researchQueue.some(q => q.id === researchId);
                const disabled = !affordable || !prereqMet;

                return (
                  <article
                    key={researchId}
                    className={`research-card${currentLevel === 0 && !prereqMet ? ' research-card--locked' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
                      open('research', researchId);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
                      e.preventDefault();
                      open('research', researchId);
                    }}
                  >
                    <div className="research-card__header">
                      <LevelRing level={currentLevel} color={category.color} size={32} maxLevel={15} />
                      <div className="research-card__title-group">
                        <h3>{definition.name}</h3>
                        {currentLevel > 0 && (
                          <div className="research-card__level-up">
                            Level {currentLevel} → {currentLevel + 1}
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="research-card__description">{definition.description}</p>

                    {definition.requires.length > 0 && (
                      <div className="research-card__requirements">
                        {definition.requires.map((prerequisite) => (
                          <span
                            key={`${researchId}-${prerequisite.type}-${prerequisite.id}`}
                            className={`research-card__requirement ${
                              requirementMet(prerequisite, gameState) ? 'research-card__requirement--met' : 'research-card__requirement--unmet'
                            }`}
                          >
                            {requirementLabel(prerequisite)}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="research-card__meta">
                      <CostDisplay cost={cost} available={planet.resources} />
                      <span className="research-card__time">{formatDuration(timeSeconds)}</span>
                    </div>

                    <button
                      type="button"
                      className="research-card__button"
                      disabled={disabled}
                      onClick={() => {
                        startResearchAction(researchId);
                      }}
                    >
                      {inQueue
                        ? `Queue → Lv ${nextLevel}`
                        : currentLevel === 0
                          ? 'Research'
                          : `Research Lv ${nextLevel}`}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </section>
  );
}
