import { useState } from 'react';
import { useGame } from '../context/GameContext';

export function SettingsPanel() {
  const {
    resetGameAction,
    exportSaveAction,
    importSaveAction,
  } = useGame();
  const [importText, setImportText] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const handleReset = (): void => {
    const confirmed = window.confirm(
      'Reset game progress? This cannot be undone.',
    );
    if (!confirmed) return;

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

  return (
    <section className="panel">
      <h1 className="panel-title">Settings</h1>
      <p className="panel-subtitle">Manage save data.</p>

      <div className="settings-grid">
        <article className="panel-card">
          <h2 className="section-title">Save Management</h2>
          <div className="settings-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                void handleExport();
              }}
            >
              Export Save
            </button>
            <button type="button" className="btn" onClick={handleImport}>
              Import Save
            </button>
            <button type="button" className="btn btn-danger" onClick={handleReset}>
              Reset Game
            </button>
          </div>

          <textarea
            className="textarea"
            value={importText}
            onChange={(event) => {
              setImportText(event.target.value);
            }}
            placeholder="Paste exported save JSON here..."
          />

          {statusMessage && <p className="hint">{statusMessage}</p>}
        </article>
      </div>
    </section>
  );
}
