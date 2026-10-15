/** Converts a Prisma BigInt copper value to a JS number (safe: prices are far below 2^53). */
export function toNumber(
  value: bigint | number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'bigint' ? Number(value) : value;
}
