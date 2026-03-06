import { useState } from 'react';
import type { ActivePanel } from './models/types.ts';
import { GameProvider, useGame } from './context/GameContext';
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
import { AdminPanel } from './panels/AdminPanel';
import { MessagesPanel } from './panels/MessagesPanel';

function ActivePanelContent({
  activePanel,
  onNavigate,
}: {
  activePanel: ActivePanel;
  onNavigate: (panel: ActivePanel) => void;
}) {
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
      return <GalaxyPanel onNavigate={onNavigate} />;
    case 'fleet':
      return <FleetPanel />;
    case 'messages':
      return <MessagesPanel />;
    case 'settings':
      return <SettingsPanel />;
    case 'admin':
      return <AdminPanel />;
    default:
      return <OverviewPanel />;
  }
}

function GameLayout() {
  const { gameState, fleetNotifications } = useGame();
  const [activePanel, setActivePanel] = useState<ActivePanel>('overview');
  const unreadMessageCount =
    gameState.combatLog.filter((entry) => !entry.read).length +
    gameState.espionageReports.filter((report) => !report.read).length +
    fleetNotifications.filter((notification) => !notification.read).length;

  return (
    <div className="app-shell">
      <PlanetSwitcher />
      <ResourceBar />
      <NavSidebar
        activePanel={activePanel}
        onNavigate={setActivePanel}
        unreadMessageCount={unreadMessageCount}
      />
      <main className="main-content">
        <ActivePanelContent activePanel={activePanel} onNavigate={setActivePanel} />
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
