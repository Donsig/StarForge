import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useMemo, useState } from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen, within } from '../../test/test-utils';
import { GameContext, type GameContextType } from '../../context/GameContext';
import { createNewGameState } from '../../models/GameState.ts';
import { createDefaultPlanet, type PlanetState } from '../../models/Planet.ts';
import { calculateProduction, getStorageCaps } from '../../engine/ResourceEngine.ts';
import type { Coordinates } from '../../models/Galaxy.ts';
import type { BuildingId, DefenceId, ResearchId, ShipId } from '../../models/types.ts';
import { AdminPanel } from '../AdminPanel';

function withPlanetMutation(
  setGameState: Dispatch<SetStateAction<ReturnType<typeof createNewGameState>>>,
  planetIndex: number,
  mutator: (planet: ReturnType<typeof createDefaultPlanet>) => void,
): void {
  setGameState((current) => {
    const next = structuredClone(current);
    const planet = next.planets[planetIndex];
    if (!planet) {
      return current;
    }
    mutator(planet);
    return next;
  });
}

function Harness({ children }: { children?: ReactNode }) {
  const [gameState, setGameState] = useState(() => createNewGameState());

  const contextValue = useMemo<GameContextType>(() => ({
    gameState,
    espionageReports: gameState.espionageReports,
    fleetNotifications: gameState.fleetNotifications,
    productionRates: calculateProduction(gameState),
    storageCaps: getStorageCaps(gameState),
    upgradeBuilding: () => false,
    startResearchAction: () => false,
    buildShips: () => false,
    buildDefences: () => false,
    colonizeAction: () => false,
    cancelBuilding: () => {},
    cancelResearch: () => {},
    cancelShipyard: () => {},
    resetGameAction: () => {},
    setActivePlanet: () => {},
    fleetTarget: null,
    setFleetTarget: () => {},
    pendingMissionTarget: null,
    setPendingMissionTarget: () => {},
    dispatchFleet: () => null,
    dispatchEspionage: () => null,
    dispatchHarvest: () => null,
    recallFleet: () => {},
    markCombatRead: () => {},
    markAllCombatRead: () => {},
    markEspionageRead: () => {},
    markAllEspionageRead: () => {},
    markFleetRead: () => {},
    markAllFleetRead: () => {},
    deleteCombatEntry: () => {},
    deleteEspionageReport: () => {},
    deleteFleetNotification: () => {},
    setGameSpeed: (n: number) => {
      setGameState((current) => ({
        ...current,
        settings: {
          ...current.settings,
          gameSpeed: n,
        },
      }));
    },
    setMaxProbeCount: (n: number) => {
      setGameState((current) => ({
        ...current,
        settings: {
          ...current.settings,
          maxProbeCount: Math.max(1, Math.min(999, Math.floor(n))),
        },
      }));
    },
    setGodMode: (enabled: boolean) => {
      setGameState((current) => ({
        ...current,
        settings: {
          ...current.settings,
          godMode: enabled,
        },
      }));
    },
    adminSetResources: (planetIndex, metal, crystal, deuterium) => {
      withPlanetMutation(setGameState, planetIndex, (planet) => {
        const caps = getStorageCaps(planet);
        planet.resources.metal = Math.max(0, Math.min(caps.metal, Math.floor(metal)));
        planet.resources.crystal = Math.max(0, Math.min(caps.crystal, Math.floor(crystal)));
        planet.resources.deuterium = Math.max(0, Math.min(caps.deuterium, Math.floor(deuterium)));
      });
    },
    adminAddResources: (planetIndex, metal, crystal, deuterium) => {
      withPlanetMutation(setGameState, planetIndex, (planet) => {
        const caps = getStorageCaps(planet);
        planet.resources.metal = Math.max(
          0,
          Math.min(caps.metal, Math.floor(planet.resources.metal + metal)),
        );
        planet.resources.crystal = Math.max(
          0,
          Math.min(caps.crystal, Math.floor(planet.resources.crystal + crystal)),
        );
        planet.resources.deuterium = Math.max(
          0,
          Math.min(caps.deuterium, Math.floor(planet.resources.deuterium + deuterium)),
        );
      });
    },
    adminSetBuildings: () => {},
    adminSetShips: () => {},
    adminSetDefences: () => {},
    adminSetResearch: (_research: Partial<Record<ResearchId, number>>) => {},
    adminForceColonize: (coords: Coordinates): PlanetState | null => {
      let created: PlanetState | null = null;
      setGameState((current) => {
        const next = structuredClone(current);
        const occupied = next.planets.some(
          (planet) =>
            planet.coordinates.galaxy === coords.galaxy &&
            planet.coordinates.system === coords.system &&
            planet.coordinates.slot === coords.slot,
        );
        if (occupied) {
          return current;
        }

        const colony = createDefaultPlanet();
        colony.name = `Colony ${next.planets.length + 1}`;
        colony.coordinates = { ...coords };
        next.planets.push(colony);
        created = colony;
        return next;
      });
      return created;
    },
    adminConvertNPC: () => null,
    adminRemoveNPC: () => {},
    adminAddNPC: () => null,
    adminSetNPCTier: () => {},
    adminSetNPCSpecialty: () => {},
    adminSetNPCBuildings: (_coords: Coordinates, _buildings: Partial<Record<BuildingId, number>>) => {},
    adminSetNPCCurrentFleet: (
      _coords: Coordinates,
      _ships: Partial<Record<ShipId, number>>,
      _applyToBase?: boolean,
    ) => {},
    adminSetNPCCurrentDefences: (
      _coords: Coordinates,
      _defences: Partial<Record<DefenceId, number>>,
      _applyToBase?: boolean,
    ) => {},
    adminResetNPC: () => {},
    adminWipeNPC: () => {},
    adminNPCTriggerUpgrade: () => {},
    adminClearNPCRaidHistory: () => {},
    adminForceAbandonNPC: () => {},
    adminSetPlanetFieldCount: (planetIndex, fieldCount) => {
      withPlanetMutation(setGameState, planetIndex, (planet) => {
        planet.fieldCount = Math.max(40, Math.min(250, Math.floor(fieldCount)));
      });
    },
    adminCompleteBuilding: () => {},
    adminCompleteResearch: () => {},
    adminCompleteShipyard: () => {},
    adminCompleteAllQueues: () => {},
    adminResolveMission: () => {},
    adminResolveAllMissions: () => {},
    adminTriggerCombat: () => null,
    adminSimulateTime: () => {},
    adminRegenerateGalaxy: () => {},
    adminClearCombatLog: () => {},
    adminClearEspionageReports: () => {},
    adminClearDebrisFields: () => {},
    exportSaveAction: () => '',
    importSaveAction: () => false,
  }), [gameState]);

  return <GameContext.Provider value={contextValue}>{children}</GameContext.Provider>;
}

