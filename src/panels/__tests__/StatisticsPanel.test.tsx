/// <reference types="vitest/globals" />

// Regression tests for the redesigned StatisticsPanel (Task 15).
// All new tests FAIL against the current production panel — they drive the redesign.
//
// Local types mirror the upcoming v16 GameStatistics shape.
// Delete these when models/GameState.ts ships v16.

import userEvent from '@testing-library/user-event';
import { StatisticsPanel } from '../StatisticsPanel';
import { renderWithGame, screen, within } from '../../test/test-utils';
import type { NPCColony } from '../../models/Galaxy.ts';
import type { FleetNotification } from '../../models/Fleet.ts';

interface ProductionHistory {
  metal: number[];
  crystal: number[];
  deuterium: number[];
  lastSampleAt: number;
}

interface StatisticsV16 {
  resourcesMined: { metal: number; crystal: number; deuterium: number };
  combat: { fought: number; won: number; lost: number; drawn: number; totalLoot: number; shipsLost: number };
  fleet: { sent: Record<string, number>; totalDistance: number };
  milestones: Record<string, unknown>;
  productionHistory: ProductionHistory;
  totalBuilt: Partial<Record<string, number>>;
}

function makeBaseStatistics(overrides: Partial<StatisticsV16> = {}): StatisticsV16 {
  return {
    resourcesMined: { metal: 0, crystal: 0, deuterium: 0 },
    combat: { fought: 0, won: 0, lost: 0, drawn: 0, totalLoot: 0, shipsLost: 0 },
    fleet: { sent: {}, totalDistance: 0 },
    milestones: {},
    productionHistory: { metal: [], crystal: [], deuterium: [], lastSampleAt: 0 },
    totalBuilt: {},
    ...overrides,
  };
}

function makeMinimalNPC(overrides: Partial<NPCColony> = {}): NPCColony {
  return {
    coordinates: { galaxy: 1, system: 9, slot: 1 },
    name: 'NPC Colony',
    temperature: 20,
    tier: 1,
    specialty: 'balanced',
    maxTier: 5,
    initialUpgradeIntervalMs: 21_600_000,
    currentUpgradeIntervalMs: 21_600_000,
    targetTier: 1,
    catchUpUpgradeIntervalMs: 5_400_000,
    catchUpProgressTicks: 0,
    lastUpgradeAt: 0,
    upgradeTickCount: 0,
    raidCount: 0,
    recentRaidTimestamps: [],
    buildings: {},
    baseDefences: {},
    baseShips: {},
    currentDefences: {},
    currentShips: {},
    lastRaidedAt: 0,
    resources: { metal: 0, crystal: 0, deuterium: 0 },
    ...overrides,
  };
}

function makeHarvestNotification(
  id: string,
  metal: number,
  crystal: number,
): FleetNotification {
  return {
    id,
    missionId: `mission_${id}`,
    timestamp: Date.now(),
    missionType: 'harvest',
    targetCoordinates: { galaxy: 1, system: 1, slot: 6 },
    targetName: 'Debris Field',
    loot: { metal, crystal, deuterium: 0 },
    read: false,
  };
}

// ─── Header ─────────────────────────────────────────────────────────────────

describe('StatisticsPanel — header', () => {
  it('renders an h1 with text "Statistics"', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: { statistics: makeBaseStatistics() as unknown as typeof makeBaseStatistics extends () => infer R ? R : never },
    });

    expect(screen.getByRole('heading', { name: 'Statistics', level: 1 })).toBeInTheDocument();
  });

  it('renders subtitle showing player rank and total commander count (solo — no NPCs)', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: makeBaseStatistics() as never,
        galaxy: { seed: 42, npcColonies: [] },
      },
    });

    // With no NPCs, player is rank 1 of 1
    expect(screen.getByText(/ranked\s*#1\s*of\s*1\s*commander/i)).toBeInTheDocument();
  });

  it('renders subtitle showing correct rank when 2 NPCs outrank player', () => {
    // NPCs with tier 5 will have very high scores — player starts at 0
    renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: makeBaseStatistics() as never,
        galaxy: {
          seed: 42,
          npcColonies: [
            makeMinimalNPC({ name: 'Big1', tier: 5, coordinates: { galaxy: 1, system: 9, slot: 1 } }),
            makeMinimalNPC({ name: 'Big2', tier: 5, coordinates: { galaxy: 1, system: 9, slot: 2 } }),
          ],
        },
      },
    });

    // 2 NPCs + 1 player = 3 commanders; player ranks 3rd with zero score
    expect(screen.getByText(/ranked\s*#3\s*of\s*3\s*commander/i)).toBeInTheDocument();
  });
});

// ─── Score Breakdown ────────────────────────────────────────────────────────

