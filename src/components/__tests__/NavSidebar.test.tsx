import userEvent from '@testing-library/user-event';
import { NavSidebar } from '../NavSidebar';
import { renderWithGame, screen } from '../../test/test-utils';

describe('NavSidebar', () => {
  it('renders the navigation buttons', () => {
    const onNavigate = vi.fn();

    renderWithGame(<NavSidebar activePanel="overview" onNavigate={onNavigate} unreadMessageCount={0} />);

    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buildings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Research' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shipyard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fleet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Messages' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('applies the active class to the active panel button', () => {
    const onNavigate = vi.fn();

    renderWithGame(<NavSidebar activePanel="research" onNavigate={onNavigate} unreadMessageCount={0} />);

    expect(screen.getByRole('button', { name: 'Research' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Overview' })).not.toHaveClass('active');
  });

  it('calls onNavigate with the selected panel when a button is clicked', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    renderWithGame(<NavSidebar activePanel="overview" onNavigate={onNavigate} unreadMessageCount={0} />);

    await user.click(screen.getByRole('button', { name: 'Shipyard' }));

    expect(onNavigate).toHaveBeenCalledWith('shipyard');
  });

  it('shows an unread badge for messages when count is positive', () => {
    const onNavigate = vi.fn();

    renderWithGame(<NavSidebar activePanel="overview" onNavigate={onNavigate} unreadMessageCount={3} />);

    expect(screen.getByText('3')).toHaveClass('nav-badge');
  });

  it('scrolls the active tab into view on mobile when the active panel changes', () => {
    const onNavigate = vi.fn();
    const scrollIntoView = vi.fn();
    const originalMatchMedia = window.matchMedia;
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        media: '(max-width: 900px)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    try {
      const view = renderWithGame(
        <NavSidebar activePanel="overview" onNavigate={onNavigate} unreadMessageCount={0} />,
      );

      view.rerender(
        <NavSidebar activePanel="messages" onNavigate={onNavigate} unreadMessageCount={0} />,
      );

      expect(scrollIntoView).toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: originalMatchMedia,
      });
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        value: originalScrollIntoView,
      });
    }
  });
});
