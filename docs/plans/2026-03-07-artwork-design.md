# Artwork System Design

**Date:** 2026-03-07
**Status:** Approved, awaiting implementation plan

## Overview

Add static artwork to Star Forge: card header banners for every game entity (buildings, ships, defences, research), page banners for each major panel, and planet visuals for the galaxy map and Overview panel. All images are pre-generated manually (Claude provides prompts, user generates in DALL-E 3 / Gemini) and committed as static assets. No runtime image generation.

---

## Art Style

Old-school realistic sci-fi illustration — painted space art in the style of 1970s–80s science fiction book covers (think Chris Foss, John Berkey, classic OGame). Not photorealistic CGI. Detailed, atmospheric, dramatic lighting.

**Style prefix for every prompt:**
> "Old-school realistic sci-fi illustration, painted space art in the style of 1970s–80s science fiction book covers, dramatic lighting, highly detailed, no text, no UI elements, no watermarks"

---

## Asset Inventory (~62 images total)

### Card Banners (per-entity, wide landscape)
Generated at **1792×1024**, stored at **896×512 webp**.

**Buildings (~15):**
metalMine, crystalMine, deuteriumSynthesizer, solarPlant, fusionReactor, roboticsFactory, shipyard, researchLab, naniteFactory, metalStorage, crystalStorage, deuteriumTank, missileSilo, spaceDock, terraformer

**Ships (~14):**
lightFighter, heavyFighter, cruiser, battleship, battlecruiser, bomber, destroyer, deathStar, smallCargo, largeCargo, recycler, espionageProbe, solarSatellite, colonyShip

**Defences (8):**
rocketLauncher, lightLaser, heavyLaser, gaussCannon, ionCannon, plasmaTurret, smallShieldDome, largeShieldDome

**Research (~16):**
energyTechnology, laserTechnology, ionTechnology, hyperspaceTechnology, plasmaTechnology, combustionDrive, impulseDrive, hyperspaceDrive, espionageTechnology, computerTechnology, astrophysicsTechnology, intergalacticResearchNetwork, gravitonTechnology, weaponsTechnology, shieldingTechnology, armourTechnology

### Page Banners (per-panel, full-width header)
Generated at **1792×1024**, stored at **896×512 webp**.

| Panel | Subject |
|-------|---------|
| Fleet | Formation of warships in deep space |
| Defence | Planetary gun batteries, shield domes, fortress |
| Buildings | Colony base landscape, industrial structures on alien terrain |
| Research | Orbital research lab, technology and science imagery |
| Galaxy | Deep space star field, nebulae, galaxy view |

> **Future enhancement:** Page banners dynamically swap or blend based on player fleet/defence strength on the active planet. Not implemented in this phase — static only.

### Planet Visuals
Generated at **1024×1024**, stored at two sizes: **512×512** (portrait) and **128×128** (icon).

**4 planet types** mapped by `maxTemperature`:

| Type | Temperature Range | Visual |
|------|------------------|--------|
| `hot` | > 60° | Volcanic, lava flows, scorched rock |
| `temperate` | 20–60° | Earth-like, clouds, blue-green |
| `cold` | -20–20° | Rocky, grey, thin atmosphere |
| `frozen` | < -20° | Ice-covered, white-blue, glacial |

---

## File Structure

```
public/assets/
  buildings/
    metalMine.webp
    crystalMine.webp
    … (one per building ID)
  ships/
    lightFighter.webp
    … (one per ship ID)
  defences/
    rocketLauncher.webp
    … (one per defence ID)
  research/
    energyTechnology.webp
    … (one per research ID)
  planets/
    hot.webp
    temperate.webp
    cold.webp
    frozen.webp
    hot-icon.webp
    temperate-icon.webp
    cold-icon.webp
    frozen-icon.webp
  panels/
    fleet.webp
    defence.webp
    buildings.webp
    research.webp
    galaxy.webp
```

---

## Code Architecture

### Asset Map (`src/data/assets.ts`)
Central mapping of item IDs to asset paths. Panels import from here — no path strings scattered in components.

```ts
export const BUILDING_IMAGES: Record<string, string> = {
  metalMine: '/assets/buildings/metalMine.webp',
  crystalMine: '/assets/buildings/crystalMine.webp',
  // …
};

export const SHIP_IMAGES: Record<string, string> = { … };
export const DEFENCE_IMAGES: Record<string, string> = { … };
export const RESEARCH_IMAGES: Record<string, string> = { … };
export const PANEL_IMAGES = {
  fleet: '/assets/panels/fleet.webp',
  defence: '/assets/panels/defence.webp',
  buildings: '/assets/panels/buildings.webp',
  research: '/assets/panels/research.webp',
  galaxy: '/assets/panels/galaxy.webp',
} as const;

export function getPlanetType(maxTemperature: number): 'hot' | 'temperate' | 'cold' | 'frozen' {
  if (maxTemperature > 60) return 'hot';
  if (maxTemperature > 20) return 'temperate';
  if (maxTemperature > -20) return 'cold';
  return 'frozen';
}

export function getPlanetImageUrl(maxTemperature: number, size: 'portrait' | 'icon' = 'portrait'): string {
  const type = getPlanetType(maxTemperature);
  return size === 'icon' ? `/assets/planets/${type}-icon.webp` : `/assets/planets/${type}.webp`;
}
```

### Fallback Behavior
If an image fails to load, show a dark gradient placeholder — no broken image icon. Implemented via `onError` handler or CSS background fallback.

```tsx
<img
  src={src}
  alt=""
  className="card-banner-img"
  onError={(e) => { e.currentTarget.style.display = 'none'; }}
/>
```

Or wrap in a `<div className="card-banner">` with a CSS gradient background so the div shows through when the image is absent.

### UI Integration

**Card banners** — top of each building/ship/defence/research card:
```css
.card-banner-img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  object-position: center;
  display: block;
  border-radius: 0.4rem 0.4rem 0 0;
}
```

**Page banners** — full-width header at top of each panel:
```css
.panel-banner-img {
  width: 100%;
  height: 180px;
  object-fit: cover;
  object-position: center;
  display: block;
  margin-bottom: 1rem;
}
```

**Planet portrait** (Overview panel): `256×256`, circular (`border-radius: 50%`)

**Planet icon** (Galaxy map slot): `48×48`, circular

---

## Generation Workflow

1. Claude provides a crafted prompt for each item (in the implementation plan)
2. User generates in DALL-E 3 (ChatGPT) or Gemini Imagen at the specified resolution
3. User resizes: card/panel art → 896×512; planet portrait → 512×512; planet icon → 128×128
4. Save as `.webp` to the correct `public/assets/` subfolder
5. Wire up in `src/data/assets.ts` (Codex handles the code; user handles the files)

---

## Phases

- **Phase A (this plan):** All code wiring — `assets.ts`, card banner `<img>` tags, page banner components, planet visuals in Overview + Galaxy map. Placeholders (gradient divs) everywhere images would appear.
- **Phase B (manual):** User generates and drops in actual `.webp` files. No code changes needed — images appear automatically.
- **Phase C (future):** Dynamic page banners that reflect fleet/defence strength.
