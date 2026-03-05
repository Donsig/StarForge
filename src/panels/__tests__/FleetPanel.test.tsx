import userEvent from '@testing-library/user-event';
import { FleetPanel } from '../FleetPanel';
import { renderWithGame, screen } from '../../test/test-utils';

describe('FleetPanel', () => {
  it('shows target-selection hint when no fleet target is selected', () => {
    renderWithGame(<FleetPanel />);

    expect(
      screen.getByText('Select an NPC target from the Galaxy panel to prepare an attack mission.'),
    ).toBeInTheDocument();
    expect(screen.getByText('No active missions')).toBeInTheDocument();
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
});
