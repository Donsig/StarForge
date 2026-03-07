import type { BuildingId, DefenceId, ResearchId, ShipId } from '../models/types.ts';

export type PlanetType = 'hot' | 'temperate' | 'cold' | 'frozen';
export type PanelImageId =
  | 'fleet'
  | 'defence'
  | 'buildings'
  | 'research'
  | 'galaxy'
  | 'statistics';

export function getPlanetType(maxTemperature: number): PlanetType {
  if (maxTemperature > 60) {
    return 'hot';
  }
  if (maxTemperature > 20) {
    return 'temperate';
  }
  if (maxTemperature > -20) {
    return 'cold';
  }
  return 'frozen';
}

export function getPlanetImageUrl(
  maxTemperature: number,
  size: 'portrait' | 'icon' = 'portrait',
): string {
  const type = getPlanetType(maxTemperature);
  return size === 'icon'
    ? `/assets/planets/${type}-icon.webp`
    : `/assets/planets/${type}.webp`;
}

export const BUILDING_IMAGES: Record<BuildingId, string> = {
  metalMine: '/assets/buildings/metalMine.webp',
  crystalMine: '/assets/buildings/crystalMine.webp',
  deuteriumSynthesizer: '/assets/buildings/deuteriumSynthesizer.webp',
  solarPlant: '/assets/buildings/solarPlant.webp',
  fusionReactor: '/assets/buildings/fusionReactor.webp',
  metalStorage: '/assets/buildings/metalStorage.webp',
  crystalStorage: '/assets/buildings/crystalStorage.webp',
  deuteriumTank: '/assets/buildings/deuteriumTank.webp',
  roboticsFactory: '/assets/buildings/roboticsFactory.webp',
  naniteFactory: '/assets/buildings/naniteFactory.webp',
  shipyard: '/assets/buildings/shipyard.webp',
  researchLab: '/assets/buildings/researchLab.webp',
};

export const SHIP_IMAGES: Record<ShipId, string> = {
  lightFighter: '/assets/ships/lightFighter.webp',
  heavyFighter: '/assets/ships/heavyFighter.webp',
  cruiser: '/assets/ships/cruiser.webp',
  battleship: '/assets/ships/battleship.webp',
  bomber: '/assets/ships/bomber.webp',
  destroyer: '/assets/ships/destroyer.webp',
  battlecruiser: '/assets/ships/battlecruiser.webp',
  smallCargo: '/assets/ships/smallCargo.webp',
  largeCargo: '/assets/ships/largeCargo.webp',
  colonyShip: '/assets/ships/colonyShip.webp',
  recycler: '/assets/ships/recycler.webp',
  espionageProbe: '/assets/ships/espionageProbe.webp',
  solarSatellite: '/assets/ships/solarSatellite.webp',
};

export const DEFENCE_IMAGES: Record<DefenceId, string> = {
  rocketLauncher: '/assets/defences/rocketLauncher.webp',
  lightLaser: '/assets/defences/lightLaser.webp',
  heavyLaser: '/assets/defences/heavyLaser.webp',
  gaussCannon: '/assets/defences/gaussCannon.webp',
  ionCannon: '/assets/defences/ionCannon.webp',
  plasmaTurret: '/assets/defences/plasmaTurret.webp',
  smallShieldDome: '/assets/defences/smallShieldDome.webp',
  largeShieldDome: '/assets/defences/largeShieldDome.webp',
};

export const RESEARCH_IMAGES: Record<ResearchId, string> = {
  energyTechnology: '/assets/research/energyTechnology.webp',
  laserTechnology: '/assets/research/laserTechnology.webp',
  ionTechnology: '/assets/research/ionTechnology.webp',
  plasmaTechnology: '/assets/research/plasmaTechnology.webp',
  espionageTechnology: '/assets/research/espionageTechnology.webp',
  computerTechnology: '/assets/research/computerTechnology.webp',
  weaponsTechnology: '/assets/research/weaponsTechnology.webp',
  shieldingTechnology: '/assets/research/shieldingTechnology.webp',
  armourTechnology: '/assets/research/armourTechnology.webp',
  combustionDrive: '/assets/research/combustionDrive.webp',
  impulseDrive: '/assets/research/impulseDrive.webp',
  hyperspaceTechnology: '/assets/research/hyperspaceTechnology.webp',
  hyperspaceDrive: '/assets/research/hyperspaceDrive.webp',
  astrophysicsTechnology: '/assets/research/astrophysicsTechnology.webp',
  intergalacticResearchNetwork: '/assets/research/intergalacticResearchNetwork.webp',
};

export const PANEL_IMAGES: Record<PanelImageId, string> = {
  fleet: '/assets/panels/fleet.webp',
  defence: '/assets/panels/defence.webp',
  buildings: '/assets/panels/buildings.webp',
  research: '/assets/panels/research.webp',
  galaxy: '/assets/panels/galaxy.webp',
  statistics: '/assets/panels/statistics.webp',
};
