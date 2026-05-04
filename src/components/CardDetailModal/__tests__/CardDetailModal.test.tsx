import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import CardDetailModal from '../index';
import { renderWithGame } from '../../../test/test-utils';
import { createSpyModalValue } from '../../../test/SpyModalProvider';

// ── Test 1: Building — metalMine Lv 7 ─────────────────────────────────────
describe('CardDetailModal — building', () => {
  it('renders title and current level; CTA dispatches upgradeBuilding; Escape calls close', async () => {
    const user = userEvent.setup();
    const upgradeBuilding = vi.fn(() => true);
    const { value, spies } = createSpyModalValue({ type: 'building', id: 'metalMine' });

    renderWithGame(<CardDetailModal />, {
      gameState: {
        planet: {
          buildings: { metalMine: 7 },
          resources: { metal: 1_000_000, crystal: 1_000_000, deuterium: 1_000_000 },
        },
      },
      actions: { upgradeBuilding },
      modal: { value },
    });

    // Dialog rendered with correct accessible name
    const dialog = await screen.findByRole('dialog', { name: /Metal Mine/i });
    expect(dialog).toBeInTheDocument();

    // Current level text present somewhere in the modal
    expect(screen.getByText(/Level 7/i)).toBeInTheDocument();

    // CTA is present and enabled (plenty of resources)
    const cta = screen.getByRole('button', { name: /Upgrade to Lv 8/i });
    expect(cta).toBeInTheDocument();
    expect(cta).not.toBeDisabled();

    // CTA click dispatches action
    await user.click(cta);
    expect(upgradeBuilding).toHaveBeenCalledWith('metalMine');

    // Escape calls close spy
    await user.keyboard('{Escape}');
    expect(spies.close).toHaveBeenCalled();
  });
});

// ── Test 2: Research — weaponsTechnology Lv 3, prereq nav ─────────────────
describe('CardDetailModal — research', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows +30% attack stat; clicking unmet prereq pill fires open after 150ms', async () => {
    const user = userEvent.setup();
    const { value, spies } = createSpyModalValue({ type: 'research', id: 'weaponsTechnology' });

    renderWithGame(<CardDetailModal />, {
      gameState: {
        research: { weaponsTechnology: 3 },
        planet: {
          // researchLab: 0 (default) means "Research Lab 4" prereq is unmet
          buildings: { researchLab: 0 },
        },
      },
      modal: { value },
    });

    // Stat grid shows +30% attack
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('+30% attack').length).toBeGreaterThan(0);

    // Unmet prereq pill for "Research Lab 4" is clickable
    // weaponsTechnology requires researchLab:4; label = "Research Lab 4"
    const pill = screen.getByRole('button', { name: /Research Lab 4/i });
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveAttribute('title', 'Go to Research Lab 4');

    // Click pill → toast appears immediately
    await user.click(pill);
    expect(screen.getByText(/Navigating to/i)).toBeInTheDocument();

    // After 150ms delay, open spy is called
    vi.advanceTimersByTime(150);
    expect(spies.open).toHaveBeenCalledWith('building', 'researchLab');
  });
});

// ── Test 3: Ship — cruiser stepper ────────────────────────────────────────
// cruiser.requires = [shipyard:5, impulseDrive:4, ionTechnology:2]
// cruiser.cost = { metal:20000, crystal:7000, deuterium:2000 }
// With metal:100000, crystal:50000, deuterium:20000 → MAX = min(5,7,10) = 5
describe('CardDetailModal — ship', () => {
  it('stepper + increments CTA label; CTA calls buildShips with correct qty', async () => {
    const user = userEvent.setup();
    const buildShips = vi.fn(() => true);
    const { value } = createSpyModalValue({ type: 'ship', id: 'cruiser' });

    renderWithGame(<CardDetailModal />, {
      gameState: {
        planet: {
          buildings: { shipyard: 5 },
          resources: { metal: 100_000, crystal: 50_000, deuterium: 20_000 },
        },
        research: { impulseDrive: 4, ionTechnology: 2 },
      },
      actions: { buildShips },
      modal: { value },
    });

    await screen.findByRole('dialog', { name: /Cruiser/i });

    // Initial CTA label
    expect(screen.getByRole('button', { name: /Build Ships ×1/i })).toBeInTheDocument();

    // Click + once
    await user.click(screen.getByRole('button', { name: /Increase quantity/i }));
    expect(screen.getByRole('button', { name: /Build Ships ×2/i })).toBeInTheDocument();

    // Click CTA → calls buildShips(id, qty)
    await user.click(screen.getByRole('button', { name: /Build Ships ×2/i }));
    expect(buildShips).toHaveBeenCalledWith('cruiser', 2);
  });
});

