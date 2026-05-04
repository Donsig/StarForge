# Handoff: Card Detail Modal — Issue #44

## Overview

This handoff covers the design for a card detail modal triggered when a player clicks any card in StarForge. Cards exist in four types: **Buildings**, **Research**, **Ships**, and **Defence**. Currently clicking a card does nothing; this feature opens a modal providing richer context, level progression, prerequisites, and the build/upgrade action.

The chosen design is **Proposal A — Dossier**: a split-panel modal with a fixed left column (image + level stats + next-level preview) and a scrollable right column (description, stats, progression table, unlocks, strategic notes), plus a sticky footer with the build action.

---

## About the Design Files

The files in this bundle are **design references created in HTML** — interactive prototypes showing intended look, layout, and behavior. They are not production code to copy directly.

Your task is to **recreate these designs inside the existing StarForge React + TypeScript codebase** (`src/` directory), using its established component patterns, existing CSS tokens (`src/styles.css`), and data structures (`src/data/`, `src/models/`). Do not ship the HTML files.

The prototype includes mock data; the real implementation should wire up to live `GameState`, `BuildingDefinition`, `ResearchDefinition`, `ShipDefinition`, and `DefenceDefinition` types.

---

## Fidelity

**High-fidelity.** The prototype uses exact design tokens from `src/styles.css`, real images from the CDN, and matches the existing UI vocabulary precisely. Implement pixel-accurately: same colors, spacing, typography, and interaction states.

---

## Feature Scope

