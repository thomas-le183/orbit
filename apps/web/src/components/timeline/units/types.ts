export type ZoomLevel = "weeks" | "months" | "quarters" | "years";

export type UnitType = "day" | "week" | "month" | "quarter" | "year";

/** A horizontal slice of the axis. `from`/`to` are ms offsets relative to today. */
export type Unit = { from: number; to: number; type: UnitType };

/** A time range expressed as ms offsets relative to today. */
export type RelativeTimeRangeOffset = { from: number; to: number };
