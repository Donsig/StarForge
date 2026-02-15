import { FleetPanel } from '../FleetPanel';
import { renderWithGame, screen, within } from '../../test/test-utils';

describe('FleetPanel', () => {
  it('shows an empty-state message when no ships are built', () => {
    renderWithGame(<FleetPanel />);

    expect(
      screen.getByText('No ships available. Build your first fleet in the Shipyard.'),
    ).toBeInTheDocument();
  });

  it('shows ship names and counts when ships exist', () => {
    renderWithGame(<FleetPanel />, {
      gameState: {
        planet: {
          ships: {
            lightFighter: 5,
            cruiser: 2,
          },
        },
      },
    });

    const lightFighterRow = screen.getByRole('cell', {
      name: 'Light Fighter',
    }).closest('tr');
    expect(lightFighterRow).not.toBeNull();
    expect(within(lightFighterRow as HTMLElement).getByText(/^5$/)).toBeInTheDocument();

    const cruiserRow = screen.getByRole('cell', { name: 'Cruiser' }).closest('tr');
    expect(cruiserRow).not.toBeNull();
    expect(within(cruiserRow as HTMLElement).getByText(/^2$/)).toBeInTheDocument();
  });

  it('shows the total fleet power summary', () => {
    renderWithGame(<FleetPanel />, {
      gameState: {
        planet: {
          ships: {
            lightFighter: 5,
            cruiser: 2,
          },
        },
      },
    });

    expect(screen.getByText('Total Fleet Power')).toBeInTheDocument();
    expect(screen.getByText('1,050')).toBeInTheDocument();
  });
});
