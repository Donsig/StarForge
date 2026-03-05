export interface AttackerTechs {
  weaponsTechnology: number;
  shieldingTechnology: number;
  armourTechnology: number;
}

export interface DefenderTechs {
  weaponsTechnology: number;
  shieldingTechnology: number;
  armourTechnology: number;
}

export type UnitSnapshot = {
  ships: Partial<Record<string, number>>;
  defences?: Partial<Record<string, number>>;
};

export interface CombatResult {
  seed: number;
  outcome: 'attacker_wins' | 'defender_wins' | 'draw';
  rounds: number;
  attackerStart: UnitSnapshot;
  attackerEnd: UnitSnapshot;
  defenderStart: UnitSnapshot;
  defenderEnd: UnitSnapshot;
  attackerLosses: UnitSnapshot;
  defenderLosses: UnitSnapshot;
  defencesRebuilt: Record<string, number>;
  debrisCreated: { metal: number; crystal: number };
  loot: { metal: number; crystal: number; deuterium: number };
}
