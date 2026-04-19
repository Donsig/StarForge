import { useRef, useState, type CSSProperties } from 'react';
import { CursorTooltip } from '../components/CursorTooltip.tsx';
import { DEFENCE_ORDER, DEFENCES } from '../data/defences.ts';
import { getPlanetImageUrl, getPlanetType } from '../data/assets.ts';
import { SHIP_ORDER, SHIPS } from '../data/ships.ts';
import { usedFields } from '../engine/BuildQueue.ts';
import { useGame } from '../context/GameContext';
import { useNow } from '../hooks/useNow.ts';
import type { MissionType, PlayerMovementEntry } from '../models/Fleet.ts';
import type { GameState } from '../models/GameState.ts';
import type { Coordinates } from '../models/Galaxy.ts';
import type { PlanetState } from '../models/Planet.ts';
import type { ActivePanel } from '../models/types.ts';
import { formatCompact } from '../utils/format.ts';
import { formatCoords } from '../utils/fleet.ts';
import { formatCountdown } from '../utils/time.ts';

interface ProgressBarProps {
  value: number;
  max: number;
  color: string;
  h?: number;
}

function ProgressBar({ value, max, color, h = 5 }: ProgressBarProps) {
  const safeMax = Math.max(1, max);
  const pct = Math.min(100, Math.max(0, (value / safeMax) * 100));
  const nearCap = pct > 88;

  return (
    <div className="overview-progress-bar" style={{ '--progress-height': `${h}px` } as CSSProperties}>
      <div
        className={`overview-progress-bar__fill${nearCap ? ' is-near-cap' : ''}`}
        style={{
          width: `${pct}%`,
          '--progress-color': color,
          '--progress-shadow': nearCap ? '0 0 8px #f0a83260' : `0 0 6px ${color}50`,
        } as CSSProperties}
      />
    </div>
  );
}

interface FieldRingProps {
  used: number;
  max: number;
  size?: number;
}

