# Artwork System Implementation Plan

> **Note:** This is an implementation plan intended to be followed task-by-task by contributors or automation.

**Goal:** Wire up the artwork system — asset map, CSS, card banners, page banners, and planet visuals — so that dropping `.webp` files into `public/assets/` makes them appear automatically. No images are generated here; this is code-only.

**Architecture:** Central `src/data/assets.ts` maps all item IDs to `/assets/...` paths. Panels import from there. Images are wrapped in a `<div className="card-banner">` container with a dark CSS fallback; the `<img>` uses `onError` to self-hide if the file doesn't exist yet. Planet type is derived from `maxTemperature` at render time.

**Tech Stack:** React 19, TypeScript strict, Vite (serves `public/` as-is), CSS custom properties, vitest + @testing-library/react

---

## Key Files Reference

- `src/data/assets.ts` — **create new** — central asset map
- `src/data/buildings.ts` — BUILDING_ORDER (12 IDs)
- `src/data/ships.ts` — SHIP_ORDER (13 IDs)
- `src/data/defences.ts` — DEFENCE_ORDER (8 IDs)
- `src/data/research.ts` — RESEARCH_ORDER (15 IDs)
- `src/panels/BuildingsPanel.tsx` — card items in `<article className="item-card">`, header in `<div className="item-header">`
- `src/panels/ShipyardPanel.tsx` — same card structure
- `src/panels/DefencePanel.tsx` — same card structure
- `src/panels/ResearchPanel.tsx` — same card structure
- `src/panels/FleetPanel.tsx` — top-level `<section className="panel">`
- `src/panels/OverviewPanel.tsx` — shows `planet.name` and `planet.maxTemperature`
- `src/panels/GalaxyPanel.tsx` — renders `SystemSlot` rows; `slot.type === 'npc'` or `'player'`; NPC has `slot.npc?.temperature`
- `src/styles.css` — global styles
- `src/test/test-utils.tsx` — `renderWithGame(component, options)` for all tests

---

## Complete Item ID Lists

**Buildings (12):** metalMine, crystalMine, deuteriumSynthesizer, solarPlant, fusionReactor, metalStorage, crystalStorage, deuteriumTank, roboticsFactory, naniteFactory, shipyard, researchLab

**Ships (13):** lightFighter, heavyFighter, cruiser, battleship, bomber, destroyer, battlecruiser, smallCargo, largeCargo, colonyShip, recycler, espionageProbe, solarSatellite

**Defences (8):** rocketLauncher, lightLaser, heavyLaser, gaussCannon, ionCannon, plasmaTurret, smallShieldDome, largeShieldDome

**Research (15):** energyTechnology, laserTechnology, ionTechnology, plasmaTechnology, espionageTechnology, computerTechnology, weaponsTechnology, shieldingTechnology, armourTechnology, combustionDrive, impulseDrive, hyperspaceTechnology, hyperspaceDrive, astrophysicsTechnology, intergalacticResearchNetwork

**Planets (4):** hot, temperate, cold, frozen

**Page banners (5):** fleet, defence, buildings, research, galaxy

---

## Task 1: Create `src/data/assets.ts`

**Files:**
- Create: `src/data/assets.ts`
- Test: `src/data/__tests__/assets.test.ts`

### Step 1: Write the failing test

Create `src/data/__tests__/assets.test.ts`:

