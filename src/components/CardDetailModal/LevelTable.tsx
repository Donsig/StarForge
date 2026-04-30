import type { CSSProperties } from 'react';
import type { LevelRow } from '../../utils/cardDetails';

const RESOURCE_COLORS = {
  metal: '#9ca3af',
  crystal: '#60a5fa',
  deuterium: '#34d399',
  energy: '#fbbf24',
} as const;
const RESOURCE_HEADER_COLORS = {
  metal: 'rgba(156,163,175,0.6)',
  crystal: 'rgba(96,165,250,0.6)',
  deuterium: 'rgba(52,211,153,0.6)',
  energy: 'rgba(251,191,36,0.6)',
} as const;

const styles = {
  wrap: {
    borderRadius: 6,
    overflow: 'hidden',
    border: '1px solid rgba(40,60,120,0.28)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    fontFamily: 'var(--font-display)',
    fontSize: '0.57rem',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '0.3rem 0.5rem',
    background: 'rgba(5,8,20,0.7)',
    borderBottom: '1px solid rgba(40,60,120,0.28)',
    color: 'rgba(150,180,220,0.3)',
  },
  td: {
    padding: '0.32rem 0.5rem',
    borderBottom: '1px solid rgba(40,60,120,0.12)',
  },
  levelCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.34rem',
    minWidth: 0,
  },
  levelNumber: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.75rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  nowBadge: {
    fontFamily: 'var(--font-display)',
    fontSize: '0.52rem',
    fontWeight: 800,
    letterSpacing: '0.05em',
    borderRadius: 3,
    padding: '0.04rem 0.28rem',
    color: '#050810',
  },
  outlineBadge: {
    fontFamily: 'var(--font-display)',
    fontSize: '0.52rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    borderRadius: 3,
    padding: '0.04rem 0.28rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.18rem',
  },
  benefit: {
    fontSize: '0.72rem',
  },
  cost: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.68rem',
    fontWeight: 600,
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
} satisfies Record<string, CSSProperties>;

function formatCompact(value: number): string {
  const rounded = Math.round(value);
  if (!Number.isFinite(rounded)) return '0';

  const sign = rounded < 0 ? '-' : '';
  const absolute = Math.abs(rounded);
  if (absolute >= 1_000_000) return `${sign}${(absolute / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${sign}${Math.round(absolute / 1_000)}K`;
  return `${rounded}`;
}

function rowState(row: LevelRow): 'current' | 'queued' | 'next' | null {
  if (row.current) return 'current';
  if (row.queued) return 'queued';
  if (row.next) return 'next';
  return null;
}

function rowBackground(row: LevelRow, index: number, accentColor: string): string {
  const state = rowState(row);
  if (state === 'current') return `${accentColor}1a`;
  if (state === 'queued') return `${accentColor}14`;
  if (state === 'next') return `${accentColor}0d`;
  return index % 2 === 0 ? 'rgba(5,8,20,0.28)' : 'transparent';
}

function textAlpha(row: LevelRow): number {
  const state = rowState(row);
  if (state === 'current') return 1;
  if (state === 'queued') return 0.9;
  if (state === 'next') return 0.82;
  return 0.42;
}

function levelColor(row: LevelRow, accentColor: string, alpha: number): string {
  const state = rowState(row);
  if (state === 'current') return accentColor;
  if (state === 'queued' || state === 'next') return `${accentColor}cc`;
  return `rgba(150,180,220,${alpha})`;
}

function LevelBadge({ row, accentColor }: { row: LevelRow; accentColor: string }) {
  if (row.current) {
    return <span style={{ ...styles.nowBadge, background: accentColor }}>NOW</span>;
  }

  if (row.queued) {
    return (
      <span style={{ ...styles.outlineBadge, color: accentColor, border: `1px solid ${accentColor}88` }}>
        <span aria-hidden="true">⏳</span>
        <span>QUEUE</span>
      </span>
    );
  }

  if (row.next) {
    return <span style={{ ...styles.outlineBadge, color: accentColor, border: `1px solid ${accentColor}88` }}>NEXT</span>;
  }

  return null;
}

function CostCell({ value, color, active }: { value: number; color: string; active: boolean }) {
  if (value === 0) {
    return <td style={{ ...styles.td, ...styles.cost, color: 'rgba(150,180,220,0.2)' }}>—</td>;
  }

  return (
    <td style={{ ...styles.td, ...styles.cost, color, opacity: active ? 1 : 0.45 }}>
      {formatCompact(value)}
    </td>
  );
}

export function LevelTable({ rows, accentColor }: { rows: LevelRow[]; accentColor: string }) {
  const showDeuterium = rows.some((row) => row.deuterium > 0);
  const showEnergy = rows.some((row) => row.energy !== 0);

  return (
    <div style={styles.wrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={{ ...styles.th, width: 80, textAlign: 'left' }}>Level</th>
            <th style={{ ...styles.th, textAlign: 'left' }}>Benefit</th>
            <th style={{ ...styles.th, textAlign: 'right', color: RESOURCE_HEADER_COLORS.metal }}>⬡ Metal</th>
            <th style={{ ...styles.th, textAlign: 'right', color: RESOURCE_HEADER_COLORS.crystal }}>◈ Crystal</th>
            {showDeuterium ? (
              <th style={{ ...styles.th, textAlign: 'right', color: RESOURCE_HEADER_COLORS.deuterium }}>◉ Deut.</th>
            ) : null}
            {showEnergy ? (
              <th style={{ ...styles.th, textAlign: 'right', color: RESOURCE_HEADER_COLORS.energy }}>⚡ Energy</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const alpha = textAlpha(row);
            const active = row.current || row.queued || row.next;

            return (
              <tr key={row.level} style={{ background: rowBackground(row, index, accentColor) }}>
                <td style={styles.td}>
                  <div style={styles.levelCell}>
                    <span style={{ ...styles.levelNumber, color: levelColor(row, accentColor, alpha) }}>{row.level}</span>
                    <LevelBadge row={row} accentColor={accentColor} />
                  </div>
                </td>
                <td style={{ ...styles.td, ...styles.benefit, color: `rgba(150,180,220,${alpha})` }}>{row.benefit}</td>
                <CostCell value={row.metal} color={RESOURCE_COLORS.metal} active={active} />
                <CostCell value={row.crystal} color={RESOURCE_COLORS.crystal} active={active} />
                {showDeuterium ? <CostCell value={row.deuterium} color={RESOURCE_COLORS.deuterium} active={active} /> : null}
                {showEnergy ? <CostCell value={row.energy} color={RESOURCE_COLORS.energy} active={active} /> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
