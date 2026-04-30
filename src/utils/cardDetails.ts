import { BUILDINGS } from '../data/buildings.ts';
import { DEFENCES } from '../data/defences.ts';
import { RESEARCH } from '../data/research.ts';
import { SHIPS } from '../data/ships.ts';
import type { GameState } from '../models/GameState.ts';
import type { ResourcesState } from '../models/Planet.ts';
import type {
  BuildingId,
  Prerequisite,
  ResearchId,
  ResourceCost,
} from '../models/types.ts';

export type CardType = 'building' | 'research' | 'ship' | 'defence';

interface TypeAccent {
  c: string;
  bg: string;
  bd: string;
  glow: string;
}

export const TYPE_ACCENTS: Record<CardType, TypeAccent> = {
  building: {
    c: '#4d8fff',
    bg: 'rgba(77,143,255,0.12)',
    bd: 'rgba(77,143,255,0.35)',
    glow: 'rgba(77,143,255,0.22)',
  },
  research: {
    c: '#818cf8',
    bg: 'rgba(129,140,248,0.12)',
    bd: 'rgba(129,140,248,0.35)',
    glow: 'rgba(129,140,248,0.22)',
  },
  ship: {
    c: '#30d5c8',
    bg: 'rgba(48,213,200,0.12)',
    bd: 'rgba(48,213,200,0.35)',
    glow: 'rgba(48,213,200,0.22)',
  },
  defence: {
    c: '#f0a832',
    bg: 'rgba(240,168,50,0.12)',
    bd: 'rgba(240,168,50,0.35)',
    glow: 'rgba(240,168,50,0.22)',
  },
};

const RESOURCE_KEYS: Array<keyof ResourceCost> = ['metal', 'crystal', 'deuterium'];

export function maxAffordable(
  cost: ResourceCost,
  resources: ResourcesState,
  maxCount?: number,
  existingCount = 0,
): number {
  const byResource = RESOURCE_KEYS.map((key) =>
    cost[key] > 0 ? Math.floor(resources[key] / cost[key]) : Infinity,
  );
  let max = Math.min(...byResource);

  if (!Number.isFinite(max)) {
    max = 0;
  }

  if (typeof maxCount === 'number') {
    max = Math.min(max, maxCount - existingCount);
  }

  return Math.max(0, max);
}

export interface PrereqRow {
  label: string;
  met: boolean;
  target: { type: CardType; id: string } | null;
}