```typescript
import { getPlanetType, getPlanetImageUrl, BUILDING_IMAGES, SHIP_IMAGES, DEFENCE_IMAGES, RESEARCH_IMAGES, PANEL_IMAGES } from '../assets';

describe('getPlanetType', () => {
  it('returns hot for temperature above 60', () => {
    expect(getPlanetType(61)).toBe('hot');
    expect(getPlanetType(100)).toBe('hot');
  });
  it('returns temperate for 20–60', () => {
    expect(getPlanetType(60)).toBe('temperate');
    expect(getPlanetType(21)).toBe('temperate');
  });
  it('returns cold for -20 to 20', () => {
    expect(getPlanetType(20)).toBe('cold');
    expect(getPlanetType(-19)).toBe('cold');
  });
  it('returns frozen for -20 and below', () => {
    expect(getPlanetType(-20)).toBe('frozen');
    expect(getPlanetType(-100)).toBe('frozen');
  });
});

describe('getPlanetImageUrl', () => {
  it('returns portrait path by default', () => {
    expect(getPlanetImageUrl(80)).toBe('/assets/planets/hot.webp');
  });
  it('returns icon path when requested', () => {
    expect(getPlanetImageUrl(0)).toBe('/assets/planets/cold-icon.webp');
  });
});

describe('asset maps', () => {
  it('BUILDING_IMAGES has all 12 buildings', () => {
    expect(Object.keys(BUILDING_IMAGES)).toHaveLength(12);
    expect(BUILDING_IMAGES.metalMine).toBe('/assets/buildings/metalMine.webp');
  });
  it('SHIP_IMAGES has all 13 ships', () => {
    expect(Object.keys(SHIP_IMAGES)).toHaveLength(13);
  });
  it('DEFENCE_IMAGES has all 8 defences', () => {
    expect(Object.keys(DEFENCE_IMAGES)).toHaveLength(8);
  });
  it('RESEARCH_IMAGES has all 15 research items', () => {
    expect(Object.keys(RESEARCH_IMAGES)).toHaveLength(15);
  });
  it('PANEL_IMAGES has all 5 panels', () => {
    expect(Object.keys(PANEL_IMAGES)).toHaveLength(5);
    expect(PANEL_IMAGES.fleet).toBe('/assets/panels/fleet.webp');
  });
});
```

### Step 2: Run to verify it fails

```bash
npx vitest run src/data/__tests__/assets.test.ts
```
Expected: FAIL — module not found

### Step 3: Create `src/data/assets.ts`

```typescript
export type PlanetType = 'hot' | 'temperate' | 'cold' | 'frozen';

export function getPlanetType(maxTemperature: number): PlanetType {
  if (maxTemperature > 60) return 'hot';
  if (maxTemperature > 20) return 'temperate';
  if (maxTemperature > -20) return 'cold';
  return 'frozen';
}

export function getPlanetImageUrl(
  maxTemperature: number,
  size: 'portrait' | 'icon' = 'portrait',
): string {
  const type = getPlanetType(maxTemperature);
  return size === 'icon'
    ? `/assets/planets/${type}-icon.webp`
    : `/assets/planets/${type}.webp`;
}

export const BUILDING_IMAGES: Record<string, string> = {
  metalMine: '/assets/buildings/metalMine.webp',
  crystalMine: '/assets/buildings/crystalMine.webp',
  deuteriumSynthesizer: '/assets/buildings/deuteriumSynthesizer.webp',
  solarPlant: '/assets/buildings/solarPlant.webp',
  fusionReactor: '/assets/buildings/fusionReactor.webp',
  metalStorage: '/assets/buildings/metalStorage.webp',
  crystalStorage: '/assets/buildings/crystalStorage.webp',
  deuteriumTank: '/assets/buildings/deuteriumTank.webp',
  roboticsFactory: '/assets/buildings/roboticsFactory.webp',
  naniteFactory: '/assets/buildings/naniteFactory.webp',
  shipyard: '/assets/buildings/shipyard.webp',
  researchLab: '/assets/buildings/researchLab.webp',
};

export const SHIP_IMAGES: Record<string, string> = {
  lightFighter: '/assets/ships/lightFighter.webp',
  heavyFighter: '/assets/ships/heavyFighter.webp',
  cruiser: '/assets/ships/cruiser.webp',
  battleship: '/assets/ships/battleship.webp',
  bomber: '/assets/ships/bomber.webp',
  destroyer: '/assets/ships/destroyer.webp',
  battlecruiser: '/assets/ships/battlecruiser.webp',
  smallCargo: '/assets/ships/smallCargo.webp',
  largeCargo: '/assets/ships/largeCargo.webp',
  colonyShip: '/assets/ships/colonyShip.webp',
  recycler: '/assets/ships/recycler.webp',
  espionageProbe: '/assets/ships/espionageProbe.webp',
  solarSatellite: '/assets/ships/solarSatellite.webp',
};

export const DEFENCE_IMAGES: Record<string, string> = {
  rocketLauncher: '/assets/defences/rocketLauncher.webp',
  lightLaser: '/assets/defences/lightLaser.webp',
  heavyLaser: '/assets/defences/heavyLaser.webp',
  gaussCannon: '/assets/defences/gaussCannon.webp',
  ionCannon: '/assets/defences/ionCannon.webp',
  plasmaTurret: '/assets/defences/plasmaTurret.webp',
  smallShieldDome: '/assets/defences/smallShieldDome.webp',
  largeShieldDome: '/assets/defences/largeShieldDome.webp',
};

export const RESEARCH_IMAGES: Record<string, string> = {
  energyTechnology: '/assets/research/energyTechnology.webp',
  laserTechnology: '/assets/research/laserTechnology.webp',
  ionTechnology: '/assets/research/ionTechnology.webp',
  plasmaTechnology: '/assets/research/plasmaTechnology.webp',
  espionageTechnology: '/assets/research/espionageTechnology.webp',
  computerTechnology: '/assets/research/computerTechnology.webp',
  weaponsTechnology: '/assets/research/weaponsTechnology.webp',
  shieldingTechnology: '/assets/research/shieldingTechnology.webp',
  armourTechnology: '/assets/research/armourTechnology.webp',
  combustionDrive: '/assets/research/combustionDrive.webp',
  impulseDrive: '/assets/research/impulseDrive.webp',
  hyperspaceTechnology: '/assets/research/hyperspaceTechnology.webp',
  hyperspaceDrive: '/assets/research/hyperspaceDrive.webp',
  astrophysicsTechnology: '/assets/research/astrophysicsTechnology.webp',
  intergalacticResearchNetwork: '/assets/research/intergalacticResearchNetwork.webp',
};

export const PANEL_IMAGES = {
  fleet: '/assets/panels/fleet.webp',
  defence: '/assets/panels/defence.webp',
  buildings: '/assets/panels/buildings.webp',
  research: '/assets/panels/research.webp',
  galaxy: '/assets/panels/galaxy.webp',
} as const;
```