function FieldRing({ used, max, size = 80 }: FieldRingProps) {
  const safeMax = Math.max(0, max);
  const pct = safeMax === 0 ? 0 : Math.min(1, Math.max(0, used / safeMax));
  const r = 30;
  const cx = 40;
  const cy = 40;
  const circ = 2 * Math.PI * r;
  const danger = pct > 0.85;
  const warn = pct > 0.65;
  const color = danger ? '#f87171' : warn ? '#f0a832' : '#4d8fff';

  return (
    <div
      className="overview-field-ring"
      style={{ width: size, height: size, '--field-ring-color': color } as CSSProperties}
    >
      <svg
        className="overview-field-ring__svg"
        width={size}
        height={size}
        viewBox="0 0 80 80"
        aria-hidden="true"
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="5"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${color}80)` }}
        />
      </svg>
      <div className="overview-field-ring__value">
        <span className="overview-field-ring__used">{used}</span>
        <span className="overview-field-ring__max">/{safeMax}</span>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

function StatCard({ label, value, sub, color = '#c8e0ff' }: StatCardProps) {
  return (
    <article className="overview-stat-card">
      <div className="overview-stat-card__value" style={{ color }}>
        {value}
      </div>
      <div className="overview-stat-card__label">{label}</div>
      {sub ? <div className="overview-stat-card__sub">{sub}</div> : null}
    </article>
  );
}

interface IncomingAlertProps {
  sourceLabel: string;
  targetName: string;
  countdown: string;
}

type ActivityFeedType = 'victory' | 'defeat' | 'espionage' | 'harvest';

interface ActivityFeedEntry {
  id: string;
  type: ActivityFeedType;
  timestamp: number;
  read: boolean;
  text: string;
  loot: number | null;
  detail:
    | {
      kind: 'combat';
      attackerLosses?: Record<string, number>;
      defenderLosses?: Record<string, number>;
      plundered?: { metal: number; crystal: number; deuterium: number };
      debris?: { metal: number; crystal: number };
      targetCoords: Coordinates;
    }
    | {
      kind: 'espionage';
      resources?: { metal: number; crystal: number; deuterium: number };
      fleet?: Record<string, number>;
      defences?: Record<string, number>;
      detected: boolean;
      targetCoords: Coordinates;
    }
    | {
      kind: 'harvest';
      loot: { metal: number; crystal: number; deuterium: number };
      targetCoords: Coordinates;
    };
}

const ACTIVITY_CONFIG: Record<
  ActivityFeedType,
  { color: string; bg: string; border: string; label: string }
> = {
  victory: {
    color: '#34d399',
    bg: 'rgba(52,211,153,0.08)',
    border: 'rgba(52,211,153,0.25)',
    label: 'VICTORY',
  },
  defeat: {
    color: '#f87171',
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.25)',
    label: 'DEFEAT',
  },
  espionage: {
    color: '#818cf8',
    bg: 'rgba(129,140,248,0.08)',
    border: 'rgba(129,140,248,0.25)',
    label: 'ESP',
  },
  harvest: {
    color: '#30d5c8',
    bg: 'rgba(48,213,200,0.08)',
    border: 'rgba(48,213,200,0.25)',
    label: 'HARVEST',
  },
};

function IncomingAlert({ sourceLabel, targetName, countdown }: IncomingAlertProps) {
  return (
    <article className="overview-incoming-alert">
      <span className="overview-incoming-alert__icon" aria-hidden="true">
        ⚠
      </span>
      <div className="overview-incoming-alert__body">
        <div className="overview-incoming-alert__title">Incoming Attack</div>
        <div className="overview-incoming-alert__sub">
          {sourceLabel} {'\u2192'} {targetName} · ETA {countdown}
        </div>
      </div>
      <span className="overview-incoming-alert__eta">{countdown}</span>
    </article>
  );
}

function formatPlanetTypeLabel(maxTemperature: number): string {
  const type = getPlanetType(maxTemperature);
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatTemperature(maxTemperature: number): string {
  return `${maxTemperature >= 0 ? '+' : ''}${maxTemperature}\u00b0C`;
}

function timeAgo(ts: number): string {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));

  if (elapsedSeconds < 30) {
    return 'just now';
  }

  if (elapsedSeconds < 3600) {
    return `${Math.floor(elapsedSeconds / 60)}m ago`;
  }

  if (elapsedSeconds < 86_400) {
    return `${Math.floor(elapsedSeconds / 3600)}h ago`;
  }

  return `${Math.floor(elapsedSeconds / 86_400)}d ago`;
}

function formatCountdownFromNow(nextTransitionTime: number | null, now: number): string {
  if (nextTransitionTime === null) {
    return '\u2014';
  }

  return formatCountdown(Math.max(0, nextTransitionTime - now));
}

const MISSION_COLOURS: Record<MissionType, string> = {
  attack: '#f87171',
  harvest: '#30d5c8',
  espionage: '#818cf8',
  transport: '#34d399',
  colonise: '#cc88ff',
  deploy: '#9999bb',
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function sameCoordinates(a: Coordinates, b: Coordinates): boolean {
  return a.galaxy === b.galaxy && a.system === b.system && a.slot === b.slot;
}

function getMissionColor(missionType: MissionType): string {
  return MISSION_COLOURS[missionType] ?? '#c8e0ff';
}

function getMissionTargetLabel(
  mission: PlayerMovementEntry,
  planets: PlanetState[],
): string {
  const targetPlanet = planets.find((planet) =>
    sameCoordinates(planet.coordinates, mission.targetCoordinates)
  );
  return targetPlanet?.name ?? formatCoords(mission.targetCoordinates);
}

function getMissionRouteLabel(
  mission: PlayerMovementEntry,
  planets: PlanetState[],
): string {
  const sourcePlanetName = planets[mission.sourcePlanetIndex]?.name ?? 'Home Planet';
  const targetLabel = getMissionTargetLabel(mission, planets);
  const arrow = mission.status === 'returning' ? '\u2190' : '\u2192';
  return `${sourcePlanetName} ${arrow} ${targetLabel}`;
}

function getMissionProgress(mission: PlayerMovementEntry, now: number): number {
  if (mission.nextTransitionTime === null) {
    return 1;
  }

  const phaseDuration = mission.nextTransitionTime - mission.phaseStartTime;
  if (phaseDuration <= 0) {
    return 1;
  }

  return clamp01((now - mission.phaseStartTime) / phaseDuration);
}

function hasMissionCargo(mission: PlayerMovementEntry): boolean {
  return mission.cargo.metal > 0 || mission.cargo.crystal > 0 || mission.cargo.deuterium > 0;
}

function summariseLoot(resources: { metal: number; crystal: number; deuterium: number }): number {
  return resources.metal + resources.crystal + resources.deuterium;
}

function formatUnitLabel(unitId: string): string {
  return SHIPS[unitId as keyof typeof SHIPS]?.name ??
    DEFENCES[unitId as keyof typeof DEFENCES]?.name ??
    unitId.replace(/([A-Z])/g, ' $1').trim();
}

function compactUnitMap(
  ...groups: Array<Partial<Record<string, number>> | undefined>
): Record<string, number> | undefined {
  const entries = groups.flatMap((group) => Object.entries(group ?? {}))
    .filter(([, count]) => Math.max(0, Math.floor(count ?? 0)) > 0);

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function buildActivityEntries(state: GameState): ActivityFeedEntry[] {
  const combatEntries: ActivityFeedEntry[] = state.combatLog.map((entry) => {
    const lootTotal = summariseLoot(entry.result.loot);

    return {
      id: entry.id,
      type: entry.result.outcome === 'attacker_wins' ? 'victory' : 'defeat',
      timestamp: entry.timestamp,
      read: entry.read,
      text: `${entry.result.outcome === 'attacker_wins' ? 'Victory' : 'Defeat'} at ${formatCoords(entry.targetCoordinates)}`,
      loot: lootTotal > 0 ? lootTotal : null,
      detail: {
        kind: 'combat',
        attackerLosses: compactUnitMap(entry.result.attackerLosses.ships),
        defenderLosses: compactUnitMap(
          entry.result.defenderLosses.ships,
          entry.result.defenderLosses.defences,
        ),
        plundered: entry.result.loot,
        debris: entry.result.debrisCreated,
        targetCoords: entry.targetCoordinates,
      },
    };
  });

  const espionageEntries: ActivityFeedEntry[] = state.espionageReports.map((report) => ({
    id: report.id,
    type: 'espionage',
    timestamp: report.timestamp,
    read: report.read,
    text: `${report.targetName || formatCoords(report.targetCoordinates)} scanned`,
    loot: null,
    detail: {
      kind: 'espionage',
      resources: report.resources,
      fleet: compactUnitMap(report.fleet),
      defences: compactUnitMap(report.defences),
      detected: report.detected,
      targetCoords: report.targetCoordinates,
    },
  }));

  const harvestEntries: ActivityFeedEntry[] = state.fleetNotifications
    .filter((notification) => notification.missionType === 'harvest')
    .map((notification) => ({
      id: notification.id,
      type: 'harvest',
      timestamp: notification.timestamp,
      read: notification.read,
      text: `${notification.targetName || formatCoords(notification.targetCoordinates)} harvested`,
      loot: summariseLoot(notification.loot) || null,
      detail: {
        kind: 'harvest',
        loot: notification.loot,
        targetCoords: notification.targetCoordinates,
      },
    }));

  return [...combatEntries, ...espionageEntries, ...harvestEntries]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);
}

function renderActivityUnitRows(units: Record<string, number> | undefined) {
  const entries = Object.entries(units ?? {});

  if (entries.length === 0) {
    return <div className="overview-activity-entry__detail-empty">No losses</div>;
  }

  return entries.map(([unitId, count]) => (
    <div key={unitId} className="overview-activity-entry__loss-row">
      <span className="overview-activity-entry__loss-label">{formatUnitLabel(unitId)}</span>
      <span className="overview-activity-entry__loss-value">-{count}</span>
    </div>
  ));
}

function renderIntelUnitRows(units: Record<string, number> | undefined) {
  const entries = Object.entries(units ?? {})
    .filter(([, count]) => Math.max(0, Math.floor(count ?? 0)) > 0);

  return entries.map(([unitId, count]) => (
    <div key={unitId} className="overview-activity-entry__intel-row">
      <span className="overview-activity-entry__intel-label">{formatUnitLabel(unitId)}</span>
      <span className="overview-activity-entry__intel-value">{count}</span>
    </div>
  ));
}

function ActivityEntry({
  entry,
  expanded,
  onToggle,
  onNavigate,
}: {
  entry: ActivityFeedEntry;
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: (panel: ActivePanel) => void;
}) {
  const config = ACTIVITY_CONFIG[entry.type];
  const loot = entry.loot;
  const style = {
    '--activity-color': config.color,
    '--activity-bg': config.bg,
    '--activity-border': config.border,
    '--activity-label-bg': `${config.color}20`,
    '--activity-label-border': `${config.color}40`,
    '--activity-expanded-border': `${config.color}50`,
    '--activity-expanded-bg': `${config.color}12`,
    '--activity-divider': `${config.color}25`,
  } as CSSProperties;

  return (
    <div
      className={`overview-activity-entry${expanded ? ' is-expanded' : ''}${!entry.read ? ' is-unread' : ''}`}
      style={style}
    >
      <button
        type="button"
        className="overview-activity-entry__toggle"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="overview-activity-entry__badge">{config.label}</span>
        <span className="overview-activity-entry__text">{entry.text}</span>
        {loot !== null ? (
          <span className="overview-activity-entry__loot">+{formatCompact(loot)}</span>
        ) : null}
        <span className="overview-activity-entry__time">{timeAgo(entry.timestamp)}</span>
        {!entry.read ? <span className="overview-activity-entry__unread-dot" aria-hidden="true" /> : null}
        <span className="overview-activity-entry__chevron" aria-hidden="true">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded ? (
        <div className="overview-activity-entry__detail">
          {entry.detail.kind === 'combat' ? (
            <>
              <div className="overview-activity-entry__combat-grid">
                <div className="overview-activity-entry__detail-card overview-activity-entry__detail-card--attacker">
                  <div className="overview-activity-entry__detail-card-title overview-activity-entry__detail-card-title--attacker">
                    Attacker — You
                  </div>
                  {renderActivityUnitRows(entry.detail.attackerLosses)}
                </div>

                <div className="overview-activity-entry__detail-card overview-activity-entry__detail-card--defender">
                  <div className="overview-activity-entry__detail-card-title overview-activity-entry__detail-card-title--defender">
                    Defender
                  </div>
                  {renderActivityUnitRows(entry.detail.defenderLosses)}
                </div>
              </div>

              {entry.loot !== null && entry.loot > 0 && entry.detail.plundered ? (
                <div className="overview-activity-entry__detail-card overview-activity-entry__detail-card--plunder">
                  <div className="overview-activity-entry__detail-card-title overview-activity-entry__detail-card-title--plunder">
                    Plundered
                  </div>
                  <div className="overview-activity-entry__resource-total">
                    {formatCompact(entry.loot)} resources
                  </div>
                </div>
              ) : null}

              {entry.detail.debris &&
              (entry.detail.debris.metal > 0 || entry.detail.debris.crystal > 0) ? (
                <div className="overview-activity-entry__detail-card overview-activity-entry__detail-card--debris">
                  <div className="overview-activity-entry__detail-card-title overview-activity-entry__detail-card-title--debris">
                    Debris Field
                  </div>
                  <div className="overview-activity-entry__resource-breakdown">
                    <span>M {formatCompact(entry.detail.debris.metal)}</span>
                    <span>C {formatCompact(entry.detail.debris.crystal)}</span>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {entry.detail.kind === 'espionage' ? (
            <>
              {entry.detail.detected ? (
                <div className="overview-activity-entry__warning">
                  ⚠ Probes destroyed — intelligence may be incomplete
                </div>
              ) : null}

              <div className="overview-activity-entry__intel-grid">
                {entry.detail.resources ? (
                  <div className="overview-activity-entry__detail-card overview-activity-entry__detail-card--resources">
                    <div className="overview-activity-entry__detail-card-title overview-activity-entry__detail-card-title--resources">
                      Resources
                    </div>
                    <div className="overview-activity-entry__resource-list">
                      <span className="overview-activity-entry__resource-line overview-activity-entry__resource-line--metal">
                        M {formatCompact(entry.detail.resources.metal)}
                      </span>
                      <span className="overview-activity-entry__resource-line overview-activity-entry__resource-line--crystal">
                        C {formatCompact(entry.detail.resources.crystal)}
                      </span>
                      <span className="overview-activity-entry__resource-line overview-activity-entry__resource-line--deuterium">
                        D {formatCompact(entry.detail.resources.deuterium)}
                      </span>
                    </div>
                  </div>
                ) : null}

                {entry.detail.fleet ? (
                  <div className="overview-activity-entry__detail-card overview-activity-entry__detail-card--fleet">
                    <div className="overview-activity-entry__detail-card-title overview-activity-entry__detail-card-title--fleet">
                      Fleet
                    </div>
                    {renderIntelUnitRows(entry.detail.fleet)}
                  </div>
                ) : null}

                {entry.detail.defences ? (
                  <div className="overview-activity-entry__detail-card overview-activity-entry__detail-card--defences">
                    <div className="overview-activity-entry__detail-card-title overview-activity-entry__detail-card-title--defences">
                      Defences
                    </div>
                    {renderIntelUnitRows(entry.detail.defences)}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {entry.detail.kind === 'harvest' ? (
            <div className="overview-activity-entry__harvest-line">
              Collected {formatCompact(entry.loot ?? 0)} resources (M {formatCompact(entry.detail.loot.metal)}
              {' · '}
              C {formatCompact(entry.detail.loot.crystal)}
              {' · '}
              D {formatCompact(entry.detail.loot.deuterium)})
            </div>
          ) : null}

          <div className="overview-activity-entry__footer">
            <button
              type="button"
              className="overview-activity-entry__messages-btn"
              onClick={() => onNavigate?.('messages')}
            >
              View in Messages
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface OverviewPanelProps {
  onNavigate?: (panel: ActivePanel) => void;
}

export function OverviewPanel({ onNavigate }: OverviewPanelProps = {}) {
  const { gameState, fleetMovements, productionRates, storageCaps, renamePlanet } = useGame();
  const now = useNow(1000);
  const activePlanetIndex = gameState.activePlanetIndex;
  const planet = gameState.planets[activePlanetIndex];
  const speed = gameState.settings.gameSpeed;
  const [editingPlanetIndex, setEditingPlanetIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [hoveredMission, setHoveredMission] = useState<string | null>(null);
  const [missionHoverPos, setMissionHoverPos] = useState({ x: 0, y: 0 });
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const committedRef = useRef(false);

  const fieldsUsed = usedFields(gameState);
  const editing = editingPlanetIndex === activePlanetIndex;

  const [lastActivePlanetIndex, setLastActivePlanetIndex] = useState(activePlanetIndex);
  if (lastActivePlanetIndex !== activePlanetIndex) {
    setLastActivePlanetIndex(activePlanetIndex);
    if (editingPlanetIndex !== null) {
      setEditingPlanetIndex(null);
      setDraft('');
    }
  }

  let totalShips = 0;
  let fleetPower = 0;

  for (const shipId of SHIP_ORDER) {
    if (shipId === 'solarSatellite') continue;
    const count = planet.ships[shipId];
    totalShips += count;
    fleetPower += count * SHIPS[shipId].weaponPower;
  }

  let defencePower = 0;
  let defShield = 0;

  for (const defenceId of DEFENCE_ORDER) {
    const count = planet.defences[defenceId];
    defencePower += count * DEFENCES[defenceId].weaponPower;
    defShield += count * DEFENCES[defenceId].shieldPower;
  }

  const playerMissions = fleetMovements.filter(
    (movement): movement is PlayerMovementEntry => movement.kind === 'player',
  );
  const missionCount = playerMissions.length;
  const incomingThreats = fleetMovements.filter((m) =>
    m.kind === 'npc' &&
    m.status !== 'returning' &&
    m.targetCoordinates.galaxy === planet.coordinates.galaxy &&
    m.targetCoordinates.system === planet.coordinates.system &&
    m.targetCoordinates.slot === planet.coordinates.slot
  );

  const freeFields = Math.max(0, planet.maxFields - fieldsUsed);
  const fieldUtilisation = planet.maxFields > 0
    ? Math.round((fieldsUsed / planet.maxFields) * 100)
    : 0;
  const energySurplus = productionRates.energyProduction - productionRates.energyConsumption;
  const energyEfficiencyPct =
    productionRates.energyConsumption <= 0
      ? 100
      : Math.min(
          100,
          (productionRates.energyProduction / productionRates.energyConsumption) * 100,
        );
  const hoveredMissionEntry = hoveredMission === null
    ? null
    : playerMissions.find((mission) => mission.id === hoveredMission) ?? null;
  const hoveredMissionColor = hoveredMissionEntry
    ? getMissionColor(hoveredMissionEntry.missionType)
    : null;
  const hoveredMissionShips = hoveredMissionEntry
    ? Object.entries(hoveredMissionEntry.ships).filter(([, count]) => (count ?? 0) > 0)
    : [];
  const activityEntries = buildActivityEntries(gameState);

  const startEditing = () => {
    committedRef.current = false;
    setDraft(planet.name);
    setEditingPlanetIndex(activePlanetIndex);
  };

  const commit = () => {
    if (committedRef.current || editingPlanetIndex !== activePlanetIndex) {
      return;
    }

    committedRef.current = true;
    renamePlanet(activePlanetIndex, draft);
    setEditingPlanetIndex(null);
    setDraft('');
  };

  const cancel = () => {
    committedRef.current = false;
    setEditingPlanetIndex(null);
    setDraft('');
  };

  return (
    <section className="panel overview-panel">
      <div className="overview-hero">
        <img
          className="overview-hero__image"
          src={getPlanetImageUrl(planet.maxTemperature)}
          alt={planet.name}
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
        <div className="overview-hero__gradient" aria-hidden="true" />

        <div className="overview-hero__content">
          <div className="overview-hero__copy">
            {editing ? (
              <input
                type="text"
                className="input planet-rename-input overview-hero__rename-input"
                value={draft}
                maxLength={30}
                autoFocus
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commit();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    cancel();
                  }
                }}
                onBlur={commit}
                aria-label="Planet name"
              />
            ) : (
              <div className="overview-hero__title-row">
                <h1 className="overview-hero__title">{planet.name}</h1>
                <button
                  type="button"
                  className="overview-hero__rename-btn"
                  aria-label="Rename planet"
                  onClick={startEditing}
                >
                  {'\u270e'}
                </button>
              </div>
            )}

            <div className="overview-hero__meta">
              [{planet.coordinates.galaxy}:{planet.coordinates.system}:{planet.coordinates.slot}] ·{' '}
              {formatTemperature(planet.maxTemperature)} · {formatPlanetTypeLabel(planet.maxTemperature)}
            </div>
          </div>

          <div className="overview-hero__stats">
            <FieldRing used={fieldsUsed} max={planet.maxFields} size={72} />
            <div className="overview-hero__field-meta">
              <span className="overview-hero__field-value">{freeFields} free fields</span>
              <span className="overview-hero__field-sub">{fieldUtilisation}% utilised</span>
            </div>
          </div>
        </div>
      </div>

      {incomingThreats.length > 0 ? (
        <section className="overview-threats">
          <div className="overview-section-heading overview-section-heading--danger">
            <span className="overview-section-heading__dot" aria-hidden="true" />
            Incoming Threats
          </div>
          <div className="overview-threats__list">
            {incomingThreats.map((entry) => (
              <IncomingAlert
                key={entry.id}
                sourceLabel={formatCoords(entry.sourceCoordinates)}
                targetName={planet.name}
                countdown={formatCountdownFromNow(entry.nextTransitionTime, now)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="overview-production-card">
        <div className="overview-section-heading">Resource Production</div>
        <div className="overview-production-card__rows">
          <div className="overview-production-row">
            <span className="overview-production-row__label">Metal</span>
            <ProgressBar value={planet.resources.metal} max={storageCaps.metal} color="#9ca3af" h={6} />
            <span className="overview-production-row__amount" style={{ color: '#9ca3af' }}>
              {formatCompact(planet.resources.metal)}
            </span>
            <span className="overview-production-row__rate">
              +{formatCompact(productionRates.metalPerHour * speed)}/h
            </span>
          </div>

          <div className="overview-production-row">
            <span className="overview-production-row__label">Crystal</span>
            <ProgressBar value={planet.resources.crystal} max={storageCaps.crystal} color="#60a5fa" h={6} />
            <span className="overview-production-row__amount" style={{ color: '#60a5fa' }}>
              {formatCompact(planet.resources.crystal)}
            </span>
            <span className="overview-production-row__rate">
              +{formatCompact(productionRates.crystalPerHour * speed)}/h
            </span>
          </div>

          <div className="overview-production-row">
            <span className="overview-production-row__label">Deuterium</span>
            <ProgressBar
              value={planet.resources.deuterium}
              max={storageCaps.deuterium}
              color="#34d399"
              h={6}
            />
            <span className="overview-production-row__amount" style={{ color: '#34d399' }}>
              {formatCompact(planet.resources.deuterium)}
            </span>
            <span className="overview-production-row__rate">
              +{formatCompact(productionRates.deuteriumPerHour * speed)}/h
            </span>
          </div>

          <div className="overview-production-row overview-production-row--energy">
            <span className="overview-production-row__label">Energy</span>
            <div className="overview-energy-bar" aria-hidden="true">
              <div
                className="overview-energy-bar__fill"
                style={{ width: `${energyEfficiencyPct}%` }}
              />
            </div>
            <span
              className={`overview-production-row__amount ${
                energySurplus >= 0
                  ? 'overview-production-row__amount--positive'
                  : 'overview-production-row__amount--negative'
              }`}
            >
              {energySurplus >= 0 ? '+' : ''}
              {formatCompact(energySurplus)}
            </span>
            <span className="overview-production-row__rate">
              {formatCompact(productionRates.energyProduction)}
            </span>
          </div>
        </div>
      </section>

      <div className="overview-stat-grid">
        <StatCard
          label="Fleet Ships"
          value={formatCompact(totalShips)}
          color="#4d8fff"
          sub={`${missionCount} on mission`}
        />
        <StatCard
          label="Fleet Power"
          value={formatCompact(fleetPower)}
          color="#f87171"
          sub="total weapon rating"
        />
        <StatCard
          label="Defence Power"
          value={formatCompact(defencePower)}
          color="#f0a832"
          sub={`Shield ${formatCompact(defShield)}`}
        />
        <StatCard
          label="Metal Mine"
          value={`Lv ${planet.buildings.metalMine}`}
          color="#9ca3af"
          sub={`+${formatCompact(productionRates.metalPerHour * speed)}/h`}
        />
        <StatCard
          label="Crystal Mine"
          value={`Lv ${planet.buildings.crystalMine}`}
          color="#60a5fa"
          sub={`+${formatCompact(productionRates.crystalPerHour * speed)}/h`}
        />
        <StatCard
          label="Shipyard"
          value={`Lv ${planet.buildings.shipyard}`}
          color="#c8e0ff"
          sub={`Research Lab ${planet.buildings.researchLab}`}
        />
      </div>

      {playerMissions.length > 0 ? (
        <section className="overview-missions">
          <div className="overview-missions__header">Active Missions</div>
          <div className="overview-missions__list">
            {playerMissions.map((mission) => {
              const missionColor = getMissionColor(mission.missionType);
              const progress = getMissionProgress(mission, now);

              return (
                <div
                  key={mission.id}
                  className={`overview-mission-row${hoveredMission === mission.id ? ' is-hovered' : ''}`}
                  style={{
                    '--mission-color': missionColor,
                    '--mission-color-pill-bg': `${missionColor}18`,
                    '--mission-color-hover-bg': `${missionColor}10`,
                    '--mission-color-hover-border': `${missionColor}40`,
                    '--mission-progress-width': `${progress * 100}%`,
                  } as CSSProperties}
                  onMouseEnter={(event) => {
                    setHoveredMission(mission.id);
                    setMissionHoverPos({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseMove={(event) => {
                    setMissionHoverPos({ x: event.clientX, y: event.clientY });
                  }}
                  onMouseLeave={() => setHoveredMission(null)}
                >
                  <span className="overview-mission-row__type">{mission.missionType}</span>
                  <span className="overview-mission-row__route">
                    {getMissionRouteLabel(mission, gameState.planets)}
                  </span>
                  <div className="overview-mission-row__progress" aria-hidden="true">
                    <div className="overview-mission-row__progress-fill" />
                  </div>
                  <span className="overview-mission-row__eta">
                    {formatCountdownFromNow(mission.nextTransitionTime, now)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="overview-activity">
        {activityEntries.length > 0 ? (
          <>
            <div className="overview-activity__header">Recent Activity</div>
            <div className="overview-activity__list">
              {activityEntries.map((entry) => (
                <ActivityEntry
                  key={entry.id}
                  entry={entry}
                  expanded={expandedActivity === entry.id}
                  onToggle={() => {
                    setExpandedActivity((current) => (current === entry.id ? null : entry.id));
                  }}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="overview-activity__empty">No recent activity</div>
        )}
      </section>

      <CursorTooltip
        visible={hoveredMissionEntry !== null}
        x={missionHoverPos.x}
        y={missionHoverPos.y}
      >
        {hoveredMissionEntry && hoveredMissionColor ? (
          <div
            className="cursor-tooltip-card"
            style={{
              '--mission-color': hoveredMissionColor,
              '--mission-color-border': `${hoveredMissionColor}40`,
              '--mission-color-divider': `${hoveredMissionColor}25`,
            } as CSSProperties}
          >
            <div className="cursor-tooltip-card__title">
              {hoveredMissionEntry.missionType} Mission
            </div>
            <div className="cursor-tooltip-card__route">
              {getMissionRouteLabel(hoveredMissionEntry, gameState.planets)}
            </div>
            <div className="cursor-tooltip-card__rows">
              <div className="cursor-tooltip-card__row">
                <span className="cursor-tooltip-card__label">Status</span>
                <span className="cursor-tooltip-card__value cursor-tooltip-card__value--mission">
                  {hoveredMissionEntry.status}
                </span>
              </div>
              <div className="cursor-tooltip-card__row">
                <span className="cursor-tooltip-card__label">ETA</span>
                <span className="cursor-tooltip-card__value">
                  {formatCountdownFromNow(hoveredMissionEntry.nextTransitionTime, now)}
                </span>
              </div>
              {hoveredMissionShips.map(([shipId, count]) => (
                <div key={shipId} className="cursor-tooltip-card__row">
                  <span className="cursor-tooltip-card__label">
                    {shipId.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <span className="cursor-tooltip-card__value">{count}</span>
                </div>
              ))}
              {hasMissionCargo(hoveredMissionEntry) ? (
                <div className="cursor-tooltip-card__cargo">
                  <div className="cursor-tooltip-card__cargo-title">Cargo</div>
                  <div className="cursor-tooltip-card__cargo-value">
                    M {formatCompact(hoveredMissionEntry.cargo.metal)}
                    {' · '}
                    C {formatCompact(hoveredMissionEntry.cargo.crystal)}
                    {hoveredMissionEntry.cargo.deuterium > 0
                      ? ` · D ${formatCompact(hoveredMissionEntry.cargo.deuterium)}`
                      : ''}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </CursorTooltip>
    </section>
  );
}
