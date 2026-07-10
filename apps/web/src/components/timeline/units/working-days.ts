/**
 * Non-working (weekend) day configuration.
 *
 * Today this is a fixed Saturday/Sunday weekend. It is centralised here so the
 * planned global- and per-user non-working-day settings only have to change the
 * source of `nonWorkingDays` — every consumer already reads it through
 * {@link isNonWorkingDay}.
 */

/** Days of the week that are non-working, 0 = Sunday … 6 = Saturday. Default: the weekend. */
export const DEFAULT_NON_WORKING_DAYS: readonly number[] = [0, 6];

/** Does the UTC day containing `ts` fall on a non-working day? */
export const isNonWorkingDay = (
	ts: number,
	nonWorkingDays: readonly number[] = DEFAULT_NON_WORKING_DAYS,
): boolean => nonWorkingDays.includes(new Date(ts).getUTCDay());
