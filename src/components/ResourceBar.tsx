import { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { HoverPortal } from './HoverPortal';
import {
  solarPlantEnergy,
  fusionReactorEnergy,
  metalMineEnergy,
  crystalMineEnergy,
  deuteriumSynthEnergy,
} from '../engine/FormulasEngine.ts';
import { formatNumber, formatRate } from '../utils/format.ts';

const HOVER_CLOSE_DELAY_MS = 120;

function useHoverTimer(delayMs: number) {
  const [hovered, setHovered] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clear = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const open = () => {
    clear();
    setHovered(true);
  };

  const close = () => {
    clear();
    timerRef.current = window.setTimeout(() => {
      setHovered(false);
      timerRef.current = null;
    }, delayMs);
  };

  useEffect(() => () => clear(), []);

  return { hovered, open, close };
}

export function ResourceBar() {
  const energyHover = useHoverTimer(HOVER_CLOSE_DELAY_MS);
  const metalHover = useHoverTimer(HOVER_CLOSE_DELAY_MS);
  const crystalHover = useHoverTimer(HOVER_CLOSE_DELAY_MS);
  const deuteriumHover = useHoverTimer(HOVER_CLOSE_DELAY_MS);
  const metalRef = useRef<HTMLDivElement>(null);
  const crystalRef = useRef<HTMLDivElement>(null);
  const deuteriumRef = useRef<HTMLDivElement>(null);
  const energyRef = useRef<HTMLDivElement>(null);
  const { gameState, productionRates, storageCaps } = useGame();
  const planet = gameState.planets[gameState.activePlanetIndex];
  const { resources, buildings } = planet;
  const speed = gameState.settings.gameSpeed;
  const energyOk = productionRates.energyProduction >= productionRates.energyConsumption;
  const metalNearCap = resources.metal > storageCaps.metal * 0.9;
  const crystalNearCap = resources.crystal > storageCaps.crystal * 0.9;
  const deuteriumNearCap = resources.deuterium > storageCaps.deuterium * 0.9;
  const energyTechLevel = gameState.research.energyTechnology;
  const satelliteCount = Math.max(0, planet.ships.solarSatellite ?? 0);
  const perSatEnergy = Number.isFinite(planet.maxTemperature)
    ? Math.max(0, Math.floor((planet.maxTemperature + 140) / 6))
    : 0;
  const satelliteEnergy = Math.floor(satelliteCount * perSatEnergy);

  const productionRows = [
    { label: `Solar Plant (Lv ${buildings.solarPlant})`, value: Math.floor(solarPlantEnergy(buildings.solarPlant)) },
    {
      label: `Fusion Reactor (Lv ${buildings.fusionReactor})`,
      value: Math.floor(fusionReactorEnergy(buildings.fusionReactor, energyTechLevel)),
    },
  ].filter((row) => row.value > 0);

  const consumptionRows = [
    { label: 'Metal Mine', value: Math.floor(metalMineEnergy(buildings.metalMine)) },
    { label: 'Crystal Mine', value: Math.floor(crystalMineEnergy(buildings.crystalMine)) },
    {
      label: 'Deuterium Synth',
      value: Math.floor(deuteriumSynthEnergy(buildings.deuteriumSynthesizer)),
    },
  ].filter((row) => row.value > 0);

  const totalProduction =
    productionRows.reduce((sum, row) => sum + row.value, 0) + satelliteEnergy;
  const totalConsumption = consumptionRows.reduce((sum, row) => sum + row.value, 0);
  const netBalance = totalProduction - totalConsumption;
  const energyPenalised =
    productionRates.energyConsumption > 0 &&
    productionRates.energyProduction < productionRates.energyConsumption;
  const efficiencyPct = energyPenalised
    ? Math.min(
        100,
        Math.round(
          (productionRates.energyProduction / productionRates.energyConsumption) * 100,
        ),
      )
    : 100;
  const metalMineLevel = buildings.metalMine ?? 0;
  const crystalMineLevel = buildings.crystalMine ?? 0;
  const deutMineLevel = buildings.deuteriumSynthesizer ?? 0;
  const tempModifierPct = Number.isFinite(planet.maxTemperature)
    ? Math.round((-0.002 * planet.maxTemperature + 1.28) * 100) - 100
    : 28;

  return (
    <header className="resource-bar">
      <div
        ref={metalRef}
        className="resource-entry resource-entry--metal"
        onMouseEnter={metalHover.open}
        onMouseLeave={metalHover.close}
      >
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
        <HoverPortal
          anchorRef={metalRef}
          open={metalHover.hovered}
          align="below-right"
          className="resource-hover-panel"
          onMouseEnter={metalHover.open}
          onMouseLeave={metalHover.close}
        >
          <div className="resource-label">Metal Mine (Lv {metalMineLevel})</div>
          <div className="energy-hover-row">
            <span>Production</span>
            <span className="number">{formatRate(productionRates.metalPerHour * speed)}</span>
          </div>
          {energyPenalised && (
            <div className="energy-hover-row">
              <span>Energy efficiency</span>
              <span className="number" style={{ color: 'var(--danger)' }}>
                {efficiencyPct}%
              </span>
            </div>
          )}
          <div className="energy-hover-row">
            <span>Storage</span>
            <span className="number">
              {formatNumber(resources.metal)} / {formatNumber(storageCaps.metal)}
            </span>
          </div>
        </HoverPortal>
      </div>

      <div
        ref={crystalRef}
        className="resource-entry resource-entry--crystal"
        onMouseEnter={crystalHover.open}
        onMouseLeave={crystalHover.close}
      >
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
        <HoverPortal
          anchorRef={crystalRef}
          open={crystalHover.hovered}
          align="below-right"
          className="resource-hover-panel"
          onMouseEnter={crystalHover.open}
          onMouseLeave={crystalHover.close}
        >
          <div className="resource-label">Crystal Mine (Lv {crystalMineLevel})</div>
          <div className="energy-hover-row">
            <span>Production</span>
            <span className="number">{formatRate(productionRates.crystalPerHour * speed)}</span>
          </div>
          {energyPenalised && (
            <div className="energy-hover-row">
              <span>Energy efficiency</span>
              <span className="number" style={{ color: 'var(--danger)' }}>
                {efficiencyPct}%
              </span>
            </div>
          )}
          <div className="energy-hover-row">
            <span>Storage</span>
            <span className="number">
              {formatNumber(resources.crystal)} / {formatNumber(storageCaps.crystal)}
            </span>
          </div>
        </HoverPortal>
      </div>

      <div
        ref={deuteriumRef}
        className="resource-entry resource-entry--deuterium"
        onMouseEnter={deuteriumHover.open}
        onMouseLeave={deuteriumHover.close}
      >
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
        <HoverPortal
          anchorRef={deuteriumRef}
          open={deuteriumHover.hovered}
          align="below-right"
          className="resource-hover-panel"
          onMouseEnter={deuteriumHover.open}
          onMouseLeave={deuteriumHover.close}
        >
          <div className="resource-label">Deuterium Synthesizer (Lv {deutMineLevel})</div>
          <div className="energy-hover-row">
            <span>Production</span>
            <span className="number">{formatRate(productionRates.deuteriumPerHour * speed)}</span>
          </div>
          {energyPenalised && (
            <div className="energy-hover-row">
              <span>Energy efficiency</span>
              <span className="number" style={{ color: 'var(--danger)' }}>
                {efficiencyPct}%
              </span>
            </div>
          )}
          <div className="energy-hover-row">
            <span>Temp modifier</span>
            <span
              className="number"
              style={{ color: tempModifierPct >= 0 ? 'var(--success)' : 'var(--danger)' }}
            >
              {tempModifierPct >= 0 ? '+' : ''}
              {tempModifierPct}%
            </span>
          </div>
          <div className="energy-hover-row">
            <span>Storage</span>
            <span className="number">
              {formatNumber(resources.deuterium)} / {formatNumber(storageCaps.deuterium)}
            </span>
          </div>
        </HoverPortal>
      </div>

      <div
        ref={energyRef}
        className="resource-entry"
        onMouseEnter={energyHover.open}
        onMouseLeave={energyHover.close}
      >
        <span className="resource-dot dot-energy" />
        <div>
          <div className="resource-label">Energy</div>
          <div className={`resource-value number ${energyOk ? 'energy-ok' : 'energy-deficit'}`}>
            {formatNumber(productionRates.energyProduction)} /{' '}
            {formatNumber(productionRates.energyConsumption)}
          </div>
          <div className="resource-rate">production / consumption</div>
        </div>
        <HoverPortal
          anchorRef={energyRef}
          open={energyHover.hovered}
          align="below-right"
          className="energy-hover-panel"
          onMouseEnter={energyHover.open}
          onMouseLeave={energyHover.close}
        >
            <div className="resource-label">Production</div>
            {productionRows.map((row) => (
              <div key={row.label} className="energy-hover-row">
                <span>{row.label}</span>
                <span className="number">{formatNumber(row.value)} EU</span>
              </div>
            ))}
            <div className="energy-hover-row">
              <span>{`Solar Satellites (${satelliteCount})`}</span>
              <span className="number">{formatNumber(satelliteEnergy)} EU</span>
            </div>
            <div className="resource-label" style={{ marginTop: '0.5rem' }}>
              Consumption
            </div>
            {consumptionRows.map((row) => (
              <div key={row.label} className="energy-hover-row">
                <span>{row.label}</span>
                <span className="number">{formatNumber(row.value)} EU</span>
              </div>
            ))}
            <div
              className="energy-hover-row"
              style={{
                marginTop: '0.5rem',
                paddingTop: '0.4rem',
                borderTop: '1px solid rgba(30, 45, 74, 0.55)',
              }}
            >
              <span>Net balance</span>
              <span
                className="number"
                style={{ color: netBalance >= 0 ? 'var(--success)' : 'var(--danger)' }}
              >
                {`${netBalance >= 0 ? '+' : ''}${formatNumber(netBalance)} EU`}
              </span>
            </div>
        </HoverPortal>
      </div>
    </header>
  );
}
