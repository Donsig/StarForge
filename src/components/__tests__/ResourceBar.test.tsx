import { ResourceBar } from '../ResourceBar';
import { act, fireEvent, renderWithGame, screen } from '../../test/test-utils';

describe('ResourceBar', () => {
  it('shows formatted resource amounts and production rates', () => {
    renderWithGame(<ResourceBar />, {
      gameState: {
        planet: {
          resources: {
            metal: 12345,
            crystal: 67890,
            deuterium: 4567,
          },
        },
      },
      productionRates: {
        metalPerHour: 1500,
        crystalPerHour: 2600,
        deuteriumPerHour: -250,
        energyProduction: 400,
        energyConsumption: 300,
      },
    });

    expect(screen.getByText(/12,345\s*\/\s*10,000/)).toBeInTheDocument();
    expect(screen.getByText(/67,890\s*\/\s*10,000/)).toBeInTheDocument();
    expect(screen.getByText(/4,567\s*\/\s*10,000/)).toBeInTheDocument();

    expect(screen.getByText('+1,500/h')).toBeInTheDocument();
    expect(screen.getByText('+2,600/h')).toBeInTheDocument();
    expect(screen.getByText('-250/h')).toBeInTheDocument();
  });

  it('shows energy production and consumption values', () => {
    renderWithGame(<ResourceBar />, {
      productionRates: {
        energyProduction: 4321,
        energyConsumption: 1234,
      },
    });

    expect(screen.getByText(/4,321\s*\/\s*1,234/)).toBeInTheDocument();
  });

  it('uses the green energy class when production covers consumption', () => {
    renderWithGame(<ResourceBar />, {
      productionRates: {
        energyProduction: 300,
        energyConsumption: 300,
      },
    });

    const energyValue = screen.getByText(/300\s*\/\s*300/);
    expect(energyValue).toHaveClass('energy-ok');
    expect(energyValue).not.toHaveClass('energy-deficit');
  });

  it('uses the red energy class when consumption exceeds production', () => {
    renderWithGame(<ResourceBar />, {
      productionRates: {
        energyProduction: 100,
        energyConsumption: 250,
      },
    });

    const energyValue = screen.getByText(/100\s*\/\s*250/);
    expect(energyValue).toHaveClass('energy-deficit');
    expect(energyValue).not.toHaveClass('energy-ok');
  });

  it('updates displayed resource values when state changes', () => {
    const { rerenderWithGame } = renderWithGame(<ResourceBar />, {
      gameState: {
        planet: {
          resources: {
            metal: 111,
            crystal: 222,
            deuterium: 333,
          },
        },
      },
    });

    expect(screen.getByText(/111\s*\/\s*10,000/)).toBeInTheDocument();
    expect(screen.getByText(/222\s*\/\s*10,000/)).toBeInTheDocument();
    expect(screen.getByText(/333\s*\/\s*10,000/)).toBeInTheDocument();

    rerenderWithGame(<ResourceBar />, {
      gameState: {
        planet: {
          resources: {
            metal: 444,
            crystal: 555,
            deuterium: 666,
          },
        },
      },
    });

    expect(screen.getByText(/444\s*\/\s*10,000/)).toBeInTheDocument();
    expect(screen.getByText(/555\s*\/\s*10,000/)).toBeInTheDocument();
    expect(screen.getByText(/666\s*\/\s*10,000/)).toBeInTheDocument();
  });

  it('keeps the energy hover panel open while moving from anchor to panel', () => {
    vi.useFakeTimers();
    try {
      renderWithGame(<ResourceBar />);
      const energyEntry = screen.getByText('Energy').closest('.resource-entry');

      expect(energyEntry).not.toBeNull();
      fireEvent.mouseEnter(energyEntry!);
      expect(screen.getByText('Production')).toBeInTheDocument();

      fireEvent.mouseLeave(energyEntry!);
      act(() => {
        vi.advanceTimersByTime(60);
      });

      const hoverPanel = document.body.querySelector('.energy-hover-panel');
      expect(hoverPanel).not.toBeNull();
      fireEvent.mouseEnter(hoverPanel!);

      act(() => {
        vi.advanceTimersByTime(120);
      });
      expect(screen.getByText('Production')).toBeInTheDocument();

      act(() => {
        fireEvent.mouseLeave(hoverPanel!);
        vi.advanceTimersByTime(130);
      });
      expect(screen.queryByText('Production')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
