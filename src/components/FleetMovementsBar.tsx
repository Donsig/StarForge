import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext.tsx';
import { useNow } from '../hooks/useNow.ts';
import type { MissionStatus, MovementEntry } from '../models/Fleet.ts';
import type { Coordinates, NPCColony } from '../models/Galaxy.ts';
import type { PlanetState } from '../models/Planet.ts';
import { formatNumber } from '../utils/format.ts';
import { missionShipManifest } from '../utils/fleet.ts';
import { formatCountdown } from '../utils/time.ts';
import { HoverPortal } from './HoverPortal.tsx';

const HOVER_CLOSE_DELAY_MS = 120;
const COLLAPSED_STORAGE_KEY = 'starforge:fleet-bar-collapsed';

function getMissionTypeClass(missionType: string): string {
  switch (missionType) {
    case 'attack':
      return 'movement-type-pill--attack';
    case 'espionage':
      return 'movement-type-pill--espionage';
    case 'harvest':
      return 'movement-type-pill--harvest';
    case 'transport':
      return 'movement-type-pill--transport';
    case 'colonise':
      return 'movement-type-pill--colonise';
    case 'deploy':
      return 'movement-type-pill--deploy';
    case 'npc_raid':
      return 'movement-type-pill--npc-raid';
    default:
      return 'movement-type-pill--attack';
  }
}

function getMissionTypeLabel(missionType: string): string {
  switch (missionType) {
    case 'npc_raid':
      return 'Raid';
    default:
      return missionType;
  }
}

function getStatusClass(status: MissionStatus): 'outbound' | 'returning' | 'at-target' {
  switch (status) {
    case 'returning':
      return 'returning';
    case 'at_target':
      return 'at-target';
    default:
      return 'outbound';
  }
}

function getStatusLabel(status: MissionStatus): string {
  switch (status) {
    case 'at_target':
      return 'at target';
    case 'returning':
      return 'returning';
    case 'completed':
      return 'completed';
    default:
      return 'outbound';
  }
}

function formatCountdownFromNow(nextTransitionTime: number | null, now: number): string {
  if (nextTransitionTime === null) return '—';
  return formatCountdown(Math.max(0, nextTransitionTime - now));
}

function formatRouteCoords(coords: Coordinates): string {
  return `[${coords.galaxy}:${coords.system}:${coords.slot}]`;
}

function sameCoordinates(a: Coordinates, b: Coordinates): boolean {
  return a.galaxy === b.galaxy && a.system === b.system && a.slot === b.slot;
}

function resolveTargetName(
  coordinates: Coordinates,
  planets: PlanetState[],
  npcColonies: NPCColony[],
): string | null {
  const planet = planets.find((p) => sameCoordinates(p.coordinates, coordinates));
  if (planet) return planet.name;
  const npc = npcColonies.find((n) => sameCoordinates(n.coordinates, coordinates));
  if (npc) return npc.name;
  return null;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getMovementProgress(entry: MovementEntry, now: number): number {
  if (entry.nextTransitionTime === null) {
    return 1;
  }

  const phaseDuration = entry.nextTransitionTime - entry.phaseStartTime;
  if (phaseDuration <= 0) {
    return 1;
  }

  return clamp01((now - entry.phaseStartTime) / phaseDuration);
}

function readCollapsedPreference(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

interface MovementRowProps {
  entry: MovementEntry;
  planets: PlanetState[];
  npcColonies: NPCColony[];
  now: number;
  onRecall: (id: string) => void;
}

function MovementRow({ entry, planets, npcColonies, now, onRecall }: MovementRowProps) {
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

  const sourcePlanet = entry.kind === 'player' ? planets[entry.sourcePlanetIndex] : undefined;
  const targetName = resolveTargetName(entry.targetCoordinates, planets, npcColonies);
  const statusClass = getStatusClass(entry.status);
  const countdown = formatCountdownFromNow(entry.nextTransitionTime, now);
  const progress = getMovementProgress(entry, now);
  const shipManifest = missionShipManifest(entry.ships);
  const hasCargo = entry.kind === 'player' &&
    entry.status === 'returning' &&
    (entry.cargo.metal > 0 || entry.cargo.crystal > 0 || entry.cargo.deuterium > 0);
  const arrow = entry.kind === 'npc' || entry.status !== 'returning' ? '→' : '←';

  return (
    <li
      ref={anchorRef}
      className="movement-row"
      onMouseEnter={openTooltip}
      onMouseLeave={scheduleClose}
    >
      <span className={`movement-type-pill ${getMissionTypeClass(entry.missionType)}`}>
        {getMissionTypeLabel(entry.missionType)}
      </span>

      <div className="movement-route-stack">
        <div className="movement-route">
          {entry.kind === 'npc' ? (
            <>
              <span className="movement-route__coords">
                {formatRouteCoords(entry.sourceCoordinates)}
              </span>
              <span
                className={`movement-route__arrow movement-route__arrow--${statusClass}`}
                aria-hidden="true"
              >
                {arrow}
              </span>
              <span className="movement-route__home">
                {targetName ?? 'Home Planet'}
              </span>
            </>
          ) : (
            <>
              <span className="movement-route__home">
                {sourcePlanet?.name ?? 'Home Planet'}
              </span>
              <span
                className={`movement-route__arrow movement-route__arrow--${statusClass}`}
                aria-hidden="true"
              >
                {arrow}
              </span>
              {targetName && (
                <span className="movement-route__target">{targetName}</span>
              )}
              <span className="movement-route__coords">
                {formatRouteCoords(entry.targetCoordinates)}
              </span>
            </>
          )}
        </div>

        <div className="movement-progress" aria-hidden="true">
          <span
            className={`movement-progress__fill movement-progress__fill--${statusClass}`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      <span className={`movement-status movement-status--${statusClass}`}>
        {getStatusLabel(entry.status)}
      </span>

      <span className="movement-eta">{countdown}</span>

      {entry.canRecall && (
        <button
          type="button"
          className="movement-recall"
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
  const [collapsed, setCollapsed] = useState<boolean>(() => readCollapsedPreference());

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

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? '1' : '0');
        } catch {
          // Ignore storage failures and keep in-memory state.
        }
      }

      return next;
    });
  };

  return (
    <nav ref={barRef} className="fleet-movements-bar" aria-label="Fleet movements">
      <button
        type="button"
        className={`fleet-movements-bar__header${collapsed ? '' : ' is-expanded'}`}
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        aria-controls="fleet-movements-list"
      >
        <span className="fleet-movements-bar__title">Fleet Movements</span>
        <span className="fleet-movements-bar__count">{fleetMovements.length}</span>
        <span className="fleet-movements-bar__chevron" aria-hidden="true">
          {collapsed ? '▲' : '▼'}
        </span>
      </button>

      {!collapsed && (
        <ul id="fleet-movements-list" className="fleet-movements-bar__list">
          {fleetMovements.map((entry) => (
            <MovementRow
              key={entry.id}
              entry={entry}
              planets={gameState.planets}
              npcColonies={gameState.galaxy.npcColonies}
              now={now}
              onRecall={recallFleet}
            />
          ))}
        </ul>
      )}
    </nav>
  );
}
