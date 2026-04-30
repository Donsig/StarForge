import type { LevelRow } from '../../utils/cardDetails';

const RESOURCE_COLORS = {
  metal: '#9ca3af',
  crystal: '#60a5fa',
  deuterium: '#34d399',
  energy: '#fbbf24',
} as const;

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
    return <span className="card-detail-modal__level-badge card-detail-modal__level-badge--now" style={{ background: accentColor }}>NOW</span>;
  }

  if (row.queued) {
    return (
      <span
        className="card-detail-modal__level-badge card-detail-modal__level-badge--outline"
        style={{ color: accentColor, border: `1px solid ${accentColor}88` }}
      >
        <span aria-hidden="true">⏳</span>
        <span>QUEUE</span>
      </span>
    );
  }

  if (row.next) {
    return (
      <span
        className="card-detail-modal__level-badge card-detail-modal__level-badge--outline"
        style={{ color: accentColor, border: `1px solid ${accentColor}88` }}
      >
        NEXT
      </span>
    );
  }

  return null;
}

function CostCell({ value, color, active }: { value: number; color: string; active: boolean }) {
  if (value === 0) {
    return <td className="card-detail-modal__level-td card-detail-modal__level-cost card-detail-modal__level-cost--zero">—</td>;
  }

  return (
    <td className="card-detail-modal__level-td card-detail-modal__level-cost" style={{ color, opacity: active ? 1 : 0.45 }}>
      {formatCompact(value)}
    </td>
  );
}

export function LevelTable({ rows, accentColor }: { rows: LevelRow[]; accentColor: string }) {
  const showDeuterium = rows.some((row) => row.deuterium > 0);
  const showEnergy = rows.some((row) => row.energy !== 0);

  return (
    <div className="card-detail-modal__level-table-wrap">
      <table className="card-detail-modal__level-table">
        <thead>
          <tr>
            <th className="card-detail-modal__level-th card-detail-modal__level-th--level card-detail-modal__level-th--left">Level</th>
            <th className="card-detail-modal__level-th card-detail-modal__level-th--left">Benefit</th>
            <th className="card-detail-modal__level-th card-detail-modal__level-th--right card-detail-modal__level-th--metal">⬡ Metal</th>
            <th className="card-detail-modal__level-th card-detail-modal__level-th--right card-detail-modal__level-th--crystal">◈ Crystal</th>
            {showDeuterium ? (
              <th className="card-detail-modal__level-th card-detail-modal__level-th--right card-detail-modal__level-th--deuterium">◉ Deut.</th>
            ) : null}
            {showEnergy ? (
              <th className="card-detail-modal__level-th card-detail-modal__level-th--right card-detail-modal__level-th--energy">⚡ Energy</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const alpha = textAlpha(row);
            const active = row.current || row.queued || row.next;
            const state = rowState(row);

            return (
              <tr
                key={row.level}
                className="card-detail-modal__level-row"
                data-row-state={state ?? undefined}
                style={{ background: rowBackground(row, index, accentColor) }}
              >
                <td className="card-detail-modal__level-td">
                  <div className="card-detail-modal__level-cell">
                    <span className="card-detail-modal__level-number" style={{ color: levelColor(row, accentColor, alpha) }}>{row.level}</span>
                    <LevelBadge row={row} accentColor={accentColor} />
                  </div>
                </td>
                <td className="card-detail-modal__level-td card-detail-modal__level-benefit" style={{ color: `rgba(150,180,220,${alpha})` }}>{row.benefit}</td>
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
