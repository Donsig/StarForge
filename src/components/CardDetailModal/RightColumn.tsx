import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
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

const S = {
  column: { display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' },
  body: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' },
  footer: { flexShrink: 0, borderTop: '1px solid rgba(40,60,120,0.25)', padding: '0.8rem 1.1rem', background: 'rgba(5,8,20,0.55)', display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  title: { fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.04em', color: '#c8e0ff', margin: '0 0 0.45rem' },
  description: { fontFamily: 'var(--font-body)', fontSize: '0.79rem', color: 'rgba(150,180,220,0.62)', lineHeight: 1.55, margin: 0 },
  sectionLabel: { fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(150,180,220,0.32)', marginBottom: '0.42rem' },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.4rem' },
  statCell: { background: 'rgba(5,8,20,0.6)', border: '1px solid rgba(40,60,120,0.28)', borderRadius: 6, padding: '0.5rem 0.65rem', minWidth: 0 },
  statValue: { fontFamily: 'var(--font-mono)', fontSize: '0.88rem', fontWeight: 600, overflowWrap: 'anywhere' },
  statLabel: { fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(150,180,220,0.38)', marginTop: '0.1rem' },
  prereqWrap: { display: 'flex', flexWrap: 'wrap', gap: '0.3rem' },
  prereqPill: { borderRadius: 999, padding: '0.17rem 0.5rem', fontSize: '0.7rem' },
  emptyPrereq: { fontSize: '0.72rem', fontStyle: 'italic', color: 'rgba(150,180,220,0.4)' },
  placeholder: { padding: '0.5rem', border: '1px dashed rgba(40,60,120,0.4)', borderRadius: 6, color: 'rgba(150,180,220,0.4)', fontSize: '0.7rem' },
  unlockList: { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  unlockRow: { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'rgba(150,180,220,0.65)', minWidth: 0 },
  unlockDot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  unlockBadge: { fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0.18rem 0.5rem', borderRadius: 4, flexShrink: 0 },
  unlockLabel: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  unlockLevel: { marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'rgba(150,180,220,0.35)', whiteSpace: 'nowrap' },
  strategicNote: { padding: '0.55rem 0.7rem', background: 'rgba(5,8,20,0.5)', border: '1px solid rgba(40,60,120,0.3)', borderRadius: '0 6px 6px 0', fontSize: '0.76rem', color: 'rgba(150,180,220,0.62)', lineHeight: 1.5, fontStyle: 'italic' },
  footerTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.3rem' },
  costPills: { display: 'flex', flexWrap: 'wrap', gap: '0.3rem', minWidth: 0 },
  costPill: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem', background: 'rgba(10,14,30,0.85)', border: '1px solid rgba(60,80,140,0.4)', borderRadius: 4, padding: '0.15rem 0.45rem', whiteSpace: 'nowrap' },
  timeText: { fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'rgba(150,180,220,0.35)', whiteSpace: 'nowrap' },
  cta: { width: '100%', padding: '0.62rem 1rem', borderRadius: 6, fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase' },
  qtyPlaceholder: { display: 'flex' },
  qtyInput: { width: '100%', padding: '0.4rem 0.55rem', border: '1px solid rgba(60,80,140,0.4)', borderRadius: 4, background: 'rgba(10,14,30,0.85)', color: '#c8e0ff', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' },
} satisfies Record<string, CSSProperties>;

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
      <div style={S.sectionLabel}>{title}</div>
      {children}
    </section>
  );
}

function StatsSection({ label, stats }: { label: string; stats: CardStat[] }) {
  return (
    <Section title={label}>
      <div style={S.statGrid}>
        {stats.map((stat) => (
          <div key={`${stat.label}:${stat.value}`} style={S.statCell}>
            <div style={{ ...S.statValue, color: stat.color }}>{stat.value}</div>
            <div style={S.statLabel}>{stat.label}</div>
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
      <div style={S.unlockList}>
        {unlocks.map((entry) => {
          const accent = TYPE_ACCENTS[entry.type];
          return (
            <div key={`${entry.type}:${entry.id}:${entry.atLevel}`} style={S.unlockRow}>
              <span aria-hidden="true" style={{ ...S.unlockDot, background: accent.c, boxShadow: `0 0 5px ${accent.c}` }} />
              <span style={{ ...S.unlockBadge, color: accent.c, border: `1px solid ${accent.bd}`, background: accent.bg }}>{entry.type.toUpperCase()}</span>
              <span style={S.unlockLabel}>{entry.label}</span>
              <span style={S.unlockLevel}>at Lv {entry.atLevel}</span>
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
      <div style={{ ...S.strategicNote, borderLeft: `3px solid ${TYPE_ACCENTS[card.type].c}` }}>{note}</div>
    </Section>
  );
}

function CostPills({ cost }: { cost: ResourceCost }) {
  return (
    <div style={S.costPills}>
      {RESOURCE_KEYS.filter((key) => cost[key] > 0).map((key) => (
        <span key={key} style={{ ...S.costPill, color: RESOURCE_COLORS[key] }}>{RESOURCE_LABELS[key]} {formatCostValue(cost[key])}</span>
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
      style={{ ...S.cta, border: `1px solid ${accent.bd}`, background: disabled ? 'rgba(10,14,30,0.65)' : CTA_GRADIENTS[cardType], color: accent.c, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.58 : 1 }}
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
      <footer style={S.footer}>
        <div style={S.footerTop}><CostPills cost={cost} /><span style={S.timeText}>{formatDuration(seconds)}</span></div>
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
      <footer style={S.footer}>
        <div style={S.footerTop}><CostPills cost={cost} /><span style={S.timeText}>{formatDuration(seconds)}</span></div>
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
      <footer style={S.footer}>
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
    <footer style={S.footer}>
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
    <section className="card-detail-modal__right" data-card-type={card.type} data-card-id={card.id} style={S.column}>
      <div style={S.body}>
        <div>
          <h2 id={`card-detail-title-${card.id}`} style={S.title}>{definition.name}</h2>
          <p style={S.description}>{definition.description}</p>
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