describe('AdminPanel', () => {
  it('renders without crashing', () => {
    render(
      <Harness>
        <AdminPanel />
      </Harness>,
    );

    expect(screen.getByRole('heading', { name: 'Admin Console' })).toBeInTheDocument();
  });

  it('resource set/add mutates state', async () => {
    const user = userEvent.setup();

    render(
      <Harness>
        <AdminPanel />
      </Harness>,
    );

    const metalRow = screen.getByText('metal').closest('.admin-resource-row');
    expect(metalRow).not.toBeNull();
    const row = metalRow as HTMLElement;
    const input = within(row).getByRole('spinbutton');

    await user.clear(input);
    await user.type(input, '1200');
    await user.click(within(row).getByRole('button', { name: 'Set' }));
    expect(within(row).getByText(/Current 1,200/)).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, '300');
    await user.click(within(row).getByRole('button', { name: 'Add' }));
    expect(within(row).getByText(/Current 1,500/)).toBeInTheDocument();
  });

  it('keeps planet size draft local until Apply is clicked', async () => {
    const user = userEvent.setup();

    render(
      <Harness>
        <AdminPanel />
      </Harness>,
    );

    await user.click(screen.getByRole('tab', { name: 'Player Editor' }));
    const fieldInput = screen.getByLabelText('Field Count');

    await user.clear(fieldInput);
    await user.type(fieldInput, '200');
    expect(fieldInput).toHaveValue(200);

    await user.click(screen.getByRole('tab', { name: 'Resources' }));
    const metalRow = screen.getByText('metal').closest('.admin-resource-row');
    expect(metalRow).not.toBeNull();
    const row = metalRow as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Set' }));

    await user.click(screen.getByRole('tab', { name: 'Player Editor' }));
    expect(screen.getByLabelText('Field Count')).toHaveValue(200);
  });

  it('force colonize creates a planet', async () => {
    const user = userEvent.setup();

    render(
      <Harness>
        <AdminPanel />
      </Harness>,
    );

    await user.click(screen.getByRole('tab', { name: 'Planets' }));

    const section = screen.getByRole('heading', { name: 'Force Colonize' }).closest('section');
    expect(section).not.toBeNull();
    const forceSection = section as HTMLElement;
    const inputs = within(forceSection).getAllByRole('spinbutton');

    await user.clear(inputs[0]);
    await user.type(inputs[0], '1');
    await user.clear(inputs[1]);
    await user.type(inputs[1], '2');
    await user.clear(inputs[2]);
    await user.type(inputs[2], '8');
    await user.click(within(forceSection).getByRole('button', { name: 'Colonize' }));

    await user.click(screen.getByRole('tab', { name: 'Resources' }));
    const selector = screen.getByLabelText('Planet');
    const options = within(selector).getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(screen.getByRole('option', { name: /Colony 2 \[1:2:8\]/ })).toBeInTheDocument();
  });

  it('god mode toggle updates state', async () => {
    const user = userEvent.setup();

    render(
      <Harness>
        <AdminPanel />
      </Harness>,
    );

    await user.click(screen.getByRole('tab', { name: 'God Mode & Speed' }));
    const checkbox = screen.getByRole('checkbox', { name: /Enable God Mode/i });

    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });
});
