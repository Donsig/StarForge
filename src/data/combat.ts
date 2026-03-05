// RF table: rapidFire[attackerId][targetId] = rfValue
// Chance to fire again after a shot: (rfValue - 1) / rfValue
export const RAPID_FIRE: Partial<Record<string, Partial<Record<string, number>>>> = {
  cruiser: { lightFighter: 6, rocketLauncher: 10 },
  battleship: { espionageProbe: 5 },
  bomber: { rocketLauncher: 20, lightLaser: 20, heavyLaser: 10, ionCannon: 10 },
  destroyer: { lightLaser: 10 },
  battlecruiser: { smallCargo: 3, largeCargo: 3, lightFighter: 4, heavyFighter: 4 },
  deathstar: {
    smallCargo: 250,
    largeCargo: 250,
    lightFighter: 200,
    heavyFighter: 100,
    cruiser: 33,
    battleship: 30,
    battlecruiser: 15,
    colonyShip: 250,
    recycler: 250,
    espionageProbe: 1250,
    bomber: 25,
    destroyer: 5,
    rocketLauncher: 200,
    lightLaser: 200,
    heavyLaser: 100,
    gaussCannon: 50,
    ionCannon: 100,
  },
};
