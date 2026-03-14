import { formatCoords, missionShipManifest } from '../fleet.ts';

describe('missionShipManifest', () => {
  it('returns empty string when no ships', () => {
    expect(missionShipManifest({})).toBe('');
  });

  it('formats a single ship type', () => {
    expect(missionShipManifest({ lightFighter: 5 })).toBe('5× Light Fighter');
  });

  it('formats multiple ship types, skipping zero counts', () => {
    const result = missionShipManifest({
      lightFighter: 3,
      cruiser: 0,
      battleship: 1,
    });

    expect(result).toContain('3× Light Fighter');
    expect(result).toContain('1× Battleship');
    expect(result).not.toContain('Cruiser');
  });

  it('floors fractional counts', () => {
    expect(missionShipManifest({ lightFighter: 2.9 })).toBe('2× Light Fighter');
  });
});

describe('formatCoords', () => {
  it('formats coordinates as [G:x S:y P:z]', () => {
    expect(formatCoords({ galaxy: 1, system: 5, slot: 3 })).toBe('[G:1 S:5 P:3]');
  });
});
