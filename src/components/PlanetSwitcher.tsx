import { useGame } from '../context/GameContext';

export function PlanetSwitcher() {
  const { gameState, setActivePlanet } = useGame();

  if (gameState.planets.length <= 1) return null;

  return (
    <div className="planet-switcher">
      <select
        className="input"
        value={gameState.activePlanetIndex}
        onChange={(e) => setActivePlanet(Number(e.target.value))}
      >
        {gameState.planets.map((planet, index) => (
          <option key={index} value={index}>
            {planet.name} [{planet.coordinates.galaxy}:{planet.coordinates.system}:{planet.coordinates.slot}]
          </option>
        ))}
      </select>
    </div>
  );
}
