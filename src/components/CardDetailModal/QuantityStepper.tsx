import { useEffect, useState, type ChangeEvent, type FocusEvent } from 'react';
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
    border: `1px solid ${accent.bd}`,
    background: accent.bg,
    color: accent.c,
  };

  return (
    <div className="card-detail-modal__quantity-stepper">
      <div className="card-detail-modal__quantity-controls">
        <span className="card-detail-modal__quantity-label">Quantity</span>
        <button
          type="button"
          aria-label="Decrease quantity"
          onClick={() => setQty(Math.max(1, qty - 1))}
          className="card-detail-modal__quantity-step-btn"
          style={stepButtonStyle}
        >
          −
        </button>
        <input
          type="number"
          aria-label="Quantity"
          value={inputValue}
          onChange={onInputChange}
          onBlur={onInputBlur}
          className="card-detail-modal__quantity-input"
          style={{ border: `1px solid ${accent.bd}` }}
        />
        <button
          type="button"
          aria-label="Increase quantity"
          onClick={() => setQty(qty + 1)}
          className="card-detail-modal__quantity-step-btn"
          style={stepButtonStyle}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setQty(maxAffordable(cost, resources, maxCount, existingCount))}
          className="card-detail-modal__quantity-max-btn"
        >
          MAX
        </button>
      </div>

      <div className="card-detail-modal__quantity-totals">
        <div className="card-detail-modal__cost-pills">
          {RESOURCE_KEYS.filter((key) => cost[key] > 0).map((key) => (
            <span key={key} className="card-detail-modal__cost-pill" style={{ color: RESOURCE_COLORS[key] }}>
              {RESOURCE_LABELS[key]} {formatCompact(qty * cost[key])}
            </span>
          ))}
        </div>
        {timeSeconds > 0 ? <span className="card-detail-modal__quantity-time">{formatDuration(timeSeconds * qty)}</span> : null}
      </div>
    </div>
  );
}
