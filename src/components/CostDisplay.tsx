import type { ResourcesState } from '../models/Planet.ts';
import type { ResourceCost } from '../models/types.ts';
import { formatCompact } from '../utils/format.ts';

interface CostDisplayProps {
  cost: ResourceCost;
  available: ResourcesState;
}

export function CostDisplay({ cost, available }: CostDisplayProps) {
  const items = [
    {
      key: 'metal',
      label: 'M',
      value: cost.metal,
      affordable: available.metal >= cost.metal,
    },
    {
      key: 'crystal',
      label: 'C',
      value: cost.crystal,
      affordable: available.crystal >= cost.crystal,
    },
    {
      key: 'deuterium',
      label: 'D',
      value: cost.deuterium,
      affordable: available.deuterium >= cost.deuterium,
    },
  ].filter((item) => item.value > 0);

  return (
    <div className="cost-display">
      {items.map((item) => (
        <span
          key={item.key}
          className={`cost-pill cost-pill--${item.key}${item.affordable ? '' : ' cost-pill--insufficient'}`}
        >
          {item.label} {formatCompact(item.value)}
        </span>
      ))}
    </div>
  );
}
