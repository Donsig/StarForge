import { useState } from 'react';
import type { ActivePanel } from './models/types.ts';
import { GameProvider } from './context/GameContext';
import { ResourceBar } from './components/ResourceBar';
import { NavSidebar } from './components/NavSidebar';
import { QueueDisplay } from './components/QueueDisplay';
import { OverviewPanel } from './panels/OverviewPanel';
import { BuildingsPanel } from './panels/BuildingsPanel';
import { ResearchPanel } from './panels/ResearchPanel';
import { ShipyardPanel } from './panels/ShipyardPanel';
import { FleetPanel } from './panels/FleetPanel';
import { SettingsPanel } from './panels/SettingsPanel';

function ActivePanelContent({ activePanel }: { activePanel: ActivePanel }) {
  switch (activePanel) {
    case 'overview':
      return <OverviewPanel />;
    case 'buildings':
      return <BuildingsPanel />;
    case 'research':
      return <ResearchPanel />;
    case 'shipyard':
      return <ShipyardPanel />;
    case 'fleet':
      return <FleetPanel />;
    case 'settings':
      return <SettingsPanel />;
    default:
      return <OverviewPanel />;
  }
}

function GameLayout() {
  const [activePanel, setActivePanel] = useState<ActivePanel>('overview');

  return (
    <div className="app-shell">
      <ResourceBar />
      <NavSidebar activePanel={activePanel} onNavigate={setActivePanel} />
      <main className="main-content">
        <ActivePanelContent activePanel={activePanel} />
      </main>
      <QueueDisplay />
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <GameLayout />
    </GameProvider>
  );
}
