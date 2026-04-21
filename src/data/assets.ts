import type { BuildingId, DefenceId, ResearchId, ShipId } from '../models/types.ts';

export type PlanetType = 'hot' | 'temperate' | 'cold' | 'frozen';
export type PanelImageId =
  | 'fleet'
  | 'defence'
  | 'buildings'
  | 'research'
  | 'galaxy'
  | 'shipyard'
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

const asset = (path: string): string =>
  `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

export function getPlanetImageUrl(
  maxTemperature: number,
  size: 'portrait' | 'icon' = 'portrait',
): string {
  const type = getPlanetType(maxTemperature);
  return size === 'icon'
    ? asset(`assets/planets/${type}-icon.webp`)
    : asset(`assets/planets/${type}.webp`);
}

export const BUILDING_IMAGES: Record<BuildingId, string> = {
  metalMine: asset('assets/buildings/metalMine.webp'),
  crystalMine: asset('assets/buildings/crystalMine.webp'),
  deuteriumSynthesizer: asset('assets/buildings/deuteriumSynthesizer.webp'),
  solarPlant: asset('assets/buildings/solarPlant.webp'),
  fusionReactor: asset('assets/buildings/fusionReactor.webp'),
  metalStorage: asset('assets/buildings/metalStorage.webp'),
  crystalStorage: asset('assets/buildings/crystalStorage.webp'),
  deuteriumTank: asset('assets/buildings/deuteriumTank.webp'),
  roboticsFactory: asset('assets/buildings/roboticsFactory.webp'),
  naniteFactory: asset('assets/buildings/naniteFactory.webp'),
  shipyard: asset('assets/buildings/shipyard.webp'),
  researchLab: asset('assets/buildings/researchLab.webp'),
};

export const SHIP_IMAGES: Record<ShipId, string> = {
  lightFighter: asset('assets/ships/lightFighter.webp'),
  heavyFighter: asset('assets/ships/heavyFighter.webp'),
  cruiser: asset('assets/ships/cruiser.webp'),
  battleship: asset('assets/ships/battleship.webp'),
  bomber: asset('assets/ships/bomber.webp'),
  destroyer: asset('assets/ships/destroyer.webp'),
  battlecruiser: asset('assets/ships/battlecruiser.webp'),
  smallCargo: asset('assets/ships/smallCargo.webp'),
  largeCargo: asset('assets/ships/largeCargo.webp'),
  colonyShip: asset('assets/ships/colonyShip.webp'),
  recycler: asset('assets/ships/recycler.webp'),
  espionageProbe: asset('assets/ships/espionageProbe.webp'),
  solarSatellite: asset('assets/ships/solarSatellite.webp'),
};

export const DEFENCE_IMAGES: Record<DefenceId, string> = {
  rocketLauncher: asset('assets/defences/rocketLauncher.webp'),
  lightLaser: asset('assets/defences/lightLaser.webp'),
  heavyLaser: asset('assets/defences/heavyLaser.webp'),
  gaussCannon: asset('assets/defences/gaussCannon.webp'),
  ionCannon: asset('assets/defences/ionCannon.webp'),
  plasmaTurret: asset('assets/defences/plasmaTurret.webp'),
  smallShieldDome: asset('assets/defences/smallShieldDome.webp'),
  largeShieldDome: asset('assets/defences/largeShieldDome.webp'),
};

export const RESEARCH_IMAGES: Record<ResearchId, string> = {
  energyTechnology: asset('assets/research/energyTechnology.webp'),
  laserTechnology: asset('assets/research/laserTechnology.webp'),
  ionTechnology: asset('assets/research/ionTechnology.webp'),
  plasmaTechnology: asset('assets/research/plasmaTechnology.webp'),
  espionageTechnology: asset('assets/research/espionageTechnology.webp'),
  computerTechnology: asset('assets/research/computerTechnology.webp'),
  weaponsTechnology: asset('assets/research/weaponsTechnology.webp'),
  shieldingTechnology: asset('assets/research/shieldingTechnology.webp'),
  armourTechnology: asset('assets/research/armourTechnology.webp'),
  combustionDrive: asset('assets/research/combustionDrive.webp'),
  impulseDrive: asset('assets/research/impulseDrive.webp'),
  hyperspaceTechnology: asset('assets/research/hyperspaceTechnology.webp'),
  hyperspaceDrive: asset('assets/research/hyperspaceDrive.webp'),
  astrophysicsTechnology: asset('assets/research/astrophysicsTechnology.webp'),
  intergalacticResearchNetwork: asset('assets/research/intergalacticResearchNetwork.webp'),
};

export const PANEL_IMAGES: Record<PanelImageId, string> = {
  fleet: asset('assets/panels/fleet.webp'),
  defence: asset('assets/panels/defence.webp'),
  buildings: asset('assets/panels/buildings.webp'),
  research: asset('assets/panels/research.webp'),
  galaxy: asset('assets/panels/galaxy.webp'),
  shipyard: asset('assets/panels/shipyard.webp'),
  statistics: asset('assets/panels/statistics.webp'),
};
