import userEvent from '@testing-library/user-event';
import { QueueDisplay } from '../QueueDisplay';
import { renderWithGame, screen, within } from '../../test/test-utils';

describe('QueueDisplay', () => {
  it('is not rendered when all queues are empty', () => {
    const { container } = renderWithGame(<QueueDisplay />);

    expect(container.firstChild).toBeNull();
  });

  it('shows a building queue item with name and target level', () => {
    renderWithGame(<QueueDisplay />, {
      gameState: {
        planet: {
          buildingQueue: [
            {
              type: 'building',
              id: 'metalMine',
              targetLevel: 2,
              startedAt: Date.now(),
              completesAt: Date.now() + 60_000,
            },
          ],
        },
      },
    });

    expect(screen.getByText('Building: Metal Mine')).toBeInTheDocument();
    expect(screen.getByText('Lv 2')).toBeInTheDocument();
  });

  it('shows a research queue item', () => {
    renderWithGame(<QueueDisplay />, {
      gameState: {
        researchQueue: [
          {
            type: 'research',
            id: 'energyTechnology',
            targetLevel: 1,
            startedAt: Date.now(),
            completesAt: Date.now() + 60_000,
          },
        ],
      },
    });

    expect(screen.getByText('Research: Energy Technology')).toBeInTheDocument();
    expect(screen.getByText('Lv 1')).toBeInTheDocument();
  });

  it('shows shipyard queue items when ships are building', () => {
    renderWithGame(<QueueDisplay />, {
      gameState: {
        planet: {
          shipyardQueue: [
            {
              type: 'ship',
              id: 'lightFighter',
              quantity: 5,
              completed: 1,
              startedAt: Date.now(),
              completesAt: Date.now() + 60_000,
            },
          ],
        },
      },
    });

    expect(screen.getByText('Shipyard: Light Fighter')).toBeInTheDocument();
    expect(screen.getByText('2/5')).toBeInTheDocument();
  });

  it('shows all queued items with cancel buttons', () => {
    renderWithGame(<QueueDisplay />, {
      gameState: {
        planet: {
          buildingQueue: [
            {
              type: 'building',
              id: 'metalMine',
              targetLevel: 1,
              startedAt: Date.now(),
              completesAt: Date.now() + 60_000,
            },
            {
              type: 'building',
              id: 'crystalMine',
              targetLevel: 1,
              startedAt: Date.now() + 60_000,
              completesAt: Date.now() + 120_000,
            },
          ],
        },
      },
    });

    expect(screen.getByText('Building: Metal Mine')).toBeInTheDocument();
    expect(screen.getByText('Building: Crystal Mine')).toBeInTheDocument();
    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
    expect(cancelButtons).toHaveLength(2);
  });

  it('calls cancel actions with correct index when cancel buttons are clicked', async () => {
    const user = userEvent.setup();
    const cancelBuilding = vi.fn();
    const cancelResearch = vi.fn();
    const cancelShipyard = vi.fn();

    renderWithGame(<QueueDisplay />, {
      gameState: {
        planet: {
          buildingQueue: [
            {
              type: 'building',
              id: 'metalMine',
              targetLevel: 2,
              startedAt: Date.now(),
              completesAt: Date.now() + 60_000,
            },
          ],
        },
        researchQueue: [
          {
            type: 'research',
            id: 'energyTechnology',
            targetLevel: 1,
            startedAt: Date.now(),
            completesAt: Date.now() + 60_000,
          },
        ],
      },
      actions: {
        cancelBuilding,
        cancelResearch,
        cancelShipyard,
      },
    });

    const buildingQueueRow = screen
      .getByText('Building: Metal Mine')
      .closest('.queue-item');
    expect(buildingQueueRow).not.toBeNull();

    const researchQueueRow = screen
      .getByText('Research: Energy Technology')
      .closest('.queue-item');
    expect(researchQueueRow).not.toBeNull();

    await user.click(
      within(buildingQueueRow as HTMLElement).getByRole('button', { name: 'Cancel' }),
    );
    await user.click(
      within(researchQueueRow as HTMLElement).getByRole('button', { name: 'Cancel' }),
    );

    expect(cancelBuilding).toHaveBeenCalledWith(0);
    expect(cancelResearch).toHaveBeenCalledWith(0);
  });
});
