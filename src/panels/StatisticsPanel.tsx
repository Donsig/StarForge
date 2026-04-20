import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { formatNumber } from '../utils/format.ts';
import { computeRankings, type RankingEntry } from '../utils/rankings.ts';
import { SHIP_ORDER } from '../data/ships.ts';

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="stats-score-bar">
      <div
        className="stats-score-bar-fill"
        style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}60` }}
      />
    </div>
  );
}

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  const height = 28;
  const w = 120;
  const max = Math.max(...values, 1);
  const barW = values.length > 0 ? Math.floor(w / values.length) - 1 : w - 1;
  return (
    <svg className="stats-sparkline" width={w} height={height} style={{ display: 'block' }}>
      {values.map((v, i) => {
        const bh = Math.max(2, Math.round((v / max) * height));
        return (
          <rect
            key={i}
            x={i * (barW + 1)}
            y={height - bh}
            width={barW}
            height={bh}
            fill={color}
            opacity={0.6 + (i / Math.max(values.length, 1)) * 0.4}
            rx={1}
          />
        );
      })}
    </svg>
  );
}

type SortKey = 'economy' | 'research' | 'military' | 'fleet' | 'total';

interface SortableColHeader {
  key: SortKey;
  label: string;
}

const SORTABLE_COLUMNS: SortableColHeader[] = [
  { key: 'economy', label: 'Economy' },
  { key: 'research', label: 'Research' },
  { key: 'military', label: 'Military' },
  { key: 'fleet', label: 'Fleet' },
  { key: 'total', label: 'Total' },
];

function RankingsTable({ rankings }: { rankings: RankingEntry[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('total');

  const sorted = [...rankings]
    .sort((a, b) => b[sortKey] - a[sortKey])
    .map((entry, i) => ({ ...entry, displayRank: i + 1 }));

  const topTotal = sorted[0]?.total || 1;

  const categoryColors: Record<string, string> = {
    economy: '#34d399',
    research: '#818cf8',
    military: '#f87171',
    fleet: '#4d8fff',
  };

  return (
    <div role="table" className="stats-rankings-card">
      {/* Header row */}
      <div role="rowgroup">
        <div role="row" className="stats-rankings-row stats-rankings-row--header">
          {/* Rank column — not sortable */}
          <div
            role="columnheader"
            aria-label="Rank"
            className="stats-rank-cell stats-col-header"
            data-col-label="#"
          />
          {/* Commander name column — not sortable */}
          <div
            role="columnheader"
            aria-label="Commander"
            className="stats-col-header"
            data-col-label="Commander"
            style={{ textAlign: 'left' }}
          />
          {/* Sortable columns */}
          {SORTABLE_COLUMNS.map((col) => (
            <div
              key={col.key}
              role="columnheader"
              aria-label={col.label}
              aria-sort={sortKey === col.key ? 'descending' : 'none'}
              onClick={() => setSortKey(col.key)}
              className="stats-col-header stats-col-header--sortable"
              data-col-label={col.key === sortKey ? `${col.label} ▼` : col.label}
              data-active={sortKey === col.key ? 'true' : undefined}
            />
          ))}
        </div>
      </div>

      {/* Body rows */}
      <div role="rowgroup">
        {sorted.map((entry) => {
          const medalNumerals = ['①', '②', '③'];
          const rankDisplay =
            entry.displayRank <= 3 ? medalNumerals[entry.displayRank - 1] : entry.displayRank;
          return (
            <div
              key={entry.name}
              role="row"
              className={`stats-rankings-row${entry.isPlayer ? ' stats-rankings-row--player' : ''}`}
              onMouseEnter={(e) => {
                if (!entry.isPlayer) {
                  (e.currentTarget as HTMLDivElement).style.background =
                    'rgba(255,255,255,0.025)';
                }
              }}
              onMouseLeave={(e) => {
                if (!entry.isPlayer) {
                  (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                }
              }}
            >
              <div
                role="cell"
                className={`stats-rank-cell${
                  entry.displayRank <= 3 ? ` stats-rank-medal-${entry.displayRank}` : ''
                }`}
              >
                {rankDisplay}
              </div>
              <div
                role="cell"
                style={{ padding: '0.5rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <span
                  style={{
                    fontSize: '0.85rem',
                    color: entry.isPlayer ? '#4d8fff' : '#c8e0ff',
                    fontWeight: entry.isPlayer ? 600 : 400,
                  }}
                >
                  {entry.name}
                </span>
                {entry.isPlayer && (
                  <span
                    style={{
                      fontSize: '0.62rem',
                      padding: '0.08rem 0.4rem',
                      borderRadius: 999,
                      background: 'rgba(77,143,255,0.2)',
                      border: '1px solid rgba(77,143,255,0.4)',
                      color: '#4d8fff',
                    }}
                  >
                    You
                  </span>
                )}
              </div>
              {(['economy', 'research', 'military', 'fleet'] as const).map((k) => (
                <div
                  key={k}
                  role="cell"
                  style={{
                    padding: '0.5rem 0.6rem',
                    textAlign: 'right',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.75rem',
                    color:
                      sortKey === k ? categoryColors[k] : 'rgba(150,180,220,0.7)',
                  }}
                >
                  {formatNumber(entry[k])}
                </div>
              ))}
              <div
                role="cell"
                style={{
                  padding: '0.5rem 0.6rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  justifyContent: 'flex-end',
                }}
              >
                <div className="stats-total-bar">
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, (entry.total / topTotal) * 100)}%`,
                      background: entry.isPlayer
                        ? '#4d8fff'
                        : 'rgba(150,180,220,0.3)',
                      borderRadius: 2,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.78rem',
                    color: '#c8e0ff',
                    minWidth: 52,
                    textAlign: 'right',
                  }}
                >
                  {formatNumber(entry.total)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function StatisticsPanel() {
  const { gameState } = useGame();
  const { statistics, playerScores, planets, fleetNotifications } = gameState;

  const stats = statistics as typeof statistics & {
    productionHistory: {
      metal: number[];
      crystal: number[];
      deuterium: number[];
      lastSampleAt: number;
    };
    totalBuilt: Partial<Record<string, number>>;
  };

  const rankings = computeRankings(gameState);
  const playerRankIndex = rankings.findIndex((r) => r.isPlayer);
  const playerRank = playerRankIndex >= 0 ? playerRankIndex + 1 : rankings.length;
  const totalPlayers = rankings.length;

  // Debris harvested = sum of metal + crystal loot from harvest notifications
  const debrisHarvested = fleetNotifications
    .filter((n) => n.missionType === 'harvest' && n.loot)
    .reduce((sum, n) => sum + (n.loot?.metal ?? 0) + (n.loot?.crystal ?? 0), 0);

  // Win rate
  const won = statistics.combat.won;
  const lost = statistics.combat.lost;
  const winRateDisplay = won + lost > 0 ? `${Math.round((won / (won + lost)) * 100)}%` : '—';

  // Ships built — sum over all known ShipId values
  const shipsBuilt = SHIP_ORDER.reduce((sum, id) => sum + (stats.totalBuilt?.[id] ?? 0), 0);

  // Score breakdown
  const total = playerScores.total;
  const scoreRows: { key: 'economy' | 'research' | 'military' | 'fleet'; label: string; color: string }[] = [
    { key: 'economy', label: 'Economy', color: '#34d399' },
    { key: 'research', label: 'Research', color: '#818cf8' },
    { key: 'military', label: 'Military', color: '#f87171' },
    { key: 'fleet', label: 'Fleet', color: '#4d8fff' },
  ];

  // Production history
  const ph = stats.productionHistory ?? { metal: [], crystal: [], deuterium: [], lastSampleAt: 0 };
  const hasHistory = ph.metal.length > 0;

  const productionRows: { label: string; values: number[]; color: string }[] = [
    { label: 'Metal', values: ph.metal, color: '#9ca3af' },
    { label: 'Crystal', values: ph.crystal, color: '#60a5fa' },
    { label: 'Deuterium', values: ph.deuterium, color: '#34d399' },
  ];

  return (
    <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="stats-header">
        <h1
          style={{
            margin: '0 0 0.2rem',
            fontFamily: 'var(--font-display, Orbitron, sans-serif)',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#c8e0ff',
            letterSpacing: '0.06em',
          }}
        >
          Statistics
        </h1>
        <p className="stats-subtitle">
          {`Ranked #${playerRank} of ${totalPlayers} commanders · ${formatNumber(total)} total points`}
        </p>
      </div>

      {/* ── Score Breakdown ─────────────────────────────────── */}
      <div className="stats-score-card">
        <h2
          style={{
            margin: '0 0 0.85rem',
            fontFamily: 'var(--font-display, Orbitron, sans-serif)',
            fontSize: '0.68rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'rgba(120,150,200,0.45)',
            fontWeight: 600,
          }}
        >
          Score Breakdown
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          {scoreRows.map((row) => {
            const val = playerScores[row.key] ?? 0;
            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
            return (
              <div key={row.key} className="stats-score-row">
                <span
                  style={{
                    width: 80,
                    fontSize: '0.78rem',
                    color: 'rgba(150,180,220,0.65)',
                    flexShrink: 0,
                  }}
                >
                  {row.label}
                </span>
                <ScoreBar value={val} max={total} color={row.color} />
                <span
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.75rem',
                    color: row.color,
                    textAlign: 'right',
                    width: 70,
                    flexShrink: 0,
                  }}
                >
                  {formatNumber(val)}
                </span>
                <span
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.68rem',
                    color: 'rgba(120,150,200,0.4)',
                    textAlign: 'right',
                    width: 40,
                    flexShrink: 0,
                  }}
                >
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Battle Stats ──────────────────────────────────────── */}
      <div className="stats-battle-grid">
        {[
          { label: 'Raids Won', value: String(won), color: '#34d399' },
          { label: 'Raids Lost', value: String(lost), color: '#f87171' },
          {
            label: 'Debris Harvested',
            value: formatNumber(debrisHarvested),
            color: '#30d5c8',
          },
          { label: 'Colonies', value: String(planets.length), color: '#4d8fff' },
          { label: 'Win Rate', value: winRateDisplay, color: '#f0a832' },
          {
            label: 'Ships Built',
            value: shipsBuilt > 0 ? formatNumber(shipsBuilt) : '0',
            color: '#818cf8',
          },
        ].map((card) => (
          <div key={card.label} className="stats-battle-card">
            <div className="stats-battle-value" style={{ color: card.color }}>
              {card.value}
            </div>
            <div className="stats-battle-label">{card.label}</div>
          </div>
        ))}
      </div>

      {/* ── Production Trend ──────────────────────────────────── */}
      <div className="stats-production-card">
        <h2
          style={{
            margin: '0 0 0.75rem',
            fontFamily: 'var(--font-display, Orbitron, sans-serif)',
            fontSize: '0.68rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'rgba(120,150,200,0.45)',
            fontWeight: 600,
          }}
        >
          Production Trend (last 7 days)
        </h2>
        {!hasHistory ? (
          <p className="stats-production-empty">
            No data yet — check back after 24h of real time
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {productionRows.map((row) => {
              const last = row.values[row.values.length - 1] ?? 0;
              const first = row.values[0] ?? 0;
              let trendDisplay = '—';
              if (first > 0) {
                const pctChange = Math.round(((last - first) / first) * 100);
                const arrow = last >= first ? '▲' : '▼';
                trendDisplay = `${arrow}${Math.abs(pctChange)}%`;
              }
              return (
                <div key={row.label} className="stats-production-row">
                  <span
                    style={{
                      width: 80,
                      fontSize: '0.78rem',
                      color: 'rgba(150,180,220,0.6)',
                      flexShrink: 0,
                    }}
                  >
                    {row.label}
                  </span>
                  <MiniSparkline values={row.values} color={row.color} />
                  <span
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '0.73rem',
                      color: row.color,
                      marginLeft: '0.25rem',
                    }}
                  >
                    +{formatNumber(last)}/h
                  </span>
                  <span
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '0.68rem',
                      color: 'rgba(100,130,180,0.4)',
                      marginLeft: 'auto',
                    }}
                  >
                    {trendDisplay}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Rankings ─────────────────────────────────────────── */}
      <section>
        <div className="stats-rankings-header">
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--font-display, Orbitron, sans-serif)',
              fontSize: '0.78rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'rgba(150,180,220,0.55)',
            }}
          >
            Commander Rankings
          </h2>
          <div
            style={{ flex: 1, height: 1, background: 'rgba(40,60,120,0.3)', margin: '0 0.5rem' }}
          />
          <span style={{ fontSize: '0.7rem', color: 'rgba(100,130,180,0.4)' }}>
            Click column to sort
          </span>
        </div>
        <RankingsTable rankings={rankings} />
      </section>
    </section>
  );
}
