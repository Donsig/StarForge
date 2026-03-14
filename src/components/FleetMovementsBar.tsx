import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext.tsx';
import { useNow } from '../hooks/useNow.ts';
import type { MovementEntry } from '../models/Fleet.ts';
import type { PlanetState } from '../models/Planet.ts';
import { formatNumber } from '../utils/format.ts';
import { formatCoords, missionShipManifest } from '../utils/fleet.ts';
import { formatCountdown } from '../utils/time.ts';
import { HoverPortal } from './HoverPortal.tsx';

const HOVER_CLOSE_DELAY_MS = 120;

function getMissionTypeClass(missionType: string): string {
  switch (missionType) {
    case 'attack':
      return 'movement-type--attack';
    case 'espionage':
      return 'movement-type--espionage';
    case 'harvest':
      return 'movement-type--harvest';
    case 'transport':
      return 'movement-type--transport';
    case 'colonise':
      return 'movement-type--colonise';
    case 'deploy':
      return 'movement-type--deploy';
    case 'npc_raid':
      return 'movement-type--npc-raid';
    default:
      return '';
  }
}

function getMissionTypeLabel(missionType: string): string {
  switch (missionType) {
    case 'attack':
      return 'Attack';
    case 'espionage':
      return 'Espionage';
    case 'harvest':
      return 'Harvest';
    case 'transport':
      return 'Transport';
    case 'colonise':
      return 'Colonise';
    case 'deploy':
      return 'Deploy';
    case 'npc_raid':
      return 'Raid';
    default:
      return missionType;
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'outbound':
      return 'Outbound';
    case 'returning':
      return 'Returning';
    case 'at_target':
      return 'At Target';
    default:
      return status;
  }
}

function formatCountdownFromNow(nextTransitionTime: number | null, now: number): string {
  if (nextTransitionTime === null) return '—';
  const remainingMs = nextTransitionTime - now;
  return formatCountdown(Math.max(0, remainingMs));
}

interface MovementRowProps {
  entry: MovementEntry;
  planets: PlanetState[];
  now: number;
  onRecall: (id: string) => void;
}

function MovementRow({ entry, planets, now, onRecall }: MovementRowProps) {
  const anchorRef = useRef<HTMLLIElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const hoverTimerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const openTooltip = () => {
    clearTimer();
    setShowTooltip(true);
  };

  const scheduleClose = () => {
    clearTimer();
    hoverTimerRef.current = window.setTimeout(() => {
      setShowTooltip(false);
      hoverTimerRef.current = null;
    }, HOVER_CLOSE_DELAY_MS);
  };

  useEffect(() => () => clearTimer(), []);

  const sourcePlanet = entry.kind === 'player' ? planets[entry.sourcePlanetIndex] : null;
  const sourceLabel = sourcePlanet
    ? `${sourcePlanet.name} ${formatCoords(sourcePlanet.coordinates)}`
    : entry.kind === 'npc'
      ? formatCoords(entry.sourceCoordinates)
      : '?';
  const targetLabel = formatCoords(entry.targetCoordinates);
  const arrow = entry.direction === 'outgoing' ? '›' : '‹';
  const typeClass = getMissionTypeClass(entry.missionType);
  const typeLabel = getMissionTypeLabel(entry.missionType);
  const statusLabel = getStatusLabel(entry.status);
  const countdown = formatCountdownFromNow(entry.nextTransitionTime, now);
  const shipManifest = missionShipManifest(entry.ships);
  const hasCargo = entry.kind === 'player' &&
    entry.status === 'returning' &&
    (entry.cargo.metal > 0 || entry.cargo.crystal > 0 || entry.cargo.deuterium > 0);

  return (
    <li
      ref={anchorRef}
      className="movement-row"
      onMouseEnter={openTooltip}
      onMouseLeave={scheduleClose}
    >
      <span className={`movement-type-pill ${typeClass}`}>{typeLabel}</span>
      <span className="movement-source">{sourceLabel}</span>
      <span className="movement-arrow">{arrow}</span>
      <span className="movement-target">{targetLabel}</span>
      <span className={`movement-status movement-status--${entry.status}`}>{statusLabel}</span>
      <span className="movement-countdown">{countdown}</span>
      {entry.canRecall && (
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => onRecall(entry.id)}
        >
          Recall
        </button>
      )}
      <HoverPortal
        anchorRef={anchorRef}
        open={showTooltip && shipManifest.length > 0}
        align="below-right"
        className="movement-tooltip"
        onMouseEnter={clearTimer}
        onMouseLeave={scheduleClose}
      >
        <p>{shipManifest}</p>
        {hasCargo && entry.kind === 'player' && (
          <p className="hint">
            M {formatNumber(entry.cargo.metal)}&nbsp;
            C {formatNumber(entry.cargo.crystal)}&nbsp;
            D {formatNumber(entry.cargo.deuterium)}
          </p>
        )}
      </HoverPortal>
    </li>
  );
}

export function FleetMovementsBar() {
  const { fleetMovements, gameState, recallFleet } = useGame();
  const now = useNow(1000);
  const barRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) {
      document.documentElement.style.setProperty('--movements-bar-height', '0px');
      return;
    }

    const setBarHeight = () => {
      document.documentElement.style.setProperty(
        '--movements-bar-height',
        `${bar.offsetHeight}px`,
      );
    };

    if (typeof ResizeObserver === 'undefined') {
      setBarHeight();

      return () => {
        document.documentElement.style.setProperty('--movements-bar-height', '0px');
      };
    }

    const observer = new ResizeObserver(() => {
      setBarHeight();
    });
    observer.observe(bar);
    setBarHeight();

    return () => {
      observer.disconnect();
      document.documentElement.style.setProperty('--movements-bar-height', '0px');
    };
  }, []);

  if (fleetMovements.length === 0) {
    return null;
  }

  return (
    <nav ref={barRef} className="fleet-movements-bar" aria-label="Fleet movements">
      <ul className="movement-list">
        {fleetMovements.map((entry) => (
          <MovementRow
            key={entry.id}
            entry={entry}
            planets={gameState.planets}
            now={now}
            onRecall={recallFleet}
          />
        ))}
      </ul>
    </nav>
  );
}
