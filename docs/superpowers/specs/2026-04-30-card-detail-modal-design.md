# Card Detail Modal — Design Spec

**Issue:** #44
**Status:** Revised after two Codex review passes (pending user approval)
**Created:** 2026-04-30
**Last revised:** 2026-04-30 — second pass: closest()-self-match, keydown guard, focus-ref lifecycle, SpyModalProvider, queued maxCount, research-card class

## Summary

A click on any item card in the Buildings, Research, Shipyard, or Defence panel opens a shared, type-aware detail modal. Card class names differ by panel (`item-card` in Buildings/Shipyard/Defence; `research-card` in Research, see `src/panels/ResearchPanel.tsx:164`) — the wiring is per-panel, not based on a single class selector. The modal shows richer context (image, current/next level, full stats, level progression, prerequisites, unlocks, strategic notes) and exposes the build/upgrade action via a sticky footer. The existing inline upgrade buttons keep working unchanged.

The visual design is fixed by the design handoff in `design handoff/building cards/design_handoff_card_detail_modal/` (Proposal A — Dossier). This spec covers how to recreate that design inside the StarForge codebase, decisions on data sourcing, state management, behaviour, and tests.

## Decisions Locked

| # | Decision |
|---|---|
| 1 | **Scope:** ship all four card types (Building, Research, Ship, Defence) in a single plan/PR. |
| 2 | **Strategic notes:** new file `src/data/strategicNotes.ts` (separate from definition data). Seeded with 10–15 entries; section hidden when missing. |
| 3 | **Modal state:** dedicated `ModalContext` / `useModal()` in `src/context/`. Not added to GameContext. |
| 4 | **Prereq pill navigation:** modal-only — clicking an unmet pill replaces the modal contents; the underlying panel does not change. |
| 5 | **Solar Satellite:** clicking the Solar Satellite card in the Buildings panel opens the **ship** modal. The modal's stat grid surfaces "Energy / unit" using the canonical guarded formula: `Number.isFinite(maxTemperature) ? Math.max(0, Math.floor((maxTemperature + 140) / 6)) : 0` (matches the CLAUDE.md gotcha). The existing inline build form in BuildingsPanel stays. |
| 6 | **Building benefit column:** every building category gets a specific benefit string (mines: prod/hr; energy: ±energy; storage: capacity; facilities: −% time). Single signed Energy column in the level table. |
| 7 | **MAX button:** pure `min(floor(resource / cost))` across resources, clamped by `maxCount` and `currentCount`. Returns 0 when not affordable or already at cap. |
| 8 | **Tests:** medium coverage — unit tests for pure helpers, one component happy-path test per card type, one integration test. |
| 9 | **CTA stays open:** after a successful build/upgrade dispatch the modal stays open and reflects the queue. CTA label and target level update; level-table rows in the queue get a QUEUE badge. |

State-management framework adoption (Zustand etc.) is **out of scope** — tracked as a separate future initiative.

---

## Architecture

```
App
├── GameProvider                       (existing — game state + actions)
│   └── ModalProvider                  (NEW — owns selectedCard)
│       ├── NavSidebar / panels…
│       └── <CardDetailModal />        (NEW — renders only when open)
```

Boundaries:

