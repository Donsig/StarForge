// src/data/strategicNotes.ts
import type { BuildingId, ResearchId, ShipId, DefenceId } from '../models/types.ts';

export type StrategicNoteType = 'building' | 'research' | 'ship' | 'defence';

const BUILDING_NOTES: Partial<Record<BuildingId, string>> = {
  metalMine:
    'The single highest-impact upgrade early game. Every other building depends on the metal flow this provides. Prioritise until Lv 20+ before diversifying.',
  crystalMine:
    'Crystal becomes the bottleneck around the time you start research-heavy upgrades. Keep within 1–2 levels of your Metal Mine.',
  deuteriumSynthesizer:
    'Cold planets produce more deuterium per level. Slot-place colonies on cold worlds before scaling this aggressively.',
  solarPlant:
    'The default early-game energy supply. Each Lv increases output but eventually loses to Fusion Reactor + Energy Tech for energy-per-deuterium efficiency.',
  fusionReactor:
    'Endgame energy. Pair with Energy Technology — fusion output scales with that tech, so plan upgrades together.',
  roboticsFactory:
    'Compounds on every other building. Even one extra level here saves hours across a long upgrade chain.',
  naniteFactory:
    'A single Nanite level halves all build times. The unlock cost is steep but the payoff is permanent.',
  shipyard:
    'Ships build linearly faster per shipyard level. Push to Lv 8+ before any large fleet build-out.',
  researchLab:
    'The cheapest cumulative speedup for the entire tech tree. Always queue Lv +1 when you have spare resources.',
};

const RESEARCH_NOTES: Partial<Record<ResearchId, string>> = {
  weaponsTechnology:
    'Pure offensive multiplier. Stacks with Plasma Technology bonus. Essential before any large-scale fleet engagement.',
  shieldingTechnology:
    'Survival math. Each level multiplies effective shield HP across every ship and turret you own.',
  armourTechnology:
    'The cheapest of the three combat techs. Soak more shots without losing fleet value.',
  computerTechnology:
    'Every level unlocks an additional fleet slot. Bottleneck for serious raiders past Lv 5.',
  astrophysicsTechnology:
    'Two levels = one new colony. Decide your colony slot ceiling early — late-game expansion runs through this tech.',
  plasmaTechnology:
    'A permanent mine production multiplier. The single most cost-efficient long-term economy upgrade.',
};

const SHIP_NOTES: Partial<Record<ShipId, string>> = {
  cruiser:
    'Rapid-fire against Light Fighters (×6). Excellent for clearing weak defenders. Poor against Battleships — mix with heavier units.',
  battleship:
    'Backbone of any serious fleet. Strong all-rounder; vulnerable to Battlecruisers without mixed support.',
  destroyer:
    'Counter to Battlecruisers. Pair with Battleships to neutralize cruiser swarms efficiently.',
  bomber:
    'Devastating against fixed defences. Bring at least a small bomber wing on any planet raid.',
  smallCargo:
    'Throughput for small economic transfers. Cargo capacity scales with combustion-drive level.',
  largeCargo:
    'The hauler. Use for raid recovery and long-distance resource shuttling.',
  espionageProbe:
    'Cheap recon. Send 5–10 to reduce the chance of detection on espionage missions.',
  recycler:
    'Sweeps debris fields after combat. Bring enough cargo capacity to recover full battle debris.',
  colonyShip:
    'One-shot vessel. Consumed on use; check planet temperature/fields before committing.',
};

const DEFENCE_NOTES: Partial<Record<DefenceId, string>> = {
  rocketLauncher:
    'Cheap meatshield. Builds in seconds and absorbs cruiser fire while heavier turrets do the work.',
  gaussCannon:
    'Best attack-per-resource of mid-tier defences. Specifically strong against Destroyers and Battleships.',
  plasmaTurret:
    'Top-tier fixed firepower. Place on high-value planets — moderate price tag, devastating output.',
  smallShieldDome:
    'Single-instance defensive shield. Build it on every planet you care about.',
  largeShieldDome:
    'Endgame shielding. Pairs with Small Shield Dome for stacking shield HP.',
};

export function getStrategicNote(
  type: StrategicNoteType,
  id: string,
): string | undefined {
  switch (type) {
    case 'building':
      return BUILDING_NOTES[id as BuildingId];
    case 'research':
      return RESEARCH_NOTES[id as ResearchId];
    case 'ship':
      return SHIP_NOTES[id as ShipId];
    case 'defence':
      return DEFENCE_NOTES[id as DefenceId];
  }
}
