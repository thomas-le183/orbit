import { createContext, type ReactNode, useContext } from "react";
import type { RelativeTimeRangeOffset } from "../units/types";

/**
 * The range of an in-progress bar drag/resize, shared with the header so it can
 * tint the spanned axis cells. The header band and the lanes body are separate
 * branches of the layout tree, and `TimeUnitsBar` is shared with the Gantt view,
 * so this travels by context rather than props.
 *
 * The provider's caller decides when a drag counts as "in progress" — consumers
 * highlight whenever the range is non-null.
 */
const DragRangeContext = createContext<RelativeTimeRangeOffset | null>(null);

export function DragRangeProvider({
	range,
	children,
}: {
	range: RelativeTimeRangeOffset | null;
	children: ReactNode;
}) {
	return (
		<DragRangeContext.Provider value={range}>
			{children}
		</DragRangeContext.Provider>
	);
}

/** The live drag range, or null when no drag is in progress. */
export function useDragRange(): RelativeTimeRangeOffset | null {
	return useContext(DragRangeContext);
}