function hasOwnKey<T extends object>(
  object: T,
  key: PropertyKey,
): key is keyof T {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function activePlanet(state: GameState): GameState['planets'][number] | null {
  const fallback = state.planets[0];
  if (!fallback) {
    return null;
  }

  const clampedIndex = Math.min(
    Math.max(0, Math.floor(state.activePlanetIndex)),
    state.planets.length - 1,
  );
  return state.planets[clampedIndex] ?? fallback;
}

export function prereqRowsFor(
  requires: Prerequisite[],
  state: GameState,
): PrereqRow[] {
  const planet = activePlanet(state);

  return requires.map((prerequisite) => {
    if (prerequisite.type === 'building') {
      if (!hasOwnKey(BUILDINGS, prerequisite.id)) {
        return {
          label: `${prerequisite.id} ${prerequisite.level}`,
          met: false,
          target: null,
        };
      }

      const id = prerequisite.id as BuildingId;
      const level = planet?.buildings[id] ?? 0;
      return {
        label: `${BUILDINGS[id].name} ${prerequisite.level}`,
        met: level >= prerequisite.level,
        target: { type: 'building', id },
      };
    }

    if (!hasOwnKey(RESEARCH, prerequisite.id)) {
      return {
        label: `${prerequisite.id} ${prerequisite.level}`,
        met: false,
        target: null,
      };
    }

    const id = prerequisite.id as ResearchId;
    const level = state.research[id] ?? 0;
    return {
      label: `${RESEARCH[id].name} ${prerequisite.level}`,
      met: level >= prerequisite.level,
      target: { type: 'research', id },
    };
  });
}

export interface UnlockEntry {
  type: CardType;
  id: string;
  label: string;
  atLevel: number;
}

const UNLOCKS_BY_KEY: Map<string, UnlockEntry[]> = (() => {
  const unlocks = new Map<string, UnlockEntry[]>();

  const add = (depType: CardType, depId: string, target: UnlockEntry) => {
    const key = `${depType}:${depId}`;
    const list = unlocks.get(key) ?? [];
    list.push(target);
    unlocks.set(key, list);
  };

  for (const building of Object.values(BUILDINGS)) {
    for (const prerequisite of building.requires) {
      add(prerequisite.type, prerequisite.id, {
        type: 'building',
        id: building.id,
        label: building.name,
        atLevel: prerequisite.level,
      });
    }
  }

  for (const research of Object.values(RESEARCH)) {
    for (const prerequisite of research.requires) {
      add(prerequisite.type, prerequisite.id, {
        type: 'research',
        id: research.id,
        label: research.name,
        atLevel: prerequisite.level,
      });
    }
  }

  for (const ship of Object.values(SHIPS)) {
    for (const prerequisite of ship.requires) {
      add(prerequisite.type, prerequisite.id, {
        type: 'ship',
        id: ship.id,
        label: ship.name,
        atLevel: prerequisite.level,
      });
    }
  }

  for (const defence of Object.values(DEFENCES)) {
    for (const prerequisite of defence.requires) {
      add(prerequisite.type, prerequisite.id, {
        type: 'defence',
        id: defence.id,
        label: defence.name,
        atLevel: prerequisite.level,
      });
    }
  }

  return unlocks;
})();

export function enablesFor(type: CardType, id: string): UnlockEntry[] {
  return UNLOCKS_BY_KEY.get(`${type}:${id}`) ?? [];
}

import {
  crystalMineEnergy,
  crystalProductionPerHour,
  deuteriumProductionPerHour,
  deuteriumSynthEnergy,
  fusionReactorDeuteriumConsumption,
  fusionReactorEnergy,
  metalMineEnergy,
  metalProductionPerHour,
  plasmaCrystalBonus,
  plasmaDeuteriumBonus,
  plasmaMetalBonus,
  solarPlantEnergy,
  storageCapacity,
} from '../engine/FormulasEngine.ts';

export interface CardStat {
  label: string;
  value: string;
  color: string;
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) {
    return '0';
  }

  const rounded = Math.round(n);
  if (rounded >= 1_000_000) {
    return `${(rounded / 1_000_000).toFixed(1)}M`;
  }
  if (rounded >= 1_000) {
    return `${Math.round(rounded / 1_000)}K`;
  }
  return rounded.toLocaleString('en-US');
}

function planetForCardDetails(state: GameState): GameState['planets'][number] | null {
  return state.planets[state.activePlanetIndex] ?? state.planets[0] ?? null;
}

function finiteMaxTemperature(state: GameState): number {
  const temperature = planetForCardDetails(state)?.maxTemperature ?? 0;
  return Number.isFinite(temperature) ? temperature : 0;
}

function formatBuildTimeReduction(level: number, kind: 'robotics' | 'nanite'): string {
  const factor = kind === 'nanite' ? Math.pow(2, level) : 1 + level;
  const pct = Math.round((1 - 1 / factor) * 100);
  return `−${pct}% build time`;
}

function formatShipyardSpeedup(level: number): string {
  const pct = Math.round((1 - 1 / (1 + level)) * 100);
  return `−${pct}% ship build time`;
}

function formatLabSpeedup(level: number): string {
  const pct = Math.round((1 - 1 / (1 + level)) * 100);
  return `−${pct}% research time`;
}

