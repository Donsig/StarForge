import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FleetMovementsBar } from '../FleetMovementsBar.tsx';
import { renderWithGame } from '../../test/test-utils.tsx';
import type { PlayerMovementEntry } from '../../models/Fleet.ts';

function makeEntry(overrides: Partial<PlayerMovementEntry> = {}): PlayerMovementEntry {
  return {
    kind: 'player',
    id: 'mission-1',
    missionType: 'attack',
    direction: 'outgoing',
    sourcePlanetIndex: 0,
    targetCoordinates: { galaxy: 1, system: 2, slot: 3 },
    status: 'outbound',
    nextTransitionTime: Date.now() + 60_000,
    ships: { lightFighter: 3 },
    cargo: { metal: 0, crystal: 0, deuterium: 0 },
    canRecall: true,
    ...overrides,
  };
}

describe('FleetMovementsBar', () => {
  it('renders nothing when there are no fleet movements', () => {
    const { container } = renderWithGame(<FleetMovementsBar />, {
      fleetMovements: [],
    });

    expect(container.firstChild).toBeNull();
  });

  it('renders a row for each active movement', () => {
    const entries = [
      makeEntry({ id: 'a', missionType: 'attack' }),
      makeEntry({ id: 'b', missionType: 'transport' }),
    ];

    renderWithGame(<FleetMovementsBar />, { fleetMovements: entries });

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows the outgoing arrow for player missions', () => {
    renderWithGame(<FleetMovementsBar />, { fleetMovements: [makeEntry()] });

    expect(screen.getByText('›')).toBeInTheDocument();
  });

  it('shows Recall button only for canRecall entries', () => {
    const entries = [
      makeEntry({ id: 'a', canRecall: true }),
      makeEntry({ id: 'b', canRecall: false, status: 'returning' }),
    ];

    renderWithGame(<FleetMovementsBar />, { fleetMovements: entries });

    expect(screen.getAllByRole('button', { name: /recall/i })).toHaveLength(1);
  });

  it('calls recallFleet with the mission id when Recall is clicked', async () => {
    const recallFleet = vi.fn();

    renderWithGame(<FleetMovementsBar />, {
      fleetMovements: [makeEntry({ id: 'mission-99', canRecall: true })],
      actions: { recallFleet },
    });

    await userEvent.click(screen.getByRole('button', { name: /recall/i }));

    expect(recallFleet).toHaveBeenCalledWith('mission-99');
  });

  it('shows — for countdown when nextTransitionTime is null', () => {
    const entry = makeEntry({ status: 'at_target', nextTransitionTime: null });

    renderWithGame(<FleetMovementsBar />, { fleetMovements: [entry] });

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('applies color class for mission type', () => {
    renderWithGame(<FleetMovementsBar />, {
      fleetMovements: [makeEntry({ missionType: 'espionage' })],
    });

    expect(document.querySelector('.movement-type--espionage')).toBeInTheDocument();
  });
});
