import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { Toggle } from '../components/Toggle.tsx';
import { useGame } from '../context/GameContext.tsx';

function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="settings-group">
      <h2 className="settings-group__title">{title}</h2>
      <div className="settings-group__content">{children}</div>
    </section>
  );
}

function SettingsRow({
  label,
  sub,
  children,
}: {
  label: string;
  sub: string;
  children: ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row__copy">
        <div className="settings-row__label">{label}</div>
        <div className="settings-row__sub">{sub}</div>
      </div>
      <div className="settings-row__control">{children}</div>
    </div>
  );
}

export function SettingsPanel() {
  const {
    gameState,
    resetGameAction,
    exportSaveAction,
    importSaveAction,
    setGameSpeed,
    setMaxProbeCount,
    setGodMode,
    setNotificationSetting,
  } = useGame();
  const [importText, setImportText] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const notifications = gameState.settings.notifications;

  const handleReset = (): void => {
    const confirmed = window.confirm('Reset game progress? This cannot be undone.');
    if (!confirmed) {
      return;
    }

    resetGameAction();
    setStatusMessage('Game reset complete.');
  };

  const handleExport = async (): Promise<void> => {
    const payload = exportSaveAction();

    try {
      await navigator.clipboard.writeText(payload);
      setStatusMessage('Save copied to clipboard.');
    } catch {
      setImportText(payload);
      setStatusMessage('Clipboard unavailable. Save text placed in import field.');
    }
  };

  const handleImport = (): void => {
    const payload = importText.trim();
    if (payload.length === 0) {
      setStatusMessage('Paste a save payload before importing.');
      return;
    }

    const success = importSaveAction(payload);
    setStatusMessage(success ? 'Save imported successfully.' : 'Invalid save payload.');

    if (success) {
      setImportText('');
    }
  };

  const handleGameSpeedChange = (nextValue: number): void => {
    setGameSpeed(nextValue);
  };

  const handleGameSpeedKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
  ): void => {
    const currentValue = gameState.settings.gameSpeed;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      handleGameSpeedChange(Math.min(8, currentValue + 1));
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      handleGameSpeedChange(Math.max(1, currentValue - 1));
    }
  };

  const handleMaxProbeChange = (nextValue: number): void => {
    setMaxProbeCount(nextValue);
  };

  const handleMaxProbeKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
  ): void => {
    const currentValue = gameState.settings.maxProbeCount;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      handleMaxProbeChange(Math.min(100, currentValue + 1));
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      handleMaxProbeChange(Math.max(1, currentValue - 1));
    }
  };

  return (
    <section className="panel settings-panel">
      <div className="settings-header">
        <h1 className="settings-header__title">Settings</h1>
        <p className="settings-header__subtitle">
          Configure game behaviour, alerts, and display preferences.
        </p>
      </div>

      <div className="settings-stack">
        <SettingsGroup title="Game">
          <SettingsRow
            label="Game Speed"
            sub="Multiplier applied to all production and build times"
          >
            <div className="settings-slider-row">
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={gameState.settings.gameSpeed}
                className="settings-slider settings-slider--speed"
                onChange={(event) => {
                  handleGameSpeedChange(Number.parseInt(event.target.value, 10));
                }}
                onKeyDown={handleGameSpeedKeyDown}
              />
              <span className="settings-slider__value">
                {gameState.settings.gameSpeed}×
              </span>
            </div>
          </SettingsRow>
          <SettingsRow
            label="Max Espionage Probes"
            sub="Maximum probes sent per spy mission"
          >
            <div className="settings-slider-row">
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={gameState.settings.maxProbeCount}
                className="settings-slider settings-slider--probes"
                onChange={(event) => {
                  handleMaxProbeChange(Number.parseInt(event.target.value, 10));
                }}
                onKeyDown={handleMaxProbeKeyDown}
              />
              <span className="settings-slider__value">
                {gameState.settings.maxProbeCount}
              </span>
            </div>
          </SettingsRow>
          <SettingsRow
            label="God Mode"
            sub="Admin shortcuts for testing and rapid verification"
          >
            <Toggle
              checked={gameState.settings.godMode}
              onChange={setGodMode}
              color="#f0a832"
              ariaLabel="God Mode"
            />
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup title="Notifications">
          <SettingsRow
            label="Enable Notifications"
            sub="Master switch for all in-game alerts"
          >
            <Toggle
              checked={notifications.enabled}
              onChange={(next) => setNotificationSetting?.('enabled', next)}
              ariaLabel="Enable Notifications"
            />
          </SettingsRow>
          <SettingsRow
            label="Combat Alerts"
            sub="Notify when combat reports are received"
          >
            <Toggle
              checked={notifications.combat}
              onChange={(next) => setNotificationSetting?.('combat', next)}
              color="#f87171"
              ariaLabel="Combat Alerts"
            />
          </SettingsRow>
          <SettingsRow
            label="Fleet Alerts"
            sub="Notify when fleet missions return or arrive"
          >
            <Toggle
              checked={notifications.fleet}
              onChange={(next) => setNotificationSetting?.('fleet', next)}
              color="#34d399"
              ariaLabel="Fleet Alerts"
            />
          </SettingsRow>
          <SettingsRow
            label="Espionage Reports"
            sub="Notify when probe reports are received"
          >
            <Toggle
              checked={notifications.espionage}
              onChange={(next) => setNotificationSetting?.('espionage', next)}
              color="#818cf8"
              ariaLabel="Espionage Reports"
            />
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup title="Data">
          <SettingsRow
            label="Export Save"
            sub="Copy your current game state as a JSON payload"
          >
            <button
              type="button"
              className="settings-action-button"
              onClick={() => {
                void handleExport();
              }}
            >
              Export Save
            </button>
          </SettingsRow>
          <SettingsRow
            label="Import Save"
            sub="Load a previously exported save payload"
          >
            <button
              type="button"
              className="settings-action-button"
              onClick={handleImport}
            >
              Import Save
            </button>
          </SettingsRow>
          <textarea
            className="settings-textarea"
            value={importText}
            onChange={(event) => {
              setImportText(event.target.value);
            }}
            placeholder="Paste exported save JSON here..."
          />
          {statusMessage && <p className="hint">{statusMessage}</p>}
        </SettingsGroup>

        <SettingsGroup title="Danger Zone">
          <SettingsRow
            label="Reset Game"
            sub="Permanently wipe all progress and start over"
          >
            <button
              type="button"
              className="settings-action-button settings-action-button--danger"
              onClick={handleReset}
            >
              Reset Game
            </button>
          </SettingsRow>
        </SettingsGroup>
      </div>

      <p className="settings-footer-hint">Changes save automatically.</p>
    </section>
  );
}
