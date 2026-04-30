- **RESOLVED**: ModalContext split from GameContext. Fix lives in `Architecture` and `File List` for `src/context/ModalContext.tsx`.

- **RESOLVED**: Tick re-render / animation concern. Fix lives in `Animation` and `Open Risks / Considerations`, especially the stable mount + stable `data-state` wording.

- **PARTIALLY RESOLVED**: Origin focus element storage. The spec now uses `useRef` in `Architecture` and `Focus management`, but `Closing` says `close()` clears the ref before post-animation `restoreFocus()`, which defeats focus return.

- **RESOLVED**: Non-existent queue/resource types. Fix lives in `Pure Helpers`: `QueueItem[]` and `ResourcesState` are named correctly.

- **RESOLVED**: Wrong GameContext action names. Fix lives in `CTA dispatch`: `startResearchAction` and `buildDefences` are now correct.

- **RESOLVED**: Cost/time helper signatures. Fix lives in `Pure Helpers > Build-time helpers used by the modal`, including `defenceBuildTime`.

- **RESOLVED**: Research queue semantics. Fix lives in `Pure Helpers`, `buildingProgression` / `researchProgression` notes: research queue is filtered by `id` only.

- **PARTIALLY RESOLVED**: Solar Satellite input/button bubbling. Fix lives in `Modified files` and `Opening`, but the proposed `closest()` guard includes `[role="button"]` while the article itself also gets `role="button"`, so it self-matches and blocks all card clicks. The keydown path also does not explicitly guard interactive children.

- **RESOLVED**: HoverPortal misuse. The revised spec creates a dedicated `CardDetailModal` shell and no longer proposes reusing `HoverPortal`.

- **RESOLVED**: `cardStatsFor` raw vs effective stats. Fix lives in `Pure Helpers` notes: raw datasheet stats are explicitly documented.

- **RESOLVED**: `buildingBenefitAtLevel` state dependencies. Fix lives in `Pure Helpers` and `Building benefit mapping`, including temperature, energy tech, and plasma bonuses.

- **RESOLVED**: Unknown prerequisite ids. Fix lives in `Pure Helpers > prereqRowsFor` and `Edge cases`.

- **RESOLVED**: Unknown selected card ids. Fix lives in `Edge cases`: unavailable item placeholder, hidden CTA, no throw.

- **RESOLVED**: Exit animation losing card data. Fix lives in `Architecture`, `Closing`, and `Animation` via local `displayedCard`.

- **RESOLVED**: Prereq navigation timer stacking. Fix lives in `Prereq pill navigation`: timer ref, clear before reschedule, cleanup on unmount.

- **RESOLVED**: Integration test asserting private `gameState`. Fix lives in `Integration test`: assertions are DOM-based.

- **PARTIALLY RESOLVED**: Spying on `useModal().open`. Fix is attempted in `Component tests` and `Test infra`, but the described `SpyModalProvider` is still underspecified and likely brittle unless the modal context supports injected values or exposes a test hook point.

- **RESOLVED**: `renderWithGame()` modal wrapping / fake timers. Fix lives in `Test infra`.

- **RESOLVED**: CLAUDE.md engine/UI boundary. Fix lives in `Architecture` and `Pure Helpers`; no engine changes are proposed.

- **RESOLVED**: CLAUDE.md research queue gotcha. Fix lives in `Pure Helpers` queue notes.

- **RESOLVED**: Solar Satellite guarded energy formula. Fix lives in `Decisions Locked #5` and `cardStatsFor` notes.

**Fresh-Eyes Findings**

- The `closest()` guard is not viable as written. Because the article itself is assigned `role="button"`, `event.target.closest('..., [role="button"]')` returns the article for normal card clicks, so the modal never opens.

- The same interactive-child guard needs to apply to `onKeyDown`, not just `onClick`; otherwise Enter/Space from nested inputs/buttons can bubble to the article handler.

- `Implementation Sequencing` still says “button `stopPropagation`”, contradicting the earlier “without per-element `stopPropagation`” guard approach.

- Focus management has a lifecycle contradiction: `close()` clears the captured ref, but `restoreFocus()` is supposed to run after the exit animation. Also, prereq modal-to-modal navigation would overwrite the original trigger with an element inside the modal unless `open()` preserves the original focus ref during internal navigation.

- `restoreFocus()` is mentioned in `Focus management`, but the `ModalContext` public surface is otherwise specified as only `selectedCard`, `open`, and `close`.

- `SpyModalProvider` is not concrete enough. Wrapping the real provider and spying on its internal `open` function may not intercept event-handler closures unless the context value is injected before consumers render. The spec also asks `renderWithGame()` to accept an initial `selectedCard`, but `ModalProvider` props do not specify such an initializer.

- Defence `maxCount` handling misses queued domes. The engine blocks `owned + queued + quantity > maxCount`; the spec’s `maxAffordable(... currentCount)` and tests only cover “already built”, not “already queued”.

- Research cards currently use `research-card`, not `item-card`. The spec’s summary says all target cards are `<article className="item-card">`, so an implementation plan that follows that literally could miss ResearchPanel.

**Verdict**

Not quite ready to convert into an implementation plan. The smallest additional change is a targeted correction pass, not a rewrite: fix the article guard so it does not self-match and covers keydown, make the focus-ref lifecycle internally consistent, define the test modal provider/initial-state hook precisely, and state that defence caps include queued units.