import type { BuildingDefinition } from '../data/buildings.ts';
import type { ResearchDefinition } from '../data/research.ts';
import type { ResourceCost } from '../models/types.ts';

function cumulativeCost(
  def: Pick<BuildingDefinition | ResearchDefinition, 'baseCost' | 'costMultiplier'>,
  level: number,
): ResourceCost {
  if (level <= 0) {
    return { metal: 0, crystal: 0, deuterium: 0 };
  }

  const factor =
    def.costMultiplier === 1
      ? level
      : (Math.pow(def.costMultiplier, level) - 1) / (def.costMultiplier - 1);

  return {
    metal: def.baseCost.metal * factor,
    crystal: def.baseCost.crystal * factor,
    deuterium: def.baseCost.deuterium * factor,
  };
}

export function scorePointsForCost({ metal, crystal, deuterium }: ResourceCost): number {
  return Math.floor((metal + crystal + deuterium) / 1000);
}

export function cumulativeBuildingCost(
  def: BuildingDefinition,
  level: number,
): ResourceCost {
  return cumulativeCost(def, level);
}

export function cumulativeResearchCost(
  def: ResearchDefinition,
  level: number,
): ResourceCost {
  return cumulativeCost(def, level);
}
