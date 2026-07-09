import type { RelativeTimeRangeOffset } from "../units/types";

/**
 * Whether a half-open axis unit `[from, to)` intersects a drag range. Both spans
 * carry an exclusive `to`, so they overlap when each starts strictly before the
 * other ends. A null range (no drag in progress) never overlaps.
 */
export function overlapsRange(
	unit: { from: number; to: number },
	range: RelativeTimeRangeOffset | null,
): boolean {
	if (!range) return false;
	return unit.from < range.to && unit.to > range.from;
}