### Step 4: Run to verify it passes

```bash
npx vitest run src/data/__tests__/assets.test.ts
```
Expected: PASS

### Step 5: Commit

```bash
git add src/data/assets.ts src/data/__tests__/assets.test.ts
git commit -m "feat(assets): add central asset map and planet type helpers"
```

---

## Task 2: CSS — card banners, page banners, planet images

**Files:**
- Modify: `src/styles.css`

No test needed for CSS. Add the following at the end of `src/styles.css`:

```css
/* ── Artwork ────────────────────────────────────── */

/* Card banner — appears at top of each item card */
.card-banner {
  width: 100%;
  height: 120px;
  background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
  border-radius: 0.4rem 0.4rem 0 0;
  overflow: hidden;
  flex-shrink: 0;
}

.card-banner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
}

/* Page banner — full-width header at top of each panel */
.panel-banner {
  width: 100%;
  height: 180px;
  background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
  border-radius: 0.4rem;
  overflow: hidden;
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.panel-banner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
}

/* Planet portrait — Overview panel */
.planet-portrait {
  width: 256px;
  height: 256px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0d1117 0%, #1c2333 100%);
  overflow: hidden;
  flex-shrink: 0;
  margin: 0 auto 1rem;
}

.planet-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* Planet icon — Galaxy map */
.planet-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0d1117 0%, #1c2333 100%);
  overflow: hidden;
  flex-shrink: 0;
}

.planet-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
```

### Commit

```bash
git add src/styles.css
git commit -m "feat(styles): add artwork CSS — card banners, page banners, planet visuals"
```

---

## Task 3: Page banners — Fleet, Defence, Buildings, Research, Galaxy panels

**Files:**
- Modify: `src/panels/FleetPanel.tsx`, `src/panels/DefencePanel.tsx`, `src/panels/BuildingsPanel.tsx`, `src/panels/ResearchPanel.tsx`, `src/panels/GalaxyPanel.tsx`

In each panel, add `import { PANEL_IMAGES } from '../data/assets.ts';` at the top (with existing imports).

Then add the banner as the **first child** inside the `<section className="panel">` element:

```tsx
<div className="panel-banner">
  <img
    src={PANEL_IMAGES.buildings}  {/* change key per panel */}
    alt=""
    onError={(e) => { e.currentTarget.style.display = 'none'; }}
  />
</div>
```

Use the correct key per panel:
- BuildingsPanel → `PANEL_IMAGES.buildings`
- DefencePanel → `PANEL_IMAGES.defence`
- FleetPanel → `PANEL_IMAGES.fleet`
- ResearchPanel → `PANEL_IMAGES.research`
- GalaxyPanel → `PANEL_IMAGES.galaxy`

### Smoke test

```bash
npm run build
```
Expected: clean build, no TypeScript errors.

### Commit