- **`ModalContext`** owns `selectedCard: { type, id } | null` and exposes `open(type, id)`, `close()`, and `restoreFocus()`. No game-state coupling, so consumers don't re-render with each game tick. The originating focusable element is captured into a `useRef<HTMLElement | null>` inside the provider (not exposed in the context value). Capture rule: `open()` captures `document.activeElement` **only if `originRef.current === null`** — this preserves the original opener across modal-to-modal prereq navigation. `close()` does **not** clear the ref. The modal calls `restoreFocus()` at the end of the exit animation; that function focuses `originRef.current` if it is still in the DOM and focusable, then sets `originRef.current = null`.
- **`CardDetailModal`** is the only component that combines modal state with game state. It pulls definition data from `src/data/*`, current values + actions from `useGame()`, and open/close from `useModal()`. To survive the exit animation, the modal keeps a local `displayedCard` state that mirrors `selectedCard` while open and **persists through the closing phase** — when `selectedCard` flips to `null`, the modal stays mounted with `displayedCard` intact and `data-state="closing"`; `onAnimationEnd` then clears `displayedCard` and unmounts. This isolates lifecycle state from the context.
- **Pure helpers** in `src/utils/cardDetails.ts` compute every derived display value (stats, benefit strings, level progression rows, enables/unlocks, prereq rows, max-affordable). No React inside; testable as plain functions.
- **Strategic notes** live in `src/data/strategicNotes.ts`. Modal optionally reads them by `(type, id)`.

Why this shape:
- Modal is a self-contained leaf — adding/removing it later doesn't ripple through panels.
- Pure helpers stay independently testable and reusable elsewhere (tooltips, hover panels).
- `ModalContext` is small enough to host other future modals (fleet send, espionage report) without bloating GameContext.
- Keeps the existing engine/UI boundary (CLAUDE.md rule) intact.

---

## File List

### New files

