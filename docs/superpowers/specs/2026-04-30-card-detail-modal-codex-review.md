**Architectural Soundness**

- [SHOULD-FIX] The `ModalContext` split fits the codebase. `GameContext` is already broad and tick-driven, so keeping transient UI selection out of it is sound. `App.tsx:107-111` currently has only `GameProvider`; adding `ModalProvider` under it matches the existing provider pattern.
- [SHOULD-FIX] The tick re-render risk is overstated in the spec. `useGameEngine()` calls `setGameState({ ...currentState })` on ticks (`src/hooks/useGameEngine.ts:391-396`, `455-456`), and any modal using `useGame()` will re-render, but CSS entry animations should not replay unless the modal DOM is remounted or `data-state` changes. Smallest mitigation: keep the modal shell mounted for the open card and do not key it on `gameState`; split animated shell from game-state content if needed. `React.memo` alone will not stop context-driven re-renders.
- [SHOULD-FIX] Storing the originating `HTMLElement` as ModalContext state (`docs/...modal-design.md:62`, `242-244`) is heavier than needed and risks stale detached elements. A provider/modal `useRef` capturing `document.activeElement` at open time is cleaner. React 19 does not provide native focus return/trap behavior, so this still needs explicit ref-based handling.

**Data Shape / Type Fidelity**

- [BLOCKER] The spec names non-existent queue/resource types: `BuildingQueueItem`, `ResearchQueueItem`, and `PlanetResources` (`docs/...modal-design.md:117-135`). The correct queue type is the shared `QueueItem` (`src/models/types.ts:77-88`). The planet resource type is `ResourcesState` (`src/models/Planet.ts:8-14`).
- [BLOCKER] Two GameContext action names are wrong. Existing signatures are `upgradeBuilding(id)`, `startResearchAction(id)`, `buildShips(id, qty)`, and `buildDefences(id, qty)` (`src/context/GameContext.tsx:80-83`). The spec’s `startResearch(id)` and `buildDefence(id, qty)` (`docs/...modal-design.md:204-207`) will not compile against context.
- [SHOULD-FIX] Cost/time helper signatures are mostly correct: `buildingCostAtLevel(baseCost, multiplier, level)`, `researchCostAtLevel(baseCost, multiplier, level)`, `buildingTime(metalCost, crystalCost, roboticsLevel, naniteLevel, gameSpeed)`, `researchTime(metalCost, crystalCost, labLevel, gameSpeed)`, and `shipBuildTime(structuralIntegrity, shipyardLevel, naniteLevel, gameSpeed)` (`src/engine/FormulasEngine.ts:66-130`). Defence should use `defenceBuildTime`, which is an alias of `shipBuildTime` (`src/engine/FormulasEngine.ts:130`).

**Existing-Code Intersections**

- [SHOULD-FIX] Research queue handling needs sharper wording. The queue is global (`src/models/GameState.ts:50-51`) and each item carries `sourcePlanetIndex` (`src/models/types.ts:82-83`; `src/engine/BuildQueue.ts:226-250`). `ResearchPanel` renders the global queue (`src/panels/ResearchPanel.tsx:87-110`) and counts queued levels by `id` only (`src/panels/ResearchPanel.tsx:136-158`). For progression/NEXT level, filtering by `id + sourcePlanetIndex` would be wrong; use `sourcePlanetIndex` only to identify/display which planet paid or for lab timing.
- [BLOCKER] Solar Satellite’s inline quantity input will conflict with article-level click/key handlers unless the input/form area also stops propagation or the article handler ignores interactive targets. The card article is at `src/panels/BuildingsPanel.tsx:230`, the input is `257-271`, and the build button is `286-294`. Stopping only the button, as the spec says (`docs/...modal-design.md:80`, `180`), means clicking the input can also open the modal.
- [SHOULD-FIX] `HoverPortal` should not be reused for the modal container. It requires an anchor ref and implements hover positioning (`src/components/HoverPortal.tsx:24-32`, `105-136`). A modal needs backdrop, focus management, and centered fixed layout. Existing portal code can be a pattern only; direct `createPortal` is appropriate.

**Pure Helper API**

