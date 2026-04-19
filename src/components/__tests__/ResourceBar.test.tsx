import { ResourceBar } from '../ResourceBar';
import { act, fireEvent, renderWithGame, screen, waitFor } from '../../test/test-utils';

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

    expect(screen.getByText('12.3K')).toBeInTheDocument();
    expect(screen.getByText('67.9K')).toBeInTheDocument();
    expect(screen.getByText('4,567')).toBeInTheDocument();

    expect(screen.getByText('+1,500/h')).toBeInTheDocument();
    expect(screen.getByText('+2,600/h')).toBeInTheDocument();
    expect(screen.getByText('-250/h')).toBeInTheDocument();
  });

  it('shows the signed net energy balance', () => {
    renderWithGame(<ResourceBar />, {
      productionRates: {
        energyProduction: 4321,
        energyConsumption: 1234,
      },
    });

    expect(screen.getByText('+3,087')).toBeInTheDocument();
  });

  it('uses the green energy class when production covers consumption', () => {
    renderWithGame(<ResourceBar />, {
      productionRates: {
        energyProduction: 300,
        energyConsumption: 300,
      },
    });

    const energyValue = screen.getByText('+0');
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

    const energyValue = screen.getByText('-150');
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

    expect(screen.getByText('111')).toBeInTheDocument();
    expect(screen.getByText('222')).toBeInTheDocument();
    expect(screen.getByText('333')).toBeInTheDocument();

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

    expect(screen.getByText('444')).toBeInTheDocument();
    expect(screen.getByText('555')).toBeInTheDocument();
    expect(screen.getByText('666')).toBeInTheDocument();
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

  it('hovering Metal entry shows Metal Mine level', async () => {
    const { container } = renderWithGame(<ResourceBar />, {
      gameState: { planet: { buildings: { metalMine: 7 } } },
    });

    const metalEntry = container.querySelector('.resource-entry--metal');
    expect(metalEntry).not.toBeNull();

    fireEvent.mouseEnter(metalEntry!);
    await waitFor(() => {
      expect(document.body.querySelector('.resource-hover-panel')).not.toBeNull();
    });

    expect(document.body.textContent).toContain('Metal Mine');
    expect(document.body.textContent).toContain('Lv 7');
  });

  it('hovering Deuterium entry shows temperature modifier', async () => {
    const { container } = renderWithGame(<ResourceBar />, {
      gameState: { planet: { maxTemperature: 100 } },
    });

    const deutEntry = container.querySelector('.resource-entry--deuterium');
    expect(deutEntry).not.toBeNull();

    fireEvent.mouseEnter(deutEntry!);
    await waitFor(() => {
      expect(document.body.querySelector('.resource-hover-panel')).not.toBeNull();
    });

    expect(document.body.textContent).toMatch(/Temp/i);
  });
});