| Path | Purpose |
|---|---|
| `src/context/ModalContext.tsx` | `ModalProvider`, `useModal()`. Public API: `selectedCard: { type, id } \| null`, `open(type, id)`, `close()`, `restoreFocus()`. Internally tracks the originating focusable element via `useRef<HTMLElement \| null>` (not part of the context value) for focus return on close — preserved across prereq navigation; cleared by `restoreFocus()` after the exit animation. Provider accepts an optional `value` prop so tests can inject a fully controlled context value (`<ModalProvider value={spyValue}>`). |
| `src/components/CardDetailModal/index.tsx` | Modal shell — backdrop, top bar, body row, close logic, Escape handler, focus trap, entry animation. |
| `src/components/CardDetailModal/LeftColumn.tsx` | Image + accent bar + Current Level block + Next Level block (buildings/research only). |
| `src/components/CardDetailModal/RightColumn.tsx` | Scrollable body (name, description, stats, prereqs, level progression, unlocks, strategic notes) + sticky footer. |
| `src/components/CardDetailModal/LevelTable.tsx` | Level-progression table with NOW / QUEUE / NEXT badges (buildings & research). |
| `src/components/CardDetailModal/QuantityStepper.tsx` | −/+ / number input / MAX, total cost + total time (ships & defence). |
| `src/components/CardDetailModal/PrereqPills.tsx` | Met/unmet pills with click-to-navigate behaviour and inline "Navigating to…" toast. |
| `src/utils/cardDetails.ts` | Pure helpers — see [Helpers](#pure-helpers). |
| `src/data/strategicNotes.ts` | Per-type `Partial<Record<id, string>>` maps + `getStrategicNote(type, id)` accessor. Seeded with 10–15 entries. |
| `src/components/CardDetailModal/__tests__/CardDetailModal.test.tsx` | Component happy-path tests, one per card type. |
| `src/utils/__tests__/cardDetails.test.ts` | Unit tests for the pure helpers. |
| `src/test/integration/cardDetailModal.test.tsx` | One end-to-end test: panel click → modal → CTA → queue update → QUEUE badge → Escape. |

### Modified files

| Path | Change |
|---|---|
| `src/App.tsx` | Wrap children in `<ModalProvider>`; render `<CardDetailModal />` once at root. |
| `src/panels/BuildingsPanel.tsx` | Add `onClick` / `onKeyDown` / `role="button"` / `tabIndex={0}` to each `<article className="item-card">`. Both handlers use the shared interactive-child guard from the *Opening* section — selector `'button, input, select, textarea, a'` (no `[role="button"]`, to avoid the article self-matching). No per-element `stopPropagation`. Solar Satellite card opens `open('ship', 'solarSatellite')`; inline form continues to work because clicks/keys inside its `<input>` and `<button>` are caught by the guard. |
| `src/panels/ResearchPanel.tsx` | Same pattern, but the article uses `className="research-card"` (not `item-card`). Same shared guard. |
| `src/panels/ShipyardPanel.tsx` | Same pattern as BuildingsPanel. Same shared guard. |
| `src/panels/DefencePanel.tsx` | Same pattern as BuildingsPanel. Same shared guard. |
| `src/styles.css` | New rules under a `.card-detail-modal` namespace (backdrop, container, top bar, columns, level table, prereq pills, quantity stepper, CTA, entry animation `@keyframes`). Use existing tokens; add new tokens only if used in 3+ places. |
| `src/test/test-utils.tsx` | Extend `renderWithGame()` to optionally wrap in `<ModalProvider>` and accept an initial `selectedCard`. Existing tests untouched (default = no provider). |

### Out of scope
- Other future modals (fleet send, espionage report) — `ModalContext` is general but only `CardDetailModal` is wired now.
- Any GameContext refactor or Zustand evaluation.
- Changes to `AdminPanel` cards.

---

## Pure Helpers

`src/utils/cardDetails.ts` — public surface:

```ts
export type CardType = 'building' | 'research' | 'ship' | 'defence';

export const TYPE_ACCENTS: Record<CardType, {
  c: string; bg: string; bd: string; glow: string;
}>;

export interface CardStat { label: string; value: string; color: string; }
// Returns RAW (datasheet) stats per type/id — combat numbers are NOT scaled by
// research bonuses. This matches how the existing panels render cards. If a future
// caller needs effective stats, wrap with combat-engine scaling outside the helper.
export function cardStatsFor(type: CardType, id: string, state: GameState): CardStat[];

// State is required for: planet temperature (deuterium), energyTechnology level
// (fusion reactor energy output), and plasma-tech bonuses on mines. Caller passes
// the full GameState; helper reads only what it needs.
export function buildingBenefitAtLevel(id: BuildingId, level: number, state: GameState): string;
export function researchBenefitAtLevel(id: ResearchId, level: number): string;

export interface LevelRow {
  level: number;
  benefit: string;
  metal: number; crystal: number; deuterium: number; energy: number;
  current: boolean; queued: boolean; next: boolean;
}
// Queue arg is the shared QueueItem[] from src/models/types.ts (not a per-type alias).
// For buildings: pass the planet's buildingQueue filtered by id.
// For research:  pass state.researchQueue filtered by id ONLY (the queue is global —
// see CLAUDE.md research-queue gotcha; sourcePlanetIndex is for payer/timing display,
// not for progression counting).
export function buildingProgression(
  id: BuildingId,
  currentLevel: number,
  queue: QueueItem[],
  state: GameState,
): LevelRow[];
export function researchProgression(
  id: ResearchId,
  currentLevel: number,
  queue: QueueItem[],
  state: GameState,
): LevelRow[];

export interface UnlockEntry { type: CardType; id: string; label: string; atLevel: number; }
export function enablesFor(type: CardType, id: string): UnlockEntry[];

// resources is the per-planet ResourcesState (src/models/Planet.ts).
// existingCount = owned + queued (the engine blocks owned + queued + qty > maxCount, so
// callers must pass the SUM, not just owned). For ships this is just current ship count;
// for shield domes it is `defences[id] + shipyardQueue.filter(q => q.type==='defence' && q.id===id).length`.
export function maxAffordable(
  cost: ResourceCost,
  resources: ResourcesState,
  maxCount?: number,
  existingCount?: number,
): number;

export interface PrereqRow {
  label: string;
  met: boolean;
  target: { type: CardType; id: string } | null;  // null when the prereq id is unknown
}
// Defensive: if a Prerequisite's id is not in the relevant definition map (data drift
// or corrupted save), the row is rendered with the raw id as the label and target=null
// so the pill is non-clickable rather than crashing.
export function prereqRowsFor(requires: Prerequisite[], state: GameState): PrereqRow[];
```

Notes:

- **`cardStatsFor`** owns per-id stat layouts. Combat stats for ships/defences are **raw datasheet values** — not scaled by weapons/shielding/armour research (that scaling lives in `CombatEngine`). This matches the existing panel rendering. Buildings return type-specific stats per the benefit mapping. For `solarSatellite` it surfaces "Energy / unit" using the canonical guarded formula `Number.isFinite(maxTemperature) ? Math.max(0, Math.floor((maxTemperature + 140) / 6)) : 0`.
- **`enablesFor`** precomputes a `Map<string, UnlockEntry[]>` at module load by iterating the four definition maps once. O(1) per lookup.
- **`buildingProgression`** returns levels from `max(1, currentLevel - 2)` to `max(currentLevel + 3, nextLevel + 1)` so the NEXT row is always visible even with a long queue. `nextLevel` is `currentLevel + queue.length + 1` (queue passed in is already filtered to entries for this id).
- **`researchProgression`** returns levels 1 to `max(currentLevel + 3, nextLevel + 1)`. Queue is filtered by id only (see signature note above).
- **`prereqRowsFor`** outputs `target: { type, id } | null` ready for `useModal().open()`. Pills don't have to inspect the prerequisite shape; the modal renders unmet pills with `target=null` as non-clickable plain text so unknown ids never crash the click path.

Build-time helpers used by the modal:
- Buildings → `buildingTime(metalCost, crystalCost, roboticsLevel, naniteLevel, gameSpeed)`.
- Research → `researchTime(metalCost, crystalCost, labLevel, gameSpeed)`.
- Ships → `shipBuildTime(structuralIntegrity, shipyardLevel, naniteLevel, gameSpeed)`.
- Defence → `defenceBuildTime(...)` — explicit alias of `shipBuildTime` exported from `FormulasEngine.ts:130`. Use the alias for clarity at call sites.

### Building benefit mapping

| Building | Benefit value at level L |
|---|---|
| `metalMine` | `+{prod}/h` (`metalProductionPerHour(L)`) |
| `crystalMine` | `+{prod}/h` (`crystalProductionPerHour(L)`) |
| `deuteriumSynthesizer` | `+{prod}/h` (`deuteriumProductionPerHour(L, planet.maxTemperature)`) |
| `solarPlant` | `+{energy}` (`solarPlantEnergy(L)`) |
| `fusionReactor` | `+{energy} / −{deut}/h` (production + consumption together) |
| `metalStorage` / `crystalStorage` / `deuteriumTank` | `{capacity}` (`storageCapacity(L)`) |
| `roboticsFactory` | `−{pct}% build time` (relative to L=0 baseline) |
| `naniteFactory` | `−{pct}% build time` |
| `shipyard` | `−{pct}% ship build time` |
| `researchLab` | `−{pct}% research time` |

Energy column in the level table uses signed values; one column carries both production (Solar/Fusion) and consumption (mines).

---

## Modal Lifecycle & Interactions

### Opening
- Each card article in the four panels (`item-card` for Buildings/Shipyard/Defence; `research-card` for Research) gets `onClick`, `onKeyDown` for Enter/Space, `role="button"`, and `tabIndex={0}`.
- Both handlers use the same **interactive-child guard**. The selector deliberately excludes `[role="button"]` because the article itself carries that role — including it would self-match and block every card click. The selector lists native interactive tags only; that is sufficient for the existing card markup (upgrade/build buttons, Solar Satellite input, future interactive widgets):
  ```ts
  const INTERACTIVE_SELECTOR = 'button, input, select, textarea, a';

  function handleCardClick(e: MouseEvent<HTMLElement>) {
    if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
    open(type, id);
  }

  function handleCardKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return; // Enter inside an inner input must not open
    e.preventDefault();
    open(type, id);
  }
  ```
- This single shared guard removes the need for any per-element `stopPropagation()`. Keep it identical across all four panels.
- The Solar Satellite card in BuildingsPanel resolves to `open('ship', 'solarSatellite')`.

### Closing
Three triggers, all calling `close()`:
1. `✕` button.
2. Backdrop click (modal container stops propagation so inner clicks don't bubble).
3. Escape key — `useEffect` subscribes to `document.keydown` only while open.

Two-phase close:
1. `close()` sets `selectedCard = null` in ModalContext and clears the originating-element ref.
2. The modal component watches `selectedCard`. When it transitions `non-null → null`, it keeps `displayedCard` (its own local state, set on each open) and flips `data-state="closing"` to play the exit animation.
3. `onAnimationEnd` clears `displayedCard` and the modal unmounts.

This keeps the context simple (one boolean-ish piece of state) and isolates animation lifecycle inside the modal component.

### Prereq pill navigation (modal-only)
- Met pills: not clickable. Pills with `target = null` (unknown id, defensive) are also not clickable and render as plain text.
- Unmet, clickable pills:
  1. Click → set local state `navigatingTo: target.label`, render the inline "Navigating to …" toast.
  2. The deferred navigation is held in a `useRef<ReturnType<typeof setTimeout> | null>`. **Before scheduling a new timer, the previous one is cleared.** The effect's cleanup also clears any pending timer on unmount.
  3. After ~150 ms call `open(target.type, target.id)` — same provider, replaces `selectedCard`. New modal content fades in; underlying panel unchanged.
- Rapid double-clicks therefore only navigate to the most recent target, never stack into spurious navigations.
- No history stack. Closing returns the user to the panel they were on.

### Quantity stepper (ships/defence)
- `−` decrements (min 1). `+` increments. Number input clamps to ≥ 1 on blur.
- `MAX` calls `maxAffordable(cost, resources, maxCount, existingCount)` where `existingCount = owned + queued` (NOT just owned — the engine blocks `owned + queued + qty > maxCount`). For shield domes, queued counts include items already in the shipyard queue (`shipyardQueue.filter(q => q.type === 'defence' && q.id === id).length`). Returns 0 when unaffordable or already at cap (built or queued); CTA disables.
- CTA label updates live: `"Build Ships ×N"` / `"Construct ×N"`.
- CTA disabled when `qty < 1`, `!canAfford(qty * cost)`, `!prerequisitesMet`, or `existingCount + qty > maxCount`.

### CTA dispatch
Action names are taken verbatim from `src/context/GameContext.tsx:80-83`. **Do not rename.**

| Type | Action | Notes |
|---|---|---|
| building | `upgradeBuilding(id)` | Uses next-level cost (queue-aware). |
| research | `startResearchAction(id)` | Same. |
| ship | `buildShips(id, qty)` | Quantity from stepper. |
| defence | `buildDefences(id, qty)` | Same. |

### After successful CTA — modal stays open
- Modal does **not** auto-close. State updates from the next render reflect into the modal:
  - Left-column Next Level block advances to `currentLevel + queuedCount + 1`.
  - Footer cost/time recompute for the new target level.
  - CTA label flips: `"Upgrade to Lv N"` → `"Queue → Lv N"` (matches `BuildingsPanel.tsx:212` convention).
  - For ships/defence the stepper resets to 1 immediately after dispatch to prevent stray repeat-clicks queueing another large batch.
- CTA disables itself based on the same conditions the existing panel buttons use:
  - **Buildings:** `!canAfford(cost)` || `!prerequisitesMet` || `maxFieldsReached` (see `BuildingsPanel.tsx:159-162`).
  - **Research:** `!canAfford(cost)` || `!prerequisitesMet`.
  - **Ships:** `qty < 1` || `!canAfford(qty * cost)` || `!prerequisitesMet`.
  - **Defence:** same as ships, plus already at `maxCount` (shield domes).

### QUEUE badges in the Level Progression table
A third badge state alongside NOW and NEXT:

| State | Meaning | Visual |
|---|---|---|
| NOW | `level === currentLevel` | Filled-accent badge, dark text. |
| QUEUE | level is currently in the build queue (one badge per queued instance) | Outline accent badge with a small `⏳` glyph; row tint slightly weaker than NEXT. |
| NEXT | `level === currentLevel + queuedCount + 1` | Outline accent badge. |

Implementation:
- `buildingProgression` / `researchProgression` accept the queue as an arg; each `LevelRow` gains `queued: boolean`.
- Visible range expands to `max(currentLevel + 3, nextLevel + 1)` so NEXT stays on screen with long queues.
- At most one of `current` / `queued` / `next` is true per row.

### Animation
CSS-only `@keyframes`, driven by the `data-state` attribute managed by the two-phase close described above.
- Backdrop: `opacity 0 → 1`, 180 ms ease-out (`data-state="open"`).
- Container: `opacity 0 → 1` + `scale(0.96 → 1)`, 200 ms ease-out (`data-state="open"`).
- Exit: same animations reversed, 150 ms (`data-state="closing"`).
- `onAnimationEnd` on the container fires only when `data-state="closing"`; it then clears `displayedCard` and unmounts.
- Tick-driven re-renders do not replay the entry animation: the modal DOM stays mounted with stable identity (no `key` tied to game state), and CSS animations only run when `data-state` changes. `React.memo` is **not** sufficient for this — it does not stop context-driven re-renders; the animation-replay safety comes from keeping `data-state` stable across non-open/non-closing renders.

### Focus management
- On open: focus the modal container; `role="dialog"`, `aria-modal="true"`, `aria-labelledby` → card name `<h2>`.
- The provider keeps `originRef = useRef<HTMLElement | null>(null)`. `open(type, id)` captures `document.activeElement` into `originRef.current` **only when the ref is null** — so prereq modal-to-modal navigation does not overwrite the original opener with an element inside the modal.
- `close()` only sets `selectedCard = null`. The ref is **not** cleared at close.
- After the exit animation completes the modal invokes the public `restoreFocus()` from `useModal()`. `restoreFocus` focuses `originRef.current` if it is still connected to the DOM (`isConnected` check) and focusable; falls back to `document.body` otherwise; then clears `originRef.current = null`.
- Inline focus trap — first/last focusable elements wrap on Tab. No external library.

### Edge cases
- No prereqs → render *"No prerequisites"* placeholder.
- No progression (ships/defence) → no Level Progression section, no Next Level block in the left column.
- `enablesFor()` empty → no Unlocks section.
- `getStrategicNote()` undefined → no Strategic Notes section.
- `solarSatellite` clicked from BuildingsPanel → opens with `cardType: 'ship'`; `cardStatsFor` adds the Energy/unit stat for this id.
- **Unknown card id** (corrupted save, version drift, prereq pointing at removed item): the modal looks up the definition with `?.` and renders an "Unavailable item — id `<id>` not found" placeholder body with a working close button. CTA is hidden. No throw, no blank screen.
- **Unknown prerequisite id** in another card's `requires`: handled at `prereqRowsFor` (see helper notes). Pill renders the raw id label with `target = null`, non-clickable, styled like an unmet pill but without the `↗` icon.

---

## Test Plan

### Unit tests — `src/utils/__tests__/cardDetails.test.ts`
- `cardStatsFor` per type, including solarSatellite's Energy/unit stat.
- `buildingBenefitAtLevel` for each category (mines, energy, storage, facilities) at low and high levels.
- `researchBenefitAtLevel` for representative items (weapons, computer, astrophysics).
- `buildingProgression` / `researchProgression` — range bounds, current/queued/next flags, range expansion under long queues, never below level 1.
- `enablesFor` — empty case, building → ships, research → defence, cross-type coverage.
- `maxAffordable` — affordable, unaffordable-at-1 returns 0, `maxCount` clamping (shield domes), zero-cost resources don't divide by zero, **`maxCount` clamping must include queued count** (e.g. `smallShieldDome` already in queue but not yet built → MAX = 0).
- `prereqRowsFor` — empty, mixed met/unmet, `target` field correct.

### Component tests — `src/components/CardDetailModal/__tests__/CardDetailModal.test.tsx`
One happy-path test per card type. GameContext actions (`upgradeBuilding`, `startResearchAction`, `buildShips`, `buildDefences`) are stubbed via `vi.fn()` and asserted with `toHaveBeenCalledWith(...)`.

1. **Building** (`metalMine`, Lv 7) — title, current level, Next Level block, level table NOW/NEXT, CTA fires `upgradeBuilding('metalMine')`, Escape closes, backdrop closes.
2. **Research** (`weaponsTechnology`, Lv 3) — stat grid `+30%`. **Prereq nav**: rendered through a `SpyModalProvider` test helper that constructs a fully controlled context value `{ selectedCard, open: vi.fn(), close: vi.fn(), restoreFocus: vi.fn() }` and passes it via `<ModalProvider value={value}>`. The provider's `value` prop (see ModalContext file row) bypasses the internal `useState`/`useRef` and uses the injected value verbatim, so the spies are the actual `open`/`close` consumers see. Click an unmet prereq pill, advance fake timers by ≥150 ms, assert `value.open` received `(target.type, target.id)` and that the inline "Navigating to …" toast appeared.
3. **Ship** (`cruiser`, two unmet prereqs) — stepper −/+/MAX (mock resources → expected qty), CTA label updates with qty, `buildShips('cruiser', N)` called.
4. **Defence** — `gaussCannon` happy path; **`smallShieldDome` already built** → MAX = 0, CTA disabled. Also assert `smallShieldDome` **already queued** (owned 0, in shipyard queue) → MAX = 0, CTA disabled (engine blocks `owned + queued + qty > maxCount`).

### Integration test — `src/test/integration/cardDetailModal.test.tsx`
The test asserts on rendered DOM, not on `gameState` directly (`<App />` does not expose state).

1. Render `<App />` with fresh game state on the Buildings panel.
2. `await user.click(screen.getByRole('button', { name: /metal mine/i }))` (the article has `role="button"`).
3. `await waitFor(() => expect(screen.getByRole('dialog', { name: /metal mine/i })).toBeInTheDocument())`.
4. Assert footer shows Lv 1 → Lv 2 cost.
5. `await user.click(screen.getByRole('button', { name: /upgrade to lv 2/i }))` (CTA inside the modal).
6. `await waitFor(() => expect(screen.getByRole('button', { name: /queue → lv 3/i })).toBeInTheDocument())` — CTA label flipped, queue is reflected.
7. Inside the modal, find Lv 2's row in the level table and assert the QUEUE badge is present (`getByText('QUEUE')`); find Lv 3's row and assert the NEXT badge.
8. Press Escape → modal closes (`waitForElementToBeRemoved`); the underlying Buildings panel is still rendered.

This trace exercises panel `onClick` wiring, ModalProvider state, GameContext action dispatch, queue-aware re-rendering on subsequent ticks, QUEUE badge logic, and Escape handler — without needing access to `gameState` internals.

### Test infra
- `ModalProvider` accepts an optional `value?: ModalContextValue` prop. When supplied, the provider skips its internal state/ref creation and renders `<ModalContext.Provider value={value}>` directly. This single hook makes spying clean and removes the need for any test-only context module.
- Extend `renderWithGame()` with optional `modal?: { selectedCard?: ... } | { value?: ModalContextValue }` arg. The simple form wraps in a real `<ModalProvider>` and lets tests pre-set `selectedCard`. The `value` form bypasses the provider internals and is what `SpyModalProvider` uses.
- A `<SpyModalProvider>` helper (`src/test/SpyModalProvider.tsx`) constructs a `value` of `{ selectedCard, open: vi.fn(), close: vi.fn(), restoreFocus: vi.fn() }` and exposes the spies via a forwarded ref or named export so test assertions can read them.
- Use vitest's `vi.useFakeTimers()` in tests that exercise the 150 ms prereq-nav delay; advance with `vi.advanceTimersByTime(150)`. Restore real timers in `afterEach`.
- No new test framework or library — vitest + @testing-library/react + user-event already present.

### Out of scope
- Visual regression / screenshot tests.
- Animation timing assertions.
- Accessibility audits beyond `role`/`aria-modal` (no axe-core in project).

---

## Implementation Sequencing (informational — actual plan in `docs/superpowers/plans/`)

A natural top-down order Codex can follow:

1. `src/data/strategicNotes.ts` — seed file with 10–15 entries.
2. `src/utils/cardDetails.ts` + unit tests.
3. `src/context/ModalContext.tsx`.
4. `src/components/CardDetailModal/*` (shell first, then LeftColumn, RightColumn, LevelTable, QuantityStepper, PrereqPills).
5. CSS additions in `src/styles.css`.
6. `src/App.tsx` wire-in.
7. Panel `onClick` / `onKeyDown` wiring (Buildings, Research, Shipyard, Defence) using the shared interactive-child guard; no per-element `stopPropagation`.
8. Component tests + integration test.
9. Manual smoke test in `npm run dev` — all four card types, prereq nav, MAX, queue reflection, QUEUE badges, Escape, backdrop, focus return.

---

## Open Risks / Considerations

- The active UI redesign plan (`docs/superpowers/plans/2026-04-19-ui-redesign.md`) is in flight and rewrites `src/styles.css`. If a redesign task lands during this work it could conflict on style additions. Mitigation: add modal CSS at the bottom of `styles.css` under a clear comment block; coordinate ordering with the redesign plan owner.
- `src/utils/cardDetails.ts` could grow past 300 lines. If it does, split into `cardStats.ts`, `cardProgression.ts`, `cardEnables.ts` after the first review.
- Solar Satellite has dual-presence (Buildings panel + Shipyard panel). Both card click handlers call `open('ship', 'solarSatellite')` — verify by hand that nothing in the existing code path breaks when the same modal is opened from two routes.
- Tick-driven re-renders: `useGameEngine()` calls `setGameState({ ...currentState })` every second (`src/hooks/useGameEngine.ts:391-396`, `455-456`). Any component reading `useGame()` will re-render — but CSS animations only replay if the modal DOM is unmounted/remounted or its `data-state` attribute changes. The two-phase close described in the Animation section keeps `data-state` stable across non-open/non-closing renders, so ticks should not cause flicker. `React.memo` does **not** help here (context-driven re-renders bypass it); the safety property is "stable `data-state` + stable mount". Verify by manually opening the modal and watching it across at least 5 ticks during smoke testing.

---

## References

- Design handoff: `design handoff/building cards/design_handoff_card_detail_modal/README.md`
- HTML prototype (reference only, do not ship): `design handoff/building cards/design_handoff_card_detail_modal/StarForge Modal Proposals.html`
- First Codex review (read-only): `docs/superpowers/specs/2026-04-30-card-detail-modal-codex-review.md`
- Second Codex review (read-only): `docs/superpowers/specs/2026-04-30-card-detail-modal-codex-review-2.md`
- Existing panel pattern: `src/panels/BuildingsPanel.tsx:165-220`
- Cost formulas: `src/engine/FormulasEngine.ts`
- Combat-stat scaling (raw vs effective): `src/engine/CombatEngine.ts:110-163`
- Shared queue type: `src/models/types.ts:77-88`
- Per-planet resources type: `src/models/Planet.ts:8-14`
- GameContext action signatures: `src/context/GameContext.tsx:80-83`
- Project conventions: `CLAUDE.md`
