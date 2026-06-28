/**
 * Inclusive id range between `anchorId` and `targetId` within `orderedIds`.
 * - target not found → `[]`
 * - anchor null or not found → `[targetId]`
 * - order-independent (anchor may sit before or after target)
 */
export function rangeIds(
	orderedIds: string[],
	anchorId: string | null,
	targetId: string,
): string[] {
	const targetIdx = orderedIds.indexOf(targetId);
	if (targetIdx === -1) return [];
	const anchorIdx = anchorId === null ? -1 : orderedIds.indexOf(anchorId);
	if (anchorIdx === -1) return [targetId];
	const lo = Math.min(anchorIdx, targetIdx);
	const hi = Math.max(anchorIdx, targetIdx);
	return orderedIds.slice(lo, hi + 1);
}
