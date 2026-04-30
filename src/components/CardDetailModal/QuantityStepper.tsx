import { useEffect, useState, type CSSProperties, type ChangeEvent, type FocusEvent } from 'react';
import type { ResourcesState } from '../../models/Planet';
import type { ResourceCost } from '../../models/types';
import { maxAffordable, TYPE_ACCENTS } from '../../utils/cardDetails';
import { formatDuration } from '../../utils/time';

export interface QuantityStepperProps {
  qty: number;
  setQty: (next: number) => void;
  cost: ResourceCost;
  timeSeconds: number;
  type: 'ship' | 'defence';
  resources: ResourcesState;
  maxCount?: number;
  existingCount?: number;
}

type ResourceKey = keyof ResourceCost;

const RESOURCE_KEYS: ResourceKey[] = ['metal', 'crystal', 'deuterium'];
const RESOURCE_COLORS: Record<ResourceKey, string> = {
  metal: '#9ca3af',
  crystal: '#60a5fa',
  deuterium: '#34d399',
};
const RESOURCE_LABELS: Record<ResourceKey, string> = {
  metal: 'M',
  crystal: 'C',
  deuterium: 'D',
};

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  label: {
    flex: 1,
    fontSize: '0.62rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'rgba(150,180,220,0.32)',
  },
  stepButton: {
    width: 26,
    height: 26,
    borderRadius: 5,
    fontSize: '1rem',
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: 'pointer',
  },
  input: {
    width: 52,
    textAlign: 'center',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#c8e0ff',
    background: 'rgba(8,12,30,0.9)',
    borderRadius: 5,
    padding: '0.25rem 0.3rem',
  },
  maxButton: {
    padding: '0.22rem 0.5rem',
    border: '1px solid rgba(60,80,120,0.35)',
    borderRadius: 5,
    background: 'transparent',
    color: 'rgba(150,180,220,0.45)',
    fontSize: '0.65rem',
    letterSpacing: '0.05em',
    cursor: 'pointer',
  },
  totals: {
    display: 'flex',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '0.3rem',
  },
  costPills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.3rem',
    minWidth: 0,
  },
  costPill: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.72rem',
    background: 'rgba(10,14,30,0.85)',
    border: '1px solid rgba(60,80,140,0.4)',
    borderRadius: 4,
    padding: '0.15rem 0.45rem',
    whiteSpace: 'nowrap',
  },
  time: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.65rem',
    color: 'rgba(150,180,220,0.3)',
    whiteSpace: 'nowrap',
  },
} satisfies Record<string, CSSProperties>;

function formatCompact(value: number): string {
  const rounded = Math.round(value);
  if (!Number.isFinite(rounded)) return '0';
  if (rounded >= 1_000_000) return `${(rounded / 1_000_000).toFixed(1)}M`;
  if (rounded >= 1_000) return `${Math.round(rounded / 1_000)}K`;
  return `${rounded}`;
}

function clampQuantity(value: number): number {
  return Math.max(1, Math.floor(value));
}

export function QuantityStepper({
  qty,
  setQty,
  cost,
  timeSeconds,
  type,
  resources,
  maxCount,
  existingCount,
}: QuantityStepperProps) {
  const [inputValue, setInputValue] = useState(String(qty));
  const accent = TYPE_ACCENTS[type];

  useEffect(() => {
    setInputValue(String(qty));
  }, [qty]);

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.currentTarget.value;
    setInputValue(nextValue);

    const parsed = Number.parseInt(nextValue, 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      setQty(Math.floor(parsed));
    }
  };

  const onInputBlur = (event: FocusEvent<HTMLInputElement>) => {
    const parsed = Number.parseInt(event.currentTarget.value, 10);
    const next = Number.isFinite(parsed) ? clampQuantity(parsed) : 1;
    setQty(next);
    setInputValue(String(next));
  };

  const stepButtonStyle = {
    ...styles.stepButton,
    border: `1px solid ${accent.bd}`,
    background: accent.bg,
    color: accent.c,
  };

  return (
    <div style={styles.root}>
      <div style={styles.controls}>
        <span style={styles.label}>Quantity</span>
        <button type="button" aria-label="Decrease quantity" onClick={() => setQty(Math.max(1, qty - 1))} style={stepButtonStyle}>
          −
        </button>
        <input
          type="number"
          aria-label="Quantity"
          value={inputValue}
          onChange={onInputChange}
          onBlur={onInputBlur}
          style={{ ...styles.input, border: `1px solid ${accent.bd}` }}
        />
        <button type="button" aria-label="Increase quantity" onClick={() => setQty(qty + 1)} style={stepButtonStyle}>
          +
        </button>
        <button type="button" onClick={() => setQty(maxAffordable(cost, resources, maxCount, existingCount))} style={styles.maxButton}>
          MAX
        </button>
      </div>

      <div style={styles.totals}>
        <div style={styles.costPills}>
          {RESOURCE_KEYS.filter((key) => cost[key] > 0).map((key) => (
            <span key={key} style={{ ...styles.costPill, color: RESOURCE_COLORS[key] }}>
              {RESOURCE_LABELS[key]} {formatCompact(qty * cost[key])}
            </span>
          ))}
        </div>
        {timeSeconds > 0 ? <span style={styles.time}>{formatDuration(timeSeconds * qty)}</span> : null}
      </div>
    </div>
  );
}