export function buildingBenefitAtLevel(
  id: BuildingId,
  level: number,
  state: GameState,
): string {
  const plasmaLevel = state.research.plasmaTechnology ?? 0;

  switch (id) {
    case 'metalMine':
      return `+${formatNumber(
        metalProductionPerHour(level) * plasmaMetalBonus(plasmaLevel),
      )}/h`;
    case 'crystalMine':
      return `+${formatNumber(
        crystalProductionPerHour(level) * plasmaCrystalBonus(plasmaLevel),
      )}/h`;
    case 'deuteriumSynthesizer':
      return `+${formatNumber(
        deuteriumProductionPerHour(level, finiteMaxTemperature(state)) *
          plasmaDeuteriumBonus(plasmaLevel),
      )}/h`;
    case 'solarPlant':
      return `+${formatNumber(solarPlantEnergy(level))}`;
    case 'fusionReactor': {
      const energy = fusionReactorEnergy(level, state.research.energyTechnology ?? 0);
      const deuterium = fusionReactorDeuteriumConsumption(level);
      return `+${formatNumber(energy)} / −${formatNumber(deuterium)}/h`;
    }
    case 'metalStorage':
    case 'crystalStorage':
    case 'deuteriumTank':
      return formatNumber(storageCapacity(level));
    case 'roboticsFactory':
      return formatBuildTimeReduction(level, 'robotics');
    case 'naniteFactory':
      return formatBuildTimeReduction(level, 'nanite');
    case 'shipyard':
      return formatShipyardSpeedup(level);
    case 'researchLab':
      return formatLabSpeedup(level);
  }
}

export function researchBenefitAtLevel(id: ResearchId, level: number): string {
  switch (id) {
    case 'weaponsTechnology':
      return `+${level * 10}% attack`;
    case 'shieldingTechnology':
      return `+${level * 10}% shields`;
    case 'armourTechnology':
      return `+${level * 10}% hull`;
    case 'computerTechnology':
      return `+${level} fleet slot${level === 1 ? '' : 's'}`;
    case 'astrophysicsTechnology': {
      const colonies = Math.floor(level / 2);
      return `+${colonies} colon${colonies === 1 ? 'y' : 'ies'}`;
    }
    case 'plasmaTechnology':
      return `+${level}% metal / +${(level * 0.66).toFixed(
        1,
      )}% crystal / +${(level * 0.33).toFixed(1)}% deut.`;
    default:
      return `Lv ${level}`;
  }
}

function buildingEnergyStat(id: BuildingId, level: number): CardStat | null {
  switch (id) {
    case 'metalMine':
      return { label: 'Energy', value: `−${formatNumber(metalMineEnergy(level))}`, color: '#f87171' };
    case 'crystalMine':
      return { label: 'Energy', value: `−${formatNumber(crystalMineEnergy(level))}`, color: '#f87171' };
    case 'deuteriumSynthesizer':
      return { label: 'Energy', value: `−${formatNumber(deuteriumSynthEnergy(level))}`, color: '#f87171' };
    case 'solarPlant':
      return { label: 'Energy', value: buildingBenefitAtLevel(id, level, {} as GameState), color: '#fbbf24' };
    default:
      return null;
  }
}

function buildingStatsFor(id: BuildingId, state: GameState): CardStat[] {
  const level = planetForCardDetails(state)?.buildings[id] ?? 0;
  const fieldsStat: CardStat = { label: 'Fields', value: '1', color: '#c8e0ff' };

  switch (id) {
    case 'metalMine':
    case 'crystalMine':
    case 'deuteriumSynthesizer': {
      const energy = buildingEnergyStat(id, level);
      return [
        { label: 'Prod / h', value: buildingBenefitAtLevel(id, level, state), color: '#34d399' },
        ...(energy ? [energy] : []),
        fieldsStat,
      ];
    }
    case 'solarPlant':
      return [
        { label: 'Energy', value: buildingBenefitAtLevel(id, level, state), color: '#fbbf24' },
        fieldsStat,
      ];
    case 'fusionReactor':
      return [
        { label: 'Energy / Deut', value: buildingBenefitAtLevel(id, level, state), color: '#fbbf24' },
        fieldsStat,
      ];
    case 'metalStorage':
    case 'crystalStorage':
    case 'deuteriumTank':
      return [
        { label: 'Capacity', value: buildingBenefitAtLevel(id, level, state), color: '#34d399' },
        fieldsStat,
      ];
    case 'roboticsFactory':
    case 'naniteFactory':
    case 'shipyard':
    case 'researchLab':
      return [
        { label: 'Effect', value: buildingBenefitAtLevel(id, level, state), color: '#818cf8' },
        fieldsStat,
      ];
  }
}

