# StarForge UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the entire visual layer of StarForge with a high-fidelity redesign — new design tokens, typography, shared components, and all 10 gameplay panels.

**Architecture:** CSS-first approach — lay the design token foundation, then rewrite shared components against the new tokens, then rewrite panels one at a time. Each task produces a visually verifiable result. No engine/logic changes — this is purely a UI layer rewrite.

**Tech Stack:** React 19, TypeScript (strict), Vite, CSS custom properties, Google Fonts (Orbitron, Space Grotesk, JetBrains Mono)

**Design Reference:** `handoff/design_handoff/README.md` (full spec), `handoff/design_handoff/StarForge Redesign.html` (interactive prototype), `handoff/design_handoff/sf-*.jsx` (component mockups)

---

## Scope & Sequencing

The redesign has **no engine or data model changes**. All existing GameContext actions, hooks, and models remain untouched. We are rewriting:
- `src/styles.css` (design tokens + all class rules)
- `index.html` (font imports)
- 8 shared components in `src/components/`
- 10 panel components in `src/panels/` (AdminPanel excluded — keep current styling)
- 3 new shared components: `PanelBanner.tsx`, `CardImage.tsx`, `LevelRing.tsx`

**Sequencing rationale:** CSS tokens first (everything depends on them), then shared atoms (panels depend on them), then panels in dependency order (Buildings before Shipyard/Defence since they share the card pattern).

---

## Task 1: Design Tokens, Typography & Body Background

**Files:**
- Modify: `index.html`
- Modify: `src/styles.css:1-50`

This task replaces the CSS foundation. Everything that follows builds on these tokens.

- [x] **Step 1: Add Google Fonts to index.html**

In `index.html`, add inside `<head>` before `<title>`:

```html
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700&family=Space+Grotesk:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

- [x] **Step 2: Replace :root CSS custom properties**

Replace the entire `:root { ... }` block in `src/styles.css` with:

```css
:root {
  /* Backgrounds */
  --bg-void:        #050810;
  --bg-panel:       rgba(8,12,28,0.85);
  --bg-panel-dark:  rgba(5,8,20,0.97);
  --bg-hover:       rgba(255,255,255,0.03);

  /* Borders */
  --border:         rgba(40,60,120,0.3);
  --border-hover:   rgba(77,143,255,0.45);

  /* Resources */
  --metal:          #9ca3af;
  --crystal:        #60a5fa;
  --deuterium:      #34d399;
  --energy:         #fbbf24;

  /* Accents */
  --accent:         #4d8fff;
  --accent-blue:    #4d8fff;
  --accent-teal:    #30d5c8;
  --accent-amber:   #f0a832;
  --accent-purple:  #818cf8;
  --accent-violet:  #a78bfa;

  /* Semantic */
  --danger:         #f87171;
  --success:        #34d399;
  --text:           #c8e0ff;
  --text-dim:       rgba(150,180,220,0.55);
  --text-muted:     rgba(120,150,200,0.4);

  /* Font stacks — use these everywhere instead of raw font-family */
  --font-display:   'Orbitron', sans-serif;
  --font-body:      'Space Grotesk', 'Segoe UI', sans-serif;
  --font-mono:      'JetBrains Mono', 'Consolas', 'Courier New', monospace;

  /* Shared layout tokens */
  --card-radius:    10px;
  --panel-radius:   12px;
  --btn-radius:     6px;
  --card-padding:   0.85rem 1rem;
  --grid-gap:       0.75rem;
  --card-shadow:    0 2px 12px rgba(0,0,0,0.4);
  --card-shadow-hover: 0 0 24px rgba(77,143,255,0.12);
}
```

Note: `--bg-dark` is renamed to `--bg-void`. `--bg-panel-hover` is replaced by `--bg-hover`. `--text-dim` changes from hex to rgba. Several new accent colours are added. Font stacks are defined as custom properties to ensure consistency across all components.

- [x] **Step 3: Replace body font-family and background**

Replace the `body { ... }` rule block (currently setting margin, color, font-family, background) with:

```css
body {
  margin: 0;
  color: var(--text);
  font-family: var(--font-body);
  background: #050810;
}

body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 60% 50% at 15% 20%, rgba(60,40,120,0.18) 0%, transparent 70%),
    radial-gradient(ellipse 50% 40% at 85% 75%, rgba(20,60,120,0.15) 0%, transparent 70%);
}
```

- [x] **Step 4: Replace .number utility class**

Replace the `.number` rule block with:

```css
.number {
  font-family: var(--font-mono);
}
```

And add global animation keyframes used by multiple panels:

```css
@keyframes alertPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

- [x] **Step 5: Update all remaining references to old variable names**

