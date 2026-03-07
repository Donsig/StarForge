import { StatisticsPanel } from '../StatisticsPanel';
import { renderWithGame, screen } from '../../test/test-utils';

const baseStatistics = {
  resourcesMined: { metal: 0, crystal: 0, deuterium: 0 },
  combat: { fought: 0, won: 0, lost: 0, drawn: 0, totalLoot: 0, shipsLost: 0 },
  fleet: { sent: {}, totalDistance: 0 },
  milestones: {},
};

describe('StatisticsPanel', () => {
  it('renders panel title', () => {
    renderWithGame(<StatisticsPanel />, { gameState: { statistics: baseStatistics } });
    expect(screen.getByRole('heading', { name: 'Statistics', level: 1 })).toBeInTheDocument();
  });

  it('displays resource mining stats', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: {
          ...baseStatistics,
          resourcesMined: { metal: 12345, crystal: 6789, deuterium: 1000 },
        },
      },
    });

    expect(screen.getByText(/12,345|12345/)).toBeInTheDocument();
  });

  it('displays combat stats', () => {
    renderWithGame(<StatisticsPanel />, {
      gameState: {
        statistics: {
          ...baseStatistics,
          combat: { fought: 10, won: 7, lost: 2, drawn: 1, totalLoot: 50000, shipsLost: 30 },
        },
      },
    });

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });
});
