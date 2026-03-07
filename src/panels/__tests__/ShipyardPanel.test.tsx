import userEvent from '@testing-library/user-event';
import { SHIP_ORDER, SHIPS } from '../../data/ships.ts';
import { ShipyardPanel } from '../ShipyardPanel';
import { renderWithGame, screen, within } from '../../test/test-utils';

function getShipCard(name: string): HTMLElement {
  const heading = screen.getByRole('heading', { name, level: 3 });
  const card = heading.closest('article');
  expect(card).not.toBeNull();
  return card as HTMLElement;
}

describe('ShipyardPanel', () => {
  it('renders all ships with names', () => {
    renderWithGame(<ShipyardPanel />);

    for (const shipId of SHIP_ORDER) {
      expect(
        screen.getByRole('heading', { name: SHIPS[shipId].name, level: 3 }),
      ).toBeInTheDocument();
    }
  });

  it('shows locked state for ships with unmet prerequisites', () => {
    renderWithGame(<ShipyardPanel />);

    const lightFighterCard = getShipCard('Light Fighter');
    expect(
      within(lightFighterCard).getByRole('button', { name: 'Locked' }),
    ).toBeDisabled();
    expect(
      within(lightFighterCard).getByText('Shipyard 1'),
    ).toBeInTheDocument();
    expect(
      within(lightFighterCard).getByText('Combustion Drive 1'),
    ).toBeInTheDocument();
  });

  it('shows build controls for ships with met prerequisites', () => {
    renderWithGame(<ShipyardPanel />, {
      gameState: {
        planet: {
          buildings: {
            shipyard: 1,
          },
          resources: {
            metal: 100_000,
            crystal: 100_000,
            deuterium: 100_000,
          },
        },
        research: {
          combustionDrive: 1,
        },
      },
    });

    const lightFighterCard = getShipCard('Light Fighter');
    expect(
      within(lightFighterCard).getByRole('button', { name: 'Queue Build' }),
    ).toBeEnabled();
    expect(within(lightFighterCard).getByRole('spinbutton')).toBeInTheDocument();
  });

  it('updates batch cost when quantity input changes', async () => {
    const user = userEvent.setup();

    renderWithGame(<ShipyardPanel />, {
      gameState: {
        planet: {
          buildings: {
            shipyard: 1,
          },
          resources: {
            metal: 100_000,
            crystal: 100_000,
            deuterium: 100_000,
          },
        },
        research: {
          combustionDrive: 1,
        },
      },
    });

    const lightFighterCard = getShipCard('Light Fighter');
    const quantityInput = within(lightFighterCard).getByRole('spinbutton');

    await user.clear(quantityInput);
    await user.type(quantityInput, '3');

    expect(within(lightFighterCard).getByText('M 9,000')).toBeInTheDocument();
    expect(within(lightFighterCard).getByText('C 3,000')).toBeInTheDocument();
  });

  it('Max button sets quantity to max affordable count', async () => {
    const user = userEvent.setup();

    renderWithGame(<ShipyardPanel />, {
      gameState: {
        planet: {
          buildings: { shipyard: 2 },
          resources: { metal: 6000, crystal: 2000, deuterium: 0 },
        },
        research: { combustionDrive: 2 },
      },
    });

    const card = screen.getByRole('heading', { name: 'Small Cargo', level: 3 }).closest('article');
    expect(card).not.toBeNull();

    await user.click(within(card as HTMLElement).getByRole('button', { name: 'Max' }));

    expect(within(card as HTMLElement).getByRole('spinbutton')).toHaveValue(1);
  });

  it('calls buildShips with ship ID and quantity', async () => {
    const user = userEvent.setup();
    const buildShips = vi.fn(() => true);

    renderWithGame(<ShipyardPanel />, {
      gameState: {
        planet: {
          buildings: {
            shipyard: 1,
          },
          resources: {
            metal: 100_000,
            crystal: 100_000,
            deuterium: 100_000,
          },
        },
        research: {
          combustionDrive: 1,
        },
      },
      actions: {
        buildShips,
      },
    });

    const lightFighterCard = getShipCard('Light Fighter');
    const quantityInput = within(lightFighterCard).getByRole('spinbutton');

    await user.clear(quantityInput);
    await user.type(quantityInput, '4');
    await user.click(within(lightFighterCard).getByRole('button', { name: 'Queue Build' }));

    expect(buildShips).toHaveBeenCalledWith('lightFighter', 4);
  });

  it('disables build button when resources are insufficient for the selected batch', async () => {
    const user = userEvent.setup();

    renderWithGame(<ShipyardPanel />, {
      gameState: {
        planet: {
          buildings: {
            shipyard: 1,
          },
          resources: {
            metal: 3000,
            crystal: 1000,
            deuterium: 0,
          },
        },
        research: {
          combustionDrive: 1,
        },
      },
    });

    const lightFighterCard = getShipCard('Light Fighter');
    const quantityInput = within(lightFighterCard).getByRole('spinbutton');

    await user.clear(quantityInput);
    await user.type(quantityInput, '2');

    expect(
      within(lightFighterCard).getByRole('button', { name: 'Queue Build' }),
    ).toBeDisabled();
    expect(
      within(lightFighterCard).getByText('Insufficient resources'),
    ).toBeInTheDocument();
  });
});
