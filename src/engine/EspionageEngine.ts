import { getNPCCurrentForce, getNPCResources } from './GalaxyEngine.ts';
import type { EspionageReport } from '../models/Fleet.ts';
import type { NPCColony } from '../models/Galaxy.ts';
import type { GameState } from '../models/GameState.ts';

const NPC_RECOVERY_MS = 48 * 3600 * 1000;

export type ResearchState = GameState['research'];

/** NPC espionage level derived from tier */
export function calcNPCEspionageLevel(tier: number): number {
  return Math.floor(tier / 2);
}

/**
 * OGame-style detection chance.
 * Returns 0–1 probability of detection.
 */
export function calcDetectionChance(
  npcEspionageLevel: number,
  playerEspionageTech: number,
  probeCount: number,
): number {
  if (npcEspionageLevel === 0) return 0;
  if (playerEspionageTech === 0) return 1;
  if (probeCount <= 0) return 1;
  const ratio = npcEspionageLevel / (playerEspionageTech * probeCount);
  return Math.min(1, ratio * ratio);
}

function createReportId(colony: NPCColony, now: number): string {
  const randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (randomUUID) {
    return randomUUID();
  }

  const coordsHash = [
    colony.coordinates.galaxy.toString(16).padStart(2, '0'),
    colony.coordinates.system.toString(16).padStart(2, '0'),
    colony.coordinates.slot.toString(16).padStart(2, '0'),
  ].join('');
  const nowHex = (now >>> 0).toString(16).padStart(8, '0');
  return `esp_${nowHex}_${coordsHash}`;
}

/**
 * Generate a spy report. Uses seeded rng for detection roll.
 * Returns EspionageReport (may be a failed/detected report).
 */
export function generateReport(
  colony: NPCColony,
  now: number,
  sourcePlanetIndex: number,
  probesSent: number,
  research: ResearchState,
  gameSpeed: number,
  rng: () => number,
): EspionageReport {
  const npcEspLevel = calcNPCEspionageLevel(colony.tier);
  const detectionChance = calcDetectionChance(
    npcEspLevel,
    research.espionageTechnology,
    probesSent,
  );
  const detected = rng() < detectionChance;
  const reportId = createReportId(colony, now);

  const baseReport: EspionageReport = {
    id: reportId,
    timestamp: now,
    sourcePlanetIndex,
    targetCoordinates: { ...colony.coordinates },
    targetName: colony.name,
    probesSent,
    probesLost: detected ? probesSent : 0,
    detected,
    read: false,
  };

  if (detected) {
    return baseReport;
  }

  const espionageTech = research.espionageTechnology;
  const currentForce = getNPCCurrentForce(colony, now);
  const report: EspionageReport = {
    ...baseReport,
    resources: getNPCResources(colony, now, gameSpeed),
  };

  if (espionageTech >= 2) {
    report.fleet = { ...currentForce.ships };
  }

  if (espionageTech >= 4) {
    report.defences = { ...currentForce.defences };
  }

  if (espionageTech >= 6) {
    report.buildings = { ...colony.buildings };
    report.tier = colony.tier;
  }

  if (espionageTech >= 8) {
    if (colony.lastRaidedAt === 0) {
      report.rebuildStatus = { defencePct: 100, fleetPct: 100 };
    } else {
      const elapsed = Math.min(
        Math.max(0, now - colony.lastRaidedAt),
        NPC_RECOVERY_MS,
      );
      const pct = elapsed / NPC_RECOVERY_MS;
      report.rebuildStatus = {
        defencePct: Math.round(pct * 100),
        fleetPct: Math.round(pct * 100),
      };
    }
  }

  return report;
}