### Trigger
- Clicking anywhere on an `.item-card` element (the card `<article>`) opens the modal for that item.
- The existing upgrade/build button inside the card continues to work as before (stop propagation so button clicks don't also open the modal).

### Card types covered
| Type | Panel | Data source |
|---|---|---|
| Building | `BuildingsPanel.tsx` | `BUILDINGS[id]`, `BUILDING_IMAGES[id]` |
| Research | `ResearchPanel.tsx` | `RESEARCH[id]`, `RESEARCH_IMAGES[id]` |
| Ship | `ShipyardPanel.tsx` / `FleetPanel.tsx` | `SHIPS[id]`, `SHIP_IMAGES[id]` |
| Defence | `DefencePanel.tsx` | `DEFENCES[id]`, `DEFENCE_IMAGES[id]` |

---

## Modal Layout

### Container
```
Position:   fixed, centered, z-index: 100
Backdrop:   rgba(2,4,14,0.55) + blur(4px) behind modal
Width:      700px (max-width: 96vw)
Max-height: 92vh
Background: rgba(7,10,22,0.97)
Border:     1px solid <type accent border color>
Border-radius: 12px
Box-shadow: 0 0 70px rgba(0,0,0,0.75), 0 0 32px <type glow>
Display:    flex, flex-direction: column
Overflow:   hidden
```

### Type accent colours
| Type | `--c` | `--bg` | `--bd` | `--glow` |
|---|---|---|---|---|
| building | `#4d8fff` | `rgba(77,143,255,0.12)` | `rgba(77,143,255,0.35)` | `rgba(77,143,255,0.22)` |
| research | `#818cf8` | `rgba(129,140,248,0.12)` | `rgba(129,140,248,0.35)` | `rgba(129,140,248,0.22)` |
| ship | `#30d5c8` | `rgba(48,213,200,0.12)` | `rgba(48,213,200,0.35)` | `rgba(48,213,200,0.22)` |
| defence | `#f0a832` | `rgba(240,168,50,0.12)` | `rgba(240,168,50,0.35)` | `rgba(240,168,50,0.22)` |

---

## Sections

### 1 — Top Bar (fixed, no scroll)
```
Height:     ~44px
Padding:    0.65rem 1rem
Border-bottom: 1px solid rgba(40,60,120,0.3)
Background: rgba(5,8,20,0.6)
Layout:     flex, space-between
```
- **Left**: Type badge (Orbitron, 0.6rem, uppercase, coloured pill) + subtitle `"INTEL FILE · CLASSIFIED"` (JetBrains Mono, 0.6rem, rgba(150,180,220,0.28))
- **Right**: Close `✕` button (no background, rgba(150,180,220,0.35))

### 2 — Body (flex row, flex: 1, min-height: 0)

#### 2a — Left Column (fixed width, scrollable)
```
Width:      250px
flex-shrink: 0
Border-right: 1px solid rgba(40,60,120,0.22)
Background: rgba(5,8,20,0.4)
overflow-y: auto
```

**Image:**
- Full width, height: 188px, object-fit: cover
- Gradient overlay: `linear-gradient(transparent 55%, rgba(5,8,20,0.92))`
- Accent bar top: 3px, `linear-gradient(90deg, <accent>, transparent)`

**Current Level section** (padding: 0.75rem 0.8rem):
- Header: Orbitron 0.6rem 700, `<accent colour>`, uppercase, "Level N" (buildings/research) or "×N in fleet" (ships) or "×N deployed" (defence)
- Rows: label (0.6rem uppercase rgba(150,180,220,0.38), `white-space: nowrap`) + value (JetBrains Mono 0.72rem 600, resource colour)
- Show the first 3 stats from the item's stat array

**Next Level section** (buildings & research only):
- Divider: `border-top: 1px solid rgba(40,60,120,0.28)`, padding-top: 0.6rem
- Header: "Level N" (Orbitron 0.6rem, rgba(150,180,220,0.4)) + "NEXT" badge (Orbitron 0.52rem, accent colour, 1px border, border-radius: 3px)
- Rows (same label/value pattern, `white-space: nowrap`):
  - Prod / hr (buildings) or Effect (research) — **highlighted**: larger font (0.76rem 700), accent colour; separated by a bottom border from cost rows
  - Metal (colour: `#9ca3af`)
  - Crystal (colour: `#60a5fa`)
  - Deuterium (colour: `#34d399`) — only if > 0
  - Energy (colour: `#fbbf24`) — only if non-zero
  - Build Time (colour: `rgba(150,180,220,0.45)`) — `formatDuration(timeSeconds)` for buildings, research lab formula for research

#### 2b — Right Column (flex: 1, flex column)

**Scrollable body** (flex: 1, overflow-y: auto, padding: 1rem 1.1rem, gap: 0.85rem):

1. **Name + Description**
   - Name: Orbitron 1.05rem 700, letter-spacing: 0.04em, `#c8e0ff`, margin-bottom: 0.45rem
   - Description: Space Grotesk 0.79rem, `rgba(150,180,220,0.62)`, line-height: 1.55

2. **Stats section** (section label + stat grid)
   - Label: "Output" (building) / "Effect" (research) / "Combat Stats" (ship/defence)
   - Grid: 2-column, gap: 0.4rem
   - Each cell: `background: rgba(5,8,20,0.6)`, border `rgba(40,60,120,0.28)`, border-radius: 6px, padding: 0.5rem 0.65rem
   - Value: JetBrains Mono 0.88rem 600, resource colour
   - Label: 0.62rem uppercase, `rgba(150,180,220,0.38)`

3. **Prerequisites** (if any)
   - Pills: border-radius: 999px, met = green (`#34d399` / `rgba(52,211,153,0.5)`), unmet = red (`#f87171` / `rgba(248,113,113,0.5)`)
   - **Unmet pills are clickable links**: cursor pointer, ↗ icon, onClick navigates to the referenced card's modal (pass the prerequisite id + type to the modal open handler)
   - Show "Navigating to…" inline toast on click (150ms fade in, auto-dismiss after ~1.8s)

4. **Level Progression table** (buildings & research only)
   - Table with columns: LV | BENEFIT | ⬡ Metal | ◈ Crystal | [◉ Deut.] | [⚡ Energy]
   - Only render Deuterium/Energy columns if any row has non-zero values
   - Current row: background `<accent>1a`, accent-coloured level number, "NOW" badge (filled accent bg, dark text)
   - Next row: background `<accent>0d`, "NEXT" badge (outline)
   - Dim rows not current/next: opacity ~0.42 on text
   - Header: Orbitron 0.57rem, `rgba(150,180,220,0.3)` / resource colour per column
   - Resource values right-aligned, JetBrains Mono 0.68rem 600
   - Zero values shown as `—`

5. **Unlocks** (if this item is a prerequisite for others)
   - List of items this unlocks, each with TypeBadge + name + "at Lv N"
   - Dot indicator in accent colour with glow

6. **Strategic Notes**
   - Left-border accent card: `border-left: 3px solid <accent>`, background `rgba(5,8,20,0.5)`, italic 0.76rem text

**Sticky footer** (flex-shrink: 0, border-top, padding: 0.8rem 1.1rem, background: rgba(5,8,20,0.55)):

- **Buildings / Research**: cost pills row (resource colour pills, JetBrains Mono 0.72rem) + build time (right-aligned) + full-width primary CTA button
- **Ships / Defence**: quantity stepper + total cost row + full-width primary CTA

#### Quantity Stepper (ships & defence)
```
Layout: flex row, align-items: center, gap: 0.5rem
- "Quantity" label (left, flex: 1)
- − button: 26×26px, accent border/bg, accent colour text
- Number input: 52px wide, text-align center, JetBrains Mono 0.85rem
- + button: same as −
- MAX button: transparent bg, 0.65rem, sets quantity to reasonable max (e.g. max affordable)
Below: total cost pills (quantity × unit cost) + total build time
```

CTA label: `"Build Ships ×N"` / `"Construct ×N"` (updates live with quantity)

### 3 — Primary CTA Button
```
Width:      100%
Padding:    0.62rem 1rem
Border:     1px solid <type bd>
Border-radius: 6px
Background: linear-gradient(135deg, <type bg at 0.22 alpha>, <type bg at 0.42 alpha>)
Color:      <type accent colour>
Font:       Orbitron 0.7rem 600, letter-spacing: 0.09em, uppercase
```

---

## Interactions & Animations

### Opening the modal
- Add `onClick` to the `<article className="item-card">` wrapper in each panel
- Stop propagation on the existing upgrade/build button so it doesn't also trigger the modal
- Recommended entry animation: `opacity 0→1 + scale 0.96→1`, duration ~200ms, ease-out

### Closing
- Click the `✕` button
- Click the backdrop overlay
- Press `Escape` key

### Prerequisite navigation
- Clicking an unmet prerequisite pill should close the current modal and open the modal for the referenced item (building or research)
- Show a brief inline "Navigating to X…" toast (fade in 150ms, hold ~1.5s, fade out) before navigating

### Quantity stepper (ships/defence)
- `−` button: decrement, min 1
- `+` button: increment
- MAX button: set to maximum affordable quantity (`Math.floor(resource / unitCost)` for each resource, take the minimum)
- Input: free-type number, clamp to ≥ 1 on blur

---

## State Management

Suggested component interface:

```tsx
interface CardDetailModalProps {
  open: boolean;
  onClose: () => void;
  cardType: 'building' | 'research' | 'ship' | 'defence';
  cardId: BuildingId | ResearchId | ShipId | DefenceId;
}
```

Internal state:
- `qty: number` — build quantity (ships/defence only), default 1
- `tab` — not needed for Proposal A (all content is in-column), but keep in mind for future
- `navigatingTo: string | null` — drives the prerequisite navigation toast

The modal reads live `GameState` via `useGame()` to determine:
- Current level / owned count
- Whether prerequisites are met (`prerequisitesMet`)
- Whether the player can afford (`canAfford`)
- Build time (`buildingTime` / `shipyard` level formulas)

---

## Level Progression Data

The progression table needs computed values, not hardcoded ones. Use the existing formula engines:

**Buildings:**
```ts
// Cost at each level
const cost = buildingCostAtLevel(def.baseCost, def.costMultiplier, level);
// Production at each level — use the existing production formula per building type
// Time at each level
const time = buildingTime(cost.metal, cost.crystal, planet.buildings.roboticsFactory, planet.buildings.naniteFactory, settings.gameSpeed);
```

Show levels from `max(1, currentLevel - 2)` to `currentLevel + 3`.

**Research:**
```ts
const cost = researchCostAtLevel(def.baseCost, def.costMultiplier, level);
```

Show all levels 1 through `currentLevel + 3`.

---

## Design Tokens (from src/styles.css)

```css
--bg-void: #050810
--bg-panel: rgba(8,12,28,0.85)
--bg-panel-dark: rgba(5,8,20,0.97)
--border: rgba(40,60,120,0.3)
--border-hover: rgba(77,143,255,0.45)
--accent: #4d8fff
--accent-teal: #30d5c8
--accent-amber: #f0a832
--accent-purple: #818cf8
--danger: #f87171
--success: #34d399
--text: #c8e0ff
--text-dim: rgba(150,180,220,0.55)
--metal: #9ca3af
--crystal: #60a5fa
--deuterium: #34d399
--energy: #fbbf24
--font-display: 'Orbitron', sans-serif
--font-body: 'Space Grotesk', 'Segoe UI', sans-serif
--font-mono: 'JetBrains Mono', 'Consolas', monospace
--card-radius: 10px
--panel-radius: 12px
--btn-radius: 6px
```

---

## Assets

All item images are already available in the existing asset maps:
- `BUILDING_IMAGES[buildingId]` → `assets/buildings/<id>.webp`
- `RESEARCH_IMAGES[researchId]` → `assets/research/<id>.webp`
- `SHIP_IMAGES[shipId]` → `assets/ships/<id>.webp`
- `DEFENCE_IMAGES[defenceId]` → `assets/defences/<id>.webp`

No new assets required.

---

## Suggested Implementation Plan

1. Create `src/components/CardDetailModal.tsx` — the modal shell (backdrop, container, top bar, close logic, Escape key handler)
2. Create `src/components/CardDetailModal/LeftColumn.tsx` — image, current level stats, next level preview
3. Create `src/components/CardDetailModal/RightColumn.tsx` — scrollable body + sticky footer
4. Create `src/components/CardDetailModal/LevelTable.tsx` — the progression table
5. Create `src/components/CardDetailModal/QuantityStepper.tsx` — ship/defence quantity input
6. Add `selectedCard: { type, id } | null` state to each panel (or via a shared context)
7. Wire `onClick` on each `<article className="item-card">` in `BuildingsPanel`, `ResearchPanel`, `ShipyardPanel`, `DefencePanel`
8. Add CSS entry animation in `src/styles.css`

---

## Files

| File | Description |
|---|---|
| `StarForge Modal Proposals.html` | Interactive HTML prototype — **reference only**, do not ship |

Open the HTML file in a browser to interact with all card types via the Tweaks panel (toggle in toolbar). Proposal A is the chosen design.