function researchScopeStat(id: ResearchId): CardStat | null {
  switch (id) {
    case 'weaponsTechnology':
    case 'shieldingTechnology':
    case 'armourTechnology':
      return { label: 'Applies', value: 'Combat stats', color: '#f0a832' };
    case 'computerTechnology':
      return { label: 'Applies', value: 'Fleet slots', color: '#30d5c8' };
    case 'astrophysicsTechnology':
      return { label: 'Applies', value: 'Colonies', color: '#30d5c8' };
    case 'plasmaTechnology':
      return { label: 'Applies', value: 'Mine output', color: '#34d399' };
    default:
      return null;
  }
}

function researchStatsFor(id: ResearchId, state: GameState): CardStat[] {
  const level = state.research[id] ?? 0;
  const scope = researchScopeStat(id);
  return [
    { label: 'Current', value: researchBenefitAtLevel(id, level), color: '#818cf8' },
    { label: 'Next', value: researchBenefitAtLevel(id, level + 1), color: '#34d399' },
    ...(scope ? [scope] : []),
  ];
}

function solarSatelliteEnergyPerUnit(state: GameState): number {
  const maxTemperature = planetForCardDetails(state)?.maxTemperature ?? 0;
  return Number.isFinite(maxTemperature)
    ? Math.max(0, Math.floor((maxTemperature + 140) / 6))
    : 0;
}

export function cardStatsFor(type: CardType, id: string, state: GameState): CardStat[] {
  switch (type) {
    case 'building':
      if (!hasOwnKey(BUILDINGS, id)) {
        return [];
      }
      return buildingStatsFor(id, state);
    case 'research':
      if (!hasOwnKey(RESEARCH, id)) {
        return [];
      }
      return researchStatsFor(id, state);
    case 'ship': {
      if (!hasOwnKey(SHIPS, id)) {
        return [];
      }

      const def = SHIPS[id];
      const stats: CardStat[] = [
        { label: 'ATK', value: formatNumber(def.attack), color: '#f87171' },
        { label: 'SHD', value: formatNumber(def.shield), color: '#60a5fa' },
        { label: 'HULL', value: formatNumber(def.hull), color: '#c8e0ff' },
        { label: 'CARGO', value: formatNumber(def.cargoCapacity), color: '#34d399' },
        { label: 'SPD', value: formatNumber(def.speed), color: '#f0a832' },
        { label: 'DRIVE', value: def.drive, color: '#818cf8' },
      ];

      if (id === 'solarSatellite') {
        stats.push({
          label: 'Energy / unit',
          value: String(solarSatelliteEnergyPerUnit(state)),
          color: '#fbbf24',
        });
      }

      return stats;
    }
    case 'defence': {
      if (!hasOwnKey(DEFENCES, id)) {
        return [];
      }

      const def = DEFENCES[id];
      return [
        { label: 'ATK', value: formatNumber(def.attack), color: '#f87171' },
        { label: 'SHD', value: formatNumber(def.shield), color: '#60a5fa' },
        { label: 'HULL', value: formatNumber(def.hull), color: '#c8e0ff' },
        {
          label: 'MAX',
          value: def.maxCount === undefined ? '∞' : String(def.maxCount),
          color: '#c8e0ff',
        },
      ];
    }
  }
}
