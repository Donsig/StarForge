import { beforeEach, describe, expect, it } from 'vitest';
import {
  fireEvent,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import App from '../../App';

describe('Integration: card detail modal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it(
    'panel click -> modal -> CTA -> QUEUE badge -> NEXT badge -> Escape closes',
    async () => {
      const user = userEvent.setup();
      render(<App />);

      const buildingsNav = screen.getByRole('button', { name: /buildings/i });
      await user.click(buildingsNav);

      const metalMineCard = screen.getByRole('button', { name: /metal mine/i });
      await user.click(metalMineCard);

      const dialog = await screen.findByRole('dialog', { name: /metal mine/i });
      expect(dialog).toBeInTheDocument();

      const dialogScreen = within(dialog);
      const cta = dialogScreen.getByRole('button', { name: /upgrade to lv 1/i });
      expect(cta).toBeInTheDocument();
      expect(cta).not.toBeDisabled();

      await user.click(cta);

      await waitFor(() =>
        expect(dialogScreen.getByRole('button', { name: /queue → lv 2/i })).toBeInTheDocument(),
      );

      const queuedRow = dialog.querySelector('[data-row-state="queued"]');
      const nextRow = dialog.querySelector('[data-row-state="next"]');
      expect(queuedRow).not.toBeNull();
      expect(nextRow).not.toBeNull();
      expect(within(queuedRow as HTMLElement).getByText('QUEUE')).toBeInTheDocument();
      expect(within(nextRow as HTMLElement).getByText('NEXT')).toBeInTheDocument();

      await user.keyboard('{Escape}');

      await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closing'));
      const dialogRemoved = waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
      fireEvent(screen.getByRole('dialog'), new Event('webkitAnimationEnd', { bubbles: true }));

      await dialogRemoved;

      expect(screen.getByRole('heading', { name: /buildings/i, level: 1 })).toBeInTheDocument();
    },
    15_000,
  );
});
