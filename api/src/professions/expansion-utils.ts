export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Derives the expansion name from a Blizzard skill tier name.
 * e.g. "Khaz Algar Alchemy" -> "Khaz Algar", "Midnight Alchemy" -> "Midnight", "Alchemy" -> "Classic".
 * When the tier name contains the configured target expansion name, that name wins.
 */
export function deriveExpansionName(
  skillTierName: string,
  professionName: string,
  targetExpansionName?: string,
): string {
  if (
    targetExpansionName &&
    skillTierName.toLowerCase().includes(targetExpansionName.toLowerCase())
  ) {
    return targetExpansionName;
  }
  const stripped = skillTierName
    .replace(new RegExp(`\\b${escapeRegExp(professionName)}\\b`, 'i'), '')
    .trim();
  return stripped === '' ? 'Classic' : stripped;
}

/**
 * Picks only the skill tier matching the configured target. Never substitute another expansion.
 */
export function pickTargetSkillTier<T extends { id: number; name: string }>(
  tiers: readonly T[],
  targetExpansionName: string,
): T | undefined {
  const target = targetExpansionName.toLowerCase();
  return tiers.find((tier) => tier.name.toLowerCase().includes(target));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
