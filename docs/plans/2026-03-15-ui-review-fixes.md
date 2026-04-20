# UI Review & Fixes — 2026-03-15

Full-pass UI review combining a Codex code review, a live Playwright UI tour, and a manual visual inspection. Findings from both Codex and Claude are consolidated here and ranked by impact.

---

## Quick Wins (S effort — fix in one sitting)

### 1. Energy widget misleads players (`ResourceBar.tsx`, `styles.css`)

**Problem:** `1,333 / 643` uses the same `value / cap` visual grammar as resources, so it reads as "production is over cap" — alarming and backwards. The larger number comes first, which inverts every other widget.

**Fix:** Change the label to `Prod / Use`, add a net line (`+690` surplus or `-N` deficit in red), and tint the energy dot green (surplus) or red (deficit). Remove the generic `production / consumption` subtext.

---

### 2. Solar Satellite stat row contradicts its own description (`ShipyardPanel.tsx`, `BuildingsPanel.tsx`)

**Problem:** The card reads *"Cannot move or fight"* then immediately shows `ATK 1  SHD 1  HULL 2000  SPD 0  CARGO 0`. Players scan stat rows first — `ATK 1` directly contradicts the description.

**Fix:** On both the Shipyard and Buildings panel cards, replace the full combat stat row with a satellite-specific row: `Energy: 29/sat  HULL 2000`. The ATK/SHD stats exist in the engine for combat purposes (cannon fodder) but should not be surfaced in the build UI.

---

### 3. Disabled card states are ambiguous (`BuildingsPanel.tsx`, `ResearchPanel.tsx`, `ShipyardPanel.tsx`, `DefencePanel.tsx`)

**Problem:** "Locked", "Owned: 5" + "Locked", "Maximum built" + greyed button — these states all look similar. Players can't tell if they're missing a prereq, can't afford it, or have already maxed it.

**Fix:** Use explicit disabled reasons as small text beneath the button:
- `Prerequisites not met` (prereqs fail)
- `Insufficient resources` (already shown with red costs — keep as-is)
- `Maximum built` (shield domes, unique items)
- Remove the confusing "Owned: N" + "Locked" co-existence by only showing Locked if the item is both unmet on prereqs AND not yet owned

---

### 4. Fleet preview irrelevant for non-attack missions (`FleetPanel.tsx`)

**Problem:** Cargo ship rows (Small Cargo, Large Cargo) appear in the ship selection list for Espionage and Attack missions where cargo is irrelevant. Players may wonder if they should include cargo ships.

**Fix:** Filter ship rows shown by mission type. Espionage: probes only. Attack: combat ships + cargo optional. Colonise: colony ship required. Transport/Deploy: cargo ships prominent.

---

### 5. Mission countdown rAF loop — one per row (`useCountdown.ts`, `FleetPanel.tsx`, `useNow.ts`)

**Problem:** Each active mission row runs its own `requestAnimationFrame` loop with `setState`, firing ~60×/sec per row. The UI only needs 1-second precision.

**Fix:** Replace per-row rAF with the existing `useNow` hook (already 1s precision) or a single shared `setInterval(1000)`. One global clock for all rows.

---

## Medium Effort (M — one focused session each)

### 6. Queue state not visible inside panels (`BuildingsPanel.tsx`, `ResearchPanel.tsx`, `ShipyardPanel.tsx`, `DefencePanel.tsx`, `QueueDisplay.tsx`)

**Problem:** Queue visibility is fragmented. Players start a build from the Buildings panel but must go to Overview or the global queue display to see progress, time remaining, or cancel. Cross-panel scanning adds friction.

**Fix:** Add a compact inline queue block at the top of each panel showing: current item + progress bar + time remaining + cancel button. The global queue remains, but panels become self-sufficient.

---

### 7. Fleet panel idle state is inert (`FleetPanel.tsx`, `GalaxyPanel.tsx`)

**Problem:** Before a target is selected, the Fleet panel shows zeroed-out stats (Speed 0, ETA --, Distance 0) and a disabled dispatch button. It teaches the flow via a small hint text, but feels like a dead end.

**Fix:** Replace zeroed preview with a visual step guide:
> 1. Choose a mission type
> 2. Select a target in the Galaxy panel
> 3. Assign ships

Add a prominent **Open Galaxy →** button. Hide the speed/ETA/distance rows entirely until a target is chosen.

---

### 8. Score panel exposes two conflicting models (`StatisticsPanel.tsx`, `ScoreEngine.ts`, `useGameEngine.ts`)

**Problem:** `Military: 8,906` (recomputed from current state) and `Fleet: 0 / Defence: 0 / Buildings: 0` (accumulated lifetime — not updated by admin injection) sit in the same table, making it look broken.

