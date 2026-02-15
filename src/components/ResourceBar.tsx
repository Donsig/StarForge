import { useGame } from '../context/GameContext';
import { formatNumber, formatRate } from '../utils/format.ts';

export function ResourceBar() {
  const { gameState, productionRates, storageCaps } = useGame();
  const { resources } = gameState.planet;
  const speed = gameState.settings.gameSpeed;
  const energyOk = productionRates.energyProduction >= productionRates.energyConsumption;
  const metalNearCap = resources.metal > storageCaps.metal * 0.9;
  const crystalNearCap = resources.crystal > storageCaps.crystal * 0.9;
  const deuteriumNearCap = resources.deuterium > storageCaps.deuterium * 0.9;

  return (
    <header className="resource-bar">
      <div className="resource-entry">
        <span className="resource-dot dot-metal" />
        <div>
          <div className="resource-label">Metal</div>
          <div
            className={
              metalNearCap
                ? 'resource-value number resource-near-cap'
                : 'resource-value number'
            }
          >
            {formatNumber(resources.metal)} / {formatNumber(storageCaps.metal)}
          </div>
          <div className="resource-rate number">{formatRate(productionRates.metalPerHour * speed)}</div>
        </div>
      </div>

      <div className="resource-entry">
        <span className="resource-dot dot-crystal" />
        <div>
          <div className="resource-label">Crystal</div>
          <div
            className={
              crystalNearCap
                ? 'resource-value number resource-near-cap'
                : 'resource-value number'
            }
          >
            {formatNumber(resources.crystal)} / {formatNumber(storageCaps.crystal)}
          </div>
          <div className="resource-rate number">{formatRate(productionRates.crystalPerHour * speed)}</div>
        </div>
      </div>

      <div className="resource-entry">
        <span className="resource-dot dot-deuterium" />
        <div>
          <div className="resource-label">Deuterium</div>
          <div
            className={
              deuteriumNearCap
                ? 'resource-value number resource-near-cap'
                : 'resource-value number'
            }
          >
            {formatNumber(resources.deuterium)} / {formatNumber(storageCaps.deuterium)}
          </div>
          <div className="resource-rate number">{formatRate(productionRates.deuteriumPerHour * speed)}</div>
        </div>
      </div>

      <div className="resource-entry">
        <span className="resource-dot dot-energy" />
        <div>
          <div className="resource-label">Energy</div>
          <div className={`resource-value number ${energyOk ? 'energy-ok' : 'energy-deficit'}`}>
            {formatNumber(productionRates.energyProduction)} /{' '}
            {formatNumber(productionRates.energyConsumption)}
          </div>
          <div className="resource-rate">production / consumption</div>
        </div>
      </div>
    </header>
  );
}
