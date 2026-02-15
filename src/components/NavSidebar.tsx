import type { ActivePanel } from '../models/types.ts';

interface NavSidebarProps {
  activePanel: ActivePanel;
  onNavigate: (panel: ActivePanel) => void;
}

const NAV_ITEMS: Array<{ id: ActivePanel; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'buildings', label: 'Buildings' },
  { id: 'research', label: 'Research' },
  { id: 'shipyard', label: 'Shipyard' },
  { id: 'defence', label: 'Defence' },
  { id: 'fleet', label: 'Fleet' },
  { id: 'settings', label: 'Settings' },
];

export function NavSidebar({ activePanel, onNavigate }: NavSidebarProps) {
  return (
    <aside className="nav-sidebar">
      <div className="sidebar-title">Star Forge</div>
      <nav className="nav-list">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-button ${activePanel === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
