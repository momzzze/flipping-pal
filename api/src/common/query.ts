/** Parses an optional positive integer query parameter, falling back on invalid input. */
export function parsePositiveInt(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = value === undefined ? NaN : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
