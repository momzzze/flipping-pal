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
 * Picks the skill tier to import: the one matching the target expansion name,
 * otherwise the newest tier (Blizzard skill tier ids increase with each expansion).
 */
export function pickTargetSkillTier<T extends { id: number; name: string }>(
  tiers: readonly T[],
  targetExpansionName: string,
): T | undefined {
  const target = targetExpansionName.toLowerCase();
  const match = tiers.find((tier) => tier.name.toLowerCase().includes(target));
  if (match) return match;
  return [...tiers].sort((a, b) => b.id - a.id)[0];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