Search `src/styles.css` for `--bg-dark` and replace with `--bg-void`. Search for `--bg-panel-hover` and replace with `--bg-hover`. Search for `--text-dim` usage and verify it still works with the new rgba value (it should — it's only used for `color` properties).

Also do a project-wide search in `.tsx` files for inline references to old variables (there shouldn't be many since most styling is in CSS classes).

- [x] **Step 6: Verify the app still loads**

Run: `npm run dev`

Open in browser. The app should load with the new background gradient, new font (Space Grotesk for body text), and new colour scheme. Some elements will look wrong because panel classes haven't been updated yet — that's expected.

- [x] **Step 7: Commit**

```bash
git add index.html src/styles.css
git commit -m "feat(ui): replace design tokens, typography, and body background

New palette: Orbitron/Space Grotesk/JetBrains Mono typography system,
dark void background with subtle gradient nebulae, updated CSS custom
properties for the full redesign."
```

---

## Task 2: New Shared Components — PanelBanner & CardImage

**Files:**
- Create: `src/components/PanelBanner.tsx`
- Create: `src/components/CardImage.tsx`
- Create: `src/components/LevelRing.tsx`
- Modify: `src/styles.css` (add new classes)

These are new atoms used by multiple panels.

- [x] **Step 1: Create PanelBanner component**

Create `src/components/PanelBanner.tsx`:

```tsx
import { PANEL_IMAGES } from '../data/assets.ts';
import type { PanelImageId } from '../data/assets.ts';

interface PanelBannerProps {
  panel: PanelImageId;
  title: string;
  subtitle: string;
}

export function PanelBanner({ panel, title, subtitle }: PanelBannerProps) {
  const src = PANEL_IMAGES[panel];
  return (
    <div className="panel-banner">
      {src && (
        <img
          src={src}
          alt=""
          className="panel-banner__img"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div className="panel-banner__gradient" />
      <div className="panel-banner__vignette" />
      <div className="panel-banner__content">
        <h1 className="panel-banner__title">{title}</h1>
        <p className="panel-banner__subtitle">{subtitle}</p>
      </div>
    </div>
  );
}
```

- [x] **Step 2: Add PanelBanner CSS**

Add to `src/styles.css`:

```css
/* ── Panel Banner ──────────────────────────────────────────── */
.panel-banner {
  position: relative;
  height: 220px;
  border-radius: 12px;
  overflow: hidden;
  background: #050810;
  flex-shrink: 0;
}
.panel-banner__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 35%;
}
.panel-banner__gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(5,8,20,0.3) 0%,
    rgba(5,8,20,0.2) 40%,
    rgba(5,8,20,0.85) 80%,
    rgba(5,8,20,0.97) 100%
  );
}
.panel-banner__vignette {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to right,
    rgba(5,8,20,0.6) 0%,
    transparent 40%,
    transparent 60%,
    rgba(5,8,20,0.4) 100%
  );
}
.panel-banner__content {
  position: absolute;
  inset: 0;
  padding: 1.2rem 1.5rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.panel-banner__title {
  margin: 0 0 0.25rem;
  font-family: var(--font-display);
  font-size: 1.6rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.07em;
  text-shadow: 0 2px 20px rgba(0,0,0,1), 0 0 40px rgba(0,0,0,0.8);
}
.panel-banner__subtitle {
  margin: 0;
  color: rgba(200,215,240,0.75);
  font-size: 0.83rem;
  text-shadow: 0 1px 8px rgba(0,0,0,1);
}
```

- [x] **Step 3: Create CardImage component**

Create `src/components/CardImage.tsx`:

```tsx
import { useState } from 'react';

interface CardImageProps {
  src: string;
  label: string;
  height?: number;
}

export function CardImage({ src, label, height = 110 }: CardImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div className="card-image" style={{ height }}>
      {!errored && (
        <img
          src={src}
          alt=""
          className="card-image__img"
          style={{ opacity: loaded ? 1 : 0 }}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
      )}
      {(errored || !loaded) && (
        <div className="card-image__placeholder">
          <span className="card-image__label">{label}</span>
        </div>
      )}
    </div>
  );
}
```

- [x] **Step 4: Add CardImage CSS**

```css
/* ── Card Image ────────────────────────────────────────────── */
.card-image {
  position: relative;
  overflow: hidden;
  border-radius: 9px 9px 0 0;
  background: rgba(8,12,30,0.6);
}
.card-image__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  transition: opacity 300ms;
}
.card-image__placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: repeating-linear-gradient(
    135deg,
    rgba(255,255,255,0.02) 0px,
    rgba(255,255,255,0.02) 1px,
    transparent 1px,
    transparent 12px
  );
}
.card-image__label {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: rgba(255,255,255,0.15);
  letter-spacing: 0.08em;
  text-align: center;
  padding: 0 1rem;
}
```

- [x] **Step 5: Create LevelRing component**

Create `src/components/LevelRing.tsx`:

```tsx
interface LevelRingProps {
  level: number;
  maxLevel?: number;
  size?: number;
  color?: string;
}

export function LevelRing({ level, maxLevel = 20, size = 36, color = '#4d8fff' }: LevelRingProps) {
  const r = 14;
  const circumference = 2 * Math.PI * r;
  const fillPct = Math.min(1, level / maxLevel);

  return (
    <div className="level-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="18" cy="18" r={r} fill="none" stroke={`${color}26`} strokeWidth="2.5" />
        {level > 0 && (
          <circle
            cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="2.5"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - fillPct)}
            strokeLinecap="round"
          />
        )}
      </svg>
      <span className="level-ring__value">{level}</span>
    </div>
  );
}
```

- [x] **Step 6: Add LevelRing CSS**

```css
/* ── Level Ring ────────────────────────────────────────────── */
.level-ring {
  position: relative;
  flex-shrink: 0;
}
.level-ring__value {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: #c8e0ff;
  font-weight: 600;
}
```

- [x] **Step 7: Verify components render in isolation**

Temporarily import and render `<PanelBanner panel="buildings" title="Test" subtitle="Test sub" />` in any panel to confirm the banner image, gradients, and text render correctly.

- [x] **Step 8: Commit**

```bash
git add src/components/PanelBanner.tsx src/components/CardImage.tsx src/components/LevelRing.tsx src/styles.css
git commit -m "feat(ui): add PanelBanner, CardImage, LevelRing shared components"
```

---

## Task 3: Redesign CostDisplay

**Files:**
- Modify: `src/components/CostDisplay.tsx`
- Modify: `src/styles.css` (update `.cost-display`, `.cost-item`)

- [x] **Step 1: Update CostDisplay component**

Replace `src/components/CostDisplay.tsx` entirely:

```tsx
import type { ResourcesState } from '../models/Planet.ts';
import type { ResourceCost } from '../models/types.ts';
import { formatCompact } from '../utils/format.ts';

interface CostDisplayProps {
  cost: ResourceCost;
  available: ResourcesState;
}

export function CostDisplay({ cost, available }: CostDisplayProps) {
  const entries: Array<{ key: string; label: string; value: number; affordable: boolean }> = [];
  if (cost.metal > 0) entries.push({ key: 'metal', label: 'M', value: cost.metal, affordable: available.metal >= cost.metal });
  if (cost.crystal > 0) entries.push({ key: 'crystal', label: 'C', value: cost.crystal, affordable: available.crystal >= cost.crystal });
  if (cost.deuterium > 0) entries.push({ key: 'deuterium', label: 'D', value: cost.deuterium, affordable: available.deuterium >= cost.deuterium });

  return (
    <div className="cost-display">
      {entries.map((e) => (
        <span key={e.key} className={`cost-pill cost-pill--${e.key} ${e.affordable ? '' : 'cost-pill--insufficient'}`}>
          {e.label} {formatCompact(e.value)}
        </span>
      ))}
    </div>
  );
}
```

Note: Uses `formatCompact` (not `formatNumber`) to produce abbreviated output like `M 1.2M`, `C 308K`, `D 0` as required by the design spec.
```

- [x] **Step 2: Update CSS for cost pills**

Replace existing `.cost-display` and `.cost-item` rules with:

```css
/* ── Cost Pills ────────────────────────────────────────────── */
.cost-display {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
}
.cost-pill {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  background: rgba(10,14,30,0.8);
  border: 1px solid rgba(60,80,140,0.4);
}
.cost-pill--metal     { color: var(--metal); }
.cost-pill--crystal   { color: var(--crystal); }
.cost-pill--deuterium { color: var(--deuterium); }
.cost-pill--insufficient {
  background: rgba(239,68,68,0.08);
  border-color: rgba(239,68,68,0.35);
  color: #ff8888 !important;
}
```

- [x] **Step 3: Verify**

Run `npm run dev`, navigate to Buildings panel. Cost pills should show abbreviated values with resource-coloured text, red background when unaffordable.

- [x] **Step 4: Commit**

```bash
git add src/components/CostDisplay.tsx src/styles.css
git commit -m "feat(ui): redesign CostDisplay with coloured cost pills"
```

---

## Task 4: Redesign NavSidebar

**Files:**
- Modify: `src/components/NavSidebar.tsx`
- Modify: `src/styles.css` (`.nav-sidebar`, `.nav-button`, etc.)

- [x] **Step 1: Update NavSidebar component**

Add planet coords display below "STARFORGE" header. The component already receives data through the parent — we need to pass planet coords from GameContext. For now, add the coords display with a static format (the parent already passes `activePanel` and `onNavigate`).

Update the component to accept `planetName` and `coords` props (optional, with defaults):

```tsx
import { useGame } from '../context/GameContext.tsx';
import type { ActivePanel } from '../models/types.ts';

interface NavSidebarProps {
  activePanel: ActivePanel;
  onNavigate: (panel: ActivePanel) => void;
  unreadMessageCount: number;
}

// ... keep existing MAIN_NAV_ITEMS and ADMIN_NAV_ITEM ...

export function NavSidebar({ activePanel, onNavigate, unreadMessageCount }: NavSidebarProps) {
  const { gameState } = useGame();
  const planet = gameState.planets[gameState.activePlanetIndex];
  const coords = planet?.coordinates;

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
          className={`nav-button nav-button-admin ${activePanel === ADMIN_NAV_ITEM.id ? 'active' : ''}`}
          onClick={() => onNavigate(ADMIN_NAV_ITEM.id)}
        >
          {ADMIN_NAV_ITEM.label}
        </button>
      </nav>
    </aside>
  );
}
```

- [x] **Step 2: Update NavSidebar CSS**

Replace existing `.nav-sidebar`, `.sidebar-title`, `.nav-list`, `.nav-button`, `.nav-badge`, `.nav-divider` rules with the redesigned versions. Key changes:
- Background: `rgba(5,8,20,0.9)` with `backdrop-filter: blur(12px)`
- Title: Orbitron 1rem weight 700 `#c8d6ff`
- New `.sidebar-coords`: JetBrains Mono 0.7rem muted
- Active item: `border-left: 2px solid #4d8fff`, gradient background
- Inactive hover: `rgba(77,143,255,0.07)`
- Active glow: `box-shadow: inset 0 0 20px rgba(77,143,255,0.08)`

```css
/* ── Nav Sidebar ───────────────────────────────────────────── */
.nav-sidebar {
  grid-area: nav;
  width: 200px;
  border-right: 1px solid var(--border);
  background: rgba(5,8,20,0.9);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1rem 0.6rem;
  overflow-y: auto;
}
.sidebar-header {
  padding: 0.5rem 0.5rem 1rem;
  margin-bottom: 0.25rem;
  border-bottom: 1px solid rgba(40,60,120,0.25);
}
.sidebar-title {
  font-family: var(--font-display);
  font-size: 1rem;
  letter-spacing: 0.12em;
  color: #c8d6ff;
  font-weight: 700;
}
.sidebar-coords {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: rgba(150,180,220,0.5);
  margin-top: 0.2rem;
}
.nav-list {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.nav-button {
  background: transparent;
  border: none;
  border-left: 2px solid transparent;
  border-radius: 0 6px 6px 0;
  color: rgba(150,180,220,0.65);
  padding: 0.55rem 0.75rem;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 0.88rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 150ms ease;
  text-align: left;
}
.nav-button:hover {
  background: rgba(77,143,255,0.07);
}
.nav-button.active {
  border-left-color: #4d8fff;
  background: linear-gradient(90deg, rgba(77,143,255,0.18), rgba(77,143,255,0.06));
  color: #c8e0ff;
  box-shadow: inset 0 0 20px rgba(77,143,255,0.08);
}
.nav-badge {
  background: rgba(239,68,68,0.2);
  border: 1px solid rgba(239,68,68,0.5);
  border-radius: 999px;
  font-size: 0.68rem;
  padding: 0.1rem 0.4rem;
  color: #ffd6d6;
}
.nav-divider {
  border: none;
  border-top: 1px solid rgba(40,60,120,0.25);
  margin: 0.5rem 0;
}
```

- [x] **Step 3: Verify**

Run `npm run dev`. NavSidebar should show "STARFORGE" in Orbitron font, planet coords below, blue left-border on active item, gradient background on active, subtle hover on inactive.

- [x] **Step 4: Commit**

```bash
git add src/components/NavSidebar.tsx src/styles.css
git commit -m "feat(ui): redesign NavSidebar with Orbitron title, coords, blue active indicator"
```

---

## Task 5: Redesign ResourceBar + PlanetSwitcher

**Files:**
- Modify: `src/components/ResourceBar.tsx`
- Modify: `src/components/PlanetSwitcher.tsx`
- Modify: `src/styles.css`

This is a large component rewrite. The ResourceBar gets a PlanetSwitcher as first element, tighter resource pills with glowing dots, and a field usage counter right-aligned.

- [x] **Step 1: Rewrite PlanetSwitcher**

Read the current `src/components/PlanetSwitcher.tsx` first to understand its current interface. Then rewrite it to match the design spec — planet icon, name in Orbitron, coords in JetBrains Mono, dropdown with all planets. Reference `handoff/design_handoff/sf-shared.jsx` lines 180-243 for the exact design.

Key visual elements:
- Button: planet icon 22x22 circle, planet name Orbitron 0.75rem, coords JetBrains Mono 0.62rem
- Dropdown: `rgba(5,8,20,0.98)`, `backdrop-filter: blur(16px)`, border-radius 10px
- Each row: 28x28 planet icon, name + coords + field usage, active planet gets blue highlight + bullet

- [x] **Step 2: Rewrite ResourceBar styling**

Update the ResourceBar to use the new design tokens. Key changes:
- Resource pills: tighter padding (0.3rem 0.65rem), 7x7 glowing dot, label 0.7rem uppercase, value JetBrains Mono 0.85rem, rate JetBrains Mono 0.72rem muted
- Add 1px divider between PlanetSwitcher and resource pills
- Field usage counter right-aligned: `{used}/{max} fields`
- Bar background: `rgba(5,8,20,0.97)`, `backdrop-filter: blur(12px)`

Reference `handoff/design_handoff/sf-shared.jsx` lines 245-273 for exact layout.

- [x] **Step 3: Update CSS for resource bar and resource pills**

Replace existing `.resource-bar`, `.resource-entry`, `.resource-dot`, `.resource-label`, `.resource-value`, `.resource-rate` classes.

- [x] **Step 4: Verify**

ResourceBar should show PlanetSwitcher → divider → 4 resource pills → field counter. PlanetSwitcher dropdown should open on click, show all planets, highlight active one.

- [x] **Step 5: Commit**

```bash
git add src/components/ResourceBar.tsx src/components/PlanetSwitcher.tsx src/styles.css
git commit -m "feat(ui): redesign ResourceBar with PlanetSwitcher, glowing dots, field counter"
```

---

## Task 6: Redesign FleetMovementsBar

**Files:**
- Modify: `src/components/FleetMovementsBar.tsx`
- Modify: `src/styles.css`

- [x] **Step 1: Rewrite FleetMovementsBar**

Complete visual rewrite. Key changes from current:
- Collapsible header with "Fleet Movements" label + count badge
- Collapse state persisted in localStorage
- CSS grid rows: `90px 1fr auto auto auto`
- Mission type pills with colour-coded backgrounds (see MOVEMENT_COLORS in `sf-shared.jsx:277-284`)
- Route shows home planet always LEFT, arrow direction flips for returning
- 2px progress bar under route text
- Status label coloured by state (outbound blue, returning green, at_target amber)

Reference `handoff/design_handoff/sf-shared.jsx` lines 276-374 for exact implementation.

- [x] **Step 2: Update CSS**

Replace all `.fleet-movements-bar`, `.movement-*` rules. The bar is `position: fixed; bottom: 0; z-index: 200`.

- [x] **Step 3: Verify**

Start a fleet mission (or use admin panel). FleetMovementsBar should show at bottom with collapsible header, coloured mission type pills, progress bars, and correct arrow directions.

- [x] **Step 4: Commit**

```bash
git add src/components/FleetMovementsBar.tsx src/styles.css
git commit -m "feat(ui): redesign FleetMovementsBar with collapsible header, progress bars, mission type pills"
```

---

## Task 7: Redesign BuildingsPanel

**Files:**
- Modify: `src/panels/BuildingsPanel.tsx`
- Modify: `src/styles.css`

- [x] **Step 1: Add PanelBanner to BuildingsPanel**

Import and add `<PanelBanner panel="buildings" title="Buildings" subtitle="Construct and upgrade structures that power your economy." />` at the top of the panel.

- [x] **Step 2: Rewrite building cards**

Each building card gets:
- `CardImage` at top (110px, uses `BUILDING_IMAGES[id]` with fallback)
- `LevelRing` SVG ring replacing plain "Lv X" text
- Name in Orbitron 0.88rem
- Description in 0.78rem muted
- CostDisplay pills + build time
- Upgrade button with blue gradient (or disabled grey when unaffordable)

Reference `handoff/design_handoff/sf-panels-a.jsx` lines 80-125 for BuildingCard.

- [x] **Step 3: Add category section headers**

Category headers: icon + Orbitron label + horizontal rule. Resource Buildings (⬡), Facilities (◈), Storage (▣).

Reference `sf-panels-a.jsx` lines 145-160.

- [x] **Step 4: Update CSS for item cards**

Replace existing `.item-card`, `.item-header`, `.item-level`, etc. with new card styling:
- Border: `1px solid rgba(40,60,120,0.35)` → hover `rgba(77,143,255,0.45)`
- Background: `rgba(8,12,28,0.85)`, `backdrop-filter: blur(12px)`, `border-radius: var(--card-radius)`
- Default shadow: `var(--card-shadow)`, hover shadow: `var(--card-shadow-hover)`
- Construction queue card: blue-accented border `rgba(77,143,255,0.3)`, background `rgba(77,143,255,0.06)`
- Upgrade button: blue gradient `linear-gradient(135deg, rgba(77,143,255,0.3), rgba(30,80,200,0.55))`, border `rgba(77,143,255,0.6)`. Disabled: `rgba(40,40,60,0.4)` bg, `rgba(80,80,120,0.3)` border, muted text
- Quantity input: `rgba(8,12,30,0.9)` bg, `rgba(40,60,120,0.4)` border, JetBrains Mono font

- [x] **Step 5: Verify**

Buildings panel should show banner image → construction queue → category sections with cards showing image placeholder, level ring, costs, and hover effects.

- [x] **Step 6: Commit**

```bash
git add src/panels/BuildingsPanel.tsx src/styles.css
git commit -m "feat(ui): redesign BuildingsPanel with banner, card images, level rings, category headers"
```

---

## Task 8: Redesign ResearchPanel

**Files:**
- Modify: `src/panels/ResearchPanel.tsx`
- Modify: `src/styles.css`

- [x] **Step 1: Add PanelBanner**

`<PanelBanner panel="research" title="Research" subtitle="Advance your civilization through scientific breakthroughs." />`

- [x] **Step 2: Rewrite research cards**

Research cards differ from building cards:
- No CardImage — uses LevelRing (smaller, 32px) with category colour
- Category colour on hover border
- Prerequisite tags shown as small pills
- Special note for Graviton Technology
- Research button coloured per category

Category colours: Propulsion `#30d5c8`, Energy & Weapons `#f87171`, Military `#f0a832`, Intel `#818cf8`.

Reference `handoff/design_handoff/sf-panels-b.jsx` lines 537-668 for ResearchPanel and ResearchCard.

- [x] **Step 3: Add category section headers**

Same pattern as Buildings but with category-coloured icons and labels.

- [x] **Step 4: Add active research indicator**

Purple-accented card at top showing currently researching tech with pulsing dot.

- [x] **Step 5: Verify and commit**

```bash
git add src/panels/ResearchPanel.tsx src/styles.css
git commit -m "feat(ui): redesign ResearchPanel with category colours, level rings, prerequisite tags"
```

---

## Task 9: Redesign ShipyardPanel

**Files:**
- Modify: `src/panels/ShipyardPanel.tsx`
- Modify: `src/styles.css`

- [x] **Step 1: Add PanelBanner**

`<PanelBanner panel="shipyard" title="Shipyard" subtitle="Construct vessels for combat, colonisation, and logistics." />`

- [x] **Step 2: Rewrite ship cards**

Ship cards add a **stat strip** between description and cost:
- 5 chips: ATK (red) · SHD (blue) · HULL (white) · CARGO (green) · SPD (amber)
- Each: value in JetBrains Mono 0.8rem + label 0.62rem muted uppercase
- Bordered top and bottom

Also: owned count badge (`×{count}`) top-right in JetBrains Mono blue.

Reference `handoff/design_handoff/sf-panels-a.jsx` lines 165-234.

Card-specific details:
- CardImage height: `100px` (not 110px like buildings)
- Quantity input: width 64px, JetBrains Mono, same styling as buildings input
- Build button: blue gradient, shows `Build {qty}` text
- Cost pills + `/unit` time label right-aligned in the same row

- [x] **Step 3: Verify and commit**

```bash
git add src/panels/ShipyardPanel.tsx src/styles.css
git commit -m "feat(ui): redesign ShipyardPanel with stat strips, owned count badges, card images"
```

---

## Task 10: Redesign DefencePanel

**Files:**
- Modify: `src/panels/DefencePanel.tsx`
- Modify: `src/styles.css`

- [x] **Step 1: Add PanelBanner**

`<PanelBanner panel="defence" title="Defence" subtitle="Fortify your world against enemy incursions." />`

- [x] **Step 2: Add summary bar**

3 stat cards at top: Total Firepower (red), Shield Rating (blue), Defence Units (white).

- [x] **Step 3: Rewrite defence cards**

Same as ship cards but with **amber accent** on hover:
- `border-color: rgba(240,168,50,0.4)`, `box-shadow: 0 0 20px rgba(240,168,50,0.08)`
- Build button: amber gradient
- Stat strip: ATK · SHD · HULL only (no CARGO/SPD)

Reference `handoff/design_handoff/sf-panels-a.jsx` lines 237-308.

Card-specific details:
- CardImage height: `90px` (shorter than buildings/shipyard)
- Amber build button: `linear-gradient(135deg, rgba(240,168,50,0.25), rgba(180,100,0,0.4))`, border `rgba(240,168,50,0.45)`, text `#f0c060`
- Quantity input: same styling as shipyard (64px, JetBrains Mono)
- Stat strip shows only ATK · SHD · HULL (no CARGO/SPD)

- [x] **Step 4: Verify and commit**

```bash
git add src/panels/DefencePanel.tsx src/styles.css
git commit -m "feat(ui): redesign DefencePanel with amber accents, summary bar, stat strips"
```

---

## Task 11: Redesign OverviewPanel

**Files:**
- Modify: `src/panels/OverviewPanel.tsx`
- Modify: `src/styles.css`

This is the most complex panel rewrite. Multiple new sections.

- [x] **Step 1: Planet Hero section**

200px hero with planet image right-aligned, left-to-right gradient reveal, planet name + coords + temperature, field usage ring (72x72 SVG donut).

Reference `handoff/design_handoff/sf-overview.jsx` lines 197-225.

- [x] **Step 2: Incoming Threats section**

Red pulsing dot + alert cards. Only shown when incoming enemy attacks exist. Uses CSS animation `alertPulse`.

- [x] **Step 3: Resource Production section**

Full-width card with production bars. Grid: `80px label | 1fr bar | 72px amount | 70px rate`. Bar: 6px height with near-cap glow (amber gradient when >88%).

Reference `sf-overview.jsx` lines 238-263.

- [x] **Step 4: Stat Cards grid**

6-card responsive grid: Fleet Ships, Fleet Power, Defence Power, Metal Mine Lv, Crystal Mine Lv, Shipyard Lv. Value in JetBrains Mono 1.4rem.

- [x] **Step 5: Active Missions Summary**

Compact list with type badge + route + mini progress bar + ETA. On hover, show a **cursor-following tooltip** (via `CursorTooltip` portal — NOT `HoverPortal`) displaying: mission type header, full route, status, ETA, ship manifest, and cargo. Track mouse position via `onMouseMove`, clamp tooltip to viewport bounds.

State: `hoveredMission` (mission ID or null) + `missionHoverPos` ({ x, y }).

Reference `sf-overview.jsx` lines 276-362.

- [x] **Step 6: Recent Activity Feed**

Clickable-to-expand list of recent combat/espionage/fleet events.

**Interaction details (from prototype):**
- **Single-expanded-item behaviour:** only one entry expanded at a time. Clicking an expanded entry collapses it. State: `expandedActivity` (index or null).
- Header row: type badge (VICTORY/DEFEAT/ESP/HARVEST) + text + loot amount + time ago + unread dot + expand chevron
- Expanded: attacker/defender loss grid (blue left / red right), plundered resources card, debris field card
- **"View in Messages" button** in expanded footer — navigates to Messages panel
- Unread entries show coloured left border accent

Reference `sf-overview.jsx` lines 52-139 for ActivityEntry component.

- [x] **Step 7: Verify and commit**

```bash
git add src/panels/OverviewPanel.tsx src/styles.css
git commit -m "feat(ui): redesign OverviewPanel with planet hero, production bars, stat cards, activity feed"
```

---

## Task 12: Redesign GalaxyPanel

**Files:**
- Modify: `src/panels/GalaxyPanel.tsx`
- Modify: `src/styles.css`

- [x] **Step 1: Add PanelBanner**

`<PanelBanner panel="galaxy" title="Galaxy" subtitle="Navigate systems, locate targets, colonize worlds, harvest debris fields." />`

- [x] **Step 2: System Minimap Strip**

Horizontal strip: sun circle → 1px orbit line → 15 slot buttons (planet icons with strength-coloured borders). Selected slot gets outline. Debris indicator: 6x6 teal dot.

Reference `handoff/design_handoff/sf-panels-b.jsx` lines 54-82.

- [x] **Step 2b: System navigator + legend row**

Above the minimap: prev/next system buttons, Galaxy label + number badge, System editable input, `/500` label. Right-aligned: colour legend dots (You, Weak, Moderate, Strong, Dangerous, Debris).

Reference `sf-panels-b.jsx` lines 304-331.

- [x] **Step 3: Slot Table**

CSS grid rows: `2.5rem | 2rem | 1fr | 90px | 150px`. Per row: slot number, planet dot, name + status badges + mission indicators, strength pill, action buttons.

**Row state matrix (from spec):**
- Default: `background: transparent`
- Hover: `background: rgba(255,255,255,0.03)`
- Selected (player): `background: rgba(77,143,255,0.1)`
- Selected (NPC): `background: {strengthConfig.bg}` (strength colour at 8% opacity)

**Mission indicators** on name cell: small coloured chips `↗ attack`, `↩ harvest`, `↗ espionage` etc., shown inline when that slot has active missions. Intel indicator `◈ intel` when espionage data exists but no active mission.

Reference `sf-panels-b.jsx` lines 84-185.

- [x] **Step 4: Hover tooltip via cursor-following portal**

Espionage intel + active missions. Use `CursorTooltip` portal (NOT `HoverPortal`) — track mouse via `onMouseMove`, position with `position: fixed`, clamp to viewport. Content: planet name + strength, active missions list, espionage report (resources, fleet, defences), "No intelligence" fallback.

Reference `sf-panels-b.jsx` lines 225-302.

- [x] **Step 5: Selected slot detail strip**

Below table, shows expanded info for selected slot.

- [x] **Step 6: Verify and commit**

```bash
git add src/panels/GalaxyPanel.tsx src/styles.css
git commit -m "feat(ui): redesign GalaxyPanel with minimap strip, slot table, hover tooltips"
```

---

## Task 13: Redesign FleetPanel

**Files:**
- Modify: `src/panels/FleetPanel.tsx`
- Modify: `src/styles.css`

- [x] **Step 1: Add PanelBanner**

`<PanelBanner panel="fleet" title="Fleet" subtitle="Dispatch missions, track movements, manage your war fleet." />`

- [x] **Step 2: Active Missions section**

Each mission as a card with: type pill + target + coords + status badge + ETA, 4px progress bar, ship manifest chips OR cargo summary, recall button.

Mission colours: attack red, harvest teal, espionage purple, transport green, colonise violet.

Reference `handoff/design_handoff/sf-panels-b.jsx` lines 392-448.

- [x] **Step 3: Dispatch Form**

Mission type selector (row of coloured toggle buttons), coordinate inputs (3 number inputs), ship selection grid, footer with Speed/Travel/Fuel stats + Dispatch button.

Reference `sf-panels-b.jsx` lines 450-534.

- [x] **Step 4: Verify and commit**

```bash
git add src/panels/FleetPanel.tsx src/styles.css
git commit -m "feat(ui): redesign FleetPanel with mission cards, dispatch form, coloured mission types"
```

---

## Task 14: Redesign MessagesPanel

**Files:**
- Modify: `src/panels/MessagesPanel.tsx`
- Modify: `src/styles.css`

- [x] **Step 1: Panel shell + state management**

State variables needed:
- `tab`: `'combat' | 'espionage' | 'fleet'` (default `'combat'`)
- `expanded`: message ID or null (single-open expansion — clicking another message closes the previous)

Unread count computed per tab from message arrays. "Mark All Read" button in tab bar header.

Empty state: centered muted text "No messages in this inbox." when current tab has zero messages.

- [x] **Step 2: Tab bar redesign**

Tabs on border-bottom baseline. Active tab has visible border with bottom matching panel background (classic tab look). Unread count badges use tab accent colours (combat `#f87171`, espionage `#818cf8`, fleet `#34d399`).

Reference `handoff/design_handoff/sf-panels-c.jsx` lines 244-288.

- [x] **Step 3: Combat report cards**

**Unread chrome:** unread cards use coloured border + tinted background. Read cards use muted border + neutral background. `NEW` badge (accent-coloured pill) on unread entries. Unread dot (6px circle) on header row.

Header: outcome icon circle (36x36, ✓/✗/~) + Victory/Defeat/Draw label (coloured) + target name + coords badge + NEW badge + time ago + expand chevron.
Expanded: 2-column Attacker vs Defender grid (blue left / red right), plundered resources card (green), debris field card (teal), "Send Recyclers" + "Delete" buttons.

Reference `sf-panels-c.jsx` lines 3-133.

- [x] **Step 4: Espionage report cards**

Header: ESP badge (36x36 circle) + target + coords + DETECTED badge (red, if applicable) + NEW badge + time. Expanded: grid of Resources/Fleet/Defences coloured cards. Detected state: "Probes destroyed — intelligence gathering failed."

Reference `sf-panels-c.jsx` lines 135-219.

- [x] **Step 5: Fleet notification cards**

Compact non-expandable. FLT badge (36x36 circle, green) + mission type text + resource summary + time + Delete button.

Reference `sf-panels-c.jsx` lines 221-242.

- [x] **Step 6: Verify and commit**

```bash
git add src/panels/MessagesPanel.tsx src/styles.css
git commit -m "feat(ui): redesign MessagesPanel with tab bar, combat/espionage/fleet card designs"
```

---

## Task 15: Redesign StatisticsPanel

**Files:**
- Modify: `src/panels/StatisticsPanel.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Score Breakdown**

4-row grid: Economy/Research/Military/Fleet. Each: label + proportional bar + value + % of total.

- [ ] **Step 2: Battle Stats**

6 stat cards: Raids Won, Raids Lost, Debris Harvested, Colonies, Win Rate, Ships Built.

- [ ] **Step 3: Production Trend**

7-bar SVG sparkline per resource. Current rate + % change vs 7 days ago.

Reference `handoff/design_handoff/sf-panels-d.jsx` lines 49-64 for MiniSparkline.

- [ ] **Step 4: Rankings Table**

CSS grid: `2rem | 1fr | 90px | 90px | 90px | 90px | 100px`.

**Sortable columns:** Economy, Research, Military, Fleet, Total only (NOT rank or name). Active sort column header shows `▼` indicator and blue text. "Click column to sort" hint text right-aligned above table.

**Row details:**
- Top 3 ranks: gold ①, silver ②, bronze ③ circled numerals
- Player row: `background: rgba(77,143,255,0.08)`, name in blue with "You" badge
- Total column: mini score bar (proportional fill) + value
- Hover: `rgba(255,255,255,0.025)` background on non-player rows

Reference `sf-panels-d.jsx` lines 66-130.

- [ ] **Step 5: Verify and commit**

```bash
git add src/panels/StatisticsPanel.tsx src/styles.css
git commit -m "feat(ui): redesign StatisticsPanel with score breakdown, sparklines, sortable rankings"
```

---

## Task 16: Redesign SettingsPanel

**Files:**
- Modify: `src/panels/SettingsPanel.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Create Toggle component**

Create inline or extract a `Toggle` component: 40x22px pill, 16x16 thumb, transitions left 2px → 18px in 200ms. Active: coloured background + white thumb with glow. Inactive: muted.

Reference `handoff/design_handoff/sf-panels-d.jsx` lines 224-239.

- [ ] **Step 2: Rewrite settings sections**

5 card groups, each in a `SettingsGroup` wrapper (Orbitron 0.65rem uppercase title). Each row uses `SettingsRow` layout (label + sub-label left, control right).

**Exact section contents:**
1. **Game:** Game Speed slider (range 1-8, `accentColor: #4d8fff`) + Max Espionage Probes slider (range 1-100, `accentColor: #818cf8`) + God Mode toggle (amber `#f0a832`)
2. **Notifications:** Master toggle (blue) + Combat Alerts toggle (red `#f87171`) + Fleet Alerts toggle (green `#34d399`) + Espionage Reports toggle (purple `#818cf8`)
3. **Display:** Compact Mode toggle + Show Coordinates toggle + Highlight Debris Fields toggle (teal `#30d5c8`)
4. **Data:** Export JSON button + Import JSON button (neutral styling)
5. **Danger Zone:** Reset button (red `rgba(239,68,68,0.15)` bg, `#f87171` text)

Reference `sf-panels-d.jsx` lines 263-374.

- [ ] **Step 3: Save button**

Orbitron 0.82rem, blue gradient, transitions to "Saved ✓" for 2s.

- [ ] **Step 4: Verify and commit**

```bash
git add src/panels/SettingsPanel.tsx src/styles.css
git commit -m "feat(ui): redesign SettingsPanel with toggle components, grouped cards, save animation"
```

---

## Task 17: CSS Cleanup & Polish Pass

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Remove dead CSS rules**

After all panels are rewritten, search `src/styles.css` for class names that are no longer used in any `.tsx` file. Remove orphaned rules.

- [ ] **Step 2: Verify responsive breakpoints**

Check media queries at `@media (max-width: 900px)` and `@media (max-height: 500px)`. Update breakpoint rules to work with new component dimensions (e.g., panel banner height, fleet bar height).

- [ ] **Step 3: Verify QueueDisplay still works**

The QueueDisplay component and QueueRow weren't explicitly redesigned. Verify they still render correctly with the new token values. Minor CSS tweaks may be needed.

- [ ] **Step 4: Verify AdminPanel still works**

AdminPanel was excluded from the redesign. Verify it renders correctly — its dark monospace styling should be independent of the redesign tokens, but check for any `.panel` or `.btn` class conflicts.

- [ ] **Step 5: Full visual smoke test**

Navigate through every panel. Check:
- Fonts rendering (Orbitron titles, Space Grotesk body, JetBrains Mono numbers)
- Colour consistency (resource colours, accent blues, danger reds)
- Hover effects (cards, nav items, buttons)
- Panel banners (images loading, gradients, text readable)
- FleetMovementsBar (collapsible, progress bars, mission colours)
- PlanetSwitcher (dropdown opens/closes, planet icons load)
- Mobile breakpoint (≤900px width)

- [ ] **Step 6: Commit**

```bash
git add src/styles.css
git commit -m "chore(ui): cleanup dead CSS rules, fix responsive breakpoints after redesign"
```

---

## Implementation Notes for Workers

### Design Reference Workflow

For every component, the worker should:
1. Open `handoff/design_handoff/StarForge Redesign.html` in a browser as visual reference
2. Read the corresponding `sf-*.jsx` file for exact styling values
3. Read the README spec section for any details not obvious from the JSX

**Conflict resolution:** When README.md and `sf-*.jsx` files disagree on a value (spacing, colour, font size, etc.), **README.md wins** — it is the canonical spec. The JSX files are rapid prototypes and may have minor inconsistencies. Known exception: the JSX files contain interaction behaviours (hover states, expand/collapse logic, tooltip tracking) that the README describes only in prose — for interaction implementation, follow the JSX.

### Codex Prompt Guidelines (learned during implementation)

- **Call out JSX structural changes explicitly.** Codex reliably updates CSS values but may leave the JSX element hierarchy unchanged. If the design changes layout (e.g., stacked column → flat inline row), the prompt must say so: "Flatten the nested div wrapper into inline spans" — not just "update styling."
- **Specify element heights when multiple components must align.** Resource pills and PlanetSwitcher must share `height: 36px` to pixel-align. Call out shared dimensions explicitly.
- **Review should check rendered structure, not just CSS values.** Compare the JSX element hierarchy against the prototype's flex layout, not just whether the right CSS properties exist.

### Key Architecture Rules

- **No engine changes.** All data comes from GameContext — don't modify hooks, engines, or models.
- **CSS classes over inline styles.** The prototype JSX uses inline styles for prototyping convenience. Convert these to CSS classes in `src/styles.css`.
- **Keep existing component interfaces.** Props types should stay compatible. Adding optional new props is fine.
- **CardImage graceful degradation.** Building/ship/defence/research individual images don't exist yet. CardImage's striped placeholder handles this.
- **HoverPortal vs cursor-following tooltips.** The existing `HoverPortal.tsx` is anchor-based (positioned relative to a ref element). The Overview mission hover and Galaxy slot hover in the prototype use **cursor-following** tooltips (`position: fixed`, tracking `onMouseMove` clientX/clientY). For these two panels, create a small `CursorTooltip` wrapper that renders via `ReactDOM.createPortal` to `document.body` with fixed positioning clamped to viewport — do NOT try to force `HoverPortal` into cursor-tracking mode. Use `HoverPortal` for anchor-based hovers (e.g., resource bar, fleet panel ship counts).
- **Admin panel excluded.** Don't touch `AdminPanel.tsx` — it has its own styling namespace (`.admin-*`).
- **NavSidebar now uses `useGame` hook.** Task 4 changes NavSidebar from pure-props to context-aware. If NavSidebar tests exist in `src/components/__tests__/`, they will need `renderWithGame()` wrapper instead of bare render. Update any affected test files.

### CSS Naming Convention

- **New components** (PanelBanner, CardImage, LevelRing): use BEM — `.panel-banner__img`, `.card-image__placeholder`
- **Existing components** (NavSidebar, ResourceBar, CostDisplay): use flat naming — `.nav-button`, `.cost-pill`
- Both conventions coexist — don't refactor existing flat names to BEM

### CSS Variable Mapping

| Old | New | Notes |
|-----|-----|-------|
| `--bg-dark` | `--bg-void` | Rename everywhere |
| `--bg-panel` | `--bg-panel` | Value changed from hex to rgba |
| `--bg-panel-hover` | `--bg-hover` | Value changed |
| `--text-dim` | `--text-dim` | Changed from hex to rgba |
| `--accent` | `--accent` / `--accent-blue` | Same value, new aliases added |
| `--danger` | `--danger` | Changed from `#ef4444` to `#f87171` |
| `--success` | `--success` | Changed from `#22c55e` to `#34d399` |

### Font Usage

Always use the CSS custom properties — never raw font-family strings:

| Context | Variable | Font |
|---------|----------|------|
| Panel titles, section headers | `var(--font-display)` | Orbitron 600-700 |
| Body text, buttons, descriptions | `var(--font-body)` | Space Grotesk 400-600 (inherited from `body`) |
| Numbers, coordinates, costs, ETAs | `var(--font-mono)` | JetBrains Mono 400-500 |

### Mission Type Colour Map

Use these exact values for fleet mission type styling across FleetMovementsBar, FleetPanel, and Overview active missions:

| Type | Background | Text | Border |
|------|-----------|------|--------|
| attack | `rgba(120,40,0,0.9)` | `#ffb366` | `rgba(180,60,0,0.6)` |
| espionage | `rgba(0,30,100,0.9)` | `#66aaff` | `rgba(0,60,180,0.5)` |
| harvest | `rgba(0,60,60,0.9)` | `#30d5c8` | `rgba(0,100,100,0.5)` |
| transport | `rgba(0,60,20,0.9)` | `#66ff88` | `rgba(0,100,40,0.5)` |
| colonise | `rgba(60,0,100,0.9)` | `#cc88ff` | `rgba(100,0,160,0.5)` |

**Status colours:** outbound `#4d8fff` · returning `#34d399` · at_target `#f0a832`
