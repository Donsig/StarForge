import { useCallback, useEffect, useMemo, useState } from 'react';
import { CursorTooltip } from '../components/CursorTooltip';
import { PanelBanner } from '../components/PanelBanner';
import type { EspionageReport, FleetMission } from '../models/Fleet.ts';
import { useGame } from '../context/GameContext';
import { getPlanetImageUrl } from '../data/assets.ts';
import { GALAXY_CONSTANTS } from '../data/galaxy.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { DEFENCES } from '../data/defences.ts';
import { SHIPS } from '../data/ships.ts';
import { calcDistance, calcFuelCost, calcMaxFleetSlots } from '../engine/FleetEngine.ts';
import {
  canColonize,
  getNPCCurrentForce,
  getSystemSlots,
} from '../engine/GalaxyEngine.ts';
import type { Coordinates, DebrisField, NPCColony } from '../models/Galaxy.ts';
import type { ActivePanel } from '../models/types.ts';
import { formatNumber } from '../utils/format.ts';
import { npcRelativeStrengthLabel } from './galaxyStrength.ts';

// ─── Strength config ──────────────────────────────────────────────────────────

const STRENGTH_CONFIG = {
  weak:      { color: '#34d399', label: 'Weak',      bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.3)' },
  moderate:  { color: '#f0a832', label: 'Moderate',  bg: 'rgba(240,168,50,0.08)',  border: 'rgba(240,168,50,0.3)' },
  strong:    { color: '#f87171', label: 'Strong',    bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.3)' },
  dangerous: { color: '#ff3366', label: 'Dangerous', bg: 'rgba(255,51,102,0.1)',   border: 'rgba(255,51,102,0.4)' },
};

type StrengthKey = keyof typeof STRENGTH_CONFIG;

function strengthConfigKey(label: string): StrengthKey {
  switch (label) {
    case 'Easy': return 'weak';
    case 'Fair': return 'weak';
    case 'Even': return 'moderate';
    case 'Hard': return 'strong';
    case 'Dangerous': return 'dangerous';
    default: return 'moderate';
  }
}

// ─── Mission colours ──────────────────────────────────────────────────────────

const MISSION_COLORS: Record<string, string> = {
  attack:    '#f87171',
  harvest:   '#30d5c8',
  espionage: '#818cf8',
  transport: '#34d399',
  colonise:  '#a78bfa',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcNPCPower(colony: NPCColony, now: number): number {
  const force = getNPCCurrentForce(colony, now);
  let power = 0;
  for (const [id, count] of Object.entries(force.ships)) {
    if (count > 0) power += (SHIPS[id as keyof typeof SHIPS]?.weaponPower ?? 0) * count;
  }
  for (const [id, count] of Object.entries(force.defences)) {
    if (count > 0) power += (DEFENCES[id as keyof typeof DEFENCES]?.weaponPower ?? 0) * count;
  }
  return power;
}

function formatSpecialtyLabel(specialty: string): string {
  if (!specialty) return '';
  return specialty.charAt(0).toUpperCase() + specialty.slice(1);
}

function coordsKey(coords: Coordinates): string {
  return `${coords.galaxy}:${coords.system}:${coords.slot}`;
}

function formatScannedAgo(timestamp: number, now: number): string {
  const elapsedMs = Math.max(0, now - timestamp);
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  if (elapsedMinutes < 1) return 'Scanned just now';
  if (elapsedMinutes < 60) return `Scanned ${elapsedMinutes} min ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Scanned ${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `Scanned ${elapsedDays}d ago`;
}

function formatGameHours(hours: number): string {
  const clamped = Math.max(0, hours);
  const digits = clamped >= 10 ? 0 : 1;
  return `${clamped.toFixed(digits)}h`;
}

function abandonmentStatusLabel(
  abandonment: NonNullable<EspionageReport['abandonmentProximity']>,
): string {
  if (abandonment.status === 'imminent') return 'Imminent';
  if (abandonment.status === 'atRisk') return 'At Risk';
  return 'Stable';
}

function unitName(unitId: string): string {
  return SHIPS[unitId as keyof typeof SHIPS]?.name ?? unitId;
}

function defenceName(defenceId: string): string {
  return DEFENCES[defenceId as keyof typeof DEFENCES]?.name ?? defenceId;
}

function buildingName(buildingId: string): string {
  return BUILDINGS[buildingId as keyof typeof BUILDINGS]?.name ?? buildingId;
}

function listEntries(
  values: Record<string, number> | undefined,
  nameResolver: (id: string) => string,
): Array<{ id: string; name: string; count: number }> {
  return Object.entries(values ?? {})
    .map(([id, countValue]) => ({
      id,
      name: nameResolver(id),
      count: Math.max(0, Math.floor(countValue)),
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);
}

function tempColor(t: number): string {
  if (t < -60) return '#a5f3fc';
  if (t < 0)   return '#7dd3fc';
  if (t < 40)  return '#86efac';
  if (t < 80)  return '#fde68a';
  return '#fb923c';
}

// ─── PlanetDot ────────────────────────────────────────────────────────────────

interface PlanetDotProps {
  type: 'empty' | 'player' | 'npc';
  strengthKey?: StrengthKey;
  temp?: number;
  faded?: boolean;
  size?: number;
}

function PlanetDot({ type, strengthKey, temp = 20, faded = false, size = 22 }: PlanetDotProps) {
  if (type === 'empty') {
    return (
      <div
        style={{
          width: size, height: size, borderRadius: '50%',
          border: '1px dashed rgba(60,80,120,0.35)',
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(60,80,120,0.3)' }} />
      </div>
    );
  }
  const col = type === 'player' ? '#4d8fff' : (STRENGTH_CONFIG[strengthKey ?? 'moderate']?.color ?? '#f0a832');
  const src = getPlanetImageUrl(temp, 'icon');
  return (
    <div className="planet-icon" style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <img
        src={src}
        alt=""
        style={{
          width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover',
          opacity: faded ? 0.4 : 1,
          boxShadow: `0 0 ${size / 2}px ${col}60`,
          border: `1.5px solid ${col}80`,
        }}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          const next = e.currentTarget.nextSibling as HTMLElement | null;
          if (next) next.style.display = 'flex';
        }}
      />
      {/* Fallback gradient circle shown if image fails */}
      <div
        style={{
          display: 'none', position: 'absolute', inset: 0, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, ${tempColor(temp)}, ${col})`,
          boxShadow: `0 0 ${size / 2}px ${col}50`,
          opacity: faded ? 0.45 : 1,
        }}
      />
    </div>
  );
}

