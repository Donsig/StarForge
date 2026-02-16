import { SHIP_ORDER, SHIPS } from '../data/ships.ts';
import { useGame } from '../context/GameContext';
import { formatNumber } from '../utils/format.ts';

export function FleetPanel() {
  const { gameState } = useGame();
  const planet = gameState.planets[gameState.activePlanetIndex];

  const ownedShips = SHIP_ORDER.filter((shipId) => planet.ships[shipId] > 0);

  let totalFleetPower = 0;
  for (const shipId of SHIP_ORDER) {
    const count = planet.ships[shipId];
    totalFleetPower += count * SHIPS[shipId].weaponPower;
  }

  return (
    <section className="panel">
      <h1 className="panel-title">Fleet Command</h1>
      <p className="panel-subtitle">Read-only overview of currently deployed ships and firepower.</p>

      <div className="panel-card">
        <p className="stat-line">
          <span className="label">Total Fleet Power</span>
          <span className="number">{formatNumber(totalFleetPower)}</span>
        </p>
      </div>

      {ownedShips.length === 0 ? (
        <div className="panel-card empty-state">
          <p>No ships available. Build your first fleet in the Shipyard.</p>
        </div>
      ) : (
        <div className="table-wrap panel-card">
          <table className="fleet-table">
            <thead>
              <tr>
                <th>Ship</th>
                <th>Count</th>
                <th>ATK / Unit</th>
                <th>Total ATK</th>
              </tr>
            </thead>
            <tbody>
              {ownedShips.map((shipId) => {
                const count = planet.ships[shipId];
                const unitAttack = SHIPS[shipId].weaponPower;
                const totalAttack = count * unitAttack;

                return (
                  <tr key={shipId}>
                    <td>{SHIPS[shipId].name}</td>
                    <td className="number">{formatNumber(count)}</td>
                    <td className="number">{formatNumber(unitAttack)}</td>
                    <td className="number">{formatNumber(totalAttack)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