describe('StatisticsPanel — Score Breakdown', () => {
  it('renders 4 score category labels: Buildings, Research, Fleet, Defence', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: { statistics: makeBaseStatistics() as never },
    });

    expect(screen.getByText(/buildings/i)).toBeInTheDocument();
    expect(screen.getByText(/research/i)).toBeInTheDocument();
    expect(screen.getByText(/fleet/i)).toBeInTheDocument();
    expect(screen.getByText(/defence/i)).toBeInTheDocument();
  });

  it('renders percentage for buildings when buildings is 50% of total', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: makeBaseStatistics() as never,
      },
      actions: {
        // override context playerScores to test percentage rendering
      },
    });

    // With playerScores { economy: 500, total: 1000 } → 50%
    // We do this by rendering with a gameState override that results in a
    // known score ratio. Simplest: provide a planet with only economy buildings.
    // Actually, provide the playerScores directly via gameState spread
    renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: makeBaseStatistics() as never,
        playerScores: {
          economy: 500,
          research: 300,
          military: 200,
          buildings: 0,
          fleet: 0,
          defence: 0,
          total: 1000,
        },
      },
    });

    // 500/1000 = 50%
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('renders a section heading for Score Breakdown', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: { statistics: makeBaseStatistics() as never },
    });

    expect(
      screen.getByRole('heading', { name: /score breakdown/i }),
    ).toBeInTheDocument();
  });
});

// ─── Battle Stats ────────────────────────────────────────────────────────────

describe('StatisticsPanel — Battle Stats', () => {
  it('renders Raids Won stat card', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: makeBaseStatistics({
          combat: { fought: 5, won: 3, lost: 2, drawn: 0, totalLoot: 0, shipsLost: 0 },
        }) as never,
      },
    });

    expect(screen.getByText(/raids won/i)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders Raids Lost stat card', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: makeBaseStatistics({
          combat: { fought: 5, won: 3, lost: 2, drawn: 0, totalLoot: 0, shipsLost: 0 },
        }) as never,
      },
    });

    expect(screen.getByText(/raids lost/i)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders Debris Harvested stat card', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: { statistics: makeBaseStatistics() as never },
    });

    expect(screen.getByText(/debris harvested/i)).toBeInTheDocument();
  });

  it('renders Colonies stat card', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: { statistics: makeBaseStatistics() as never },
    });

    expect(screen.getByText(/colonies/i)).toBeInTheDocument();
  });

  it('renders Win Rate stat card', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: { statistics: makeBaseStatistics() as never },
    });

    expect(screen.getByText(/win rate/i)).toBeInTheDocument();
  });

  it('renders Ships Built stat card', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: { statistics: makeBaseStatistics() as never },
    });

    expect(screen.getByText(/ships built/i)).toBeInTheDocument();
  });

  it('calculates Debris Harvested as sum of metal + crystal from harvest notifications', () => {
    const notifications = [
      makeHarvestNotification('n1', 5000, 3000),
      makeHarvestNotification('n2', 2000, 1000),
    ];

    renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: makeBaseStatistics() as never,
        fleetNotifications: notifications,
      },
    });

    // Sum: 5000+3000+2000+1000 = 11000
    expect(screen.getByText(/11,000|11000/)).toBeInTheDocument();
  });

  it('shows "—" for win rate when no battles have been fought', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: makeBaseStatistics({
          combat: { fought: 0, won: 0, lost: 0, drawn: 0, totalLoot: 0, shipsLost: 0 },
        }) as never,
      },
    });

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows numeric win rate percentage when battles have been fought', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: makeBaseStatistics({
          combat: { fought: 4, won: 3, lost: 1, drawn: 0, totalLoot: 0, shipsLost: 0 },
        }) as never,
      },
    });

    // 3/(3+1) = 75%
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('renders Ships Built using sum of totalBuilt ship counts', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: makeBaseStatistics({
          totalBuilt: { lightFighter: 10, cruiser: 5 },
        }) as never,
      },
    });

    // Sum = 15
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('Colonies count reflects number of player planets', () => {
    renderWithGame(
      <StatisticsPanel />,
      {
        gameState: { statistics: makeBaseStatistics() as never },
        withMultiplePlanets: true,
      },
    );

    // withMultiplePlanets adds a second planet → Colonies = 2
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

// ─── Production Trend ────────────────────────────────────────────────────────

describe('StatisticsPanel — Production Trend', () => {
  it('renders a "Production Trend" section heading', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: { statistics: makeBaseStatistics() as never },
    });

    expect(screen.getByRole('heading', { name: /production trend/i })).toBeInTheDocument();
  });

  it('shows placeholder text when productionHistory is empty', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: makeBaseStatistics({
          productionHistory: { metal: [], crystal: [], deuterium: [], lastSampleAt: 0 },
        }) as never,
      },
    });

    expect(
      screen.getByText(/no data yet/i),
    ).toBeInTheDocument();
  });

  it('shows "check back after" hint when no history exists', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: makeBaseStatistics({
          productionHistory: { metal: [], crystal: [], deuterium: [], lastSampleAt: 0 },
        }) as never,
      },
    });

    expect(screen.getByText(/24h/i)).toBeInTheDocument();
  });

  it('renders Metal sparkline bars when history has 3 entries', () => {
    const { container } = renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: makeBaseStatistics({
          productionHistory: {
            metal: [100, 200, 300],
            crystal: [50, 60, 70],
            deuterium: [10, 20, 30],
            lastSampleAt: Date.now(),
          },
        }) as never,
      },
    });

    // The Metal sparkline SVG should contain 3 <rect> bars
    // We look for SVG rects within a Metal-related container
    const svgRects = container.querySelectorAll('svg rect');
    // At least 3 rects (one per data point for metal, crystal, deut each)
    expect(svgRects.length).toBeGreaterThanOrEqual(3);
  });

  it('renders SVG sparklines for Metal, Crystal, and Deuterium when history has data', () => {
    const { container } = renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: makeBaseStatistics({
          productionHistory: {
            metal: [100, 200],
            crystal: [50, 60],
            deuterium: [10, 20],
            lastSampleAt: Date.now(),
          },
        }) as never,
      },
    });

    // Expect SVG elements to be rendered for sparklines
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── Rankings Table ──────────────────────────────────────────────────────────

