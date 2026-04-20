/// <reference types="vitest/globals" />

// Regression tests for the redesigned SettingsPanel (Task 16).
//
// Tests marked with "EXISTING" pass against current production code and must
// continue to pass after the redesign. All other tests FAIL against current
// production code — they drive the redesign.
//
// New layout (top-to-bottom):
//   1. Header: <h1>Settings</h1> + subtitle
//   2. Game group: Game Speed slider + Max Probes slider + God Mode toggle
//   3. Notifications group: Enable / Combat / Fleet / Espionage toggles
//   4. Data group: Export Save + Import Save + textarea
//   5. Danger Zone group: Reset Game button
//   6. Footer hint: "Changes save automatically." — NO Save button

import userEvent from '@testing-library/user-event';
import { SettingsPanel } from '../SettingsPanel';
import { renderWithGame, screen } from '../../test/test-utils';

// Local types mirror the upcoming v17 GameSettings shape.
// Delete when types.ts ships v17.
interface NotificationSettings {
  enabled: boolean;
  combat: boolean;
  fleet: boolean;
  espionage: boolean;
}

// Default notification settings helper
function makeNotifications(overrides: Partial<NotificationSettings> = {}): NotificationSettings {
  return { enabled: true, combat: true, fleet: true, espionage: true, ...overrides };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderSettings(
  settingsOverrides: Record<string, unknown> = {},
  actionOverrides: Record<string, unknown> = {},
) {
  return renderWithGame(<SettingsPanel />, {
    gameState: {
      settings: {
        gameSpeed: 1,
        godMode: false,
        maxProbeCount: 10,
        // v17 field — will typecheck once types.ts ships v17
        ...(makeNotifications() as unknown as Record<string, unknown>),
        ...settingsOverrides,
      } as never,
    },
    actions: actionOverrides as never,
  });
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

describe('SettingsPanel — header', () => {
  it('renders Settings h1 heading', () => {
    renderWithGame(<SettingsPanel />);
    expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
  });

  it('renders the auto-save footer hint', () => {
    renderWithGame(<SettingsPanel />);
    expect(screen.getByText(/changes save automatically/i)).toBeInTheDocument();
  });

  it('does NOT render a standalone "Save" / "Save Settings" button', () => {
    renderWithGame(<SettingsPanel />);
    // Export/Import/Reset are fine — query specifically for Save variants
    const saveBtn = screen.queryByRole('button', { name: /^save settings$/i });
    expect(saveBtn).not.toBeInTheDocument();
  });

  it('renders subtitle mentioning behaviour, alerts, or preferences', () => {
    renderWithGame(<SettingsPanel />);
    // Subtitle: "Configure game behaviour, alerts, and display preferences."
    expect(
      screen.getByText(/configure game behaviour/i),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Game group
// ---------------------------------------------------------------------------

describe('SettingsPanel — Game group', () => {
  it('renders "Game Speed" label', () => {
    renderWithGame(<SettingsPanel />);
    expect(screen.getByText(/game speed/i)).toBeInTheDocument();
  });

  it('renders Game Speed slider with min=1 max=100', () => {
    renderWithGame(<SettingsPanel />);
    // Target the speed slider by its distinguishing class (multiple sliders
    // may share min=1 max=100; find the one flagged as the speed slider).
    const sliders = screen.getAllByRole('slider');
    const gameSpeedSlider = sliders.find((s) =>
      s.className.includes('settings-slider--speed'),
    );
    expect(gameSpeedSlider).toBeDefined();
    expect(gameSpeedSlider?.getAttribute('min')).toBe('1');
    expect(gameSpeedSlider?.getAttribute('max')).toBe('100');
  });

  it('Game Speed slider value label displays current speed with × suffix', () => {
    renderWithGame(<SettingsPanel />, {
      gameState: { settings: { gameSpeed: 4, godMode: false, maxProbeCount: 10 } as never },
    });
    // Should show "4×" somewhere near the slider
    expect(screen.getByText(/4×/)).toBeInTheDocument();
  });

  it('changing Game Speed slider calls setGameSpeed', async () => {
    const user = userEvent.setup();
    const setGameSpeed = vi.fn();

    renderWithGame(<SettingsPanel />, {
      actions: { setGameSpeed },
    });

    const sliders = screen.getAllByRole('slider');
    const gameSpeedSlider = sliders.find((s) =>
      s.className.includes('settings-slider--speed'),
    );
    expect(gameSpeedSlider).toBeDefined();

    // Use userEvent to change slider value
    await user.type(gameSpeedSlider!, '{ArrowRight}');

    expect(setGameSpeed).toHaveBeenCalled();
  });

  it('renders Max Espionage Probes label', () => {
    renderWithGame(<SettingsPanel />);
    expect(screen.getByText(/max espionage probes|max probes/i)).toBeInTheDocument();
  });

  it('renders Max Probes slider with min=1 max=100', () => {
    renderWithGame(<SettingsPanel />);
    const sliders = screen.getAllByRole('slider');
    const probeSlider = sliders.find(
      (s) =>
        s.getAttribute('min') === '1' &&
        s.getAttribute('max') === '100',
    );
    expect(probeSlider).toBeDefined();
  });

  it('renders God Mode label', () => {
    renderWithGame(<SettingsPanel />);
    expect(screen.getByText(/god mode/i)).toBeInTheDocument();
  });

  it('God Mode toggle reflects current state (false → aria-checked=false)', () => {
    renderWithGame(<SettingsPanel />, {
      gameState: { settings: { gameSpeed: 1, godMode: false, maxProbeCount: 10 } as never },
    });

    // Find the God Mode toggle by its accessible label
    const godModeSwitch = screen.getByRole('switch', { name: /god mode/i });
    expect(godModeSwitch).toHaveAttribute('aria-checked', 'false');
  });

  it('God Mode toggle reflects current state (true → aria-checked=true)', () => {
    renderWithGame(<SettingsPanel />, {
      gameState: { settings: { gameSpeed: 1, godMode: true, maxProbeCount: 10 } as never },
    });

    const godModeSwitch = screen.getByRole('switch', { name: /god mode/i });
    expect(godModeSwitch).toHaveAttribute('aria-checked', 'true');
  });

  it('toggling God Mode calls setGodMode', async () => {
    const user = userEvent.setup();
    const setGodMode = vi.fn();

    renderWithGame(<SettingsPanel />, {
      gameState: { settings: { gameSpeed: 1, godMode: false, maxProbeCount: 10 } as never },
      actions: { setGodMode },
    });

    const godModeSwitch = screen.getByRole('switch', { name: /god mode/i });
    await user.click(godModeSwitch);

    expect(setGodMode).toHaveBeenCalledTimes(1);
    expect(setGodMode).toHaveBeenCalledWith(true);
  });
});

// ---------------------------------------------------------------------------
// Notifications group
// ---------------------------------------------------------------------------

describe('SettingsPanel — Notifications group', () => {
  it('renders "Enable Notifications" toggle', () => {
    renderWithGame(<SettingsPanel />);
    expect(
      screen.getByRole('switch', { name: /enable notifications/i }),
    ).toBeInTheDocument();
  });

  it('renders Combat Alerts toggle', () => {
    renderWithGame(<SettingsPanel />);
    expect(
      screen.getByRole('switch', { name: /combat alerts/i }),
    ).toBeInTheDocument();
  });

  it('renders Fleet Alerts toggle', () => {
    renderWithGame(<SettingsPanel />);
    expect(
      screen.getByRole('switch', { name: /fleet alerts/i }),
    ).toBeInTheDocument();
  });

  it('renders Espionage Reports toggle', () => {
    renderWithGame(<SettingsPanel />);
    expect(
      screen.getByRole('switch', { name: /espionage reports/i }),
    ).toBeInTheDocument();
  });

  it('all 4 Notification toggles present', () => {
    renderWithGame(<SettingsPanel />);
    // There should be at least 4 switches in the notifications group
    // (plus God Mode in Game group = at least 5 total)
    const allSwitches = screen.getAllByRole('switch');
    expect(allSwitches.length).toBeGreaterThanOrEqual(4);
  });

  it('toggling Enable Notifications calls setNotificationSetting with enabled', async () => {
    const user = userEvent.setup();
    const setNotificationSetting = vi.fn();

    renderWithGame(<SettingsPanel />, {
      actions: {
        // @ts-expect-error — setNotificationSetting added in v17; doesn't exist yet.
        setNotificationSetting,
      },
    });

    const enableSwitch = screen.getByRole('switch', { name: /enable notifications/i });
    await user.click(enableSwitch);

    expect(setNotificationSetting).toHaveBeenCalledTimes(1);
    expect(setNotificationSetting).toHaveBeenCalledWith('enabled', expect.any(Boolean));
  });

  it('toggling Combat Alerts calls setNotificationSetting with combat', async () => {
    const user = userEvent.setup();
    const setNotificationSetting = vi.fn();

    renderWithGame(<SettingsPanel />, {
      actions: {
        // @ts-expect-error — setNotificationSetting added in v17; doesn't exist yet.
        setNotificationSetting,
      },
    });

    await user.click(screen.getByRole('switch', { name: /combat alerts/i }));

    expect(setNotificationSetting).toHaveBeenCalledWith('combat', expect.any(Boolean));
  });

  it('toggling Fleet Alerts calls setNotificationSetting with fleet', async () => {
    const user = userEvent.setup();
    const setNotificationSetting = vi.fn();

    renderWithGame(<SettingsPanel />, {
      actions: {
        // @ts-expect-error — setNotificationSetting added in v17; doesn't exist yet.
        setNotificationSetting,
      },
    });

    await user.click(screen.getByRole('switch', { name: /fleet alerts/i }));

    expect(setNotificationSetting).toHaveBeenCalledWith('fleet', expect.any(Boolean));
  });

  it('toggling Espionage Reports calls setNotificationSetting with espionage', async () => {
    const user = userEvent.setup();
    const setNotificationSetting = vi.fn();

    renderWithGame(<SettingsPanel />, {
      actions: {
        // @ts-expect-error — setNotificationSetting added in v17; doesn't exist yet.
        setNotificationSetting,
      },
    });

    await user.click(screen.getByRole('switch', { name: /espionage reports/i }));

    expect(setNotificationSetting).toHaveBeenCalledWith('espionage', expect.any(Boolean));
  });
});

// ---------------------------------------------------------------------------
// Data group
// ---------------------------------------------------------------------------

describe('SettingsPanel — Data group', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Export Save button', () => {
    renderWithGame(<SettingsPanel />);
    expect(screen.getByRole('button', { name: /export save/i })).toBeInTheDocument();
  });

  it('renders Import Save button', () => {
    renderWithGame(<SettingsPanel />);
    expect(screen.getByRole('button', { name: /import save/i })).toBeInTheDocument();
  });

  it('Export button calls exportSaveAction and writes to clipboard', async () => {
    const user = userEvent.setup();
    const exportSaveAction = vi.fn(() => '{"save":"payload"}');

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    renderWithGame(<SettingsPanel />, {
      actions: { exportSaveAction },
    });

    await user.click(screen.getByRole('button', { name: /export save/i }));

    expect(exportSaveAction).toHaveBeenCalledTimes(1);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('{"save":"payload"}');
  });

  it('Import button with empty textarea shows an error hint', async () => {
    const user = userEvent.setup();

    renderWithGame(<SettingsPanel />);

    // Make sure textarea is empty, then click Import
    await user.click(screen.getByRole('button', { name: /import save/i }));

    // An error/status hint should appear (exact text may vary)
    expect(
      screen.getByText(/paste|empty|no payload|before importing/i),
    ).toBeInTheDocument();
  });

  it('Import button with valid payload calls importSaveAction and clears textarea', async () => {
    const user = userEvent.setup();
    const importSaveAction = vi.fn(() => true);

    renderWithGame(<SettingsPanel />, {
      actions: { importSaveAction },
    });

    const textarea = screen.getByPlaceholderText(/paste.*save.*json|save.*payload/i);
    // Use paste instead of type to avoid userEvent interpreting { as a special key modifier
    await user.click(textarea);
    await user.paste('{"version":17}');
    await user.click(screen.getByRole('button', { name: /import save/i }));

    expect(importSaveAction).toHaveBeenCalledWith('{"version":17}');
    // Textarea should be cleared on success
    expect(textarea).toHaveValue('');
  });
});

// ---------------------------------------------------------------------------
// Danger Zone group
// ---------------------------------------------------------------------------

describe('SettingsPanel — Danger Zone group', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // EXISTING — this behaviour is preserved from the old panel
  it('renders Reset Game button', () => {
    renderWithGame(<SettingsPanel />);
    expect(screen.getByRole('button', { name: /reset game|reset/i })).toBeInTheDocument();
  });

  // EXISTING — confirm gate is preserved
  it('Reset button triggers resetGameAction after window.confirm returns true', async () => {
    const user = userEvent.setup();
    const resetGameAction = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderWithGame(<SettingsPanel />, {
      actions: { resetGameAction },
    });

    await user.click(screen.getByRole('button', { name: /reset game|reset/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(resetGameAction).toHaveBeenCalledTimes(1);
  });

  it('Reset button does NOT call resetGameAction when confirm returns false', async () => {
    const user = userEvent.setup();
    const resetGameAction = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderWithGame(<SettingsPanel />, {
      actions: { resetGameAction },
    });

    await user.click(screen.getByRole('button', { name: /reset game|reset/i }));

    expect(resetGameAction).not.toHaveBeenCalled();
  });
});
