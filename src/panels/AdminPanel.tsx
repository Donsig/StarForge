import { useEffect, useMemo, useState } from 'react';
import { BUILDINGS, BUILDING_ORDER } from '../data/buildings.ts';
import { DEFENCES, DEFENCE_ORDER } from '../data/defences.ts';
import { GALAXY_CONSTANTS } from '../data/galaxy.ts';
import { RESEARCH, RESEARCH_ORDER } from '../data/research.ts';
import { SHIPS, SHIP_ORDER } from '../data/ships.ts';
import { useGame } from '../context/GameContext';
import { getStorageCaps } from '../engine/ResourceEngine.ts';
import type { CombatResult } from '../models/Combat.ts';
import type { Coordinates, NPCSpecialty } from '../models/Galaxy.ts';
import type { BuildingId, DefenceId, ResearchId, ShipId } from '../models/types.ts';
import { formatNumber } from '../utils/format.ts';

type AdminTab =
  | 'resources'
  | 'player'
  | 'planets'
  | 'npc'
  | 'combat'
  | 'time'
  | 'debug'
  | 'settings';
type ResourceKey = 'metal' | 'crystal' | 'deuterium';

const TAB_LABELS: Record<AdminTab, string> = {
  resources: 'Resources',
  player: 'Player Editor',
  planets: 'Planets',
  npc: 'NPC Editor',
  combat: 'Combat',
  time: 'Time Controls',
  debug: 'Debug / State',
  settings: 'God Mode & Speed',
};

const COMBAT_SHIPS: ShipId[] = SHIP_ORDER.filter(
  (shipId) => shipId !== 'smallCargo' && shipId !== 'largeCargo',
);
const NPC_SPECIALTY_OPTIONS: NPCSpecialty[] = [
  'turtle',
  'fleeter',
  'miner',
  'balanced',
  'raider',
  'researcher',
];

