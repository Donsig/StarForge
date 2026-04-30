import { useEffect, useState, type ReactNode } from 'react';
import { BUILDINGS } from '../../data/buildings';
import { DEFENCES } from '../../data/defences';
import { RESEARCH } from '../../data/research';
import { SHIPS } from '../../data/ships';
import { getStrategicNote } from '../../data/strategicNotes';
import { useGame } from '../../context/GameContext';
import { canAfford, prerequisitesMet, usedFields } from '../../engine/BuildQueue';
import { buildingCostAtLevel, buildingTime, defenceBuildTime, researchCostAtLevel, researchTime, shipBuildTime } from '../../engine/FormulasEngine';
import type { GameState } from '../../models/GameState';
import type { PlanetState } from '../../models/Planet';
import type { BuildingId, DefenceId, Prerequisite, ResearchId, ResourceCost, ShipId } from '../../models/types';
import { buildingProgression, cardStatsFor, enablesFor, prereqRowsFor, researchProgression, TYPE_ACCENTS, type CardStat, type CardType } from '../../utils/cardDetails';
import { formatDuration } from '../../utils/time';
import { LevelTable } from './LevelTable';
import { PrereqPills } from './PrereqPills';
import { QuantityStepper } from './QuantityStepper';

type DetailCard = { type: CardType; id: string };
type DetailDefinition = { name: string; description: string; requires: Prerequisite[] };
type ResourceKey = keyof ResourceCost;

const RESOURCE_KEYS: ResourceKey[] = ['metal', 'crystal', 'deuterium'];
const RESOURCE_LABELS: Record<ResourceKey, string> = { metal: 'M', crystal: 'C', deuterium: 'D' };
const RESOURCE_COLORS: Record<ResourceKey, string> = { metal: '#9ca3af', crystal: '#60a5fa', deuterium: '#34d399' };
const CTA_GRADIENTS: Record<CardType, string> = {
  building: 'linear-gradient(135deg, rgba(77,143,255,0.22), rgba(77,143,255,0.42))',
  research: 'linear-gradient(135deg, rgba(129,140,248,0.22), rgba(129,140,248,0.42))',
  ship: 'linear-gradient(135deg, rgba(48,213,200,0.22), rgba(48,213,200,0.42))',
  defence: 'linear-gradient(135deg, rgba(240,168,50,0.22), rgba(240,168,50,0.42))',
};

function hasOwnKey<T extends object>(object: T, key: PropertyKey): key is keyof T {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function activePlanet(state: GameState): PlanetState | null {
  const fallback = state.planets[0];
  if (!fallback) return null;
  const index = Math.min(Math.max(0, Math.floor(state.activePlanetIndex)), state.planets.length - 1);
  return state.planets[index] ?? fallback;
}

function definitionFor(card: DetailCard): DetailDefinition | null {
  switch (card.type) {
    case 'building': return hasOwnKey(BUILDINGS, card.id) ? BUILDINGS[card.id] : null;
    case 'research': return hasOwnKey(RESEARCH, card.id) ? RESEARCH[card.id] : null;
    case 'ship': return hasOwnKey(SHIPS, card.id) ? SHIPS[card.id] : null;
    case 'defence': return hasOwnKey(DEFENCES, card.id) ? DEFENCES[card.id] : null;
  }
}

function formatCostValue(value: number): string {
  const rounded = Math.round(value);
  return Number.isFinite(rounded) ? rounded.toLocaleString('en-US') : '0';
}

function multiplyCost(cost: ResourceCost, quantity: number): ResourceCost {
  return { metal: cost.metal * quantity, crystal: cost.crystal * quantity, deuterium: cost.deuterium * quantity };
}

function statsLabelFor(type: CardType): string {
  switch (type) {
    case 'building': return 'Output';
    case 'research': return 'Effect';
    case 'ship':
    case 'defence': return 'Combat Stats';
  }
}

function queuedDefenceCount(planet: PlanetState, id: DefenceId): number {
  return planet.shipyardQueue.reduce((total, item) => {
    if (item.type !== 'defence' || item.id !== id) return total;
    const quantity = Math.max(0, Math.floor(item.quantity ?? 0));
    const completed = Math.max(0, Math.floor(item.completed ?? 0));
    return total + Math.max(0, quantity - completed);
  }, 0);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <div className="card-detail-modal__section-label">{title}</div>
      {children}
    </section>
  );
}

