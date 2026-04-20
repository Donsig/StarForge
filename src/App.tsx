import { useState } from 'react';
import type { ActivePanel } from './models/types.ts';
import { GameProvider, useGame } from './context/GameContext';
import type { MessageTab } from './context/GameContext';
import { NotificationProvider } from './context/NotificationContext.tsx';
import { ResourceBar } from './components/ResourceBar';
import { PlanetSwitcher } from './components/PlanetSwitcher';
import { NavSidebar } from './components/NavSidebar';
import { QueueDisplay } from './components/QueueDisplay';
import { FleetMovementsBar } from './components/FleetMovementsBar.tsx';
import { ToastContainer } from './components/ToastContainer.tsx';
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
import { StatisticsPanel } from './panels/StatisticsPanel';
import { useNotificationObserver } from './hooks/useNotificationObserver.ts';

function ActivePanelContent({
  activePanel,
  onNavigate,
}: {
  activePanel: ActivePanel;
  onNavigate: (panel: ActivePanel) => void;
}) {
  switch (activePanel) {
    case 'overview':
      return <OverviewPanel onNavigate={onNavigate} />;
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
      return <MessagesPanel setActivePanel={onNavigate} />;
    case 'statistics':
      return <StatisticsPanel />;
    case 'settings':
      return <SettingsPanel />;
    case 'admin':
      return <AdminPanel />;
    default:
      return <OverviewPanel onNavigate={onNavigate} />;
  }
}

function GameLayout() {
  const { gameState, fleetNotifications, setMessagesInitialTab } = useGame();
  const [activePanel, setActivePanel] = useState<ActivePanel>('overview');
  const unreadMessageCount =
    gameState.combatLog.filter((entry) => !entry.read).length +
    gameState.espionageReports.filter((report) => !report.read).length +
    fleetNotifications.filter((notification) => !notification.read).length;

  const handleNavigateToMessages = (tab: MessageTab): void => {
    setMessagesInitialTab?.(tab);
    setActivePanel('messages');
  };

  const handlePanelNavigate = (panel: ActivePanel): void => {
    if (panel === 'messages') {
      setMessagesInitialTab?.(null);
    }
    setActivePanel(panel);
  };

  return (
    <NotificationProvider onNavigateToMessages={handleNavigateToMessages}>
      <NotificationObserverMount />
      <div className="app-shell">
        <PlanetSwitcher />
        <ResourceBar />
        <NavSidebar
          activePanel={activePanel}
          onNavigate={handlePanelNavigate}
          unreadMessageCount={unreadMessageCount}
        />
        <main className="main-content">
          <ActivePanelContent activePanel={activePanel} onNavigate={handlePanelNavigate} />
        </main>
        <QueueDisplay activePanel={activePanel} />
        <FleetMovementsBar />
      </div>
      <ToastContainer />
    </NotificationProvider>
  );
}

function NotificationObserverMount() {
  useNotificationObserver();
  return null;
}

export default function App() {
  return (
    <GameProvider>
      <GameLayout />
    </GameProvider>
  );
}
