import type { CSSProperties } from 'react';
import { BUILDING_IMAGES, DEFENCE_IMAGES, RESEARCH_IMAGES, SHIP_IMAGES } from '../../data/assets';
import { useGame } from '../../context/GameContext';
import { buildingTime, researchTime } from '../../engine/FormulasEngine';
import type { BuildingId, DefenceId, ResearchId, ShipId } from '../../models/types';
import {
  buildingProgression,
  cardStatsFor,
  researchProgression,
  TYPE_ACCENTS,
  type CardType,
} from '../../utils/cardDetails';
import { formatDuration } from '../../utils/time';

type DetailCard = { type: CardType; id: string };
type NextLevel = { level: number; benefit: string; metal: number; crystal: number; deuterium: number; energy: number; timeSeconds: number; label: 'Prod / hr' | 'Effect' };
type CostRow = { label: string; value: string; color: string };

const IMAGE_MAPS: Record<CardType, Partial<Record<string, string>>> = {
  building: BUILDING_IMAGES,
  research: RESEARCH_IMAGES,
  ship: SHIP_IMAGES,
  defence: DEFENCE_IMAGES,
};

const styles: Record<string, CSSProperties> = {
  aside: { height: '100%', background: 'rgba(5,8,20,0.4)', overflowY: 'auto' },
  imageWrap: { position: 'relative' },
  image: { width: '100%', height: 188, objectFit: 'cover', display: 'block' },
  placeholder: { height: 188, background: 'rgba(5,8,20,0.88)' },
  accentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  overlay: { position: 'absolute', inset: 0, background: 'linear-gradient(transparent 55%, rgba(5,8,20,0.92))' },
  pad: { padding: '0.75rem 0.8rem' },
  title: { fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.32rem' },
  stack: { display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' },
  label: { fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' },
  value: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 600, textAlign: 'right' },
  next: { borderTop: '1px solid rgba(40,60,120,0.28)', paddingTop: '0.6rem', marginTop: '0.75rem' },
  nextHead: { display: 'flex', alignItems: 'center', gap: '0.42rem', marginBottom: '0.45rem' },
  nextLabel: { fontFamily: 'var(--font-display)', fontSize: '0.6rem', fontWeight: 700, color: 'rgba(150,180,220,0.4)', textTransform: 'uppercase' },
  badge: { fontFamily: 'var(--font-display)', fontSize: '0.52rem', borderRadius: 3, padding: '0.03rem 0.28rem' },
  highlight: { borderBottom: '1px solid rgba(40,60,120,0.2)', paddingBottom: '0.22rem', marginBottom: '0.08rem' },
};

function hasOwnKey<T extends object>(object: T, key: PropertyKey): key is keyof T {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function formatNumber(value: number): string {
  const rounded = Math.round(value);
  if (!Number.isFinite(rounded)) return '0';
  if (rounded >= 1_000_000) return `${(rounded / 1_000_000).toFixed(1)}M`;
  if (rounded >= 1_000) return `${Math.round(rounded / 1_000)}K`;
  return String(rounded);
}

function formatSignedNumber(value: number): string {
  return `${value > 0 ? '+' : '-'}${formatNumber(Math.abs(value))}`;
}

function DetailRow({
  label,
  value,
  color,
  labelColor = 'rgba(150,180,220,0.38)',
  valueSize = '0.72rem',
  valueWeight = 600,
  style,
}: {
  label: string;
  value: string;
  color: string;
  labelColor?: string;
  valueSize?: string;
  valueWeight?: CSSProperties['fontWeight'];
  style?: CSSProperties;
}) {
  return (
    <div style={{ ...styles.row, ...style }}>
      <span style={{ ...styles.label, color: labelColor }}>{label}</span>
      <span style={{ ...styles.value, color, fontSize: valueSize, fontWeight: valueWeight }}>{value}</span>
    </div>
  );
}

export function LeftColumn({ card }: { card: DetailCard }) {
  const { gameState } = useGame();
  const planet = gameState.planets[gameState.activePlanetIndex] ?? gameState.planets[0];
  const accent = TYPE_ACCENTS[card.type];
  const imageUrl = IMAGE_MAPS[card.type][card.id] ?? null;
  const stats = cardStatsFor(card.type, card.id, gameState);
  const speed = gameState.settings.gameSpeed;
  let currentHeader = '—';
  let nextLevel: NextLevel | null = null;

  if (card.type === 'building' && planet && hasOwnKey(planet.buildings, card.id)) {
    const id = card.id as BuildingId;
    const currentLevel = planet.buildings[id] ?? 0;
    const queue = planet.buildingQueue.filter((item) => item.id === id);
    const nextRow = buildingProgression(id, currentLevel, queue, gameState).find((row) => row.next);
    currentHeader = `Level ${currentLevel}`;
    if (nextRow) {
      nextLevel = {
        ...nextRow,
        label: 'Prod / hr',
        timeSeconds: buildingTime(nextRow.metal, nextRow.crystal, planet.buildings.roboticsFactory, planet.buildings.naniteFactory, speed),
      };
    }
  } else if (card.type === 'research' && hasOwnKey(gameState.research, card.id)) {
    const id = card.id as ResearchId;
    const currentLevel = gameState.research[id] ?? 0;
    const queue = gameState.researchQueue.filter((item) => item.id === id);
    const nextRow = researchProgression(id, currentLevel, queue, gameState).find((row) => row.next);
    currentHeader = `Level ${currentLevel}`;
    if (nextRow) {
      nextLevel = { ...nextRow, label: 'Effect', timeSeconds: researchTime(nextRow.metal, nextRow.crystal, planet?.buildings.researchLab ?? 0, speed) };
    }
  } else if (card.type === 'ship' && planet && hasOwnKey(planet.ships, card.id)) {
    const id = card.id as ShipId;
    currentHeader = `×${planet.ships[id] ?? 0} in fleet`;
  } else if (card.type === 'defence' && planet && hasOwnKey(planet.defences, card.id)) {
    const id = card.id as DefenceId;
    currentHeader = `×${planet.defences[id] ?? 0} deployed`;
  }

  const nextCostRows: CostRow[] = nextLevel
    ? [
        { label: 'Metal', raw: nextLevel.metal, color: '#9ca3af' },
        { label: 'Crystal', raw: nextLevel.crystal, color: '#60a5fa' },
        { label: 'Deuterium', raw: nextLevel.deuterium, color: '#34d399' },
        { label: 'Energy', raw: nextLevel.energy, color: '#fbbf24', signed: true },
      ]
        .filter((row) => row.raw !== 0)
        .map(({ label, raw, color, signed }) => ({
          label,
          value: signed ? formatSignedNumber(raw) : formatNumber(raw),
          color,
        }))
    : [];

  return (
    <aside className="card-detail-modal__left" data-card-type={card.type} data-card-id={card.id} style={styles.aside}>
      <div style={styles.imageWrap}>
        {imageUrl ? <img src={imageUrl} alt="" style={styles.image} /> : <div style={styles.placeholder} />}
        <div aria-hidden="true" style={{ ...styles.accentBar, background: `linear-gradient(90deg, ${accent.c}, transparent)` }} />
        <div aria-hidden="true" style={styles.overlay} />
      </div>

      <div style={styles.pad}>
        <div style={{ ...styles.title, color: accent.c }}>{currentHeader}</div>
        <div style={styles.stack}>
          {stats.slice(0, 3).map((stat) => (
            <DetailRow key={`${stat.label}:${stat.value}`} label={stat.label} value={stat.value} color={stat.color} />
          ))}
        </div>

        {nextLevel ? (
          <div style={styles.next}>
            <div style={styles.nextHead}>
              <span style={styles.nextLabel}>Level {nextLevel.level}</span>
              <span style={{ ...styles.badge, color: accent.c, border: `1px solid ${accent.c}80` }}>NEXT</span>
            </div>
            <div style={styles.stack}>
              <DetailRow label={nextLevel.label} value={nextLevel.benefit} color={stats[0]?.color ?? accent.c} valueSize="0.76rem" valueWeight={700} style={styles.highlight} />
              {nextCostRows.map((row) => (
                <DetailRow key={row.label} label={row.label} value={row.value} color={row.color} />
              ))}
              <DetailRow label="Build Time" value={formatDuration(nextLevel.timeSeconds)} color="rgba(150,180,220,0.45)" labelColor="rgba(150,180,220,0.45)" />
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
