import userEvent from '@testing-library/user-event';
import { SettingsPanel } from '../SettingsPanel';
import { fireEvent, renderWithGame, screen } from '../../test/test-utils';

describe('SettingsPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the current game speed value', () => {
    renderWithGame(<SettingsPanel />, {
      gameState: {
        settings: {
          gameSpeed: 2.5,
        },
      },
    });

    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('value', '2.5');
    expect(screen.getByText('2.5x')).toBeInTheDocument();
  });

  it('calls setGameSpeed when the slider is changed', () => {
    const setGameSpeed = vi.fn();

    renderWithGame(<SettingsPanel />, {
      actions: {
        setGameSpeed,
      },
    });

    const slider = screen.getByRole('slider');
    fireEvent.input(slider, { target: { value: '1.5' } });

    expect(setGameSpeed).toHaveBeenCalledWith(1.5);
  });

  it('calls exportSaveAction when export is clicked', async () => {
    const user = userEvent.setup();
    const exportSaveAction = vi.fn(() => '{"save":"payload"}');

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    renderWithGame(<SettingsPanel />, {
      actions: {
        exportSaveAction,
      },
    });

    await user.click(screen.getByRole('button', { name: 'Export Save' }));

    expect(exportSaveAction).toHaveBeenCalledTimes(1);
  });

  it('confirms before reset and calls resetGameAction when confirmed', async () => {
    const user = userEvent.setup();
    const resetGameAction = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderWithGame(<SettingsPanel />, {
      actions: {
        resetGameAction,
      },
    });

    await user.click(screen.getByRole('button', { name: 'Reset Game' }));

    expect(confirmSpy).toHaveBeenCalledWith(
      'Reset game progress? This cannot be undone.',
    );
    expect(resetGameAction).toHaveBeenCalledTimes(1);
  });

  it('does not reset when confirmation is canceled', async () => {
    const user = userEvent.setup();
    const resetGameAction = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderWithGame(<SettingsPanel />, {
      actions: {
        resetGameAction,
      },
    });

    await user.click(screen.getByRole('button', { name: 'Reset Game' }));

    expect(resetGameAction).not.toHaveBeenCalled();
  });

  it('accepts text input in the import textarea', () => {
    renderWithGame(<SettingsPanel />);

    const importTextarea = screen.getByPlaceholderText(
      'Paste exported save JSON here...',
    );
    fireEvent.change(importTextarea, { target: { value: '{"version":1}' } });

    expect(importTextarea).toHaveValue('{"version":1}');
  });
});
