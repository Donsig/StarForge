import { useGame } from '../context/GameContext';
import { PANEL_IMAGES } from '../data/assets.ts';
import { formatNumber } from '../utils/format.ts';

function formatMilestoneDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

export function StatisticsPanel() {
  const { gameState } = useGame();
  const { statistics, playerScores } = gameState;

  return (
    <section className="panel">
      <div className="panel-banner">
        <img
          src={PANEL_IMAGES.statistics}
          alt=""
          onLoad={(event) => {
            event.currentTarget.parentElement?.classList.add('panel-banner--loaded');
          }}
          onError={(event) => {
            event.currentTarget.remove();
          }}
        />
      </div>
      <h1 className="panel-title">Statistics</h1>
      <p className="panel-subtitle">Lifetime progression and counters.</p>

      <div className="settings-grid">
        <article className="panel-card">
          <h2 className="section-title">Score</h2>
          <table className="stats-table">
            <tbody>
              <tr><td>Military</td><td>{formatNumber(playerScores.military)}</td></tr>
              <tr><td>Economy</td><td>{formatNumber(playerScores.economy)}</td></tr>
              <tr><td>Research</td><td>{formatNumber(playerScores.research)}</td></tr>
              <tr><td>Buildings</td><td>{formatNumber(playerScores.buildings ?? 0)}</td></tr>
              <tr><td>Fleet</td><td>{formatNumber(playerScores.fleet ?? 0)}</td></tr>
              <tr><td>Defence</td><td>{formatNumber(playerScores.defence ?? 0)}</td></tr>
              <tr><td><strong>Total</strong></td><td><strong>{formatNumber(playerScores.total)}</strong></td></tr>
            </tbody>
          </table>
        </article>

        <article className="panel-card">
          <h2 className="section-title">Resources Mined</h2>
          <table className="stats-table">
            <tbody>
              <tr><td>Metal</td><td>{formatNumber(statistics.resourcesMined.metal)}</td></tr>
              <tr><td>Crystal</td><td>{formatNumber(statistics.resourcesMined.crystal)}</td></tr>
              <tr><td>Deuterium</td><td>{formatNumber(statistics.resourcesMined.deuterium)}</td></tr>
            </tbody>
          </table>
        </article>

        <article className="panel-card">
          <h2 className="section-title">Combat</h2>
          <table className="stats-table">
            <tbody>
              <tr><td>Battles Fought</td><td>{statistics.combat.fought}</td></tr>
              <tr><td>Won</td><td>{statistics.combat.won}</td></tr>
              <tr><td>Lost</td><td>{statistics.combat.lost}</td></tr>
              <tr><td>Drawn</td><td>{statistics.combat.drawn}</td></tr>
              <tr><td>Total Loot</td><td>{formatNumber(statistics.combat.totalLoot)}</td></tr>
              <tr><td>Ships Lost</td><td>{formatNumber(statistics.combat.shipsLost)}</td></tr>
            </tbody>
          </table>
        </article>

        <article className="panel-card">
          <h2 className="section-title">Fleet</h2>
          <table className="stats-table">
            <tbody>
              <tr><td>Total Distance</td><td>{formatNumber(statistics.fleet.totalDistance)}</td></tr>
              {Object.entries(statistics.fleet.sent).map(([type, count]) => (
                <tr key={type}>
                  <td>{type.charAt(0).toUpperCase() + type.slice(1)} missions</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        {Object.keys(statistics.milestones).length > 0 && (
          <article className="panel-card">
            <h2 className="section-title">Milestones</h2>
            <table className="stats-table">
              <tbody>
                {statistics.milestones.firstColony !== undefined && (
                  <tr><td>First Colony</td><td>{formatMilestoneDate(statistics.milestones.firstColony)}</td></tr>
                )}
                {statistics.milestones.firstBattleWon !== undefined && (
                  <tr><td>First Battle Won</td><td>{formatMilestoneDate(statistics.milestones.firstBattleWon)}</td></tr>
                )}
                {statistics.milestones.firstEspionage !== undefined && (
                  <tr><td>First Espionage</td><td>{formatMilestoneDate(statistics.milestones.firstEspionage)}</td></tr>
                )}
              </tbody>
            </table>
          </article>
        )}
      </div>
    </section>
  );
}
