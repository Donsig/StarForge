import type { ResourcesState } from '../models/Planet.ts';
import type { ResourceCost } from '../models/types.ts';
import { formatNumber } from '../utils/format.ts';

interface CostDisplayProps {
  cost: ResourceCost;
  available: ResourcesState;
}

export function CostDisplay({ cost, available }: CostDisplayProps) {
  const metalAffordable = available.metal >= cost.metal;
  const crystalAffordable = available.crystal >= cost.crystal;
  const deuteriumAffordable = available.deuterium >= cost.deuterium;

  return (
    <div className="cost-display">
      <span className={`cost-item number ${metalAffordable ? '' : 'insufficient'}`}>
        M {formatNumber(cost.metal)}
      </span>
      <span className={`cost-item number ${crystalAffordable ? '' : 'insufficient'}`}>
        C {formatNumber(cost.crystal)}
      </span>
      <span className={`cost-item number ${deuteriumAffordable ? '' : 'insufficient'}`}>
        D {formatNumber(cost.deuterium)}
      </span>
    </div>
  );
}
