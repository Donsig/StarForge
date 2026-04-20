import { useState } from 'react';
import { DEFENCES } from '../data/defences.ts';
import { SHIPS } from '../data/ships.ts';
import { useGame } from '../context/GameContext';
import type { CombatLogEntry, EspionageReport, FleetNotification } from '../models/Fleet.ts';
import type { ActivePanel } from '../models/types.ts';
import { formatNumber } from '../utils/format.ts';

type MessageTab = 'combat' | 'espionage' | 'fleet';

function formatCoords(coords: { galaxy: number; system: number; slot: number }): string {
  return `${coords.galaxy}:${coords.system}:${coords.slot}`;
}

function formatTimeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function getShipOrDefenceName(id: string): string {
  return SHIPS[id as keyof typeof SHIPS]?.name ?? DEFENCES[id as keyof typeof DEFENCES]?.name ?? id;
}

// ── Coords badge (preserves coord-link class for tests) ────────────────────────

function CoordsLink({
  coords,
  setActivePanel,
}: {
  coords: { galaxy: number; system: number; slot: number };
  setActivePanel: (panel: ActivePanel) => void;
}) {
  const { setGalaxyJumpTarget } = useGame();

  return (
    <button
      type="button"
      className="coord-link"
      title="View in galaxy map"
      onClick={(e) => {
        e.stopPropagation();
        setGalaxyJumpTarget(coords);
        setActivePanel('galaxy');
      }}
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.72rem',
        color: 'rgba(120,150,200,0.55)',
        background: 'rgba(40,60,120,0.12)',
        border: '1px solid rgba(40,60,120,0.3)',
        borderRadius: 4,
        padding: '0.1rem 0.35rem',
        cursor: 'pointer',
      }}
    >
      [{formatCoords(coords)}]
    </button>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="messages-empty">
      No messages in this inbox.
    </div>
  );
}

// ── Combat report card ─────────────────────────────────────────────────────────

