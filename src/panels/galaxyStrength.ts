export function npcRelativeStrengthLabel(npcPower: number, playerMilitary: number): string {
  if (playerMilitary <= 0) return 'Easy';
  const ratio = npcPower / playerMilitary;
  if (ratio < 0.3) return 'Easy';
  if (ratio < 0.7) return 'Fair';
  if (ratio < 1.3) return 'Even';
  if (ratio < 2.5) return 'Hard';
  return 'Dangerous';
}