**Fix:** Either:
- (A) Recompute all score categories from current state — consistent but loses historical context
- (B) Split into two tables: *"Current Power"* (recomputed) and *"Lifetime Score"* (accumulated) with a clear label explaining the difference

Option B is more informative and matches OGame conventions.

---

### 9. Fleet movement bar shows wrong arrow for returning missions (`Fleet.ts`, `useGameEngine.ts`, `FleetMovementsBar.tsx`)

**Problem:** `FleetMovement.direction` only allows `'outgoing'`. `deriveFleetMovements()` hardcodes it regardless of mission status. Returning fleets show an outbound arrow.

**Fix:** Add `'returning'` to the direction union. Derive direction from `mission.status === 'returning'`. Update `FleetMovementsBar` to render the correct arrow and label per direction.

---

### 10. Research panel has no visual depth for tech trees (`ResearchPanel.tsx`)

**Problem:** All 15 tech cards look identical regardless of lock depth. A player working toward Plasma Technology (4 techs deep) gets no visual signal of the chain they're building through.

**Fix:** Add a subtle visual treatment for techs that are multiple prerequisites away: slightly reduced opacity or a "locked chain" icon. Met-prereq techs get a faint green tint on the card edge. This makes the tree legible at a glance without restructuring the layout.

---

### 11. Messages panel has no empty-state guidance (`MessagesPanel.tsx`)

**Problem:** Three empty tabs look like unfinished scaffolding. There's no indication of how to generate messages.

**Fix:** Add contextual empty states per tab:
- **Combat:** *"No battles yet. Raid an NPC colony from the Galaxy panel."*
- **Espionage:** *"No spy reports yet. Send probes from the Galaxy panel."*
- **Fleet:** *"Completed mission logs will appear here."*

Also add the panel artwork banner (currently missing from Messages — the only panel without one).

---

### 12. Galaxy intel requires hover discovery (`GalaxyPanel.tsx`, `HoverPortal.tsx`)

**Problem:** Spy report intel is hover-only, which is non-discoverable and unavailable on touch devices.

**Fix:** When a recent spy report exists for an NPC slot, show a small inline strip on the row: scan age badge, resource icons, rebuilding indicator. Keep the hover panel for full detail.

---

## Larger Effort (L — requires design decision + multi-file changes)

### 13. Solar Satellite identity conflict across systems (`ships.ts`, `CombatEngine.ts`, `GalaxyEngine.ts`, `BuildingsPanel.tsx`, `ShipyardPanel.tsx`)

**Problem:** Solar Satellites present as energy infrastructure in Buildings, as a ship with combat stats in Shipyard, and participate in combat as cannon fodder. The presentation ambiguity reflects real engine ambiguity — NPC generation and combat normalization treat them like armed ships.

**Note:** The cannon fodder role is **intentional by design**. The problem is purely presentational — the UI should communicate this clearly rather than hiding or contradicting it.

**Fix options:**
- (A) Add a tooltip/note on the Shipyard card: *"Participates in combat as a defensive shield for your fleet. Cannot attack."* Replace `ATK 1` with `—` and add a `SHIELD BODY` label
- (B) Move Satellites out of the ship grid into their own "Orbital Infrastructure" section in Shipyard, separate from combat ships

Option A is lighter. Option B is cleaner long-term.

---

### 14. Panel banners reduce content density on small screens (`styles.css`, all panel components)

**Problem:** Every panel begins with ~200px of artwork before any interactive content. On a 768px screen this is 26% of vertical space before the first actionable element.

**Fix:** Consider a sticky-on-scroll or collapsible banner, or a shorter variant (100px) for content-dense panels (Buildings, Research, Shipyard, Defence). Gallery/exploration panels (Galaxy, Fleet) can retain the full banner.

---

### 15. Settings panel is under-utilised

**Problem:** Three buttons, one number input, and a textarea. The panel has the same chrome as every other full panel but almost nothing in it.

**Fix:** Consolidate player-facing settings here:
- Number formatting (K/M abbreviations vs full)
- Notification preferences (when queue completes)
- Theme or layout density toggle
- "Max Probes" and other per-feature limits

---

## Implementation Priority

| Phase | Items | Goal |
|-------|-------|------|
| **Quick pass** | #1, #2, #3, #4, #5 | Eliminate active misreadings and a perf issue. All S effort. |
| **UX pass** | #6, #7, #8, #9, #10, #11 | Make panels feel self-contained and feedback-rich. M effort each. |
| **Polish pass** | #12, #13, #14, #15 | Consistency and design cohesion. Requires decisions. |

---

*Sources: Codex full code review (2026-03-15) + Playwright UI tour (2026-03-15) + manual visual review*
