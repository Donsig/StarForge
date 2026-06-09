# Graph Report - .  (2026-06-09)

## Corpus Check
- 176 files · ~310,877 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 871 nodes · 2589 edges · 46 communities (37 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.87)
- Token cost: 123,090 input · 6,037 output

## Community Hubs (Navigation)
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_Espionage & Galaxy Data|Espionage & Galaxy Data]]
- [[_COMMUNITY_Fleet & Ship Engine|Fleet & Ship Engine]]
- [[_COMMUNITY_Combat Engine|Combat Engine]]
- [[_COMMUNITY_Galaxy Engine & State Manager|Galaxy Engine & State Manager]]
- [[_COMMUNITY_Resource System|Resource System]]
- [[_COMMUNITY_UI Package Dependencies|UI Package Dependencies]]
- [[_COMMUNITY_NPC Upgrade Engine|NPC Upgrade Engine]]
- [[_COMMUNITY_Game Context & UI|Game Context & UI]]
- [[_COMMUNITY_Assets & Artwork System|Assets & Artwork System]]
- [[_COMMUNITY_Production Sampling & Scoring|Production Sampling & Scoring]]
- [[_COMMUNITY_Overview Panel|Overview Panel]]
- [[_COMMUNITY_Fleet Models & Notifications|Fleet Models & Notifications]]
- [[_COMMUNITY_TypeScript App Config|TypeScript App Config]]
- [[_COMMUNITY_Fleet Movement & Planet UI|Fleet Movement & Planet UI]]
- [[_COMMUNITY_TypeScript Node Config|TypeScript Node Config]]
- [[_COMMUNITY_Fleet Movement Bar|Fleet Movement Bar]]
- [[_COMMUNITY_Admin Panel|Admin Panel]]
- [[_COMMUNITY_Statistics & Rankings Panel|Statistics & Rankings Panel]]
- [[_COMMUNITY_Notification Context|Notification Context]]
- [[_COMMUNITY_Toast Notifications|Toast Notifications]]
- [[_COMMUNITY_Build Queue & Planet Models|Build Queue & Planet Models]]
- [[_COMMUNITY_Fleet Mission Models|Fleet Mission Models]]
- [[_COMMUNITY_Game Module Index|Game Module Index]]
- [[_COMMUNITY_State Migration Tests|State Migration Tests]]
- [[_COMMUNITY_Asset Image Data|Asset Image Data]]
- [[_COMMUNITY_Messages Panel|Messages Panel]]
- [[_COMMUNITY_Time Formatting Hooks|Time Formatting Hooks]]
- [[_COMMUNITY_Navigation Sidebar|Navigation Sidebar]]
- [[_COMMUNITY_UI Component Tests|UI Component Tests]]
- [[_COMMUNITY_Settings Panel & Toggle|Settings Panel & Toggle]]
- [[_COMMUNITY_Notification Observer Hooks|Notification Observer Hooks]]
- [[_COMMUNITY_Activity Feed & Fleet Tests|Activity Feed & Fleet Tests]]
- [[_COMMUNITY_Cursor Tooltip|Cursor Tooltip]]
- [[_COMMUNITY_Asset Conversion Scripts|Asset Conversion Scripts]]
- [[_COMMUNITY_Time Utilities & Countdown|Time Utilities & Countdown]]
- [[_COMMUNITY_NPC Economy Tests|NPC Economy Tests]]
- [[_COMMUNITY_Test Setup & Mocks|Test Setup & Mocks]]
- [[_COMMUNITY_TypeScript Root Config|TypeScript Root Config]]
- [[_COMMUNITY_Fleet Movements Bar Spec|Fleet Movements Bar Spec]]
- [[_COMMUNITY_Solar Satellite Concept|Solar Satellite Concept]]
- [[_COMMUNITY_Galaxy Engine Module|Galaxy Engine Module]]
- [[_COMMUNITY_UI Redesign Plan|UI Redesign Plan]]

