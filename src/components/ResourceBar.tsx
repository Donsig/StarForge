import { useGame } from '../context/GameContext';
import { formatNumber, formatRate } from '../utils/format.ts';

export function ResourceBar() {
  const { gameState, productionRates } = useGame();
  const { resources } = gameState.planet;
  const speed = gameState.settings.gameSpeed;
  const energyOk = productionRates.energyProduction >= productionRates.energyConsumption;

  return (
    <header className="resource-bar">
      <div className="resource-entry">
        <span className="resource-dot dot-metal" />
        <div>
          <div className="resource-label">Metal</div>
          <div className="resource-value number">{formatNumber(resources.metal)}</div>
          <div className="resource-rate number">{formatRate(productionRates.metalPerHour * speed)}</div>
        </div>
      </div>

      <div className="resource-entry">
        <span className="resource-dot dot-crystal" />
        <div>
          <div className="resource-label">Crystal</div>
          <div className="resource-value number">{formatNumber(resources.crystal)}</div>
          <div className="resource-rate number">{formatRate(productionRates.crystalPerHour * speed)}</div>
        </div>
      </div>

      <div className="resource-entry">
        <span className="resource-dot dot-deuterium" />
        <div>
          <div className="resource-label">Deuterium</div>
          <div className="resource-value number">{formatNumber(resources.deuterium)}</div>
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