- [SHOULD-FIX] `cardStatsFor(type, id, state)` is broad but defensible only if stats are “effective” stats. Combat stats do depend on research in combat: attack/shield/hull are scaled by weapons/shielding/armour tech (`src/engine/CombatEngine.ts:110-129`, `148-163`). If the modal intends static card stats like current panels, pass narrower inputs such as planet plus research or explicitly document raw vs effective stats.
- [SHOULD-FIX] `buildingBenefitAtLevel(id, level, state)` can pull fusion energy tech from `state.research.energyTechnology` (`src/models/GameState.ts:50`; `src/engine/FormulasEngine.ts:32-35`). It also needs the active planet temperature for deuterium output, so the state dependency is not just fusion-related.
- [NIT] `enablesFor(type, id)` returning all static unlocks is okay because `UnlockEntry` includes `atLevel` (`docs/...modal-design.md:129-131`). An optional level/currentLevel filter would be convenient but is not required.
- [SHOULD-FIX] `prereqRowsFor` should defensively handle unknown prerequisite ids. `Prerequisite.id` is just `string` (`src/models/types.ts:15-18`), so direct map indexing can crash on bad data/version drift.

**Edge Cases Missing**

- [SHOULD-FIX] Unknown selected card ids are not handled. Since modal ids are strings (`docs/...modal-design.md:43`, `106`) but data maps are runtime objects, the modal needs a graceful “unavailable item” path instead of assuming every id exists.
- [NIT] Future surfaces for `espionageProbe`, `recycler`, and `colonyShip` should route as `ship`; they are valid `ShipId`s (`src/models/types.ts:52-65`) and already appear in `SHIP_ORDER` (`src/data/ships.ts:316-329`). This is mostly covered if callers pass `open('ship', id)`.
- [BLOCKER] Exit animation conflicts with the stated ModalContext shape. If `close()` immediately sets `selectedCard` to `null` (`docs/...modal-design.md:43`), the modal has no card to render during the `closing` state. The spec later requires delayed unmount via `data-state="open|closing"` and `onAnimationEnd` (`docs/...modal-design.md:239`). It needs a retained closing card or local shell state.
- [SHOULD-FIX] Prereq navigation timeouts can stack. The spec schedules `open()` after ~150 ms (`docs/...modal-design.md:191-192`) but does not say to cancel prior timers on another click/unmount, so rapid clicks can navigate to a stale target.

**Test Plan Gaps**

- [SHOULD-FIX] The integration test cannot simply assert `gameState.planets[0].buildingQueue.length === 1` after rendering `<App />` unless it installs a test probe. Real actions mutate and call `syncReactState()` (`src/hooks/useGameEngine.ts:475-481`), but `App` does not expose `gameState`. Prefer asserting the rendered queue/modal state with `await user.click(...)` and `waitFor`.
- [SHOULD-FIX] “Spy on `useModal().open`” is not achievable with a real `ModalProvider` as described (`docs/...modal-design.md:269-284`). The test needs either a mocked modal context/provider with spy actions, or it should use the real provider and assert the navigated modal content after advancing the 150 ms timer.
- [SHOULD-FIX] Existing `renderWithGame()` currently only wraps `GameContext` (`src/test/test-utils.tsx:203-233`). Extending it for modal tests is reasonable, but tests that use real modal navigation need fake timers or async waits because prereq navigation is delayed.

**CSS & Styles**

- [NIT] Putting modal CSS at the bottom of `src/styles.css` matches the current project convention: the redesign plan centralizes “design tokens + all class rules” there (`docs/...ui-redesign.md:7`, `18`). A component-local CSS file would reduce merge conflicts, but it would introduce a new styling convention. Given Task 17 still has an unchecked visual smoke step (`docs/...ui-redesign.md:1212-1233`), bottom-of-file namespaced CSS is acceptable if coordinated.

**Process / CLAUDE.md Compliance**

- [SHOULD-FIX] The spec largely aligns with CLAUDE.md’s engine/UI boundary and data-driven rules: helpers stay outside engine, formulas remain pure, and GameState remains the source of game state (`CLAUDE.md:83-86`). Modal UI state outside GameState does not violate the single-state-object rule.
- [SHOULD-FIX] It partially misses the research queue gotcha. CLAUDE.md explicitly says research queue is global and items carry `sourcePlanetIndex` (`CLAUDE.md:144`); the spec should state id-only queue counting for global research progression and sourcePlanetIndex only for payer/timing context.
- [SHOULD-FIX] It captures the Solar Satellite gotcha conceptually (`CLAUDE.md:141`), but the energy formula should clamp/guard exactly like the gotcha: `Math.max(0, Math.floor((maxTemperature + 140) / 6))`, with `Number.isFinite`, not just raw `Math.floor(...)` (`docs/...modal-design.md:21`, `150`).

Overall: the spec is close architecturally, but not ready to convert directly into an implementation plan. The compile-breaking API/type mismatches, Solar Satellite event bubbling, research queue semantics, and exit-animation lifecycle need to be fixed first; the remaining issues are mostly clarifications that will prevent brittle helpers and tests.