## God Nodes (most connected - your core abstractions)
1. `GameState` - 45 edges
2. `useGame()` - 40 edges
3. `createNewGameState()` - 36 edges
4. `calculateProduction()` - 31 edges
5. `Coordinates` - 26 edges
6. `createDefaultPlanet()` - 24 edges
7. `Asset Map` - 23 edges
8. `GameContextType` - 22 edges
9. `SHIPS` - 21 edges
10. `processTick()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `UI Review & Fixes` --references--> `Asset Map`  [INFERRED]
  docs/plans/2026-03-15-ui-review-fixes.md → src/data/assets.ts
- `Artwork System Implementation Plan` --implements--> `Asset Map`  [EXTRACTED]
  docs/plans/2026-03-07-artwork-implementation.md → src/data/assets.ts
- `Asset Map` --references--> `Buildings Panel Banner`  [EXTRACTED]
  src/data/assets.ts → public/assets/panels/buildings.webp
- `Asset Map` --references--> `Cold Planet Icon`  [EXTRACTED]
  src/data/assets.ts → public/assets/planets/cold-icon.webp
- `Asset Map` --references--> `Cold Planet Portrait`  [EXTRACTED]
  src/data/assets.ts → public/assets/planets/cold.webp

## Import Cycles
- None detected.

## Communities (46 total, 9 thin omitted)

### Community 0 - "UI Components"
Cohesion: 0.05
Nodes (76): CardImage(), CardImageProps, CostDisplay(), CostDisplayProps, LevelRing(), LevelRingProps, PanelBanner(), PanelBannerProps (+68 more)

### Community 1 - "Espionage & Galaxy Data"
Cohesion: 0.06
Nodes (58): GALAXY_CONSTANTS, calcDetectionChance(), calcNPCEspionageLevel(), createReportId(), generateReport(), ResearchState, addDebris(), adminAddNPC() (+50 more)

### Community 2 - "Fleet & Ship Engine"
Cohesion: 0.06
Nodes (60): CombatShipId, ShipDrive, applyNpcLosses(), calcCargoCapacity(), calcDistance(), calcFleetSpeed(), calcFuelCost(), calcLoot() (+52 more)

### Community 3 - "Combat Engine"
Cohesion: 0.07
Nodes (42): RAPID_FIRE, accumulateLosses(), addScaledStat(), applyDefenceRebuild(), applyShot(), averageLosses(), buildDefenceUnits(), buildShipUnits() (+34 more)

### Community 4 - "Galaxy Engine & State Manager"
Cohesion: 0.09
Nodes (34): accrueNpcResources(), createNPCProductionPlanet(), accrueNpcResourcesForState(), attachLoadMetadata(), buildCatchUpEntries(), clampActivePlanetIndex(), createDefaultNotificationSettings(), createLegacyNpcProductionPlanet() (+26 more)

### Community 5 - "Resource System"
Cohesion: 0.21
Nodes (26): ResourceBar(), useHoverTimer(), BASE_PRODUCTION, BASE_STORAGE, crystalMineEnergy(), crystalProductionPerHour(), deuteriumProductionPerHour(), deuteriumSynthEnergy() (+18 more)

### Community 6 - "UI Package Dependencies"
Cohesion: 0.06
Nodes (32): dependencies, react, react-dom, devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh (+24 more)

### Community 7 - "NPC Upgrade Engine"
Cohesion: 0.15
Nodes (28): applyUpgradeIncrement(), balancedActions(), buildingAction(), calcAbandonmentProximity(), canAfford(), computeEffectiveMinTier(), countRecentRaids(), debit() (+20 more)

### Community 8 - "Game Context & UI"
Cohesion: 0.13
Nodes (20): MovementRowProps, GameContext, GameContextType, GameProvider(), GameProviderProps, SystemSlot, ProductionRates, CatchUpBatch (+12 more)

### Community 9 - "Assets & Artwork System"
Cohesion: 0.08
Nodes (25): Artwork System Implementation Plan, StarForge Artwork Prompts, Asset Map, Buildings Panel Banner, Cold Planet Icon, Cold Planet Portrait, Crystal Mine Artwork, Defence Panel Banner (+17 more)

### Community 10 - "Production Sampling & Scoring"
Cohesion: 0.15
Nodes (16): sampleProduction(), computePlayerScores(), ECONOMY_BUILDINGS, NON_COMBAT_SHIP_IDS, MissionType, DebrisField, GalaxyState, GameState (+8 more)

### Community 11 - "Overview Panel"
Cohesion: 0.10
Nodes (15): ACTIVITY_CONFIG, ActivityEntry(), ActivityFeedEntry, ActivityFeedType, clamp01(), FieldRingProps, getMissionProgress(), IncomingAlertProps (+7 more)

### Community 12 - "Fleet Models & Notifications"
Cohesion: 0.14
Nodes (12): CombatLogEntry, EspionageReport, FleetNotification, baseFleetNotification, CatchUpBatch, LoadResult, buildMockGameContext(), CatchUpBatch (+4 more)

### Community 13 - "TypeScript App Config"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+13 more)

### Community 14 - "Fleet Movement & Planet UI"
Cohesion: 0.17
Nodes (15): FleetMovementsBar(), PlanetSwitcher(), QueueDisplay(), useGame(), useNotificationObserver(), DefencePanel(), MessagesPanel(), ResearchPanel() (+7 more)

### Community 15 - "TypeScript Node Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+11 more)

### Community 16 - "Fleet Movement Bar"
Cohesion: 0.18
Nodes (14): clamp01(), formatCountdownFromNow(), formatRouteCoords(), getMissionTypeClass(), getMissionTypeLabel(), getMovementProgress(), getStatusClass(), getStatusLabel() (+6 more)

### Community 17 - "Admin Panel"
Cohesion: 0.15
Nodes (11): AdminPanel(), AdminTab, clampInt(), COMBAT_SHIPS, combatSummaryLabel(), createInputState(), NPC_SPECIALTY_OPTIONS, ResourceKey (+3 more)

### Community 18 - "Statistics & Rankings Panel"
Cohesion: 0.15
Nodes (5): SORTABLE_COLUMNS, SortableColHeader, SortKey, ProductionHistory, StatisticsV16

### Community 19 - "Notification Context"
Cohesion: 0.33
Nodes (9): MessageTab, NotificationContext, NotificationContextValue, NotificationProvider(), NotificationProviderProps, ToastItem, ToastType, useNotifications() (+1 more)

### Community 20 - "Toast Notifications"
Cohesion: 0.24
Nodes (5): Toast(), ToastProps, ToastContainer(), NotificationContextValue, ToastItem

### Community 21 - "Build Queue & Planet Models"
Cohesion: 0.24
Nodes (9): CompletionEvent, LegacyGameState, LegacyPlanetState, BuildingLevels, DefenceCounts, PlanetState, ShipCounts, QueueItem (+1 more)

### Community 22 - "Fleet Mission Models"
Cohesion: 0.29
Nodes (7): FleetMission, MovementDirection, NpcRaidEntry, PlayerMovementEntry, Coordinates, NPCAbandonmentProximity, NPCAbandonmentStatus

### Community 23 - "Game Module Index"
Cohesion: 0.18
Nodes (11): Build Queue, Combat Engine, Fleet Engine, Formulas Engine, Game Context, Game Engine, Game State, localStorage (+3 more)

### Community 24 - "State Migration Tests"
Cohesion: 0.18
Nodes (6): GameSettingsV17, GameStateV15, NotificationSettings, NPCColonyV18Shape, ProductionHistory, StatisticsV16

### Community 25 - "Asset Image Data"
Cohesion: 0.38
Nodes (8): BUILDING_IMAGES, DEFENCE_IMAGES, getPlanetImageUrl(), getPlanetType(), PANEL_IMAGES, PlanetType, RESEARCH_IMAGES, SHIP_IMAGES

### Community 26 - "Messages Panel"
Cohesion: 0.31
Nodes (7): CombatCard(), CoordsLink(), EspionageCard(), FleetCard(), formatCoords(), formatTimeAgo(), MessageTab

### Community 27 - "Time Formatting Hooks"
Cohesion: 0.25
Nodes (6): useNow(), formatPlanetTypeLabel(), formatTemperature(), getMissionColor(), hasMissionCargo(), OverviewPanel()

### Community 28 - "Navigation Sidebar"
Cohesion: 0.32
Nodes (6): ADMIN_NAV_ITEM, MAIN_NAV_ITEMS, NavSidebar(), NavSidebarProps, QueueDisplayProps, ActivePanel

### Community 29 - "UI Component Tests"
Cohesion: 0.32
Nodes (5): renderWithGame(), renderFleetTab(), makeNotifications(), NotificationSettings, renderSettings()

### Community 31 - "Notification Observer Hooks"
Cohesion: 0.52
Nodes (6): formatCombatMessage(), formatCoords(), formatEspionageMessage(), formatFleetMessage(), getCombatOutcomeLabel(), titleCaseMission()

### Community 32 - "Activity Feed & Fleet Tests"
Cohesion: 0.38
Nodes (5): buildActivityEntries(), getMissionRouteLabel(), getMissionTargetLabel(), formatCoords(), missionShipManifest()

### Community 33 - "Cursor Tooltip"
Cohesion: 0.40
Nodes (3): CursorTooltip(), CursorTooltipProps, DEFAULT_OFFSET

### Community 34 - "Asset Conversion Scripts"
Cohesion: 0.33
Nodes (5): height, outDir, resolvedInput, resolvedOutput, width

## Knowledge Gaps
- **217 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+212 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GameState` connect `Production Sampling & Scoring` to `UI Components`, `Espionage & Galaxy Data`, `Fleet & Ship Engine`, `Galaxy Engine & State Manager`, `Resource System`, `NPC Upgrade Engine`, `Game Context & UI`, `Overview Panel`, `Fleet Models & Notifications`, `Build Queue & Planet Models`, `Fleet Mission Models`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `useGame()` connect `Fleet Movement & Planet UI` to `UI Components`, `Espionage & Galaxy Data`, `Fleet & Ship Engine`, `Resource System`, `Game Context & UI`, `Overview Panel`, `Fleet Movement Bar`, `Admin Panel`, `Statistics & Rankings Panel`, `Messages Panel`, `Time Formatting Hooks`, `Navigation Sidebar`, `Settings Panel & Toggle`, `Notification Observer Hooks`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `SHIPS` connect `UI Components` to `Activity Feed & Fleet Tests`, `Espionage & Galaxy Data`, `Fleet & Ship Engine`, `Combat Engine`, `Galaxy Engine & State Manager`, `NPC Upgrade Engine`, `Production Sampling & Scoring`, `Overview Panel`, `Admin Panel`, `Messages Panel`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _218 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.05261842269716285 - nodes in this community are weakly interconnected._
- **Should `Espionage & Galaxy Data` be split into smaller, more focused modules?**
  _Cohesion score 0.05837837837837838 - nodes in this community are weakly interconnected._
- **Should `Fleet & Ship Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.06298904538341157 - nodes in this community are weakly interconnected._