import { useState } from 'react';
import type { ActivePanel } from './models/types.ts';
import { GameProvider } from './context/GameContext';
import { ResourceBar } from './components/ResourceBar';
import { PlanetSwitcher } from './components/PlanetSwitcher';
import { NavSidebar } from './components/NavSidebar';
import { QueueDisplay } from './components/QueueDisplay';
import { OverviewPanel } from './panels/OverviewPanel';
import { BuildingsPanel } from './panels/BuildingsPanel';
import { ResearchPanel } from './panels/ResearchPanel';
import { ShipyardPanel } from './panels/ShipyardPanel';
import { DefencePanel } from './panels/DefencePanel';
import { FleetPanel } from './panels/FleetPanel';
import { GalaxyPanel } from './panels/GalaxyPanel';
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
    case 'defence':
      return <DefencePanel />;
    case 'galaxy':
      return <GalaxyPanel />;
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
      <PlanetSwitcher />
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
