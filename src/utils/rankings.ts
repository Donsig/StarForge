import { BUILDINGS } from '../data/buildings.ts';
import { DEFENCES } from '../data/defences.ts';
import { RESEARCH } from '../data/research.ts';
import { SHIPS } from '../data/ships.ts';
import type { GameState } from '../models/GameState.ts';
import { cumulativeBuildingCost, cumulativeResearchCost, scorePointsForCost } from './score.ts';

const NPC_RESEARCH_POINTS_PER_TIER = 2000;

export interface RankingEntry {
  name: string;
  buildings: number;
  research: number;
  fleet: number;
  defence: number;
  total: number;
  isPlayer: boolean;
}

function computeBuildingPoints(levels: Record<string, number>): number {
  let total = 0;

  for (const [id, def] of Object.entries(BUILDINGS)) {
    const level = levels[id] ?? 0;
    if (level <= 0) continue;

    total += scorePointsForCost(cumulativeBuildingCost(def, level));
  }

  return total;
}

function computeResearchPoints(levels: Record<string, number>): number {
  let total = 0;

  for (const [id, def] of Object.entries(RESEARCH)) {
    const level = levels[id] ?? 0;
    if (level <= 0) continue;

    total += scorePointsForCost(cumulativeResearchCost(def, level));
  }

  return total;
}

function computeFleetPoints(counts: Record<string, number>): number {
  let total = 0;

  for (const [id, def] of Object.entries(SHIPS)) {
    const count = counts[id] ?? 0;
    if (count <= 0) continue;

    total += count * scorePointsForCost(def.cost);
  }

  return total;
}

function computeDefencePoints(counts: Record<string, number>): number {
  let total = 0;

  for (const [id, def] of Object.entries(DEFENCES)) {
    const count = counts[id] ?? 0;
    if (count <= 0) continue;

    total += count * scorePointsForCost(def.cost);
  }

  return total;
}

/**
 * Compute rankings for the player and NPC colonies in shared cost-point units.
 * Pure function — no time, randomness, or mutation.
 */
export function computeRankings(state: GameState): RankingEntry[] {
  let playerBuildings = 0;
  let playerFleet = 0;
  let playerDefence = 0;

  for (const planet of state.planets) {
    playerBuildings += computeBuildingPoints(planet.buildings);
    playerFleet += computeFleetPoints(planet.ships);
    playerDefence += computeDefencePoints(planet.defences);
  }

  const playerResearch = computeResearchPoints(state.research);
  const playerTotal = playerBuildings + playerResearch + playerFleet + playerDefence;
  const playerName = state.planets[state.activePlanetIndex]?.name || 'You';

  const entries: RankingEntry[] = [
    {
      name: playerName,
      buildings: playerBuildings,
      research: playerResearch,
      fleet: playerFleet,
      defence: playerDefence,
      total: playerTotal,
      isPlayer: true,
    },
  ];

  for (const colony of state.galaxy.npcColonies) {
    const buildings = computeBuildingPoints(colony.buildings);
    const research = colony.tier * NPC_RESEARCH_POINTS_PER_TIER;
    const fleet = computeFleetPoints(colony.currentShips);
    const defence = computeDefencePoints(colony.currentDefences);

    entries.push({
      name: colony.name,
      buildings,
      research,
      fleet,
      defence,
      total: buildings + research + fleet + defence,
      isPlayer: false,
    });
  }

  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => (b.entry.total - a.entry.total) || (a.index - b.index))
    .map(({ entry }) => entry);
}