// ── Test 4: Defence — gaussCannon + smallShieldDome ──────────────────────
// gaussCannon.requires = [shipyard:6, energyTechnology:6, weaponsTechnology:3, shieldingTechnology:1]
// smallShieldDome.maxCount = 1.
// smallShieldDome.requires = [shipyard:1, shieldingTechnology:2]
describe('CardDetailModal — defence', () => {
  it('gaussCannon: CTA enabled when prereqs met and resources sufficient', async () => {
    const user = userEvent.setup();
    const buildDefences = vi.fn(() => true);
    const { value } = createSpyModalValue({ type: 'defence', id: 'gaussCannon' });

    renderWithGame(<CardDetailModal />, {
      gameState: {
        planet: {
          buildings: { shipyard: 6 },
          resources: { metal: 2_000_000, crystal: 2_000_000, deuterium: 2_000_000 },
        },
        research: { energyTechnology: 6, weaponsTechnology: 3, shieldingTechnology: 1 },
      },
      actions: { buildDefences },
      modal: { value },
    });

    await screen.findByRole('dialog', { name: /Gauss Cannon/i });

    const cta = screen.getByRole('button', { name: /Construct ×1/i });
    expect(cta).not.toBeDisabled();

    await user.click(cta);
    expect(buildDefences).toHaveBeenCalledWith('gaussCannon', 1);
  });

  it('smallShieldDome already built (owned=1) → CTA disabled', async () => {
    const { value } = createSpyModalValue({ type: 'defence', id: 'smallShieldDome' });

    renderWithGame(<CardDetailModal />, {
      gameState: {
        planet: {
          buildings: { shipyard: 1 },
          resources: { metal: 1_000_000, crystal: 1_000_000, deuterium: 0 },
          defences: {
            rocketLauncher: 0,
            lightLaser: 0,
            heavyLaser: 0,
            gaussCannon: 0,
            ionCannon: 0,
            plasmaTurret: 0,
            smallShieldDome: 1,
            largeShieldDome: 0,
          },
        },
        research: { shieldingTechnology: 2 },
      },
      modal: { value },
    });

    await screen.findByRole('dialog', { name: /Small Shield Dome/i });

    // maxCount=1, owned=1 → CTA must be disabled
    // qty=1, existingCount=1+0=1, exceedsMaxCount=true → disabled
    expect(screen.getByRole('button', { name: /Construct ×1/i })).toBeDisabled();
  });

  it('smallShieldDome already queued (owned=0, queued=1) → CTA disabled', async () => {
    const { value } = createSpyModalValue({ type: 'defence', id: 'smallShieldDome' });

    renderWithGame(<CardDetailModal />, {
      gameState: {
        planet: {
          buildings: { shipyard: 1 },
          resources: { metal: 1_000_000, crystal: 1_000_000, deuterium: 0 },
          // defences defaults: smallShieldDome = 0
          shipyardQueue: [
            {
              id: 'smallShieldDome',
              type: 'defence' as const,
              quantity: 1,
              completed: 0,
              startedAt: Date.now(),
              completesAt: Date.now() + 10_000,
              targetLevel: undefined,
              sourcePlanetIndex: 0,
            },
          ],
        },
        research: { shieldingTechnology: 2 },
      },
      modal: { value },
    });

    await screen.findByRole('dialog', { name: /Small Shield Dome/i });

    // existingCount = owned(0) + queued(1) = 1 → exceedsMaxCount → disabled
    expect(screen.getByRole('button', { name: /Construct ×1/i })).toBeDisabled();
  });
});
