import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import type { RelativeTimeRangeOffset } from "../units/types";

/**
 * Live state of an in-progress bar drag/resize, shared with the header so it can
 * tint the spanned day cells at fine zooms and pin a date label above the cursor
 * at coarse zooms.
 *
 * The header band and the lanes body are separate branches of the layout tree,
 * and both the scheduler and the Gantt own their drag state deep in the body, so
 * this travels by context: the body *publishes* via `usePublishDragRange`, the
 * header *reads* via `useDragRange`. With no provider (or nothing published) the
 * header reads `null` and shows no drag feedback.
 */
export type DragRangeState = {
	range: RelativeTimeRangeOffset;
	/** Cursor x in viewport (client) px, for anchoring the coarse-zoom label. */
	pointerX: number;
};

const ValueContext = createContext<DragRangeState | null>(null);
const SetContext = createContext<(state: DragRangeState | null) => void>(
	() => {},
);

export function DragRangeProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<DragRangeState | null>(null);
	return (
		<SetContext.Provider value={setState}>
			<ValueContext.Provider value={state}>{children}</ValueContext.Provider>
		</SetContext.Provider>
	);
}

/** The live drag state, or null when no drag is in progress. */
export function useDragRange(): DragRangeState | null {
	return useContext(ValueContext);
}

/**
 * Publish the body's live drag to the header. Pass `null` (or a null pointer)
 * whenever no drag is in progress; the header then shows nothing. Always clears
 * on unmount so a stale range can't linger.
 */
export function usePublishDragRange(
	range: RelativeTimeRangeOffset | null,
	pointerX: number | null,
) {
	const set = useContext(SetContext);
	useEffect(() => {
		set(range && pointerX != null ? { range, pointerX } : null);
	}, [set, range, pointerX]);
	useEffect(() => () => set(null), [set]);
}

/** Declarative form of `usePublishDragRange`, handy in layouts and tests. */
export function DragRangePublisher({
	range,
	pointerX,
}: {
	range: RelativeTimeRangeOffset | null;
	pointerX: number | null;
}) {
	usePublishDragRange(range, pointerX);
	return null;
}
