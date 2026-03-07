import {
  BUILDING_IMAGES,
  DEFENCE_IMAGES,
  PANEL_IMAGES,
  RESEARCH_IMAGES,
  SHIP_IMAGES,
  getPlanetImageUrl,
  getPlanetType,
} from '../assets';

describe('getPlanetType', () => {
  it('returns hot for temperature above 60', () => {
    expect(getPlanetType(61)).toBe('hot');
    expect(getPlanetType(100)).toBe('hot');
  });

  it('returns temperate for 20-60', () => {
    expect(getPlanetType(60)).toBe('temperate');
    expect(getPlanetType(21)).toBe('temperate');
  });

  it('returns cold for -20 to 20', () => {
    expect(getPlanetType(20)).toBe('cold');
    expect(getPlanetType(-19)).toBe('cold');
  });

  it('returns frozen for -20 and below', () => {
    expect(getPlanetType(-20)).toBe('frozen');
    expect(getPlanetType(-100)).toBe('frozen');
  });
});

describe('getPlanetImageUrl', () => {
  it('returns portrait path by default', () => {
    expect(getPlanetImageUrl(80)).toBe('/assets/planets/hot.webp');
  });

  it('returns icon path when requested', () => {
    expect(getPlanetImageUrl(0, 'icon')).toBe('/assets/planets/cold-icon.webp');
  });
});

describe('asset maps', () => {
  it('BUILDING_IMAGES has all 12 buildings', () => {
    expect(Object.keys(BUILDING_IMAGES)).toHaveLength(12);
    expect(BUILDING_IMAGES.metalMine).toBe('/assets/buildings/metalMine.webp');
  });

  it('SHIP_IMAGES has all 13 ships', () => {
    expect(Object.keys(SHIP_IMAGES)).toHaveLength(13);
  });

  it('DEFENCE_IMAGES has all 8 defences', () => {
    expect(Object.keys(DEFENCE_IMAGES)).toHaveLength(8);
  });

  it('RESEARCH_IMAGES has all 15 research items', () => {
    expect(Object.keys(RESEARCH_IMAGES)).toHaveLength(15);
  });

  it('PANEL_IMAGES has all 5 panels', () => {
    expect(Object.keys(PANEL_IMAGES)).toHaveLength(5);
    expect(PANEL_IMAGES.fleet).toBe('/assets/panels/fleet.webp');
  });
});