function clampInt(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function parseIntOrZero(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(0, Math.floor(parsed));
}

function coordsToKey(coords: Coordinates): string {
  return `${coords.galaxy}:${coords.system}:${coords.slot}`;
}

function keyToCoords(key: string): Coordinates {
  const parts = key.split(':').map((part) => Number.parseInt(part, 10));
  return {
    galaxy: parts[0] ?? 1,
    system: parts[1] ?? 1,
    slot: parts[2] ?? 1,
  };
}

function sanitizeCoords(input: Coordinates): Coordinates {
  return {
    galaxy: clampInt(1, input.galaxy, GALAXY_CONSTANTS.MAX_GALAXIES),
    system: clampInt(1, input.system, GALAXY_CONSTANTS.MAX_SYSTEMS),
    slot: clampInt(1, input.slot, GALAXY_CONSTANTS.MAX_SLOTS),
  };
}

function formatCoords(coords: Coordinates): string {
  return `[${coords.galaxy}:${coords.system}:${coords.slot}]`;
}

function combatSummaryLabel(result: CombatResult | null): string {
  if (!result) return '';
  if (result.outcome === 'attacker_wins') return 'Attacker Wins';
  if (result.outcome === 'defender_wins') return 'Defender Wins';
  return 'Draw';
}

function sumCounts(values: Partial<Record<string, number>> | undefined): number {
  if (!values) return 0;
  let total = 0;
  for (const value of Object.values(values)) {
    total += Math.max(0, Math.floor(value ?? 0));
  }
  return total;
}

function createInputState<T extends string>(ids: readonly T[], initial = ''): Record<T, string> {
  return ids.reduce((acc, id) => {
    acc[id] = initial;
    return acc;
  }, {} as Record<T, string>);
}

export function AdminPanel() {
  const {
    gameState,
    setGameSpeed,
    setGodMode,
    adminSetResources,
    adminAddResources,
    adminSetBuildings,
    adminSetShips,
    adminSetDefences,
    adminSetResearch,
    adminForceColonize,
    adminConvertNPC,
    adminRemoveNPC,
    adminAddNPC,
    adminSetNPCTier,
    adminSetNPCSpecialty,
    adminSetNPCBuildings,
    adminSetNPCCurrentFleet,
    adminSetNPCCurrentDefences,
    adminResetNPC,
    adminWipeNPC,
    adminNPCTriggerUpgrade,
    adminClearNPCRaidHistory,
    adminForceAbandonNPC,
    adminSetPlanetFieldCount,
    adminTriggerCombat,
    adminSimulateTime,
    adminResolveAllMissions,
    adminCompleteAllQueues,
    adminRegenerateGalaxy,
    adminClearCombatLog,
    adminClearEspionageReports,
    adminClearDebrisFields,
    markAllCombatRead,
    markAllEspionageRead,
    markAllFleetRead,
  } = useGame();

  const [activeTab, setActiveTab] = useState<AdminTab>('resources');
  const [status, setStatus] = useState('');
  const [selectedPlanetIndex, setSelectedPlanetIndex] = useState(0);
  const [resourceInputs, setResourceInputs] = useState<Record<ResourceKey, string>>({
    metal: '0',
    crystal: '0',
    deuterium: '0',
  });

  const [playerBuildingInputs, setPlayerBuildingInputs] = useState<Record<BuildingId, string>>(
    createInputState(BUILDING_ORDER),
  );
  const [playerShipInputs, setPlayerShipInputs] = useState<Record<ShipId, string>>(
    createInputState(SHIP_ORDER),
  );
  const [playerDefenceInputs, setPlayerDefenceInputs] = useState<Record<DefenceId, string>>(
    createInputState(DEFENCE_ORDER),
  );
  const [playerResearchInputs, setPlayerResearchInputs] = useState<Record<ResearchId, string>>(
    createInputState(RESEARCH_ORDER),
  );

  const [forceCoords, setForceCoords] = useState<Coordinates>({ galaxy: 1, system: 1, slot: 5 });
  const [convertCoords, setConvertCoords] = useState<Coordinates>({ galaxy: 1, system: 1, slot: 6 });
  const [addNpcCoords, setAddNpcCoords] = useState<Coordinates>({ galaxy: 1, system: 1, slot: 7 });
  const [addNpcTier, setAddNpcTier] = useState(3);
  const [removeNpcKey, setRemoveNpcKey] = useState('');
  const [editorNpcKey, setEditorNpcKey] = useState('');
  const [editorTier, setEditorTier] = useState(1);
  const [editorSpecialty, setEditorSpecialty] = useState<NPCSpecialty>('balanced');
  const [editorBuildings, setEditorBuildings] = useState<Record<BuildingId, string>>(
    createInputState(BUILDING_ORDER, '0'),
  );
  const [editorFleet, setEditorFleet] = useState<Record<ShipId, string>>(
    createInputState(SHIP_ORDER, '0'),
  );
  const [editorDefences, setEditorDefences] = useState<Record<DefenceId, string>>(
    createInputState(DEFENCE_ORDER, '0'),
  );
  const [combatNpcKey, setCombatNpcKey] = useState('');
  const [combatChecked, setCombatChecked] = useState<Record<ShipId, boolean>>(
    SHIP_ORDER.reduce((acc, shipId) => {
      acc[shipId] = COMBAT_SHIPS.includes(shipId);
      return acc;
    }, {} as Record<ShipId, boolean>),
  );
  const [combatShipCounts, setCombatShipCounts] = useState<Record<ShipId, string>>(
    createInputState(SHIP_ORDER, '0'),
  );
  const [combatResult, setCombatResult] = useState<CombatResult | null>(null);
  const [customSimMinutes, setCustomSimMinutes] = useState('60');
  const [regenSeedInput, setRegenSeedInput] = useState('');
  const [fieldCountDraft, setFieldCountDraft] = useState('163');

  const planet = gameState.planets[selectedPlanetIndex] ?? gameState.planets[0];
  const selectedPlanetFieldCount = gameState.planets[selectedPlanetIndex]?.fieldCount;
  const selectedPlanetCaps = planet ? getStorageCaps(planet) : { metal: 0, crystal: 0, deuterium: 0 };
  const npcColonies = gameState.galaxy.npcColonies;
  const activePlanet = gameState.planets[gameState.activePlanetIndex];

  useEffect(() => {
    if (selectedPlanetIndex >= gameState.planets.length) {
      setSelectedPlanetIndex(0);
    }
  }, [gameState.planets.length, selectedPlanetIndex]);

  useEffect(() => {
    if (selectedPlanetFieldCount !== undefined) {
      setFieldCountDraft(String(selectedPlanetFieldCount));
    }
  }, [selectedPlanetFieldCount, selectedPlanetIndex]);

  useEffect(() => {
    if (npcColonies.length === 0) {
      setRemoveNpcKey('');
      setEditorNpcKey('');
      setCombatNpcKey('');
      return;
    }
    if (!removeNpcKey) setRemoveNpcKey(coordsToKey(npcColonies[0].coordinates));
    if (!editorNpcKey) setEditorNpcKey(coordsToKey(npcColonies[0].coordinates));
    if (!combatNpcKey) setCombatNpcKey(coordsToKey(npcColonies[0].coordinates));
  }, [combatNpcKey, editorNpcKey, npcColonies, removeNpcKey]);

  const editorNPC = useMemo(
    () => npcColonies.find((colony) => coordsToKey(colony.coordinates) === editorNpcKey) ?? null,
    [editorNpcKey, npcColonies],
  );

  const combatNPC = useMemo(
    () => npcColonies.find((colony) => coordsToKey(colony.coordinates) === combatNpcKey) ?? null,
    [combatNpcKey, npcColonies],
  );

  useEffect(() => {
    if (!editorNPC) return;
    setEditorTier(editorNPC.tier);
    setEditorSpecialty(editorNPC.specialty);
    setEditorBuildings(
      BUILDING_ORDER.reduce((acc, buildingId) => {
        acc[buildingId] = String(editorNPC.buildings[buildingId] ?? 0);
        return acc;
      }, {} as Record<BuildingId, string>),
    );
    setEditorFleet(
      SHIP_ORDER.reduce((acc, shipId) => {
        acc[shipId] = String(editorNPC.currentShips[shipId] ?? 0);
        return acc;
      }, {} as Record<ShipId, string>),
    );
    setEditorDefences(
      DEFENCE_ORDER.reduce((acc, defenceId) => {
        acc[defenceId] = String(editorNPC.currentDefences[defenceId] ?? 0);
        return acc;
      }, {} as Record<DefenceId, string>),
    );
  }, [editorNPC]);

  useEffect(() => {
    if (!activePlanet) return;
    setCombatChecked(
      SHIP_ORDER.reduce((acc, shipId) => {
        acc[shipId] = COMBAT_SHIPS.includes(shipId);
        return acc;
      }, {} as Record<ShipId, boolean>),
    );
    setCombatShipCounts(
      SHIP_ORDER.reduce((acc, shipId) => {
        acc[shipId] = String(activePlanet.ships[shipId] ?? 0);
        return acc;
      }, {} as Record<ShipId, string>),
    );
  }, [activePlanet]);

  const combatHasSelectedShips = useMemo(() => {
    let total = 0;
    for (const shipId of COMBAT_SHIPS) {
      if (!combatChecked[shipId]) continue;
      total += Math.max(0, parseIntOrZero(combatShipCounts[shipId]));
    }
    return total > 0;
  }, [combatChecked, combatShipCounts]);

  const speedSliderValue = clampInt(1, gameState.settings.gameSpeed, 100);

  return (
    <section className="panel admin-panel">
      <h1 className="panel-title">Admin Console</h1>
      <p className="panel-subtitle">
        Developer-only state controls for simulation testing and content validation.
      </p>

      <div className="admin-tabs" role="tablist" aria-label="Admin tabs">
        {(Object.keys(TAB_LABELS) as AdminTab[]).map((tabId) => (
          <button
            key={tabId}
            type="button"
            className={`btn admin-tab ${activeTab === tabId ? 'admin-tab-active' : ''}`}
            role="tab"
            aria-selected={activeTab === tabId}
            onClick={() => setActiveTab(tabId)}
          >
            {TAB_LABELS[tabId]}
          </button>
        ))}
      </div>

      {status && <p className="hint admin-status">{status}</p>}

      {activeTab === 'resources' && (
        <div className="panel-card admin-card">
          <h2 className="section-title">Resource Tools</h2>

          <label className="label" htmlFor="admin-planet-select">Planet</label>
          <select
            id="admin-planet-select"
            className="input admin-select"
            value={selectedPlanetIndex}
            onChange={(event) => setSelectedPlanetIndex(Number.parseInt(event.target.value, 10) || 0)}
          >
            {gameState.planets.map((item, index) => (
              <option key={`${item.name}-${index}`} value={index}>
                {index + 1}. {item.name} {formatCoords(item.coordinates)}
              </option>
            ))}
          </select>

          {planet && (
            <div className="admin-resource-grid">
              {(['metal', 'crystal', 'deuterium'] as ResourceKey[]).map((resourceKey) => (
                <div key={resourceKey} className="admin-resource-row">
                  <div>
                    <strong>{resourceKey}</strong>
                    <p className="hint number">
                      Current {formatNumber(planet.resources[resourceKey])} / {formatNumber(selectedPlanetCaps[resourceKey])}
                    </p>
                  </div>
                  <input
                    type="number"
                    className="input quantity-input number"
                    value={resourceInputs[resourceKey]}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setResourceInputs((current) => ({ ...current, [resourceKey]: nextValue }));
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      const value = parseIntOrZero(resourceInputs[resourceKey]);
                      adminSetResources(
                        selectedPlanetIndex,
                        resourceKey === 'metal' ? value : planet.resources.metal,
                        resourceKey === 'crystal' ? value : planet.resources.crystal,
                        resourceKey === 'deuterium' ? value : planet.resources.deuterium,
                      );
                      setStatus(`Set ${resourceKey} on ${planet.name}.`);
                    }}
                  >
                    Set
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      const value = parseIntOrZero(resourceInputs[resourceKey]);
                      adminAddResources(
                        selectedPlanetIndex,
                        resourceKey === 'metal' ? value : 0,
                        resourceKey === 'crystal' ? value : 0,
                        resourceKey === 'deuterium' ? value : 0,
                      );
                      setStatus(`Added ${value} ${resourceKey}.`);
                    }}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      adminSetResources(
                        selectedPlanetIndex,
                        resourceKey === 'metal' ? selectedPlanetCaps.metal : planet.resources.metal,
                        resourceKey === 'crystal' ? selectedPlanetCaps.crystal : planet.resources.crystal,
                        resourceKey === 'deuterium' ? selectedPlanetCaps.deuterium : planet.resources.deuterium,
                      );
                      setStatus(`Filled ${resourceKey} to cap.`);
                    }}
                  >
                    Fill
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'player' && (
        <div className="panel-card admin-card">
          <h2 className="section-title">Player Empire Editor</h2>

          <label className="label" htmlFor="admin-player-planet-select">Planet</label>
          <select
            id="admin-player-planet-select"
            className="input admin-select"
            value={selectedPlanetIndex}
            onChange={(event) => setSelectedPlanetIndex(Number.parseInt(event.target.value, 10) || 0)}
          >
            {gameState.planets.map((item, index) => (
              <option key={`${item.name}-editor-${index}`} value={index}>
                {index + 1}. {item.name} {formatCoords(item.coordinates)}
              </option>
            ))}
          </select>

          {planet && (
            <>
              <section className="admin-form-section">
                <h3>Planet Size</h3>
                <div className="admin-inline-row">
                  <label className="label" htmlFor="admin-field-count-input">Field Count</label>
                  <input
                    id="admin-field-count-input"
                    type="number"
                    className="input quantity-input"
                    min={40}
                    max={250}
                    value={fieldCountDraft}
                    onChange={(event) => setFieldCountDraft(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      const parsed = parseOptionalInt(fieldCountDraft);
                      if (parsed === null) {
                        setStatus('Enter a field count between 40 and 250.');
                        return;
                      }
                      const val = clampInt(40, parsed, 250);
                      adminSetPlanetFieldCount(selectedPlanetIndex, val);
                      setFieldCountDraft(String(val));
                      setStatus(`Field count set to ${val}.`);
                    }}
                  >
                    Apply
                  </button>
                </div>
              </section>

              <section className="admin-form-section">
                <h3>Buildings</h3>
                <div className="admin-grid-inputs">
                  {BUILDING_ORDER.map((buildingId) => (
                    <label key={buildingId} className="admin-input-label">
                      <span>{BUILDINGS[buildingId].name}</span>
                      <input
                        type="number"
                        className="input quantity-input"
                        value={playerBuildingInputs[buildingId]}
                        placeholder={String(planet.buildings[buildingId] ?? 0)}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setPlayerBuildingInputs((current) => ({ ...current, [buildingId]: nextValue }));
                        }}
                      />
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const patch: Partial<Record<BuildingId, number>> = {};
                    for (const buildingId of BUILDING_ORDER) {
                      const value = parseOptionalInt(playerBuildingInputs[buildingId]);
                      if (value !== null) patch[buildingId] = value;
                    }
                    if (Object.keys(patch).length === 0) {
                      setStatus('No building values entered.');
                      return;
                    }
                    adminSetBuildings(selectedPlanetIndex, patch);
                    setPlayerBuildingInputs(createInputState(BUILDING_ORDER));
                    setStatus('Player building levels updated.');
                  }}
                >
                  Apply All
                </button>
              </section>

              <section className="admin-form-section">
                <h3>Ships</h3>
                <div className="admin-grid-inputs">
                  {SHIP_ORDER.map((shipId) => (
                    <label key={shipId} className="admin-input-label">
                      <span>{SHIPS[shipId].name}</span>
                      <input
                        type="number"
                        className="input quantity-input"
                        value={playerShipInputs[shipId]}
                        placeholder={String(planet.ships[shipId] ?? 0)}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setPlayerShipInputs((current) => ({ ...current, [shipId]: nextValue }));
                        }}
                      />
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const patch: Partial<Record<ShipId, number>> = {};
                    for (const shipId of SHIP_ORDER) {
                      const value = parseOptionalInt(playerShipInputs[shipId]);
                      if (value !== null) patch[shipId] = value;
                    }
                    if (Object.keys(patch).length === 0) {
                      setStatus('No ship values entered.');
                      return;
                    }
                    adminSetShips(selectedPlanetIndex, patch);
                    setPlayerShipInputs(createInputState(SHIP_ORDER));
                    setStatus('Player ship counts updated.');
                  }}
                >
                  Apply All
                </button>
              </section>

              <section className="admin-form-section">
                <h3>Defences</h3>
                <div className="admin-grid-inputs">
                  {DEFENCE_ORDER.map((defenceId) => (
                    <label key={defenceId} className="admin-input-label">
                      <span>{DEFENCES[defenceId].name}</span>
                      <input
                        type="number"
                        className="input quantity-input"
                        value={playerDefenceInputs[defenceId]}
                        placeholder={String(planet.defences[defenceId] ?? 0)}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setPlayerDefenceInputs((current) => ({ ...current, [defenceId]: nextValue }));
                        }}
                      />
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const patch: Partial<Record<DefenceId, number>> = {};
                    for (const defenceId of DEFENCE_ORDER) {
                      const value = parseOptionalInt(playerDefenceInputs[defenceId]);
                      if (value !== null) patch[defenceId] = value;
                    }
                    if (Object.keys(patch).length === 0) {
                      setStatus('No defence values entered.');
                      return;
                    }
                    adminSetDefences(selectedPlanetIndex, patch);
                    setPlayerDefenceInputs(createInputState(DEFENCE_ORDER));
                    setStatus('Player defence counts updated.');
                  }}
                >
                  Apply All
                </button>
              </section>
            </>
          )}

          <section className="admin-form-section">
            <h3>Research (Global)</h3>
            <div className="admin-grid-inputs">
              {RESEARCH_ORDER.map((researchId) => (
                <label key={researchId} className="admin-input-label">
                  <span>{RESEARCH[researchId].name}</span>
                  <input
                    type="number"
                    className="input quantity-input"
                    value={playerResearchInputs[researchId]}
                    placeholder={String(gameState.research[researchId] ?? 0)}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setPlayerResearchInputs((current) => ({ ...current, [researchId]: nextValue }));
                    }}
                  />
                </label>
              ))}
            </div>
            <div className="admin-inline-row">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const patch: Partial<Record<ResearchId, number>> = {};
                  for (const researchId of RESEARCH_ORDER) {
                    const value = parseOptionalInt(playerResearchInputs[researchId]);
                    if (value !== null) patch[researchId] = value;
                  }
                  if (Object.keys(patch).length === 0) {
                    setStatus('No research values entered.');
                    return;
                  }
                  adminSetResearch(patch);
                  setPlayerResearchInputs(createInputState(RESEARCH_ORDER));
                  setStatus('Research levels updated.');
                }}
              >
                Apply All
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const maxed = RESEARCH_ORDER.reduce((acc, researchId) => {
                    acc[researchId] = 10;
                    return acc;
                  }, {} as Partial<Record<ResearchId, number>>);
                  adminSetResearch(maxed);
                  setStatus('All research set to level 10.');
                }}
              >
                Max Research (Lvl 10)
              </button>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'planets' && (
        <div className="panel-card admin-card admin-planet-tools">
          <h2 className="section-title">Planet Manipulation</h2>

          <section className="admin-form-section">
            <h3>Force Colonize</h3>
            <div className="admin-coords-row">
              <input
                type="number"
                className="input quantity-input"
                value={forceCoords.galaxy}
                min={1}
                max={GALAXY_CONSTANTS.MAX_GALAXIES}
                onChange={(event) => {
                  const value = parseIntOrZero(event.target.value);
                  setForceCoords((current) => ({ ...current, galaxy: value }));
                }}
              />
              <input
                type="number"
                className="input quantity-input"
                value={forceCoords.system}
                min={1}
                max={GALAXY_CONSTANTS.MAX_SYSTEMS}
                onChange={(event) => {
                  const value = parseIntOrZero(event.target.value);
                  setForceCoords((current) => ({ ...current, system: value }));
                }}
              />
              <input
                type="number"
                className="input quantity-input"
                value={forceCoords.slot}
                min={1}
                max={GALAXY_CONSTANTS.MAX_SLOTS}
                onChange={(event) => {
                  const value = parseIntOrZero(event.target.value);
                  setForceCoords((current) => ({ ...current, slot: value }));
                }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const colony = adminForceColonize(sanitizeCoords(forceCoords));
                  setStatus(colony ? `Colonized ${formatCoords(colony.coordinates)}.` : 'Slot is occupied.');
                }}
              >
                Colonize
              </button>
            </div>
          </section>

          <section className="admin-form-section">
            <h3>Convert NPC</h3>
            <div className="admin-coords-row">
              <input
                type="number"
                className="input quantity-input"
                value={convertCoords.galaxy}
                min={1}
                max={GALAXY_CONSTANTS.MAX_GALAXIES}
                onChange={(event) => {
                  const value = parseIntOrZero(event.target.value);
                  setConvertCoords((current) => ({ ...current, galaxy: value }));
                }}
              />
              <input
                type="number"
                className="input quantity-input"
                value={convertCoords.system}
                min={1}
                max={GALAXY_CONSTANTS.MAX_SYSTEMS}
                onChange={(event) => {
                  const value = parseIntOrZero(event.target.value);
                  setConvertCoords((current) => ({ ...current, system: value }));
                }}
              />
              <input
                type="number"
                className="input quantity-input"
                value={convertCoords.slot}
                min={1}
                max={GALAXY_CONSTANTS.MAX_SLOTS}
                onChange={(event) => {
                  const value = parseIntOrZero(event.target.value);
                  setConvertCoords((current) => ({ ...current, slot: value }));
                }}
              />
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const planetResult = adminConvertNPC(sanitizeCoords(convertCoords));
                  setStatus(planetResult ? 'NPC converted to player planet.' : 'No NPC found at target slot.');
                }}
              >
                Convert to Player Planet
              </button>
            </div>
          </section>

          <section className="admin-form-section">
            <h3>Remove NPC</h3>
            <div className="admin-inline-row">
              <select
                className="input admin-select"
                value={removeNpcKey}
                onChange={(event) => setRemoveNpcKey(event.target.value)}
              >
                {npcColonies.map((colony) => (
                  <option key={coordsToKey(colony.coordinates)} value={coordsToKey(colony.coordinates)}>
                    {colony.name} {formatCoords(colony.coordinates)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-danger"
                disabled={!removeNpcKey}
                onClick={() => {
                  if (!removeNpcKey) return;
                  adminRemoveNPC(keyToCoords(removeNpcKey));
                  setStatus('NPC colony removed.');
                }}
              >
                Remove
              </button>
            </div>
          </section>

          <section className="admin-form-section">
            <h3>Add NPC</h3>
            <div className="admin-coords-row">
              <input
                type="number"
                className="input quantity-input"
                value={addNpcCoords.galaxy}
                min={1}
                max={GALAXY_CONSTANTS.MAX_GALAXIES}
                onChange={(event) => {
                  const value = parseIntOrZero(event.target.value);
                  setAddNpcCoords((current) => ({ ...current, galaxy: value }));
                }}
              />
              <input
                type="number"
                className="input quantity-input"
                value={addNpcCoords.system}
                min={1}
                max={GALAXY_CONSTANTS.MAX_SYSTEMS}
                onChange={(event) => {
                  const value = parseIntOrZero(event.target.value);
                  setAddNpcCoords((current) => ({ ...current, system: value }));
                }}
              />
              <input
                type="number"
                className="input quantity-input"
                value={addNpcCoords.slot}
                min={1}
                max={GALAXY_CONSTANTS.MAX_SLOTS}
                onChange={(event) => {
                  const value = parseIntOrZero(event.target.value);
                  setAddNpcCoords((current) => ({ ...current, slot: value }));
                }}
              />
              <label className="label" htmlFor="admin-add-tier">Tier {addNpcTier}</label>
              <input
                id="admin-add-tier"
                type="range"
                min={1}
                max={10}
                step={1}
                value={addNpcTier}
                className="slider"
                onChange={(event) => setAddNpcTier(parseIntOrZero(event.target.value) || 1)}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const colony = adminAddNPC(sanitizeCoords(addNpcCoords), addNpcTier);
                  setStatus(colony ? 'NPC colony added.' : 'Cannot add NPC to occupied slot.');
                }}
              >
                Add NPC
              </button>
            </div>
          </section>
        </div>
      )}
      {activeTab === 'npc' && (
        <div className="panel-card admin-card">
          <h2 className="section-title">NPC Editor</h2>

          <div className="admin-inline-row">
            <select
              className="input admin-select"
              value={editorNpcKey}
              onChange={(event) => setEditorNpcKey(event.target.value)}
            >
              {npcColonies.map((colony) => (
                <option key={coordsToKey(colony.coordinates)} value={coordsToKey(colony.coordinates)}>
                  {colony.name} {formatCoords(colony.coordinates)}
                </option>
              ))}
            </select>
          </div>

          {!editorNPC && <p className="hint">No NPC colonies available.</p>}

          {editorNPC && (
            <>
              <section className="admin-form-section">
                <h3>Tier</h3>
                <div className="admin-inline-row">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    className="slider"
                    value={editorTier}
                    onChange={(event) => setEditorTier(parseIntOrZero(event.target.value) || 1)}
                  />
                  <span className="number">Tier {editorTier}</span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      adminSetNPCTier(editorNPC.coordinates, editorTier);
                      setStatus('NPC tier regenerated from formula.');
                    }}
                  >
                    Regenerate from Tier
                  </button>
                </div>
              </section>

              <section className="admin-form-section">
                <h3>Specialty</h3>
                <div className="admin-inline-row">
                  <select
                    className="input admin-select"
                    value={editorSpecialty}
                    onChange={(event) =>
                      setEditorSpecialty(event.target.value as NPCSpecialty)
                    }
                  >
                    {NPC_SPECIALTY_OPTIONS.map((specialty) => (
                      <option key={specialty} value={specialty}>
                        {specialty}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      adminSetNPCSpecialty(editorNPC.coordinates, editorSpecialty);
                      setStatus(`NPC specialty set to ${editorSpecialty}.`);
                    }}
                  >
                    Apply Specialty
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      adminNPCTriggerUpgrade(editorNPC.coordinates);
                      setStatus('Triggered one NPC upgrade tick.');
                    }}
                  >
                    Trigger Upgrade
                  </button>
                </div>
              </section>

              <section className="admin-form-section">
                <h3>Buildings</h3>
                <div className="admin-grid-inputs">
                  {BUILDING_ORDER.map((buildingId) => (
                    <label key={buildingId} className="admin-input-label">
                      <span>{BUILDINGS[buildingId].name}</span>
                      <input
                        type="number"
                        className="input quantity-input"
                        value={editorBuildings[buildingId]}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setEditorBuildings((current) => ({ ...current, [buildingId]: nextValue }));
                        }}
                      />
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const patch = BUILDING_ORDER.reduce((acc, buildingId) => {
                      acc[buildingId] = Math.max(0, parseIntOrZero(editorBuildings[buildingId]));
                      return acc;
                    }, {} as Partial<Record<BuildingId, number>>);
                    adminSetNPCBuildings(editorNPC.coordinates, patch);
                    setStatus('NPC buildings updated.');
                  }}
                >
                  Apply
                </button>
              </section>

              <section className="admin-form-section">
                <h3>Current Fleet</h3>
                <div className="admin-grid-inputs">
                  {SHIP_ORDER.map((shipId) => (
                    <label key={shipId} className="admin-input-label">
                      <span>{SHIPS[shipId].name}</span>
                      <input
                        type="number"
                        className="input quantity-input"
                        value={editorFleet[shipId]}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setEditorFleet((current) => ({ ...current, [shipId]: nextValue }));
                        }}
                      />
                    </label>
                  ))}
                </div>
                <div className="admin-inline-row">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      const fleetPatch = SHIP_ORDER.reduce((acc, shipId) => {
                        acc[shipId] = Math.max(0, parseIntOrZero(editorFleet[shipId]));
                        return acc;
                      }, {} as Partial<Record<ShipId, number>>);
                      adminSetNPCCurrentFleet(editorNPC.coordinates, fleetPatch, false);
                      setStatus('NPC current fleet updated.');
                    }}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      const fleetPatch = SHIP_ORDER.reduce((acc, shipId) => {
                        acc[shipId] = Math.max(0, parseIntOrZero(editorFleet[shipId]));
                        return acc;
                      }, {} as Partial<Record<ShipId, number>>);
                      adminSetNPCCurrentFleet(editorNPC.coordinates, fleetPatch, true);
                      setStatus('NPC current + base fleet updated.');
                    }}
                  >
                    Apply to Both
                  </button>
                </div>
              </section>

              <section className="admin-form-section">
                <h3>Current Defences</h3>
                <div className="admin-grid-inputs">
                  {DEFENCE_ORDER.map((defenceId) => (
                    <label key={defenceId} className="admin-input-label">
                      <span>{DEFENCES[defenceId].name}</span>
                      <input
                        type="number"
                        className="input quantity-input"
                        value={editorDefences[defenceId]}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setEditorDefences((current) => ({ ...current, [defenceId]: nextValue }));
                        }}
                      />
                    </label>
                  ))}
                </div>
                <div className="admin-inline-row">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      const defencePatch = DEFENCE_ORDER.reduce((acc, defenceId) => {
                        acc[defenceId] = Math.max(0, parseIntOrZero(editorDefences[defenceId]));
                        return acc;
                      }, {} as Partial<Record<DefenceId, number>>);
                      adminSetNPCCurrentDefences(editorNPC.coordinates, defencePatch, false);
                      setStatus('NPC current defences updated.');
                    }}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      const defencePatch = DEFENCE_ORDER.reduce((acc, defenceId) => {
                        acc[defenceId] = Math.max(0, parseIntOrZero(editorDefences[defenceId]));
                        return acc;
                      }, {} as Partial<Record<DefenceId, number>>);
                      adminSetNPCCurrentDefences(editorNPC.coordinates, defencePatch, true);
                      setStatus('NPC current + base defences updated.');
                    }}
                  >
                    Apply to Both
                  </button>
                </div>
              </section>

              <section className="admin-inline-row">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    adminResetNPC(editorNPC.coordinates);
                    setStatus('NPC reset to base strength.');
                  }}
                >
                  Reset to Full Strength
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    adminWipeNPC(editorNPC.coordinates);
                    setStatus('NPC current fleet and defences wiped.');
                  }}
                >
                  Wipe Fleet & Defences
                </button>
              </section>

              <section className="admin-form-section">
                <h3>Raid History</h3>
                <p className="hint number">Total raids: {editorNPC.raidCount}</p>
                <p className="hint number">
                  Recent raid timestamps: {editorNPC.recentRaidTimestamps.length}
                </p>
                <p className="hint">
                  Abandoned At:{' '}
                  {editorNPC.abandonedAt !== undefined
                    ? new Date(editorNPC.abandonedAt).toLocaleString()
                    : '—'}
                </p>
                <div className="admin-inline-row">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      adminClearNPCRaidHistory(editorNPC.coordinates);
                      setStatus('NPC raid history cleared.');
                    }}
                  >
                    Clear Raid History
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      adminForceAbandonNPC(editorNPC.coordinates);
                      setStatus('NPC forced into abandoning state.');
                    }}
                  >
                    Force Abandon
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      )}
      {activeTab === 'combat' && (
        <div className="panel-card admin-card">
          <h2 className="section-title">Instant Combat</h2>

          <div className="admin-inline-row">
            <select
              className="input admin-select"
              value={combatNpcKey}
              onChange={(event) => setCombatNpcKey(event.target.value)}
            >
              {npcColonies.map((colony) => (
                <option key={coordsToKey(colony.coordinates)} value={coordsToKey(colony.coordinates)}>
                  {colony.name} {formatCoords(colony.coordinates)}
                </option>
              ))}
            </select>
          </div>

          {!combatNPC && <p className="hint">No NPC targets available.</p>}

          {combatNPC && (
            <>
              <div className="admin-grid-inputs">
                {COMBAT_SHIPS.filter((shipId) => (activePlanet?.ships[shipId] ?? 0) > 0).map((shipId) => {
                  const available = activePlanet?.ships[shipId] ?? 0;
                  return (
                    <label key={shipId} className="admin-input-label admin-combat-row">
                      <span>
                        <input
                          type="checkbox"
                          checked={combatChecked[shipId]}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setCombatChecked((current) => ({ ...current, [shipId]: checked }));
                          }}
                        />{' '}
                        {SHIPS[shipId].name} <span className="hint">(avail {formatNumber(available)})</span>
                      </span>
                      <input
                        type="number"
                        className="input quantity-input"
                        min={0}
                        max={available}
                        value={combatShipCounts[shipId]}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setCombatShipCounts((current) => ({ ...current, [shipId]: nextValue }));
                        }}
                      />
                    </label>
                  );
                })}
              </div>

              <button
                type="button"
                className="btn btn-primary"
                disabled={!combatHasSelectedShips}
                onClick={() => {
                  const attackingShips = COMBAT_SHIPS.reduce((acc, shipId) => {
                    if (!combatChecked[shipId]) return acc;
                    const available = activePlanet?.ships[shipId] ?? 0;
                    const requested = Math.max(0, parseIntOrZero(combatShipCounts[shipId]));
                    const clamped = Math.min(available, requested);
                    if (clamped > 0) {
                      acc[shipId] = clamped;
                    }
                    return acc;
                  }, {} as Record<string, number>);

                  const result = adminTriggerCombat(combatNPC.coordinates, attackingShips);
                  setCombatResult(result);
                  setStatus(result ? 'Combat resolved instantly.' : 'Combat failed.');
                }}
              >
                Resolve Combat Now
              </button>

              {combatResult && (
                <div className="admin-combat-result">
                  <p>
                    Outcome:{' '}
                    <span className={`admin-outcome admin-outcome-${combatResult.outcome}`}>
                      {combatSummaryLabel(combatResult)}
                    </span>
                  </p>
                  <p className="hint number">
                    Attacker losses: {sumCounts(combatResult.attackerLosses.ships)} ships
                  </p>
                  <p className="hint number">
                    Defender losses: {sumCounts(combatResult.defenderLosses.ships)} ships / {sumCounts(combatResult.defenderLosses.defences)} defences
                  </p>
                  <p className="hint number">
                    Loot: M {formatNumber(combatResult.loot.metal)} / C {formatNumber(combatResult.loot.crystal)} / D {formatNumber(combatResult.loot.deuterium)}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {activeTab === 'time' && (
        <div className="panel-card admin-card">
          <h2 className="section-title">Time Controls</h2>

          <div className="admin-inline-row">
            <button type="button" className="btn" onClick={() => adminSimulateTime(60)}>+1 min</button>
            <button type="button" className="btn" onClick={() => adminSimulateTime(3600)}>+1 hr</button>
            <button type="button" className="btn" onClick={() => adminSimulateTime(8 * 3600)}>+8 hr</button>
            <button type="button" className="btn" onClick={() => adminSimulateTime(24 * 3600)}>+24 hr</button>
          </div>

          <section className="admin-form-section">
            <h3>Custom Simulation</h3>
            <div className="admin-inline-row">
              <input
                type="number"
                className="input quantity-input"
                value={customSimMinutes}
                min={1}
                onChange={(event) => setCustomSimMinutes(event.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const minutes = parseIntOrZero(customSimMinutes);
                  if (minutes <= 0) {
                    setStatus('Enter a positive minute value.');
                    return;
                  }
                  adminSimulateTime(minutes * 60);
                  setStatus(`Simulated ${minutes} minutes.`);
                }}
              >
                Simulate
              </button>
            </div>
          </section>

          <div className="admin-inline-row">
            <button
              type="button"
              className="btn"
              onClick={() => {
                adminResolveAllMissions();
                setStatus('All missions resolved.');
              }}
            >
              Resolve All Missions
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                adminCompleteAllQueues();
                setStatus('All queues completed.');
              }}
            >
              Complete All Queues
            </button>
          </div>
        </div>
      )}
      {activeTab === 'debug' && (
        <div className="panel-card admin-card">
          <h2 className="section-title">Debug / State</h2>

          <div className="admin-inline-row">
            <button
              type="button"
              className="btn"
              onClick={() => {
                adminClearCombatLog();
                setStatus('Combat log cleared.');
              }}
            >
              Clear Combat Log
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                adminClearEspionageReports();
                setStatus('Espionage reports cleared.');
              }}
            >
              Clear Espionage Reports
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                adminClearDebrisFields();
                setStatus('Debris fields cleared.');
              }}
            >
              Clear Debris Fields
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                markAllCombatRead();
                markAllEspionageRead();
                markAllFleetRead();
                setStatus('All reports marked as read.');
              }}
            >
              Mark All Read
            </button>
          </div>

          <section className="admin-form-section">
            <h3>Galaxy</h3>
            <p className="hint number">Current Seed: {gameState.galaxy.seed}</p>
            <div className="admin-inline-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  adminRegenerateGalaxy();
                  setStatus('Galaxy regenerated with new random seed.');
                }}
              >
                Regenerate Galaxy
              </button>
              <input
                type="number"
                className="input quantity-input"
                placeholder="Seed"
                value={regenSeedInput}
                onChange={(event) => setRegenSeedInput(event.target.value)}
              />
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const seed = parseIntOrZero(regenSeedInput);
                  adminRegenerateGalaxy(seed);
                  setStatus(`Galaxy regenerated with seed ${seed}.`);
                }}
              >
                Regenerate with Seed
              </button>
            </div>
          </section>

          <details className="admin-form-section">
            <summary>Raw State JSON</summary>
            <pre className="number">{JSON.stringify(gameState, null, 2)}</pre>
          </details>
        </div>
      )}
      {activeTab === 'settings' && (
        <div className="panel-card admin-card">
          <h2 className="section-title">God Mode</h2>

          <label className="admin-toggle">
            <input
              type="checkbox"
              checked={gameState.settings.godMode}
              onChange={(event) => {
                setGodMode(event.target.checked);
                setStatus(event.target.checked ? 'God mode enabled.' : 'God mode disabled.');
              }}
            />
            <span>Enable God Mode (instant-complete and instant-action buttons in core panels)</span>
          </label>

          <div className="admin-form-section">
            <h3>Game Speed</h3>
            <div className="slider-row">
              <input
                type="range"
                className="slider"
                min={1}
                max={100}
                step={1}
                value={speedSliderValue}
                onChange={(event) => {
                  const value = parseIntOrZero(event.target.value) || 1;
                  setGameSpeed(value);
                }}
              />
              <span className="number">{speedSliderValue}x</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
