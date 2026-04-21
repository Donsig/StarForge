import userEvent from '@testing-library/user-event';
import { FleetPanel } from '../FleetPanel';
import { renderWithGame, screen } from '../../test/test-utils';

// ── Mock simulatePreview for tone/probability tests ──────────────────────────
// We use vi.mock to control the CombatPreview output precisely so tone-mapping
// tests are isolated from combat simulation variance.
// Real-simulation integration tests follow below (no mock).
vi.mock('../../engine/CombatEngine.ts', async () => {
  const actual = await vi.importActual<typeof import('../../engine/CombatEngine.ts')>(
    '../../engine/CombatEngine.ts',
  );
  return {
    ...actual,
    simulatePreview: vi.fn(),
  };
});

// Import after mocking so we get the mocked version
import { simulatePreview } from '../../engine/CombatEngine.ts';

// ── Shared fixtures ────────────────────────────────────────────────────────────

const now = Date.now();

/** An espionage report that includes fleet + defences intel (enables combat estimate). */
function makeIntelReport(overrides: { fleet?: Record<string, number>; defences?: Record<string, number> } = {}) {
  return {
    id: 'report_combat_intel',
    timestamp: now - 1000,
    targetCoordinates: { galaxy: 1, system: 2, slot: 4 },
    targetName: 'Enemy Base',
    sourcePlanetIndex: 0,
    probesSent: 3,
    probesLost: 0,
    detected: false as const,
    detectionChance: 0,
    read: false,
    fleet: overrides.fleet ?? { lightFighter: 10 },
    defences: overrides.defences ?? { rocketLauncher: 5 },
  };
}

/** A synthetic CombatPreview with the given win probability for testing tone mapping. */
function makeCombatPreview(winProbability: number) {
  return {
    trials: 10,
    winProbability,
    drawProbability: 0,
    averageRounds: 3,
    averageAttackerLosses: { lightFighter: 2 },
    averageDefenderShipLosses: { lightFighter: 8 },
    averageDefenderDefenceLosses: { rocketLauncher: 5 },
  };
}

/** Base render options with a fleet + espionage intel to trigger combat estimate. */
function makeAttackSetup() {
  return {
    gameState: {
      planet: {
        ships: { battleship: 10 },
        resources: { deuterium: 50_000 },
      },
      espionageReports: [makeIntelReport()],
    },
    actions: {
      fleetTarget: { galaxy: 1, system: 2, slot: 4 },
    },
  };
}

// ── Existing unrelated tests (kept intact) ────────────────────────────────────

