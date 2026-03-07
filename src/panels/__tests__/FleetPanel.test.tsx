import userEvent from '@testing-library/user-event';
import { FleetPanel } from '../FleetPanel';
import { fireEvent, renderWithGame, screen } from '../../test/test-utils';

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
    expect(screen.getByText('Attack')).toBeInTheDocument();
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

  it('renders ship manifest tooltip in a portal for active missions', () => {
    renderWithGame(<FleetPanel />, {
      gameState: {
        fleetMissions: [
          {
            id: 'mission_manifesttooltip',
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

    const row = screen.getByText('[G:1 S:8 P:4]').closest('tr');
    expect(row).not.toBeNull();
    fireEvent.mouseEnter(row!);

    const tooltip = document.body.querySelector('.fleet-mission-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip).toHaveTextContent('1× Small Cargo, 2× Cruiser');
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

    expect(screen.getByText('Harvest')).toBeInTheDocument();
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
              resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 },
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
});
