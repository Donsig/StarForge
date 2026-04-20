import { useEffect, useRef } from 'react';
import type { ActivePanel } from '../models/types.ts';
import { useGame } from '../context/GameContext.tsx';

interface NavSidebarProps {
  activePanel: ActivePanel;
  onNavigate: (panel: ActivePanel) => void;
  unreadMessageCount: number;
}

const MAIN_NAV_ITEMS: Array<{ id: Exclude<ActivePanel, 'admin'>; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'buildings', label: 'Buildings' },
  { id: 'research', label: 'Research' },
  { id: 'shipyard', label: 'Shipyard' },
  { id: 'defence', label: 'Defence' },
  { id: 'galaxy', label: 'Galaxy' },
  { id: 'fleet', label: 'Fleet' },
  { id: 'messages', label: 'Messages' },
  { id: 'statistics', label: 'Statistics' },
  { id: 'settings', label: 'Settings' },
];

const ADMIN_NAV_ITEM: { id: ActivePanel; label: string } = {
  id: 'admin',
  label: '⚙ Admin',
};

export function NavSidebar({ activePanel, onNavigate, unreadMessageCount }: NavSidebarProps) {
  const { gameState } = useGame();
  const planet = gameState.planets[gameState.activePlanetIndex];
  const coords = planet?.coordinates;
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const activeTab = activeTabRef.current;
    if (!activeTab) {
      return;
    }

    const shouldScroll =
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function' ||
      window.matchMedia('(max-width: 900px)').matches;

    if (!shouldScroll) {
      return;
    }

    if (typeof activeTab.scrollIntoView !== 'function') {
      return;
    }

    activeTab.scrollIntoView({
      block: 'nearest',
      inline: 'center',
      behavior: 'smooth',
    });
  }, [activePanel]);

  return (
    <aside className="nav-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">STARFORGE</div>
        {coords && (
          <div className="sidebar-coords">
            {coords.galaxy}:{coords.system}:{coords.slot} · {planet.name}
          </div>
        )}
      </div>
      <nav className="nav-list">
        {MAIN_NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            ref={activePanel === item.id ? activeTabRef : null}
            className={`nav-button ${activePanel === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span>{item.label}</span>
            {item.id === 'messages' && unreadMessageCount > 0 && (
              <span className="nav-badge">{unreadMessageCount}</span>
            )}
          </button>
        ))}
        <hr className="nav-divider" />
        <button
          type="button"
          ref={activePanel === ADMIN_NAV_ITEM.id ? activeTabRef : null}
          className={`nav-button nav-button-admin ${activePanel === ADMIN_NAV_ITEM.id ? 'active' : ''}`}
          onClick={() => onNavigate(ADMIN_NAV_ITEM.id)}
        >
          <span>{ADMIN_NAV_ITEM.label}</span>
        </button>
      </nav>
    </aside>
  );
}