```bash
git add src/panels/FleetPanel.tsx src/panels/DefencePanel.tsx src/panels/BuildingsPanel.tsx src/panels/ResearchPanel.tsx src/panels/GalaxyPanel.tsx
git commit -m "feat(panels): add page banner image to Fleet, Defence, Buildings, Research, Galaxy panels"
```

---

## Task 4: Card banners — BuildingsPanel

**Files:**
- Modify: `src/panels/BuildingsPanel.tsx`
- Test: `src/panels/__tests__/BuildingsPanel.test.tsx`

### Step 1: Write the failing test

Add to `src/panels/__tests__/BuildingsPanel.test.tsx`:

```tsx
it('renders a card banner img with correct src for each building', () => {
  renderWithGame(<BuildingsPanel />);

  // Metal Mine card should have a banner img pointing to the asset path
  const imgs = document.querySelectorAll('.card-banner img');
  const srcs = Array.from(imgs).map((img) => (img as HTMLImageElement).src);
  expect(srcs.some((src) => src.includes('metalMine.webp'))).toBe(true);
});
```

### Step 2: Run to verify it fails

```bash
npx vitest run src/panels/__tests__/BuildingsPanel.test.tsx
```
Expected: FAIL — no `.card-banner img` elements found

### Step 3: Add card banners to BuildingsPanel

Add `import { BUILDING_IMAGES, SHIP_IMAGES } from '../data/assets.ts';` to `src/panels/BuildingsPanel.tsx`.

Inside the building card rendering loop, add `<div className="card-banner">` as the **first child** of `<article className="item-card">`:

```tsx
<article key={buildingId} className="item-card">
  <div className="card-banner">
    <img
      src={BUILDING_IMAGES[buildingId]}
      alt=""
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  </div>
  <div className="item-header">
    {/* existing content unchanged */}
  </div>
  {/* rest of card unchanged */}
</article>
```

Also add a card banner to the Solar Satellite card (which is a ship):
```tsx
<div className="card-banner">
  <img
    src={SHIP_IMAGES.solarSatellite}
    alt=""
    onError={(e) => { e.currentTarget.style.display = 'none'; }}
  />
</div>
```

### Step 4: Run to verify it passes

```bash
npx vitest run src/panels/__tests__/BuildingsPanel.test.tsx
```
Expected: PASS

### Step 5: Commit

```bash
git add src/panels/BuildingsPanel.tsx src/panels/__tests__/BuildingsPanel.test.tsx
git commit -m "feat(buildings): add card banner images to building cards"
```

---

## Task 5: Card banners — ShipyardPanel

**Files:**
- Modify: `src/panels/ShipyardPanel.tsx`
- Test: `src/panels/__tests__/ShipyardPanel.test.tsx`

### Step 1: Write the failing test

Add to `src/panels/__tests__/ShipyardPanel.test.tsx`:

```tsx
it('renders card banner imgs for ship cards', () => {
  renderWithGame(<ShipyardPanel />, {
    gameState: { planet: { buildings: { shipyard: 1 } } },
  });

  const imgs = document.querySelectorAll('.card-banner img');
  expect(imgs.length).toBeGreaterThan(0);
  const srcs = Array.from(imgs).map((img) => (img as HTMLImageElement).src);
  expect(srcs.some((src) => src.includes('lightFighter.webp'))).toBe(true);
});
```

### Step 2: Run to verify it fails

```bash
npx vitest run src/panels/__tests__/ShipyardPanel.test.tsx
```
Expected: FAIL

### Step 3: Add card banners to ShipyardPanel

Add `import { SHIP_IMAGES } from '../data/assets.ts';` to `src/panels/ShipyardPanel.tsx`.

In the ship card loop, add as first child of `<article>`:

```tsx
<div className="card-banner">
  <img
    src={SHIP_IMAGES[shipId]}
    alt=""
    onError={(e) => { e.currentTarget.style.display = 'none'; }}
  />
</div>
```

### Step 4: Run to verify it passes

```bash
npx vitest run src/panels/__tests__/ShipyardPanel.test.tsx
```
Expected: PASS

### Step 5: Commit

```bash
git add src/panels/ShipyardPanel.tsx src/panels/__tests__/ShipyardPanel.test.tsx
git commit -m "feat(shipyard): add card banner images to ship cards"
```

---

## Task 6: Card banners — DefencePanel