describe('StatisticsPanel — Rankings Table', () => {
  it('renders a "Rankings" section heading', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: makeBaseStatistics() as never,
        galaxy: { seed: 42, npcColonies: [] },
      },
    });

    expect(screen.getByRole('heading', { name: /rankings/i })).toBeInTheDocument();
  });

  it('renders the player row with a "You" badge', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: makeBaseStatistics() as never,
        galaxy: { seed: 42, npcColonies: [] },
      },
    });

    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('shows circled numeral ① for rank 1', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: makeBaseStatistics() as never,
        galaxy: { seed: 42, npcColonies: [] },
      },
    });

    // Player should be rank 1 when alone
    expect(screen.getByText('①')).toBeInTheDocument();
  });

  it('shows circled numerals ①②③ for the top 3 entries', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: makeBaseStatistics() as never,
        galaxy: {
          seed: 42,
          npcColonies: [
            makeMinimalNPC({ name: 'NPC1', tier: 5, coordinates: { galaxy: 1, system: 9, slot: 1 } }),
            makeMinimalNPC({ name: 'NPC2', tier: 5, coordinates: { galaxy: 1, system: 9, slot: 2 } }),
          ],
        },
      },
    });

    expect(screen.getByText('①')).toBeInTheDocument();
    expect(screen.getByText('②')).toBeInTheDocument();
    expect(screen.getByText('③')).toBeInTheDocument();
  });

  it('NPC colony names appear in the rankings table', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: makeBaseStatistics() as never,
        galaxy: {
          seed: 42,
          npcColonies: [
            makeMinimalNPC({ name: 'Alpha Station', coordinates: { galaxy: 1, system: 9, slot: 1 } }),
            makeMinimalNPC({ name: 'Beta Outpost', coordinates: { galaxy: 1, system: 9, slot: 2 } }),
          ],
        },
      },
    });

    expect(screen.getByText('Alpha Station')).toBeInTheDocument();
    expect(screen.getByText('Beta Outpost')).toBeInTheDocument();
  });

  it('clicking Buildings column header re-sorts by buildings (highest first)', async () => {
    const user = userEvent.setup();

    // 3 NPCs with progressively larger building stockpiles so buildings-column
    // order is deterministic (higher base + level → higher cumulative cost).
    renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: makeBaseStatistics() as never,
        playerScores: { military: 0, economy: 0, research: 0, buildings: 0, fleet: 0, defence: 0, total: 0 },
        galaxy: {
          seed: 42,
          npcColonies: [
            makeMinimalNPC({
              name: 'Tier1',
              tier: 1,
              coordinates: { galaxy: 1, system: 9, slot: 1 },
              buildings: { metalMine: 5 },
            }),
            makeMinimalNPC({
              name: 'Tier2',
              tier: 2,
              coordinates: { galaxy: 1, system: 9, slot: 2 },
              buildings: { metalMine: 15 },
            }),
            makeMinimalNPC({
              name: 'Tier3',
              tier: 3,
              coordinates: { galaxy: 1, system: 9, slot: 3 },
              buildings: { metalMine: 25 },
            }),
          ],
        },
      },
    });

    // Click the Buildings column header
    await user.click(screen.getByRole('columnheader', { name: /buildings/i }));

    // After sorting by buildings desc, Tier3 > Tier2 > Tier1 (higher mine levels)
    const rows = screen.getAllByRole('row');
    // Find rows containing the NPC names
    const tier3RowIndex = rows.findIndex((row) => within(row).queryByText('Tier3') !== null);
    const tier2RowIndex = rows.findIndex((row) => within(row).queryByText('Tier2') !== null);
    const tier1RowIndex = rows.findIndex((row) => within(row).queryByText('Tier1') !== null);

    expect(tier3RowIndex).toBeLessThan(tier2RowIndex);
    expect(tier2RowIndex).toBeLessThan(tier1RowIndex);
  });

  it('renders column headers Buildings, Research, Fleet, Defence, Total', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: makeBaseStatistics() as never,
        galaxy: { seed: 42, npcColonies: [] },
      },
    });

    expect(screen.getByRole('columnheader', { name: /buildings/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /research/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /fleet/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /defence/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /total/i })).toBeInTheDocument();
  });
});
