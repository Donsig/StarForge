import type { ResourceCost } from '../models/types.ts';

// ── Production formulas (per hour) ──────────────────────────────

export function metalProductionPerHour(mineLevel: number): number {
  if (mineLevel === 0) return 0;
  return 30 * mineLevel * Math.pow(1.1, mineLevel);
}

export function crystalProductionPerHour(mineLevel: number): number {
  if (mineLevel === 0) return 0;
  return 20 * mineLevel * Math.pow(1.1, mineLevel);
}

export function deuteriumProductionPerHour(
  synthLevel: number,
  maxTemperature: number,
): number {
  if (synthLevel === 0) return 0;
  return (
    10 * synthLevel * Math.pow(1.1, synthLevel) * (-0.002 * maxTemperature + 1.28)
  );
}

// ── Energy formulas ─────────────────────────────────────────────

export function solarPlantEnergy(level: number): number {
  if (level === 0) return 0;
  return 20 * level * Math.pow(1.1, level);
}

export function fusionReactorEnergy(level: number, energyTechLevel: number): number {
  if (level === 0) return 0;
  return 30 * level * Math.pow(1.05 + energyTechLevel * 0.01, level);
}

export function fusionReactorDeuteriumConsumption(level: number): number {
  if (level === 0) return 0;
  return 10 * level * Math.pow(1.1, level);
}

export function metalMineEnergy(level: number): number {
  if (level === 0) return 0;
  return 10 * level * Math.pow(1.1, level);
}

export function crystalMineEnergy(level: number): number {
  if (level === 0) return 0;
  return 10 * level * Math.pow(1.1, level);
}

export function deuteriumSynthEnergy(level: number): number {
  if (level === 0) return 0;
  return 20 * level * Math.pow(1.1, level);
}

/** Energy factor: 1.0 when enough energy, proportionally reduced otherwise */
export function energyFactor(energyProduction: number, energyConsumption: number): number {
  if (energyConsumption === 0) return 1;
  if (energyProduction >= energyConsumption) return 1;
  return energyProduction / energyConsumption;
}

// ── Cost formulas ───────────────────────────────────────────────

export function buildingCostAtLevel(
  baseCost: ResourceCost,
  multiplier: number,
  level: number,
): ResourceCost {
  const factor = Math.pow(multiplier, level - 1);
  return {
    metal: Math.floor(baseCost.metal * factor),
    crystal: Math.floor(baseCost.crystal * factor),
    deuterium: Math.floor(baseCost.deuterium * factor),
  };
}

export function researchCostAtLevel(
  baseCost: ResourceCost,
  multiplier: number,
  level: number,
): ResourceCost {
  const factor = Math.pow(multiplier, level - 1);
  return {
    metal: Math.floor(baseCost.metal * factor),
    crystal: Math.floor(baseCost.crystal * factor),
    deuterium: Math.floor(baseCost.deuterium * factor),
  };
}

// ── Build time formulas (returns seconds) ───────────────────────

export function buildingTime(
  metalCost: number,
  crystalCost: number,
  roboticsLevel: number,
  naniteLevel: number,
  gameSpeed: number,
): number {
  const hours =
    (metalCost + crystalCost) /
    (2500 * (1 + roboticsLevel) * Math.pow(2, naniteLevel) * gameSpeed);
  return Math.max(1, Math.floor(hours * 3600));
}

export function researchTime(
  metalCost: number,
  crystalCost: number,
  labLevel: number,
  gameSpeed: number,
): number {
  const hours =
    (metalCost + crystalCost) / (1000 * (1 + labLevel) * gameSpeed);
  return Math.max(1, Math.floor(hours * 3600));
}

export function shipBuildTime(
  structuralIntegrity: number,
  shipyardLevel: number,
  naniteLevel: number,
  gameSpeed: number,
): number {
  const hours =
    structuralIntegrity /
    (2500 * (1 + shipyardLevel) * Math.pow(2, naniteLevel) * gameSpeed);
  return Math.max(1, Math.floor(hours * 3600));
}

export const defenceBuildTime = shipBuildTime;

// ── Storage capacity ────────────────────────────────────────────

export function storageCapacity(level: number): number {
  return 5000 * Math.floor(2.5 * Math.exp((20 * level) / 33));
}

// ── Plasma tech production bonus ────────────────────────────────

export function plasmaMetalBonus(plasmaLevel: number): number {
  return 1 + plasmaLevel * 0.01; // +1% per level
}

export function plasmaCrystalBonus(plasmaLevel: number): number {
  return 1 + plasmaLevel * 0.0066; // +0.66% per level
}

export function plasmaDeuteriumBonus(plasmaLevel: number): number {
  return 1 + plasmaLevel * 0.0033; // +0.33% per level
}