describe('FleetPanel', () => {
  it('shows fleet slots counter in panel header', () => {
    renderWithGame(<FleetPanel />, {
      gameState: {
        research: { computerTechnology: 2 },
      },
    });

    // max slots = 1 + 2 = 3; no missions active
    expect(screen.getByText('0 / 3 slots')).toBeInTheDocument();
  });

  it('fleet slots counter reflects active mission count', () => {
    renderWithGame(<FleetPanel />, {
      gameState: {
        research: { computerTechnology: 1 },
        fleetMissions: [
          {
            id: 'mission_slotcount1',
            type: 'attack',
            status: 'outbound',
            sourcePlanetIndex: 0,
            targetCoordinates: { galaxy: 1, system: 2, slot: 5 },
            targetType: 'npc_colony',
            ships: { smallCargo: 1 },
            cargo: { metal: 0, crystal: 0, deuterium: 0 },
            fuelCost: 5,
            departureTime: Date.now(),
            arrivalTime: Date.now() + 10000,
            returnTime: 0,
          },
        ],
      },
    });

    // max slots = 1 + 1 = 2; 1 mission active
    expect(screen.getByText('1 / 2 slots')).toBeInTheDocument();
  });

  it('fleet slots counter header has full-warning class when all slots used', () => {
    renderWithGame(<FleetPanel />, {
      gameState: {
        research: { computerTechnology: 0 },
        fleetMissions: [
          {
            id: 'mission_slotfull1',
            type: 'attack',
            status: 'outbound',
            sourcePlanetIndex: 0,
            targetCoordinates: { galaxy: 1, system: 2, slot: 5 },
            targetType: 'npc_colony',
            ships: { smallCargo: 1 },
            cargo: { metal: 0, crystal: 0, deuterium: 0 },
            fuelCost: 5,
            departureTime: Date.now(),
            arrivalTime: Date.now() + 10000,
            returnTime: 0,
          },
        ],
      },
    });

    // max slots = 1 + 0 = 1; 1 mission active → slots full
    const counter = screen.getByText('1 / 1 slots');
    expect(counter).toHaveClass('fleet-slots-counter--full');
  });

  it('dispatch footer missions label has danger class when slots full', () => {
    renderWithGame(<FleetPanel />, {
      gameState: {
        research: { computerTechnology: 0 },
        fleetMissions: [
          {
            id: 'mission_footerfull',
            type: 'attack',
            status: 'outbound',
            sourcePlanetIndex: 0,
            targetCoordinates: { galaxy: 1, system: 3, slot: 7 },
            targetType: 'npc_colony',
            ships: { smallCargo: 1 },
            cargo: { metal: 0, crystal: 0, deuterium: 0 },
            fuelCost: 5,
            departureTime: Date.now(),
            arrivalTime: Date.now() + 10000,
            returnTime: 0,
          },
        ],
      },
    });

    // The footer "Missions: X / Y" spans should have the danger class when full
    const missionLabels = screen.getAllByText(/Missions: 1 \/ 1/);
    expect(missionLabels.length).toBeGreaterThan(0);
    missionLabels.forEach((label) => {
      expect(label).toHaveClass('danger');
    });
  });

  it('shows Send To dropdown when transport is selected with no pre-filled target', async () => {
    const user = userEvent.setup();
    renderWithGame(<FleetPanel />, { withMultiplePlanets: true });

    await user.selectOptions(screen.getByLabelText('Mission Type'), 'transport');
    expect(screen.getByLabelText(/send to/i)).toBeInTheDocument();
  });

  it('shows cargo inputs when transport mode is active', async () => {
    const user = userEvent.setup();
    renderWithGame(<FleetPanel />, { withMultiplePlanets: true });

    await user.selectOptions(screen.getByLabelText('Mission Type'), 'transport');
    expect(screen.getByLabelText(/metal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/crystal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/deuterium/i)).toBeInTheDocument();
  });

  it('shows dispatch form with selected target and available ships', () => {
    renderWithGame(<FleetPanel />, {
      gameState: {
        planet: {
          ships: {
            smallCargo: 3,
            cruiser: 1,
          },
          resources: {
            deuterium: 5000,
          },
        },
      },
      actions: {
        fleetTarget: { galaxy: 1, system: 2, slot: 8 },
      },
    });

    expect(screen.getByText('[G:1 S:2 P:8]')).toBeInTheDocument();
    expect(screen.getByText('Mission Type')).toBeInTheDocument();
    // "Attack" appears in the toggle button and hidden select option
    expect(screen.getAllByText('Attack').length).toBeGreaterThan(0);
    expect(screen.getByText('Small Cargo')).toBeInTheDocument();
    expect(screen.getByText('Cruiser')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dispatch Attack' })).toBeDisabled();
  });

  it('shows active outbound missions with recall action', async () => {
    const user = userEvent.setup();
    const recallFleet = vi.fn();

    renderWithGame(<FleetPanel />, {
      gameState: {
        fleetMissions: [
          {
            id: 'mission_testdeadbeef',
            type: 'attack',
            status: 'outbound',
            sourcePlanetIndex: 0,
            targetCoordinates: { galaxy: 1, system: 3, slot: 12 },
            targetType: 'npc_colony',
            ships: { smallCargo: 1 },
            cargo: { metal: 0, crystal: 0, deuterium: 0 },
            fuelCost: 10,
            departureTime: Date.now(),
            arrivalTime: Date.now() + 10000,
            returnTime: 0,
          },
        ],
      },
      actions: {
        recallFleet,
      },
    });

    expect(screen.getByText('[G:1 S:3 P:12]')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Recall' }));
    expect(recallFleet).toHaveBeenCalledWith('mission_testdeadbeef');
  });

  it('renders ship manifest chips inline for active missions', () => {
    renderWithGame(<FleetPanel />, {
      gameState: {
        fleetMissions: [
          {
            id: 'mission_manifestchips',
            type: 'attack',
            status: 'outbound',
            sourcePlanetIndex: 0,
            targetCoordinates: { galaxy: 1, system: 8, slot: 4 },
            targetType: 'npc_colony',
            ships: { smallCargo: 1, cruiser: 2 },
            cargo: { metal: 0, crystal: 0, deuterium: 0 },
            fuelCost: 10,
            departureTime: Date.now(),
            arrivalTime: Date.now() + 10000,
            returnTime: 0,
          },
        ],
      },
    });

    // Ship manifest is shown as inline chips inside the mission card
    expect(screen.getByText('1× Small Cargo')).toBeInTheDocument();
    expect(screen.getByText('2× Cruiser')).toBeInTheDocument();
  });

  it('shows cargo details for returning missions carrying loot', () => {
    renderWithGame(<FleetPanel />, {
      gameState: {
        fleetMissions: [
          {
            id: 'mission_returningcargo',
            type: 'attack',
            status: 'returning',
            sourcePlanetIndex: 0,
            targetCoordinates: { galaxy: 1, system: 5, slot: 9 },
            targetType: 'npc_colony',
            ships: { smallCargo: 1 },
            cargo: { metal: 321, crystal: 654, deuterium: 987 },
            fuelCost: 10,
            departureTime: Date.now() - 20000,
            arrivalTime: Date.now() - 10000,
            returnTime: Date.now() + 10000,
          },
        ],
      },
    });

    expect(screen.getByText(/M 321\s+C 654\s+D 987/)).toBeInTheDocument();
  });

  it('shows Harvest badge for harvest missions', () => {
    renderWithGame(<FleetPanel />, {
      gameState: {
        fleetMissions: [
          {
            id: 'mission_harvestbadge',
            type: 'harvest',
            status: 'outbound',
            sourcePlanetIndex: 0,
            targetCoordinates: { galaxy: 1, system: 7, slot: 3 },
            targetType: 'debris_field',
            ships: { recycler: 2 },
            cargo: { metal: 0, crystal: 0, deuterium: 0 },
            fuelCost: 42,
            departureTime: Date.now(),
            arrivalTime: Date.now() + 20000,
            returnTime: 0,
          },
        ],
      },
    });

    // "Harvest" appears in the mission pill and the hidden select option + toggle button
    expect(screen.getAllByText('Harvest').length).toBeGreaterThan(0);
  });

  it('allows dispatching espionage with more than one probe', async () => {
    const user = userEvent.setup();
    const dispatchEspionage = vi.fn().mockReturnValue({
      id: 'mission_probe3',
      type: 'espionage',
      status: 'outbound',
      sourcePlanetIndex: 0,
      targetCoordinates: { galaxy: 1, system: 4, slot: 6 },
      targetType: 'npc_colony',
      ships: { espionageProbe: 3 },
      cargo: { metal: 0, crystal: 0, deuterium: 0 },
      fuelCost: 1,
      departureTime: Date.now(),
      arrivalTime: Date.now() + 5000,
      returnTime: 0,
    });

    renderWithGame(<FleetPanel />, {
      gameState: {
        planet: {
          ships: { espionageProbe: 5 },
          resources: { deuterium: 200 },
        },
      },
      actions: {
        fleetTarget: { galaxy: 1, system: 4, slot: 6 },
        dispatchEspionage,
      },
    });

    await user.selectOptions(screen.getByLabelText('Mission Type'), 'espionage');
    const probeInput = screen.getByRole('spinbutton');
    await user.clear(probeInput);
    await user.type(probeInput, '3');
    await user.click(screen.getByRole('button', { name: 'Dispatch Espionage' }));

    expect(dispatchEspionage).toHaveBeenCalledWith(
      0,
      { galaxy: 1, system: 4, slot: 6 },
      3,
    );
  });

  it('shows cargo capacity helper with + cargo buttons when attacking NPC with known resources', async () => {
    const user = userEvent.setup();
    const now = Date.now();

    renderWithGame(<FleetPanel />, {
      gameState: {
        galaxy: {
          seed: 1,
          npcColonies: [
            {
              coordinates: { galaxy: 1, system: 2, slot: 4 },
              name: 'Target Base',
              temperature: 25,
              tier: 5,
              specialty: 'balanced',
              maxTier: 8,
              initialUpgradeIntervalMs: 10_800_000,
              currentUpgradeIntervalMs: 10_800_000,
              targetTier: 5,
              catchUpUpgradeIntervalMs: 2_700_000,
              catchUpProgressTicks: 0,
              lastUpgradeAt: 0,
              upgradeTickCount: 0,
              raidCount: 0,
              recentRaidTimestamps: [],
              abandonedAt: undefined,
              buildings: {},
              baseDefences: {},
              baseShips: {},
              currentDefences: {},
              currentShips: {},
              lastRaidedAt: 0,
              resources: { metal: 0, crystal: 0, deuterium: 0 },
            },
          ],
        },
        espionageReports: [
          {
            id: 'report_1',
            timestamp: now - 1000,
            targetCoordinates: { galaxy: 1, system: 2, slot: 4 },
            targetName: 'Target Base',
            sourcePlanetIndex: 0,
            probesSent: 1,
            probesLost: 0,
            detected: false,
            detectionChance: 0,
            read: false,
            resources: { metal: 200_000, crystal: 100_000, deuterium: 50_000 },
          },
        ],
        planet: {
          ships: { largeCargo: 10, smallCargo: 5 },
          resources: { deuterium: 50_000 },
        },
      },
      actions: { fleetTarget: { galaxy: 1, system: 2, slot: 4 } },
    });

    expect(screen.getByText(/Lootable/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ 7 Large Cargo/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /\+ 7 Large Cargo/i }));

    expect(screen.getAllByText(/175,000/)).toHaveLength(2);
  });

  // ── NEW: Combat simulation preview tests ────────────────────────────────────
  // These tests target the upcoming simulatePreview-based combat estimate in FleetPanel.
  // They FAIL against current code (old ratio-based estimate), which is expected.
  // The mock for simulatePreview is set up at the top of this file.

  describe('combat simulation preview (Task 19)', () => {
    beforeEach(() => {
      vi.mocked(simulatePreview).mockReset();
    });

    it('shows "% win probability" text when combat preview is available', () => {
      // Mock returns a 80% win preview
      vi.mocked(simulatePreview).mockReturnValue(makeCombatPreview(0.8));

      renderWithGame(<FleetPanel />, {
        gameState: {
          planet: {
            ships: { battleship: 10 },
            resources: { deuterium: 50_000 },
          },
          espionageReports: [makeIntelReport()],
        },
        actions: {
          fleetTarget: { galaxy: 1, system: 2, slot: 4 },
        },
      });

      // The panel should display a win probability percentage
      expect(screen.getByText(/\d+% win probability/i)).toBeInTheDocument();
    });

    it('shows "Clear advantage" tone when winProbability > 0.75', () => {
      vi.mocked(simulatePreview).mockReturnValue(makeCombatPreview(0.9));

      renderWithGame(<FleetPanel />, makeAttackSetup());

      expect(screen.getByText('Clear advantage')).toBeInTheDocument();
    });

    it('shows "Outmatched" tone when winProbability <= 0.25', () => {
      vi.mocked(simulatePreview).mockReturnValue(makeCombatPreview(0.1));

      renderWithGame(<FleetPanel />, makeAttackSetup());

      expect(screen.getByText('Outmatched')).toBeInTheDocument();
    });

    it('shows "Risky odds" tone when winProbability is between 0.25 and 0.75', () => {
      vi.mocked(simulatePreview).mockReturnValue(makeCombatPreview(0.5));

      renderWithGame(<FleetPanel />, makeAttackSetup());

      expect(screen.getByText('Risky odds')).toBeInTheDocument();
    });

    it('shows "Risky odds" tone at the exact 0.25 boundary (inclusive)', () => {
      vi.mocked(simulatePreview).mockReturnValue(makeCombatPreview(0.25));

      renderWithGame(<FleetPanel />, makeAttackSetup());

      expect(screen.getByText('Risky odds')).toBeInTheDocument();
    });

    it('shows "Clear advantage" tone at exactly 0.76 win probability', () => {
      vi.mocked(simulatePreview).mockReturnValue(makeCombatPreview(0.76));

      renderWithGame(<FleetPanel />, makeAttackSetup());

      expect(screen.getByText('Clear advantage')).toBeInTheDocument();
    });

    it('displays expected attacker losses for top ship types', () => {
      vi.mocked(simulatePreview).mockReturnValue({
        trials: 10,
        winProbability: 0.8,
        drawProbability: 0,
        averageRounds: 3,
        averageAttackerLosses: { lightFighter: 5, cruiser: 1 },
        averageDefenderShipLosses: {},
        averageDefenderDefenceLosses: {},
      });

      renderWithGame(<FleetPanel />, makeAttackSetup());

      // Panel should show expected losses section
      expect(screen.getByText(/Expected losses/i)).toBeInTheDocument();
      // Should show at least one ship type with a number
      expect(
        screen.getByText(/\d+\s*(Light Fighter|Cruiser|Battleship|Heavy Fighter)/i),
      ).toBeInTheDocument();
    });

    it('does not show combat estimate section when no espionage intel is available', () => {
      vi.mocked(simulatePreview).mockReturnValue(makeCombatPreview(0.8));

      renderWithGame(<FleetPanel />, {
        gameState: {
          planet: {
            ships: { battleship: 10 },
            resources: { deuterium: 50_000 },
          },
          // No espionage reports
          espionageReports: [],
        },
        actions: {
          fleetTarget: { galaxy: 1, system: 2, slot: 4 },
        },
      });

      expect(screen.queryByText(/win probability/i)).not.toBeInTheDocument();
    });

    it('calls simulatePreview with deterministic seedBase based on target coordinates', () => {
      vi.mocked(simulatePreview).mockReturnValue(makeCombatPreview(0.7));

      renderWithGame(<FleetPanel />, {
        gameState: {
          planet: {
            ships: { battleship: 5 },
            resources: { deuterium: 50_000 },
          },
          espionageReports: [makeIntelReport()],
          galaxy: { seed: 1000, npcColonies: [] },
        },
        actions: {
          fleetTarget: { galaxy: 1, system: 2, slot: 4 },
        },
      });

      expect(vi.mocked(simulatePreview)).toHaveBeenCalled();
      const callArgs = vi.mocked(simulatePreview).mock.calls[0];
      // seedBase should be a number (deterministic from gameState.galaxy.seed XOR coordinates)
      expect(typeof callArgs[2]).toBe('number');
    });
  });
});