function CombatCard({
  entry,
  expanded,
  onToggle,
  onDelete,
  setActivePanel,
}: {
  entry: CombatLogEntry;
  expanded: boolean;
  onToggle: () => void;
  onDelete: (id: string) => void;
  setActivePanel: (panel: ActivePanel) => void;
}) {
  const { setGalaxyJumpTarget } = useGame();

  const outcome = entry.result.outcome;
  const isVictory = outcome === 'attacker_wins';
  const isDefeat  = outcome === 'defender_wins';

  const accentColor  = isVictory ? '#34d399' : isDefeat ? '#f87171' : '#f0a832';
  const bgColor      = isVictory ? 'rgba(52,211,153,0.06)' : isDefeat ? 'rgba(248,113,113,0.07)' : 'rgba(240,168,50,0.07)';
  const borderColor  = isVictory ? 'rgba(52,211,153,0.3)'  : isDefeat ? 'rgba(248,113,113,0.3)'  : 'rgba(240,168,50,0.3)';
  const outcomeLabel = isVictory ? 'Victory' : isDefeat ? 'Defeat' : 'Draw';
  const outcomeIcon  = isVictory ? '✓' : isDefeat ? '✗' : '~';

  const cardBorder  = entry.read ? '1px solid rgba(40,60,120,0.3)' : `1px solid ${borderColor}`;
  const cardBg      = entry.read ? 'rgba(8,12,28,0.8)' : bgColor;

  const hasLoot = entry.result.loot.metal > 0 || entry.result.loot.crystal > 0 || entry.result.loot.deuterium > 0;
  const hasDebris = entry.result.debrisCreated.metal > 0 || entry.result.debrisCreated.crystal > 0;

  // Losses lists
  const attackerLossEntries = Object.entries(entry.result.attackerLosses.ships ?? {})
    .filter(([, v]) => (v ?? 0) > 0);
  const defenderShipEntries = Object.entries(entry.result.defenderLosses.ships ?? {})
    .filter(([, v]) => (v ?? 0) > 0);
  const defenderDefenceEntries = Object.entries(entry.result.defenderLosses.defences ?? {})
    .filter(([, v]) => (v ?? 0) > 0);
  const defenderLossEntries = [...defenderShipEntries, ...defenderDefenceEntries];

  const coordsStr = formatCoords(entry.targetCoordinates);

  return (
    <article
      className={`message-card ${entry.read ? 'message-card--read' : 'message-card--unread'}`}
      style={{ border: cardBorder, background: cardBg }}
    >
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        className="message-card-header"
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        aria-expanded={expanded}
      >
        {/* Outcome icon circle */}
        <div
          className="message-icon"
          style={{
            background: bgColor,
            border: `1.5px solid ${borderColor}`,
            color: accentColor,
            fontSize: '1rem',
          }}
        >
          {outcomeIcon}
        </div>

        {/* Main text block */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span
              className="message-outcome-label"
              style={{ color: accentColor }}
            >
              {outcomeLabel}
            </span>
            <span className="message-title">vs [{coordsStr}]</span>
            <CoordsLink coords={entry.targetCoordinates} setActivePanel={setActivePanel} />
            {!entry.read && (
              <span
                className="message-new-badge"
                style={{
                  background: `${accentColor}20`,
                  border: `1px solid ${accentColor}50`,
                  color: accentColor,
                }}
              >
                NEW
              </span>
            )}
          </div>
          <div className="message-meta">
            <span className="message-time-ago">{entry.result.rounds} rounds</span>
            {hasLoot && (
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: '#34d399' }}>
                Loot M {formatNumber(entry.result.loot.metal)} · C {formatNumber(entry.result.loot.crystal)} · D {formatNumber(entry.result.loot.deuterium)}
              </span>
            )}
            <span className="message-time-ago">{formatTimeAgo(entry.timestamp)}</span>
          </div>
        </div>

        <span className="message-chevron">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="message-body">
          {/* Attacker vs Defender grid */}
          <div className="combat-losses-grid">
            {/* Attacker card */}
            <div
              className="combat-loss-card"
              style={{
                background: 'rgba(77,143,255,0.07)',
                border: '1px solid rgba(77,143,255,0.2)',
              }}
            >
              <div className="combat-loss-card-header" style={{ color: '#4d8fff' }}>
                Attacker — You
              </div>
              {attackerLossEntries.length > 0 ? (
                <>
                  <div className="combat-loss-card-sub">Losses:</div>
                  {attackerLossEntries.map(([id, count]) => (
                    <div key={id} className="combat-loss-row">
                      <span>{getShipOrDefenceName(id)}</span>
                      <span style={{ color: '#f87171' }}>-{count}</span>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ fontSize: '0.75rem', color: '#34d399' }}>No losses</div>
              )}
            </div>

            {/* Defender card */}
            <div
              className="combat-loss-card"
              style={{
                background: 'rgba(239,68,68,0.07)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <div className="combat-loss-card-header" style={{ color: '#f87171' }}>
                Defender — [{coordsStr}]
              </div>
              {defenderLossEntries.length > 0 ? (
                <>
                  <div className="combat-loss-card-sub">Losses:</div>
                  {defenderLossEntries.map(([id, count]) => (
                    <div key={id} className="combat-loss-row">
                      <span>{getShipOrDefenceName(id)}</span>
                      <span style={{ color: '#f87171' }}>-{count}</span>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ fontSize: '0.75rem', color: '#34d399' }}>No losses</div>
              )}
            </div>
          </div>

          {/* Loot + debris row */}
          {(hasLoot || hasDebris) && (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {hasLoot && (
                <div
                  className="combat-loot-row"
                  style={{
                    flex: '1 1 200px',
                    background: 'rgba(52,211,153,0.07)',
                    border: '1px solid rgba(52,211,153,0.2)',
                  }}
                >
                  <div className="combat-loot-header" style={{ color: '#34d399' }}>Plundered</div>
                  <div style={{ display: 'flex', gap: '0.75rem', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}>
                    <span style={{ color: '#9ca3af' }}>M {formatNumber(entry.result.loot.metal)}</span>
                    <span style={{ color: '#60a5fa' }}>C {formatNumber(entry.result.loot.crystal)}</span>
                    <span style={{ color: '#34d399' }}>D {formatNumber(entry.result.loot.deuterium)}</span>
                  </div>
                </div>
              )}
              {hasDebris && (
                <div
                  className="combat-loot-row"
                  style={{
                    flex: '1 1 180px',
                    background: 'rgba(48,213,200,0.07)',
                    border: '1px solid rgba(48,213,200,0.2)',
                  }}
                >
                  <div className="combat-loot-header" style={{ color: '#30d5c8' }}>Debris Field</div>
                  <div style={{ display: 'flex', gap: '0.75rem', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}>
                    <span style={{ color: '#9ca3af' }}>M {formatNumber(entry.result.debrisCreated.metal)}</span>
                    <span style={{ color: '#60a5fa' }}>C {formatNumber(entry.result.debrisCreated.crystal)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer actions */}
          <div className="message-actions">
            <button
              type="button"
              className="msg-btn msg-btn--teal"
              onClick={() => {
                setGalaxyJumpTarget(entry.targetCoordinates);
                setActivePanel('galaxy');
              }}
            >
              Send Recyclers
            </button>
            <button
              type="button"
              className="msg-btn msg-btn--muted"
              onClick={() => onDelete(entry.id)}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

// ── Espionage report card ──────────────────────────────────────────────────────

function EspionageCard({
  report,
  expanded,
  onToggle,
  onDelete,
  setActivePanel,
}: {
  report: EspionageReport;
  expanded: boolean;
  onToggle: () => void;
  onDelete: (id: string) => void;
  setActivePanel: (panel: ActivePanel) => void;
}) {
  const { setFleetTarget } = useGame();

  const detected     = report.detected;
  const accentColor  = detected ? '#f87171' : '#818cf8';
  const borderColor  = detected ? 'rgba(248,113,113,0.3)' : 'rgba(129,140,248,0.25)';
  const bgColor      = detected ? 'rgba(248,113,113,0.06)' : 'rgba(129,140,248,0.06)';

  const cardBorder   = report.read ? '1px solid rgba(40,60,120,0.3)' : `1px solid ${borderColor}`;
  const cardBg       = report.read ? 'rgba(8,12,28,0.8)' : bgColor;

  const fleetEntries   = report.fleet
    ? Object.entries(report.fleet).filter(([, v]) => v > 0)
    : [];
  const defenceEntries = report.defences
    ? Object.entries(report.defences).filter(([, v]) => v > 0)
    : [];

  return (
    <article
      className={`message-card ${report.read ? 'message-card--read' : 'message-card--unread'}`}
      style={{ border: cardBorder, background: cardBg }}
    >
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        className="message-card-header"
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        aria-expanded={expanded}
      >
        {/* ESP icon circle */}
        <div
          className="message-icon"
          style={{
            background: bgColor,
            border: `1.5px solid ${borderColor}`,
            fontFamily: 'Orbitron, sans-serif',
            fontSize: '0.6rem',
            color: accentColor,
            letterSpacing: '0.05em',
          }}
        >
          ESP
        </div>

        {/* Text block */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className="message-title">{report.targetName}</span>
            <CoordsLink coords={report.targetCoordinates} setActivePanel={setActivePanel} />
            {detected && (
              <span
                className="message-new-badge"
                style={{
                  background: 'rgba(248,113,113,0.15)',
                  border: '1px solid rgba(248,113,113,0.4)',
                  color: '#f87171',
                }}
              >
                DETECTED
              </span>
            )}
            {!report.read && (
              <span
                className="message-new-badge"
                style={{
                  background: `${accentColor}20`,
                  border: `1px solid ${accentColor}50`,
                  color: accentColor,
                }}
              >
                NEW
              </span>
            )}
          </div>
          <div className="message-meta">
            {report.resources && !detected && (
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'rgba(120,150,200,0.55)' }}>
                M {formatNumber(report.resources.metal)} · C {formatNumber(report.resources.crystal)} · D {formatNumber(report.resources.deuterium)}
              </span>
            )}
            <span className="message-time-ago">
              Counter chance {(report.detectionChance * 100).toFixed(1)}%
            </span>
            <span className="message-time-ago">{formatTimeAgo(report.timestamp)}</span>
          </div>
        </div>

        <span className="message-chevron">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="message-body">
          {detected ? (
            <>
              <p style={{ margin: 0, color: '#f87171', fontSize: '0.82rem' }}>
                {report.probesLost > 0
                  ? `Probes destroyed: ${report.probesLost}/${report.probesSent} — intelligence gathering failed.`
                  : 'Probes destroyed — intelligence gathering failed.'}
              </p>
            </>
          ) : (
            <div className="espionage-grid">
              {/* Resources card */}
              {report.resources && (
                <div
                  className="espionage-grid-card"
                  style={{
                    background: 'rgba(52,211,153,0.07)',
                    border: '1px solid rgba(52,211,153,0.2)',
                  }}
                >
                  <div className="espionage-grid-card-header" style={{ color: '#34d399' }}>Resources</div>
                  {[
                    ['Metal',     '#9ca3af', report.resources.metal],
                    ['Crystal',   '#60a5fa', report.resources.crystal],
                    ['Deuterium', '#34d399', report.resources.deuterium],
                  ].map(([label, color, value]) => (
                    <div key={label as string} className="espionage-grid-row">
                      <span style={{ color: 'rgba(150,180,220,0.5)' }}>{label as string}</span>
                      <span style={{ color: color as string, fontFamily: 'JetBrains Mono, monospace' }}>
                        {formatNumber(value as number)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Fleet card */}
              {fleetEntries.length > 0 && (
                <div
                  className="espionage-grid-card"
                  style={{
                    background: 'rgba(248,113,113,0.07)',
                    border: '1px solid rgba(248,113,113,0.2)',
                  }}
                >
                  <div className="espionage-grid-card-header" style={{ color: '#f87171' }}>Fleet</div>
                  {fleetEntries.map(([id, count]) => (
                    <div key={id} className="espionage-grid-row">
                      <span style={{ color: 'rgba(150,180,220,0.5)' }}>{getShipOrDefenceName(id)}</span>
                      <span style={{ color: '#f87171', fontFamily: 'JetBrains Mono, monospace' }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Defences card */}
              {defenceEntries.length > 0 && (
                <div
                  className="espionage-grid-card"
                  style={{
                    background: 'rgba(240,168,50,0.07)',
                    border: '1px solid rgba(240,168,50,0.2)',
                  }}
                >
                  <div className="espionage-grid-card-header" style={{ color: '#f0a832' }}>Defences</div>
                  {defenceEntries.map(([id, count]) => (
                    <div key={id} className="espionage-grid-row">
                      <span style={{ color: 'rgba(150,180,220,0.5)' }}>{getShipOrDefenceName(id)}</span>
                      <span style={{ color: '#f0a832', fontFamily: 'JetBrains Mono, monospace' }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Colony metadata (tier / specialty / rebuild) */}
          {(report.tier !== undefined || report.rebuildStatus) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
              {report.tier !== undefined && (
                <div style={{ fontSize: '0.75rem', color: 'rgba(150,180,220,0.55)' }}>
                  Colony tier: {report.tier}{report.specialty ? ` (${report.specialty})` : ''}
                </div>
              )}
              {report.rebuildStatus && (
                <div style={{ fontSize: '0.75rem', color: 'rgba(150,180,220,0.55)' }}>
                  Rebuild status: Fleet {report.rebuildStatus.fleetPct}% | Defence {report.rebuildStatus.defencePct}%
                </div>
              )}
            </div>
          )}

          {/* Footer actions */}
          <div className="message-actions">
            {!detected && (
              <button
                type="button"
                className="msg-btn msg-btn--danger"
                onClick={() => {
                  setFleetTarget(report.targetCoordinates);
                  setActivePanel('fleet');
                }}
              >
                Attack
              </button>
            )}
            <button
              type="button"
              className="msg-btn msg-btn--muted"
              onClick={() => onDelete(report.id)}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

// ── Fleet notification card ────────────────────────────────────────────────────

function FleetCard({
  notification,
  onRead,
  onDelete,
}: {
  notification: FleetNotification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isEmpty =
    notification.loot.metal <= 0 &&
    notification.loot.crystal <= 0 &&
    notification.loot.deuterium <= 0;

  const failureText =
    notification.missionType === 'harvest'
      ? 'No recoverable debris remained at arrival.'
      : notification.failureReason === 'planet_missing'
        ? 'Destination planet no longer exists.'
        : 'Destination planet storage was full — nothing could be delivered.';

  const cardBorder = notification.read ? '1px solid rgba(40,60,120,0.3)' : '1px solid rgba(52,211,153,0.3)';
  const cardBg     = notification.read ? 'rgba(8,12,28,0.8)' : 'rgba(52,211,153,0.06)';

  const title = notification.missionType === 'harvest'
    ? `Debris Harvested — ${notification.targetName}`
    : `Transport Delivered — ${notification.targetName}`;

  return (
    <article
      className={`message-card fleet-note ${notification.read ? 'message-card--read' : 'message-card--unread'}`}
      style={{ border: cardBorder, background: cardBg }}
      onClick={() => { if (!notification.read) onRead(notification.id); }}
    >
      {/* FLT icon circle */}
      <div
        className="message-icon"
        style={{
          background: 'rgba(52,211,153,0.1)',
          border: '1.5px solid rgba(52,211,153,0.3)',
          fontFamily: 'Orbitron, sans-serif',
          fontSize: '0.58rem',
          color: '#34d399',
          letterSpacing: '0.04em',
        }}
      >
        FLT
      </div>

      {/* Text block */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className="message-title">{title}</span>
          {!notification.read && (
            <span
              className="message-new-badge"
              style={{
                background: 'rgba(52,211,153,0.2)',
                border: '1px solid rgba(52,211,153,0.4)',
                color: '#34d399',
              }}
            >
              NEW
            </span>
          )}
        </div>
        <div className="message-meta">
          {isEmpty ? (
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'rgba(248,113,113,0.7)' }}>
              {failureText}
            </span>
          ) : (
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'rgba(120,150,200,0.55)' }}>
              M {formatNumber(notification.loot.metal)} · C {formatNumber(notification.loot.crystal)} · D {formatNumber(notification.loot.deuterium)}
            </span>
          )}
          <span className="message-time-ago">{formatTimeAgo(notification.timestamp)}</span>
        </div>
      </div>

      {/* Delete button */}
      <button
        type="button"
        className="msg-btn msg-btn--muted"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification.id);
        }}
      >
        Delete
      </button>
    </article>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export function MessagesPanel({
  setActivePanel,
}: {
  setActivePanel: (panel: ActivePanel) => void;
}) {
  const {
    gameState,
    fleetNotifications,
    markCombatRead,
    markAllCombatRead,
    markEspionageRead,
    markAllEspionageRead,
    markFleetRead,
    markAllFleetRead,
    deleteCombatEntry,
    deleteEspionageReport,
    deleteFleetNotification,
  } = useGame();

  const [activeTab, setActiveTab] = useState<MessageTab>('combat');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Sorted newest-first
  const combatEntries    = [...gameState.combatLog].sort((a, b) => b.timestamp - a.timestamp);
  const espionageEntries = [...gameState.espionageReports].sort((a, b) => b.timestamp - a.timestamp);
  const fleetEntries     = [...fleetNotifications].sort((a, b) => b.timestamp - a.timestamp);

  // Unread counts
  const combatUnread    = gameState.combatLog.filter((e) => !e.read).length;
  const espionageUnread = gameState.espionageReports.filter((r) => !r.read).length;
  const fleetUnread     = fleetNotifications.filter((n) => !n.read).length;

  const TABS: { id: MessageTab; label: string; unread: number; color: string }[] = [
    { id: 'combat',    label: 'Combat',    unread: combatUnread,    color: '#f87171' },
    { id: 'espionage', label: 'Espionage', unread: espionageUnread, color: '#818cf8' },
    { id: 'fleet',     label: 'Fleet',     unread: fleetUnread,     color: '#34d399' },
  ];

  function handleToggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function handleMarkAllRead() {
    if (activeTab === 'combat')    markAllCombatRead();
    if (activeTab === 'espionage') markAllEspionageRead();
    if (activeTab === 'fleet')     markAllFleetRead();
  }

  // Mark-read-on-expand
  function makeCombatToggle(entry: CombatLogEntry) {
    return () => {
      handleToggle(entry.id);
      if (!entry.read) markCombatRead(entry.id);
    };
  }

  function makeEspionageToggle(report: EspionageReport) {
    return () => {
      handleToggle(report.id);
      if (!report.read) markEspionageRead(report.id);
    };
  }

  return (
    <section className="panel messages-panel">
      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1
          style={{
            margin: '0 0 0.2rem',
            fontFamily: 'Orbitron, sans-serif',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#c8e0ff',
            letterSpacing: '0.06em',
          }}
        >
          Messages
        </h1>
        <p style={{ margin: 0, color: 'rgba(150,180,220,0.55)', fontSize: '0.85rem' }}>
          Combat reports, espionage intelligence, fleet notifications.
        </p>
      </div>

      {/* Tab bar */}
      <div className="messages-tabs">
        {TABS.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={`messages-tab ${isActive ? 'messages-tab--active' : ''}`}
              style={{
                color: isActive ? t.color : 'rgba(120,150,200,0.6)',
                background: isActive ? 'rgba(8,12,28,0.95)' : 'transparent',
                border: isActive ? '1px solid rgba(40,60,120,0.4)' : '1px solid transparent',
                borderBottom: isActive ? '1px solid rgba(8,12,28,0.95)' : undefined,
                marginBottom: isActive ? -1 : 0,
              }}
              onClick={() => {
                setActiveTab(t.id);
                setExpandedId(null);
              }}
            >
              {t.label}
              {t.unread > 0 && (
                <span
                  className="messages-tab-badge"
                  style={{
                    background: `${t.color}25`,
                    border: `1px solid ${t.color}50`,
                    color: t.color,
                  }}
                >
                  {t.unread}
                </span>
              )}
            </button>
          );
        })}

        <div style={{ flex: 1 }} />

        <button
          type="button"
          className="msg-btn msg-btn--ghost"
          onClick={handleMarkAllRead}
        >
          Mark All Read
        </button>
      </div>

      {/* Message list */}
      <div className="messages-list">
        {activeTab === 'combat' && (
          combatEntries.length === 0 ? (
            <EmptyState />
          ) : (
            combatEntries.map((entry) => (
              <CombatCard
                key={entry.id}
                entry={entry}
                expanded={expandedId === entry.id}
                onToggle={makeCombatToggle(entry)}
                onDelete={deleteCombatEntry}
                setActivePanel={setActivePanel}
              />
            ))
          )
        )}

        {activeTab === 'espionage' && (
          espionageEntries.length === 0 ? (
            <EmptyState />
          ) : (
            espionageEntries.map((report) => (
              <EspionageCard
                key={report.id}
                report={report}
                expanded={expandedId === report.id}
                onToggle={makeEspionageToggle(report)}
                onDelete={deleteEspionageReport}
                setActivePanel={setActivePanel}
              />
            ))
          )
        )}

        {activeTab === 'fleet' && (
          fleetEntries.length === 0 ? (
            <EmptyState />
          ) : (
            fleetEntries.map((notification) => (
              <FleetCard
                key={notification.id}
                notification={notification}
                onRead={markFleetRead}
                onDelete={deleteFleetNotification}
              />
            ))
          )
        )}
      </div>
    </section>
  );
}
