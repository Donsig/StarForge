import { RESEARCH_ORDER } from '../data/research.ts';
import { SHIPS, SHIP_ORDER } from '../data/ships.ts';
import type { GameState } from '../models/GameState.ts';
import type { BuildingId, PlayerScores, ShipId } from '../models/types.ts';

const NON_COMBAT_SHIP_IDS = new Set<ShipId>([
  'recycler',
  'espionageProbe',
  'colonyShip',
  'smallCargo',
  'largeCargo',
  'solarSatellite',
]);

const ECONOMY_BUILDINGS: readonly BuildingId[] = [
  'metalMine',
  'crystalMine',
  'deuteriumSynthesizer',
  'solarPlant',
  'fusionReactor',
];

export function computePlayerScores(state: GameState): PlayerScores {
  const weaponsTech = state.research.weaponsTechnology ?? 0;
  const armourTech = state.research.armourTechnology ?? 0;
  const techMultiplier = (1 + weaponsTech * 0.1) * (1 + armourTech * 0.05);

  let military = 0;
  let economy = 0;

  for (const planet of state.planets) {
    for (const buildingId of ECONOMY_BUILDINGS) {
      economy += planet.buildings[buildingId] ?? 0;
    }

    for (const shipId of SHIP_ORDER) {
      if (NON_COMBAT_SHIP_IDS.has(shipId)) {
        continue;
      }

      const count = planet.ships[shipId] ?? 0;
      if (count <= 0) {
        continue;
      }

      military += (SHIPS[shipId]?.weaponPower ?? 0) * count;
    }
  }

  military = Math.round(military * techMultiplier);
  const research = RESEARCH_ORDER.reduce(
    (sum, researchId) => sum + (state.research[researchId] ?? 0),
    0,
  );
  const total = military * 2 + economy * 5 + research * 3;

  return { military, economy, research, total };
}