**Files:**
- Modify: `src/panels/DefencePanel.tsx`
- Test: `src/panels/__tests__/DefencePanel.test.tsx`

### Step 1: Write the failing test

In `src/panels/__tests__/DefencePanel.test.tsx` (create if it doesn't exist — model on ShipyardPanel.test.tsx):

```tsx
import { screen } from '@testing-library/react';
import { DefencePanel } from '../DefencePanel';
import { renderWithGame } from '../../test/test-utils';

describe('DefencePanel', () => {
  it('renders card banner imgs for defence cards', () => {
    renderWithGame(<DefencePanel />, {
      gameState: { planet: { buildings: { shipyard: 1 } } },
    });

    const imgs = document.querySelectorAll('.card-banner img');
    expect(imgs.length).toBeGreaterThan(0);
    const srcs = Array.from(imgs).map((img) => (img as HTMLImageElement).src);
    expect(srcs.some((src) => src.includes('rocketLauncher.webp'))).toBe(true);
  });
});
```

### Step 2: Run to verify it fails

```bash
npx vitest run src/panels/__tests__/DefencePanel.test.tsx
```
Expected: FAIL

### Step 3: Add card banners to DefencePanel

Add `import { DEFENCE_IMAGES } from '../data/assets.ts';` to `src/panels/DefencePanel.tsx`.

Add as first child of each defence `<article>`:

```tsx
<div className="card-banner">
  <img
    src={DEFENCE_IMAGES[defenceId]}
    alt=""
    onError={(e) => { e.currentTarget.style.display = 'none'; }}
  />
</div>
```

### Step 4: Run to verify it passes

```bash
npx vitest run src/panels/__tests__/DefencePanel.test.tsx
```
Expected: PASS

### Step 5: Commit

```bash
git add src/panels/DefencePanel.tsx src/panels/__tests__/DefencePanel.test.tsx
git commit -m "feat(defence): add card banner images to defence cards"
```

---

## Task 7: Card banners — ResearchPanel

**Files:**
- Modify: `src/panels/ResearchPanel.tsx`
- Test: `src/panels/__tests__/ResearchPanel.test.tsx`

### Step 1: Write the failing test

Add to `src/panels/__tests__/ResearchPanel.test.tsx`:

```tsx
it('renders card banner imgs for research cards', () => {
  renderWithGame(<ResearchPanel />, {
    gameState: { planet: { buildings: { researchLab: 1 } } },
  });

  const imgs = document.querySelectorAll('.card-banner img');
  expect(imgs.length).toBeGreaterThan(0);
  const srcs = Array.from(imgs).map((img) => (img as HTMLImageElement).src);
  expect(srcs.some((src) => src.includes('energyTechnology.webp'))).toBe(true);
});
```

### Step 2: Run to verify it fails

```bash
npx vitest run src/panels/__tests__/ResearchPanel.test.tsx
```
Expected: FAIL

### Step 3: Add card banners to ResearchPanel

Add `import { RESEARCH_IMAGES } from '../data/assets.ts';` to `src/panels/ResearchPanel.tsx`.

Add as first child of each research `<article>`:

```tsx
<div className="card-banner">
  <img
    src={RESEARCH_IMAGES[researchId]}
    alt=""
    onError={(e) => { e.currentTarget.style.display = 'none'; }}
  />
</div>
```

### Step 4: Run to verify it passes

```bash
npx vitest run src/panels/__tests__/ResearchPanel.test.tsx
```
Expected: PASS

### Step 5: Commit

```bash
git add src/panels/ResearchPanel.tsx src/panels/__tests__/ResearchPanel.test.tsx
git commit -m "feat(research): add card banner images to research cards"
```

---

## Task 8: Planet portrait — OverviewPanel

**Files:**
- Modify: `src/panels/OverviewPanel.tsx`
- Test: `src/panels/__tests__/OverviewPanel.test.tsx` (check if exists; add to it or create)

### Step 1: Write the failing test

Add to the Overview panel test file:

```tsx
it('renders planet portrait img with correct type src based on temperature', () => {
  renderWithGame(<OverviewPanel />, {
    gameState: {
      planet: { maxTemperature: 80 }, // > 60 → hot
    },
  });

  const portrait = document.querySelector('.planet-portrait img') as HTMLImageElement;
  expect(portrait).toBeTruthy();
  expect(portrait.src).toContain('hot.webp');
});
```

### Step 2: Run to verify it fails

```bash
npx vitest run src/panels/__tests__/OverviewPanel.test.tsx
```
Expected: FAIL — no `.planet-portrait img` found

### Step 3: Add planet portrait to OverviewPanel

Add to imports in `src/panels/OverviewPanel.tsx`:
```tsx
import { getPlanetImageUrl } from '../data/assets.ts';
```

Find the section that shows `planet.name` and `planet.maxTemperature`. Add the planet portrait directly above the planet name:

```tsx
<div className="planet-portrait">
  <img
    src={getPlanetImageUrl(planet.maxTemperature)}
    alt={planet.name}
    onError={(e) => { e.currentTarget.style.display = 'none'; }}
  />
</div>
```

### Step 4: Run to verify it passes

```bash
npx vitest run src/panels/__tests__/OverviewPanel.test.tsx
```
Expected: PASS

### Step 5: Commit

```bash
git add src/panels/OverviewPanel.tsx src/panels/__tests__/OverviewPanel.test.tsx
git commit -m "feat(overview): add planet portrait image based on temperature type"
```

---

## Task 9: Planet icons — GalaxyPanel

**Files:**
- Modify: `src/panels/GalaxyPanel.tsx`
- Test: `src/panels/__tests__/GalaxyPanel.test.tsx`

Planet icons appear in the galaxy grid rows. Each NPC colony has a `temperature` field on `slot.npc`. Each player planet has `maxTemperature` on `slot.planet`.

### Step 1: Write the failing test

Add to `src/panels/__tests__/GalaxyPanel.test.tsx`:

```tsx
it('renders planet icon for NPC colony row', () => {
  renderWithGame(<GalaxyPanel />, {
    gameState: {
      galaxy: {
        seed: 1,
        npcColonies: [
          {
            coordinates: { galaxy: 1, system: 1, slot: 3 },
            name: 'Test Base',
            temperature: 80, // hot
            tier: 1,
            specialty: 'balanced',
            maxTier: 5,
            initialUpgradeIntervalMs: 21_600_000,
            currentUpgradeIntervalMs: 21_600_000,
            targetTier: 1,
            catchUpUpgradeIntervalMs: 5_400_000,
            catchUpProgressTicks: 0,
            lastUpgradeAt: 0,
            upgradeTickCount: 0,
            raidCount: 0,
            recentRaidTimestamps: [],
            abandonedAt: undefined,
            buildings: {},
            baseDefences: {},
            baseShips: {},
            currentDefences: {},
            currentShips: {},
            lastRaidedAt: 0,
            resourcesAtLastRaid: { metal: 0, crystal: 0, deuterium: 0 },
          },
        ],
      },
    },
  });

  const icons = document.querySelectorAll('.planet-icon img');
  expect(icons.length).toBeGreaterThan(0);
  const srcs = Array.from(icons).map((img) => (img as HTMLImageElement).src);
  expect(srcs.some((src) => src.includes('hot-icon.webp'))).toBe(true);
});
```

### Step 2: Run to verify it fails

```bash
npx vitest run src/panels/__tests__/GalaxyPanel.test.tsx
```
Expected: FAIL

### Step 3: Add planet icons to GalaxyPanel

Add to imports in `src/panels/GalaxyPanel.tsx`:
```tsx
import { getPlanetImageUrl } from '../data/assets.ts';
```

In the `SystemSlotRow` component (or wherever `slot.type === 'npc'` and `slot.type === 'player'` rows are rendered), add a `<div className="planet-icon">` before the slot name text:

For NPC slots (have `slot.npc.temperature`):
```tsx
{slot.type === 'npc' && (
  <div className="planet-icon">
    <img
      src={getPlanetImageUrl(slot.npc!.temperature, 'icon')}
      alt=""
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  </div>
)}
```

For player slots (have `slot.planet.maxTemperature`):
```tsx
{slot.type === 'player' && (
  <div className="planet-icon">
    <img
      src={getPlanetImageUrl(slot.planet!.maxTemperature, 'icon')}
      alt=""
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  </div>
)}
```

Place these icons inside the existing row structure, adjacent to the planet name text. Read the existing row JSX carefully before inserting — do not break existing layout.

### Step 4: Run to verify it passes

```bash
npx vitest run src/panels/__tests__/GalaxyPanel.test.tsx
```
Expected: PASS

### Step 5: Commit

```bash
git add src/panels/GalaxyPanel.tsx src/panels/__tests__/GalaxyPanel.test.tsx
git commit -m "feat(galaxy): add planet type icons to galaxy map rows"
```

---

## Task 10: Full test suite + public directory structure

### Step 1: Create public/assets directory structure

```bash
mkdir -p public/assets/buildings public/assets/ships public/assets/defences public/assets/research public/assets/planets public/assets/panels
```

Create a `.gitkeep` in each so the empty dirs are tracked:

```bash
for dir in buildings ships defences research planets panels; do
  touch public/assets/$dir/.gitkeep
done
```

### Step 2: Run full test suite

```bash
npm test
```
Expected: All tests pass, no regressions.

### Step 3: Commit

```bash
git add public/assets/
git add -A
git commit -m "feat(artwork): wire up complete artwork system — asset map, CSS, banners, planet visuals"
```

---

## Task 11: Write image generation prompts

Create `docs/plans/2026-03-07-artwork-prompts.md` with a complete DALL-E 3 prompt for every image. This file is the reference for the user to generate images in ChatGPT/Gemini.

**Style prefix** (prepend to every prompt):
> Old-school realistic sci-fi illustration, painted space art in the style of 1970s–80s science fiction book covers, dramatic lighting, highly detailed, no text, no logos, no watermarks

**Size instructions per category:**
- Card banners (buildings, ships, defences, research): request **1792×1024** (wide landscape)
- Page banners: request **1792×1024**
- Planet portraits: request **1024×1024**
- Planet icons: same generation as portrait, resize to 128×128 during export

**Write a prompt for each item below.** Save as `docs/plans/2026-03-07-artwork-prompts.md`.

### Buildings

| ID | Prompt Subject |
|----|---------------|
| metalMine | Massive open-pit metal mine on an alien planet, industrial drilling rigs, glowing ore veins, harsh lighting |
| crystalMine | Crystal extraction facility carved into a crystalline cliff face, blue-purple crystal formations, laser cutters |
| deuteriumSynthesizer | Deuterium processing plant beside an alien ocean, atmospheric condensers, pipes and tanks |
| solarPlant | Solar energy farm on a sun-baked planet, enormous mirrored dishes, heat haze |
| fusionReactor | Underground fusion reactor complex, plasma containment rings, intense blue-white glow |
| metalStorage | Enormous metal storage silos on a barren plain, industrial scale, conveyor systems |
| crystalStorage | Crystal warehouse with transparent walls, stacked crystal formations glowing within |
| deuteriumTank | Pressurised deuterium storage tanks, frost-covered pipes, industrial landscape |
| roboticsFactory | Factory floor with robotic assembly arms building spacecraft components, sparks and welding arcs |
| naniteFactory | Gleaming nanite production facility, ultra-clean white chambers, microscale machinery visible in glowing vats |
| shipyard | Enormous orbital shipyard in space, skeletal ship frames under construction, welding torches, stars beyond |
| researchLab | High-tech research laboratory, holographic displays, scientists at work, alien technology samples |

### Ships

| ID | Prompt Subject |
|----|---------------|
| lightFighter | Sleek single-seat space fighter, delta-wing design, engine trails, deep space background |
| heavyFighter | Heavier armoured fighter with twin cannons, scarred hull, battle-worn, asteroid field |
| cruiser | Mid-size warship cruising through space, rotating gun turrets, running lights, nebula backdrop |
| battleship | Massive battleship dwarfing smaller craft, heavy armour plating, multiple gun batteries |
| bomber | Wide-bodied space bomber with torpedo bays open, menacing silhouette, approaching a planet |
| destroyer | Long sleek destroyer at speed, energy weapons charging, star field |
| battlecruiser | Hybrid warship — fast lines but heavy guns, racing through a debris field |
| smallCargo | Boxy utilitarian cargo shuttle, loading bay open, crates being loaded by robotic arms |
| largeCargo | Large freighter with modular cargo pods, slow and massive, docking at a space station |
| colonyShip | Massive colony vessel with habitat modules, generation ship scale, slow and majestic |
| recycler | Industrial recycler ship with large scoop arrays, debris field, harvesting wrecked ships |
| espionageProbe | Tiny stealth probe, barely visible, sleek and dark, slipping past a space station |
| solarSatellite | Orbital solar satellite with large photovoltaic panels, planet below, sunlight glinting |

### Defences

| ID | Prompt Subject |
|----|---------------|
| rocketLauncher | Ground-based rocket battery on a planet surface, launch tubes angled skyward, exhaust trails |
| lightLaser | Rapid-fire laser turret on a fortified platform, red-orange energy beams, targeting system |
| heavyLaser | Heavy industrial laser cannon, massive barrel, heat vents glowing, fortified bunker |
| gaussCannon | Railgun battery, electromagnetic coils visible, projectile accelerating in a blue flash |
| ionCannon | Ion cannon array, electric-blue discharge crackling, atmospheric distortion |
| plasmaTurret | Plasma turret charging, glowing sphere of superheated matter, dramatic energy arcs |
| smallShieldDome | Translucent energy shield dome over a small base, shimmering blue, repelling a laser hit |
| largeShieldDome | Enormous planetary shield dome, covering a city-sized area, visible from orbit |

### Defences (continued)

### Research Technologies

| ID | Prompt Subject |
|----|---------------|
| energyTechnology | Energy research facility, high-voltage experiments, plasma coils, scientists observing |
| laserTechnology | Laser research lab, precision optics, ruby laser firing into a crystal array |
| ionTechnology | Ion drive research, blue ion exhaust in a vacuum chamber, engineers observing |
| plasmaTechnology | Plasma containment research, swirling plasma held in magnetic fields, observatory-style lab |
| espionageTechnology | Intelligence technology center, holographic displays of star maps, encrypted communications |
| computerTechnology | Advanced computer core, servers and processing arrays, blue data streams |
| weaponsTechnology | Weapons research range, scientists testing new beam weapons on armour samples |
| shieldingTechnology | Shield generator prototype, energy barrier forming around a test structure |
| armourTechnology | Materials lab, scientists testing new hull alloy plates with laser cutters |
| combustionDrive | Combustion drive test stand, rocket flame, engineers in heat-resistant suits |
| impulseDrive | Impulse drive prototype on a test rig, blue-white exhaust, space station hangar |
| hyperspaceTechnology | Hyperspace research station, distorted space around an experimental drive, swirling wormhole |
| hyperspaceDrive | Hyperdrive core installation, engineers working on the massive engine, ship interior |
| astrophysicsTechnology | Space observatory, enormous telescope array pointed at a nebula, researchers inside |
| intergalacticResearchNetwork | Massive deep-space communication array, multiple dishes, signal beams connecting star systems |

### Planets

| Type | Prompt |
|------|--------|
| hot | Volcanic alien planet from orbit, lava flows visible, scorched rock, thin atmosphere, dramatic shadow |
| temperate | Earth-like planet from orbit, blue oceans, green-brown continents, white cloud swirls |
| cold | Rocky grey-brown planet from orbit, thin wisps of atmosphere, cratered, desolate |
| frozen | Ice-covered planet from orbit, white and pale blue surface, frozen methane seas, distant sun |

### Page Banners

| Panel | Prompt |
|-------|--------|
| fleet | Formation of diverse warships in deep space — fighters, cruisers, battleships — dramatic lighting, nebula backdrop |
| defence | Planetary surface covered in defence installations — laser turrets, missile batteries, shield domes — at twilight |
| buildings | Colony base panorama on an alien planet — mines, factories, silos, research domes — industrial scale |
| research | Orbital research station complex, multiple modules, telescopes, labs, scientists visible through windows, planet below |
| galaxy | Deep space panorama — star field, nebulae, a spiral galaxy in the distance, sense of vast scale |

---

### Commit

```bash
git add docs/plans/2026-03-07-artwork-prompts.md
git commit -m "docs: add DALL-E image generation prompts for all artwork assets"
```

---

## Notes for Codex

- Do NOT generate any images. This plan is code-only (Tasks 1–10) + prompt document (Task 11).
- `src/data/assets.ts` is a new file — it does not exist yet.
- All panels use `<section className="panel">` as the root. Page banner goes as the **first child** of that section, before any existing content.
- Card banners go as the **first child** of `<article className="item-card">`, before `<div className="item-header">`.
- The `onError` handler hides the image if the `.webp` file doesn't exist — this is the graceful fallback. Do not remove it.
- `planet.maxTemperature` is on `PlanetState`. `slot.npc.temperature` is on `NPCColony`. Both are numbers — pass directly to `getPlanetImageUrl`.
- `public/assets/` subdirs need `.gitkeep` files so Git tracks the empty directories.
- Run `npm run build` after Task 3 to catch any TypeScript issues early.