function StatsSection({ label, stats }: { label: string; stats: CardStat[] }) {
  return (
    <Section title={label}>
      <div className="card-detail-modal__stat-grid">
        {stats.map((stat) => (
          <div key={`${stat.label}:${stat.value}`} className="card-detail-modal__stat-cell">
            <div className="card-detail-modal__stat-value" style={{ color: stat.color }}>{stat.value}</div>
            <div className="card-detail-modal__stat-label">{stat.label}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function PrerequisitesSection({ requires, gameState }: { requires: Prerequisite[]; gameState: GameState }) {
  return (
    <Section title="Prerequisites">
      <PrereqPills rows={prereqRowsFor(requires, gameState)} />
    </Section>
  );
}

function LevelProgressionSection({ card, gameState }: { card: DetailCard; gameState: GameState }) {
  const planet = activePlanet(gameState);

  if (card.type === 'building') {
    if (planet === null || !hasOwnKey(BUILDINGS, card.id)) return null;
    const id = card.id as BuildingId;
    const currentLevel = planet.buildings[id] ?? 0;
    const queue = planet.buildingQueue.filter((item) => item.id === id);
    const progressionRows = buildingProgression(id, currentLevel, queue, gameState);

    return (
      <Section title="Level Progression">
        <LevelTable rows={progressionRows} accentColor={TYPE_ACCENTS[card.type].c} />
      </Section>
    );
  }

  if (card.type === 'research') {
    if (!hasOwnKey(RESEARCH, card.id)) return null;
    const id = card.id as ResearchId;
    const currentLevel = gameState.research[id] ?? 0;
    const queue = gameState.researchQueue.filter((item) => item.id === id);
    const progressionRows = researchProgression(id, currentLevel, queue, gameState);

    return (
      <Section title="Level Progression">
        <LevelTable rows={progressionRows} accentColor={TYPE_ACCENTS[card.type].c} />
      </Section>
    );
  }

  return (
    null
  );
}

function UnlocksSection({ card }: { card: DetailCard }) {
  const unlocks = enablesFor(card.type, card.id);
  if (unlocks.length === 0) return null;
  return (
    <Section title="Unlocks">
      <div className="card-detail-modal__unlock-list">
        {unlocks.map((entry) => {
          const accent = TYPE_ACCENTS[entry.type];
          return (
            <div key={`${entry.type}:${entry.id}:${entry.atLevel}`} className="card-detail-modal__unlock-row">
              <span
                aria-hidden="true"
                className="card-detail-modal__unlock-dot"
                style={{ background: accent.c, boxShadow: `0 0 5px ${accent.c}` }}
              />
              <span
                className="card-detail-modal__unlock-badge"
                style={{ color: accent.c, border: `1px solid ${accent.bd}`, background: accent.bg }}
              >
                {entry.type.toUpperCase()}
              </span>
              <span className="card-detail-modal__unlock-label">{entry.label}</span>
              <span className="card-detail-modal__unlock-level">at Lv {entry.atLevel}</span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function StrategicNotesSection({ card }: { card: DetailCard }) {
  const note = getStrategicNote(card.type, card.id);
  if (note === undefined) return null;
  return (
    <Section title="Strategic Notes">
      <div className="card-detail-modal__strategic-note" style={{ borderLeft: `3px solid ${TYPE_ACCENTS[card.type].c}` }}>{note}</div>
    </Section>
  );
}

function CostPills({ cost }: { cost: ResourceCost }) {
  return (
    <div className="card-detail-modal__cost-pills">
      {RESOURCE_KEYS.filter((key) => cost[key] > 0).map((key) => (
        <span key={key} className="card-detail-modal__cost-pill" style={{ color: RESOURCE_COLORS[key] }}>{RESOURCE_LABELS[key]} {formatCostValue(cost[key])}</span>
      ))}
    </div>
  );
}

function CtaButton({ cardType, disabled, onClick, children }: { cardType: CardType; disabled: boolean; onClick: () => void; children: string }) {
  const accent = TYPE_ACCENTS[cardType];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="card-detail-modal__cta"
      style={{ border: `1px solid ${accent.bd}`, background: disabled ? 'rgba(10,14,30,0.65)' : CTA_GRADIENTS[cardType], color: accent.c, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.58 : 1 }}
    >
      {children}
    </button>
  );
}

function Footer({ card }: { card: DetailCard }) {
  const { gameState, upgradeBuilding, startResearchAction, buildShips, buildDefences } = useGame();
  const planet = activePlanet(gameState);
  const [qty, setQty] = useState(1);
  const speed = gameState.settings.gameSpeed;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: stepper qty resets to 1 only when the card identity changes (e.g. modal swaps via prereq nav); no loop because card.type/card.id are stable across renders within a single open card.
    setQty(1);
  }, [card.type, card.id]);

  if (planet === null) return null;

  if (card.type === 'building') {
    if (!hasOwnKey(BUILDINGS, card.id)) return null;
    const id = card.id as BuildingId;
    const definition = BUILDINGS[id];
    const currentLevel = planet.buildings[id] ?? 0;
    const queue = planet.buildingQueue.filter((item) => item.id === id);
    const nextLevel = currentLevel + queue.length + 1;
    const cost = buildingCostAtLevel(definition.baseCost, definition.costMultiplier, nextLevel);
    const seconds = buildingTime(cost.metal, cost.crystal, planet.buildings.roboticsFactory, planet.buildings.naniteFactory, speed);
    const maxFieldsReached = planet.maxFields ? usedFields(gameState) + planet.buildingQueue.length >= planet.maxFields : false;
    const disabled = !canAfford(cost, gameState) || !prerequisitesMet(definition.requires, gameState) || maxFieldsReached;
    const label = queue.length > 0 ? `Queue → Lv ${nextLevel}` : `Upgrade to Lv ${nextLevel}`;
    return (
      <footer className="card-detail-modal__footer">
        <div className="card-detail-modal__footer-top"><CostPills cost={cost} /><span className="card-detail-modal__time">{formatDuration(seconds)}</span></div>
        <CtaButton cardType={card.type} disabled={disabled} onClick={() => { upgradeBuilding(id); }}>{label}</CtaButton>
      </footer>
    );
  }

  if (card.type === 'research') {
    if (!hasOwnKey(RESEARCH, card.id)) return null;
    const id = card.id as ResearchId;
    const definition = RESEARCH[id];
    const currentLevel = gameState.research[id] ?? 0;
    const queue = gameState.researchQueue.filter((item) => item.id === id);
    const nextLevel = currentLevel + queue.length + 1;
    const cost = researchCostAtLevel(definition.baseCost, definition.costMultiplier, nextLevel);
    const seconds = researchTime(cost.metal, cost.crystal, planet.buildings.researchLab, speed);
    const disabled = !canAfford(cost, gameState) || !prerequisitesMet(definition.requires, gameState);
    const label = queue.length > 0 ? `Queue → Lv ${nextLevel}` : `Upgrade to Lv ${nextLevel}`;
    return (
      <footer className="card-detail-modal__footer">
        <div className="card-detail-modal__footer-top"><CostPills cost={cost} /><span className="card-detail-modal__time">{formatDuration(seconds)}</span></div>
        <CtaButton cardType={card.type} disabled={disabled} onClick={() => { startResearchAction(id); }}>{label}</CtaButton>
      </footer>
    );
  }

  if (card.type === 'ship') {
    if (!hasOwnKey(SHIPS, card.id)) return null;
    const id = card.id as ShipId;
    const definition = SHIPS[id];
    const totalCost = multiplyCost(definition.cost, qty);
    const unitTimeSeconds = shipBuildTime(definition.structuralIntegrity, planet.buildings.shipyard, planet.buildings.naniteFactory, speed);
    const disabled = qty < 1 || !canAfford(totalCost, gameState) || !prerequisitesMet(definition.requires, gameState);
    return (
      <footer className="card-detail-modal__footer">
        <QuantityStepper qty={qty} setQty={setQty} cost={definition.cost} timeSeconds={unitTimeSeconds} type={card.type} resources={planet.resources} />
        <CtaButton cardType={card.type} disabled={disabled} onClick={() => { if (buildShips(id, qty)) setQty(1); }}>{`Build Ships ×${qty}`}</CtaButton>
      </footer>
    );
  }

  if (!hasOwnKey(DEFENCES, card.id)) return null;
  const id = card.id as DefenceId;
  const definition = DEFENCES[id];
  const existingCount = (planet.defences[id] ?? 0) + queuedDefenceCount(planet, id);
  const totalCost = multiplyCost(definition.cost, qty);
  const unitTimeSeconds = defenceBuildTime(definition.structuralIntegrity, planet.buildings.shipyard, planet.buildings.naniteFactory, speed);
  const exceedsMaxCount = definition.maxCount !== undefined && existingCount + qty > definition.maxCount;
  const disabled = qty < 1 || !canAfford(totalCost, gameState) || !prerequisitesMet(definition.requires, gameState) || exceedsMaxCount;

  return (
    <footer className="card-detail-modal__footer">
      <QuantityStepper qty={qty} setQty={setQty} cost={definition.cost} timeSeconds={unitTimeSeconds} type={card.type} resources={planet.resources} maxCount={definition.maxCount} existingCount={existingCount} />
      <CtaButton cardType={card.type} disabled={disabled} onClick={() => { if (buildDefences(id, qty)) setQty(1); }}>{`Construct ×${qty}`}</CtaButton>
    </footer>
  );
}

export function RightColumn({ card }: { card: { type: CardType; id: string } }) {
  const { gameState } = useGame();
  const definition = definitionFor(card);
  if (definition === null) return <></>;

  return (
    <section className="card-detail-modal__right" data-card-type={card.type} data-card-id={card.id}>
      <div className="card-detail-modal__scroll-body">
        <div>
          <h2 id={`card-detail-title-${card.id}`} className="card-detail-modal__title">{definition.name}</h2>
          <p className="card-detail-modal__description">{definition.description}</p>
        </div>
        <StatsSection label={statsLabelFor(card.type)} stats={cardStatsFor(card.type, card.id, gameState)} />
        <PrerequisitesSection requires={definition.requires} gameState={gameState} />
        {card.type === 'building' || card.type === 'research' ? <LevelProgressionSection card={card} gameState={gameState} /> : null}
        <UnlocksSection card={card} />
        <StrategicNotesSection card={card} />
      </div>
      <Footer card={card} />
    </section>
  );
}
