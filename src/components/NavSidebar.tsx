import type { ActivePanel } from '../models/types.ts';

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
  { id: 'settings', label: 'Settings' },
];

const ADMIN_NAV_ITEM: { id: ActivePanel; label: string } = {
  id: 'admin',
  label: '⚙ Admin',
};

export function NavSidebar({ activePanel, onNavigate, unreadMessageCount }: NavSidebarProps) {
  return (
    <aside className="nav-sidebar">
      <div className="sidebar-title">Star Forge</div>
      <nav className="nav-list">
        {MAIN_NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-button ${activePanel === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
            {item.id === 'messages' && unreadMessageCount > 0 && (
              <span className="nav-badge">{unreadMessageCount}</span>
            )}
          </button>
        ))}
        <hr className="nav-divider" />
        <button
          type="button"
          className={`nav-button nav-button-admin ${activePanel === ADMIN_NAV_ITEM.id ? 'active' : ''}`}
          onClick={() => onNavigate(ADMIN_NAV_ITEM.id)}
        >
          {ADMIN_NAV_ITEM.label}
        </button>
      </nav>
    </aside>
  );
}