// ─── EspionageHoverPanel ──────────────────────────────────────────────────────

interface EspionageTooltipContentProps {
  slotName: string;
  strengthKey: StrengthKey | null;
  activeMissions: FleetMission[];
  report: EspionageReport | null;
  now: number;
}

function EspionageTooltipContent({
  slotName,
  strengthKey,
  activeMissions,
  report,
  now,
}: EspionageTooltipContentProps) {
  const sc = strengthKey ? STRENGTH_CONFIG[strengthKey] : null;

  return (
    <div className="galaxy-spy-hover-panel">
      {/* Header: planet name + strength badge */}
      <div className="galaxy-intel-header">
        <strong>{slotName}</strong>
        {sc && (
          <span
            className="galaxy-intel-strength-badge"
            style={{ color: sc.color, borderColor: sc.border, background: sc.bg }}
          >
            ⚔ {sc.label}
          </span>
        )}
      </div>

      {/* Active missions */}
      {activeMissions.length > 0 && (
        <div className="galaxy-intel-block galaxy-intel-missions">
          <p className="galaxy-intel-label">Active Missions</p>
          {activeMissions.map((m) => {
            const mc = MISSION_COLORS[m.type] ?? '#c8e0ff';
            return (
              <div key={m.id} className="galaxy-intel-mission-row">
                <span
                  className="galaxy-mission-chip"
                  style={{
                    color: mc,
                    borderColor: `${mc}40`,
                    background: 'rgba(20,25,50,0.9)',
                  }}
                >
                  {m.type.toUpperCase()}
                </span>
                <span style={{ color: 'rgba(150,180,220,0.7)', fontSize: '0.75rem' }}>
                  {m.status === 'returning' ? '← returning' : '→ outbound'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Intel content */}
      {!report ? (
        <p className="galaxy-intel-empty">No intelligence — send probes to gather data</p>
      ) : report.detected ? (
        <>
          <p className="galaxy-intel-title">Probes detected — last spy attempt failed</p>
          <p className="galaxy-intel-meta">{formatScannedAgo(report.timestamp, now)}</p>
        </>
      ) : (
        <>
          <div className="galaxy-intel-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <strong>{report.targetName}</strong>
            {report.tier !== undefined && (
              <span className="galaxy-intel-tier number">Tier {report.tier}</span>
            )}
          </div>
          <p className="galaxy-intel-meta">{formatScannedAgo(report.timestamp, now)}</p>

          {report.specialty && (
            <div className="galaxy-intel-block">
              <p className="galaxy-intel-line">
                Specialty: <span className="number">{formatSpecialtyLabel(report.specialty)}</span>
              </p>
            </div>
          )}

          {report.abandonmentProximity && (() => {
            const abandonment = report.abandonmentProximity!;
            return (
              <div className="galaxy-intel-block">
                <p className="galaxy-intel-label">Abandonment</p>
                <p className={`galaxy-intel-line galaxy-intel-abandonment galaxy-intel-abandonment-${abandonment.status}`}>
                  {abandonmentStatusLabel(abandonment)}{' '}
                  <span className="number">
                    ({abandonment.recentRaidCount}/{abandonment.raidThreshold} raids)
                  </span>
                </p>
                <div className="galaxy-intel-progress" role="presentation" aria-hidden="true">
                  <span
                    className={`galaxy-intel-progress-fill galaxy-intel-progress-fill-${abandonment.status}`}
                    style={{ width: `${abandonment.progressPct}%` }}
                  />
                </div>
                {abandonment.lastRaidGameHoursAgo !== undefined && (
                  <p className="galaxy-intel-line">
                    Last raid: <span className="number">{formatGameHours(abandonment.lastRaidGameHoursAgo)} ago</span>
                  </p>
                )}
                {abandonment.pressureWindowExpiresInGameHours !== undefined &&
                  abandonment.recentRaidCount > 0 && (
                    <p className="galaxy-intel-line">
                      Window reset in: <span className="number">{formatGameHours(abandonment.pressureWindowExpiresInGameHours)}</span>
                    </p>
                  )}
              </div>
            );
          })()}

          {report.resources && (
            <div className="galaxy-intel-block">
              <p className="galaxy-intel-label">Resources</p>
              <p className="galaxy-intel-line number">
                M {formatNumber(report.resources.metal)} | C {formatNumber(report.resources.crystal)} | D{' '}
                {formatNumber(report.resources.deuterium)}
              </p>
            </div>
          )}

          {listEntries(report.fleet, unitName).length > 0 && (
            <div className="galaxy-intel-block">
              <p className="galaxy-intel-label">Fleet</p>
              {listEntries(report.fleet, unitName).map((entry) => (
                <p key={entry.id} className="galaxy-intel-line">
                  {entry.name}: <span className="number">{formatNumber(entry.count)}</span>
                </p>
              ))}
            </div>
          )}

          {listEntries(report.defences, defenceName).length > 0 && (
            <div className="galaxy-intel-block">
              <p className="galaxy-intel-label">Defences</p>
              {listEntries(report.defences, defenceName).map((entry) => (
                <p key={entry.id} className="galaxy-intel-line">
                  {entry.name}: <span className="number">{formatNumber(entry.count)}</span>
                </p>
              ))}
            </div>
          )}

          {listEntries(report.buildings, buildingName).length > 0 && (
            <div className="galaxy-intel-block">
              <p className="galaxy-intel-label">Buildings</p>
              {listEntries(report.buildings, buildingName).map((entry) => (
                <p key={entry.id} className="galaxy-intel-line">
                  {entry.name}: <span className="number">{entry.count}</span>
                </p>
              ))}
            </div>
          )}

          {report.rebuildStatus && (
            <div className="galaxy-intel-block">
              <p className="galaxy-intel-label">Rebuild Status</p>
              <p className="galaxy-intel-line">
                Defences: <span className="number">{report.rebuildStatus.defencePct}%</span>
              </p>
              <p className="galaxy-intel-line">
                Fleet: <span className="number">{report.rebuildStatus.fleetPct}%</span>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── SystemMinimap ────────────────────────────────────────────────────────────

interface MinimapSlot {
  type: 'empty' | 'player' | 'npc';
  strengthKey?: StrengthKey;
  /** Raw label from npcRelativeStrengthLabel, e.g. 'Easy'|'Fair'|'Even'|'Hard'|'Dangerous' */
  rawStrengthLabel?: string;
  temp: number;
  faded: boolean;
  hasDebris: boolean;
  name: string;
}

interface SystemMinimapProps {
  slots: MinimapSlot[];
  selectedIdx: number | null;
  onSelect: (i: number) => void;
}

function SystemMinimap({ slots, selectedIdx, onSelect }: SystemMinimapProps) {
  return (
    <div className="galaxy-minimap">
      {/* Sun */}
      <div className="galaxy-minimap-sun" />
      {/* Orbit line separator */}
      <div style={{ width: 1, height: 16, background: 'rgba(40,60,120,0.3)', flexShrink: 0 }} />
      {/* Orbit track */}
      <div className="galaxy-minimap-track">
        <div className="galaxy-minimap-orbit-line" />
        {slots.map((slot, i) => (
          <button
            key={i}
            type="button"
            className={`galaxy-minimap-slot${selectedIdx === i ? ' galaxy-minimap-slot--selected' : ''}`}
            onClick={() => onSelect(i)}
            title={slot.name || `Slot ${i + 1}`}
          >
            <PlanetDot
              type={slot.type}
              strengthKey={slot.strengthKey}
              temp={slot.temp}
              faded={slot.faded}
              size={22}
            />
            {slot.hasDebris && <div className="galaxy-minimap-debris-dot" />}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── GalaxyPanel ─────────────────────────────────────────────────────────────

interface GalaxyPanelProps {
  onNavigate?: (panel: ActivePanel) => void;
}

export function GalaxyPanel({ onNavigate }: GalaxyPanelProps = {}) {
  const {
    gameState,
    espionageReports,
    colonizeAction,
    setFleetTarget,
    galaxyJumpTarget,
    setGalaxyJumpTarget,
    setPendingMissionTarget,
    dispatchEspionage,
    dispatchHarvest,
    adminForceColonize,
    adminTriggerCombat,
    adminRemoveNPC,
  } = useGame();

  const activePlanetIndex = gameState.activePlanetIndex;
  const activePlanet = gameState.planets[activePlanetIndex];

  const [currentSystem, setCurrentSystem] = useState(
    activePlanet.coordinates.system,
  );
  const [systemDraft, setSystemDraft] = useState(
    String(activePlanet.coordinates.system),
  );
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [now, setNow] = useState(() => Date.now());

  // Keep systemDraft in sync when currentSystem changes programmatically
  useEffect(() => {
    setSystemDraft(String(currentSystem));
  }, [currentSystem]);

  // Refresh "now" every minute for time-ago strings
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Cross-panel navigation jump target
  const clearHoveredNpc = useCallback(() => setHoveredKey(null), []);

  useEffect(() => {
    if (!galaxyJumpTarget) return;
    setCurrentSystem(galaxyJumpTarget.system);
    setGalaxyJumpTarget(null);
    clearHoveredNpc();
  }, [clearHoveredNpc, galaxyJumpTarget, setGalaxyJumpTarget]);

  function commitSystem(value: string) {
    const n = parseInt(value, 10);
    const clamped = Number.isInteger(n)
      ? Math.min(GALAXY_CONSTANTS.MAX_SYSTEMS, Math.max(1, n))
      : currentSystem;
    setCurrentSystem(clamped);
    clearHoveredNpc();
  }

  // ── Derived data ────────────────────────────────────────────────────────────

  const slots = getSystemSlots(gameState, 1, currentSystem);

  const debrisByCoord = useMemo(() => {
    const fields = new Map<string, DebrisField>();
    for (const field of gameState.debrisFields) {
      if (field.metal <= 0 && field.crystal <= 0) continue;
      fields.set(coordsKey(field.coordinates), field);
    }
    return fields;
  }, [gameState.debrisFields]);

  const activeMissions = gameState.fleetMissions.filter(
    (m) => m.status !== 'completed',
  );
  const slotsFull = activeMissions.length >= calcMaxFleetSlots(gameState.research);

  const activeHarvestTargets = useMemo(() => {
    const targets = new Set<string>();
    for (const m of activeMissions) {
      if (m.type === 'harvest') targets.add(coordsKey(m.targetCoordinates));
    }
    return targets;
  }, [activeMissions]);

  const hasColonyShip = canColonize(gameState);
  const availableRecyclers = Math.max(0, Math.floor(activePlanet.ships.recycler));
  const availableProbes = Math.min(
    activePlanet.ships.espionageProbe,
    gameState.settings.maxProbeCount,
  );

  const latestReportsByCoords = useMemo(() => {
    const latest = new Map<string, EspionageReport>();
    for (const report of espionageReports) {
      const key = coordsKey(report.targetCoordinates);
      const existing = latest.get(key);
      if (!existing || report.timestamp > existing.timestamp) latest.set(key, report);
    }
    return latest;
  }, [espionageReports]);

  // Mission indicators map: coordKey → active missions
  const missionsByCoords = useMemo(() => {
    const map = new Map<string, FleetMission[]>();
    for (const m of activeMissions) {
      const key = coordsKey(m.targetCoordinates);
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    return map;
  }, [activeMissions]);

  // ── System nav helpers ──────────────────────────────────────────────────────

  function prevSystem() {
    setCurrentSystem((s) => Math.max(1, s - 1));
    clearHoveredNpc();
    setSelectedIdx(null);
  }

  function nextSystem() {
    setCurrentSystem((s) => Math.min(GALAXY_CONSTANTS.MAX_SYSTEMS, s + 1));
    clearHoveredNpc();
    setSelectedIdx(null);
  }

  // ── Build minimap slot descriptors ─────────────────────────────────────────

  const minimapSlots: MinimapSlot[] = slots.map((slot, i) => {
    const targetCoords: Coordinates = { galaxy: 1, system: currentSystem, slot: i + 1 };
    const hasDebris = debrisByCoord.has(coordsKey(targetCoords));
    const isRebuilding = slot.type === 'npc' &&
      (slot.npc?.lastRaidedAt ?? 0) > 0 &&
      now - (slot.npc?.lastRaidedAt ?? 0) < 48 * 3600 * 1000;
    const isAbandoning = slot.type === 'npc' && slot.npc?.abandonedAt !== undefined;
    let strengthKey: StrengthKey | undefined;
    let rawStrengthLabel: string | undefined;
    if (slot.type === 'npc' && slot.npc && !isAbandoning) {
      rawStrengthLabel = npcRelativeStrengthLabel(calcNPCPower(slot.npc, now), gameState.playerScores.military);
      strengthKey = strengthConfigKey(rawStrengthLabel);
    }
    const temp = slot.type === 'player' ? (slot.planet?.maxTemperature ?? 20)
      : slot.type === 'npc' ? (slot.npc?.temperature ?? 20)
      : 20;
    return {
      type: slot.type,
      strengthKey,
      rawStrengthLabel,
      temp,
      faded: isRebuilding || isAbandoning,
      hasDebris,
      name: slot.type === 'player' ? (slot.planet?.name ?? '')
        : slot.type === 'npc' ? (slot.npc?.name ?? '')
        : `Slot ${i + 1}`,
    };
  });

  // ── Selected slot for detail strip ─────────────────────────────────────────

  const selectedSlot = selectedIdx !== null ? slots[selectedIdx] ?? null : null;
  const selectedMinimap = selectedIdx !== null ? minimapSlots[selectedIdx] ?? null : null;
  const selectedCoords: Coordinates | null = selectedIdx !== null
    ? { galaxy: 1, system: currentSystem, slot: selectedIdx + 1 }
    : null;

  // ── Hovered slot for tooltip ────────────────────────────────────────────────

  const hoveredReport = hoveredKey !== null ? (latestReportsByCoords.get(hoveredKey) ?? null) : null;
  const hoveredMissions = hoveredKey !== null ? (missionsByCoords.get(hoveredKey) ?? []) : [];

  // Figure out the slot name + strengthKey for the tooltip header
  let hoveredSlotName = '';
  let hoveredStrengthKey: StrengthKey | null = null;
  if (hoveredKey !== null) {
    // Find the slot from its key
    for (let i = 0; i < slots.length; i++) {
      const targetCoords: Coordinates = { galaxy: 1, system: currentSystem, slot: i + 1 };
      if (coordsKey(targetCoords) === hoveredKey) {
        const slot = slots[i];
        const mm = minimapSlots[i];
        hoveredSlotName = mm?.name ?? '';
        if (slot.type === 'npc' && mm?.strengthKey) {
          hoveredStrengthKey = mm.strengthKey;
        }
        break;
      }
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <section className="panel">
      <PanelBanner
        panel="galaxy"
        title="Galaxy"
        subtitle="Navigate systems, locate targets, colonize worlds, harvest debris fields."
      />

      {/* Navigator row */}
      <div className="galaxy-nav">
        <button
          type="button"
          className="galaxy-nav-arrow"
          aria-label="Previous system"
          disabled={currentSystem <= 1}
          onClick={prevSystem}
        >
          ‹
        </button>

        <div className="galaxy-nav-coords">
          <span className="galaxy-nav-label">Galaxy</span>
          <span className="galaxy-nav-galaxy-badge">1</span>
          <span className="galaxy-nav-dot">·</span>
          <label className="galaxy-nav-label" htmlFor="galaxy-nav-system-input">System</label>
          <input
            id="galaxy-nav-system-input"
            type="number"
            className="galaxy-nav-system-input"
            min={1}
            max={GALAXY_CONSTANTS.MAX_SYSTEMS}
            value={systemDraft}
            onChange={(e) => setSystemDraft(e.target.value)}
            onBlur={(e) => commitSystem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitSystem((e.target as HTMLInputElement).value);
            }}
          />
          <span className="galaxy-nav-total">/ {GALAXY_CONSTANTS.MAX_SYSTEMS}</span>
        </div>

        <button
          type="button"
          className="galaxy-nav-arrow"
          aria-label="Next system"
          disabled={currentSystem >= GALAXY_CONSTANTS.MAX_SYSTEMS}
          onClick={nextSystem}
        >
          ›
        </button>

        {/* Colour legend */}
        <div className="galaxy-legend">
          {([
            ['You',       '#4d8fff'],
            ['Weak',      '#34d399'],
            ['Moderate',  '#f0a832'],
            ['Strong',    '#f87171'],
            ['Dangerous', '#ff3366'],
            ['Debris',    '#30d5c8'],
          ] as [string, string][]).map(([label, color]) => (
            <div key={label} className="galaxy-legend-item">
              <div className="galaxy-legend-dot" style={{ background: color }} />
              <span className="galaxy-legend-text">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main card */}
      <div className="galaxy-card">
        <SystemMinimap
          slots={minimapSlots}
          selectedIdx={selectedIdx}
          onSelect={(i) => setSelectedIdx((prev) => (prev === i ? null : i))}
        />

        {/* Column headers */}
        <div className="galaxy-col-headers">
          <span className="galaxy-col-header galaxy-col-header--center">Slot</span>
          <span className="galaxy-col-header" />
          <span className="galaxy-col-header">Name / Status</span>
          <span className="galaxy-col-header galaxy-col-header--right">Strength</span>
          <span className="galaxy-col-header galaxy-col-header--right">Actions</span>
        </div>

        {/* Slot rows */}
        <div>
          {slots.map((slot, index) => {
            const targetCoords: Coordinates = { galaxy: 1, system: currentSystem, slot: index + 1 };
            const targetKey = coordsKey(targetCoords);
            const debrisField = debrisByCoord.get(targetKey) ?? null;
            const mm = minimapSlots[index];

            const isAbandoning = slot.type === 'npc' && slot.npc?.abandonedAt !== undefined;
            const isRebuilding = slot.type === 'npc' &&
              (slot.npc?.lastRaidedAt ?? 0) > 0 &&
              now - (slot.npc?.lastRaidedAt ?? 0) < 48 * 3600 * 1000;
            const isActivePlayerSlot =
              slot.type === 'player' &&
              activePlanet.coordinates.galaxy === targetCoords.galaxy &&
              activePlanet.coordinates.system === targetCoords.system &&
              activePlanet.coordinates.slot === targetCoords.slot;

            const slotMissions = missionsByCoords.get(targetKey) ?? [];
            const hasIntel = latestReportsByCoords.has(targetKey) && slotMissions.length === 0;

            // Harvest disabled reason
            let harvestDisabledReason: string | null = null;
            if (debrisField) {
              if (availableRecyclers <= 0) {
                harvestDisabledReason = 'No recyclers on active planet';
              } else if (activeHarvestTargets.has(targetKey)) {
                harvestDisabledReason = 'Harvest mission already in-flight';
              } else if (slotsFull) {
                harvestDisabledReason = 'Fleet slots full';
              } else {
                const totalDebris = Math.max(0, debrisField.metal + debrisField.crystal);
                const recyclerCount = Math.min(availableRecyclers, Math.ceil(totalDebris / 20_000));
                const distance = calcDistance(activePlanet.coordinates, targetCoords);
                const fuelCost = calcFuelCost({ recycler: recyclerCount }, distance);
                if (activePlanet.resources.deuterium < fuelCost) {
                  harvestDisabledReason = 'Insufficient deuterium';
                }
              }
            }

            // Row background
            let rowBg = 'transparent';
            if (selectedIdx === index) {
              rowBg = slot.type === 'player'
                ? 'rgba(77,143,255,0.1)'
                : slot.type === 'npc' && mm?.strengthKey
                  ? STRENGTH_CONFIG[mm.strengthKey].bg
                  : 'rgba(255,255,255,0.04)';
            }

            const sc = slot.type === 'npc' && mm?.strengthKey
              ? STRENGTH_CONFIG[mm.strengthKey]
              : null;

            return (
              <div
                key={index}
                className={`galaxy-slot-row${selectedIdx === index ? ' galaxy-slot-row--selected' : ''}${slot.type === 'npc' && !isAbandoning ? ' galaxy-slot-row--npc' : ''}`}
                style={{ background: rowBg }}
                onClick={() => {
                  // Click row: select it
                  setSelectedIdx((prev) => (prev === index ? null : index));
                  // NPC non-abandoning: also trigger attack (preserved behaviour)
                  if (slot.type === 'npc' && !isAbandoning) {
                    setFleetTarget(targetCoords);
                    onNavigate?.('fleet');
                  }
                }}
                onMouseEnter={(e) => {
                  if (slot.type !== 'empty') {
                    setHoveredKey(targetKey);
                    setHoverPos({ x: e.clientX, y: e.clientY });
                  }
                }}
                onMouseMove={(e) => {
                  if (slot.type !== 'empty') {
                    setHoverPos({ x: e.clientX, y: e.clientY });
                  }
                }}
                onMouseLeave={() => setHoveredKey(null)}
              >
                {/* Col 1: Slot number */}
                <span className="galaxy-slot-num">{index + 1}</span>

                {/* Col 2: Planet dot */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <PlanetDot
                    type={mm?.type ?? 'empty'}
                    strengthKey={mm?.strengthKey}
                    temp={mm?.temp ?? 20}
                    faded={mm?.faded ?? false}
                    size={24}
                  />
                </div>

                {/* Col 3: Name + badges + mission chips */}
                <div className="galaxy-slot-name-cell">
                  {slot.type === 'empty' ? (
                    <span className="galaxy-uninhabited">Uninhabited</span>
                  ) : (
                    <div className="galaxy-slot-name-row">
                      <span className="galaxy-slot-name">
                        {slot.type === 'player' ? slot.planet?.name : slot.npc?.name}
                      </span>
                      {slot.type === 'player' && (
                        <span className="galaxy-badge-pill galaxy-badge-pill--player">You</span>
                      )}
                      {isRebuilding && (
                        <span className="galaxy-badge-pill galaxy-badge-pill--rebuilding">Rebuilding</span>
                      )}
                      {isAbandoning && (
                        <span className="galaxy-badge-pill galaxy-badge-pill--abandoning">Abandoning</span>
                      )}
                      {debrisField && (
                        <span className="galaxy-badge-pill galaxy-badge-pill--debris">
                          Debris Field M {formatNumber(debrisField.metal)} | C {formatNumber(debrisField.crystal)}
                        </span>
                      )}
                      {slotMissions.filter((m) => m.type !== 'deploy').map((m) => {
                        const mc = MISSION_COLORS[m.type] ?? '#c8e0ff';
                        return (
                          <span
                            key={m.id}
                            className="galaxy-mission-chip"
                            style={{ color: mc, borderColor: `${mc}50`, background: `${mc}18` }}
                          >
                            {m.status === 'returning' ? '↩' : '↗'} {m.type}
                          </span>
                        );
                      })}
                      {hasIntel && (
                        <span className="galaxy-intel-indicator">◈ intel</span>
                      )}
                    </div>
                  )}
                  {slot.type === 'npc' && slot.npc?.temperature !== undefined && (
                    <span className="galaxy-slot-temp">
                      {slot.npc.temperature > 0 ? '+' : ''}{slot.npc.temperature}°C
                    </span>
                  )}
                </div>

                {/* Col 4: Strength pill */}
                <div className="galaxy-slot-strength-cell">
                  {slot.type === 'npc' && !isAbandoning && sc && mm?.rawStrengthLabel && (
                    <span
                      className="galaxy-strength-pill"
                      style={{ color: sc.color, borderColor: sc.border, background: sc.bg }}
                    >
                      Strength {mm.rawStrengthLabel}
                    </span>
                  )}
                </div>

                {/* Col 5: Actions */}
                <div
                  className="galaxy-slot-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* NPC actions */}
                  {slot.type === 'npc' && !isAbandoning && (
                    <>
                      <button
                        type="button"
                        className="galaxy-action-btn galaxy-action-btn--attack"
                        onClick={() => {
                          setFleetTarget(targetCoords);
                          onNavigate?.('fleet');
                        }}
                      >
                        Attack
                      </button>
                      <button
                        type="button"
                        className="galaxy-action-btn"
                        disabled={!availableProbes}
                        title={availableProbes ? 'Send all available probes' : 'No probes available'}
                        onClick={() => {
                          if (availableProbes <= 0) return;
                          dispatchEspionage(activePlanetIndex, targetCoords, Math.max(1, availableProbes));
                        }}
                      >
                        Spy
                      </button>
                      {gameState.settings.godMode && (
                        <>
                          <button
                            type="button"
                            className="galaxy-action-btn galaxy-action-btn--god"
                            onClick={() => adminTriggerCombat(targetCoords, { ...activePlanet.ships })}
                          >
                            ⚡ Raid
                          </button>
                          <button
                            type="button"
                            className="galaxy-action-btn galaxy-action-btn--god galaxy-action-btn--danger"
                            onClick={() => adminRemoveNPC(targetCoords)}
                          >
                            ⚡ Del
                          </button>
                        </>
                      )}
                    </>
                  )}

                  {/* Harvest */}
                  {debrisField && (
                    <div className="galaxy-harvest-wrap">
                      <button
                        type="button"
                        className="galaxy-action-btn galaxy-action-btn--harvest"
                        disabled={harvestDisabledReason !== null}
                        title={harvestDisabledReason ?? 'Dispatch recyclers'}
                        onClick={() => {
                          if (harvestDisabledReason !== null) return;
                          dispatchHarvest(activePlanetIndex, targetCoords);
                        }}
                      >
                        Harvest
                      </button>
                      {harvestDisabledReason && (
                        <span className="hint" style={{ fontSize: '0.7rem' }}>{harvestDisabledReason}</span>
                      )}
                    </div>
                  )}

                  {/* Colonize (empty slot) */}
                  {slot.type === 'empty' && hasColonyShip && (
                    <button
                      type="button"
                      className="galaxy-action-btn galaxy-action-btn--colonize"
                      onClick={() => colonizeAction(targetCoords)}
                    >
                      Colonize
                    </button>
                  )}

                  {/* God-mode colonize */}
                  {slot.type === 'empty' && gameState.settings.godMode && (
                    <button
                      type="button"
                      className="galaxy-action-btn galaxy-action-btn--god"
                      onClick={() => adminForceColonize(targetCoords)}
                    >
                      ⚡ Col
                    </button>
                  )}

                  {/* Transport (player non-active) */}
                  {slot.type === 'player' && !isActivePlayerSlot && (
                    <button
                      type="button"
                      className="galaxy-action-btn"
                      onClick={() => {
                        setFleetTarget(null);
                        setPendingMissionTarget({ type: 'transport', coords: targetCoords });
                        onNavigate?.('fleet');
                      }}
                    >
                      Transport
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected slot detail strip */}
        {selectedSlot && selectedSlot.type !== 'empty' && selectedCoords && selectedMinimap && (
          <div className="galaxy-selected-detail">
            <PlanetDot
              type={selectedMinimap.type}
              strengthKey={selectedMinimap.strengthKey}
              temp={selectedMinimap.temp}
              faded={selectedMinimap.faded}
              size={36}
            />
            <div style={{ flex: 1 }}>
              <div className="galaxy-selected-name">
                {selectedSlot.type === 'player' ? selectedSlot.planet?.name : selectedSlot.npc?.name}
              </div>
              <div className="galaxy-selected-coords">
                [{coordsKey(selectedCoords)}]
                {selectedSlot.type === 'npc' && selectedSlot.npc?.temperature !== undefined
                  ? ` · ${selectedSlot.npc.temperature > 0 ? '+' : ''}${selectedSlot.npc.temperature}°C`
                  : selectedSlot.type === 'player' && selectedSlot.planet?.maxTemperature !== undefined
                    ? ` · ${selectedSlot.planet.maxTemperature > 0 ? '+' : ''}${selectedSlot.planet.maxTemperature}°C`
                    : ''}
              </div>
            </div>
            <div className="galaxy-selected-hint">
              {selectedSlot.type === 'player'
                ? 'Your colony — use Transport to send resources.'
                : 'Send probes to gather intelligence before attacking.'}
            </div>
          </div>
        )}
      </div>

      {!hasColonyShip && (
        <p className="hint galaxy-hint">
          Build a Colony Ship in the Shipyard to colonize empty slots.
        </p>
      )}

      {/* Cursor-tracking tooltip */}
      <CursorTooltip
        x={hoverPos.x}
        y={hoverPos.y}
        visible={hoveredKey !== null}
      >
        <EspionageTooltipContent
          slotName={hoveredSlotName}
          strengthKey={hoveredStrengthKey}
          activeMissions={hoveredMissions}
          report={hoveredReport}
          now={now}
        />
      </CursorTooltip>
    </section>
  );
}
