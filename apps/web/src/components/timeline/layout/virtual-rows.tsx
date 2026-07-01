import { useVirtualizer } from "@tanstack/react-virtual";
import {
	createContext,
	type ReactNode,
	type RefObject,
	useContext,
} from "react";
import { ROW_HEIGHT } from "./row-metrics";

/**
 * Shared vertical windowing for the two timeline panes. The table column and the
 * items layer live inside one scroll container and stack rows against the same
 * fixed `ROW_HEIGHT`, so a single virtualizer decides which row indices both
 * panes render — keeping them in perfect lockstep.
 */
type VirtualRowsValue = {
	/** Whether the row at this global index is inside the rendered window. */
	isVisible: (index: number) => boolean;
	/** Whether any row in the inclusive `[start, end]` span is rendered. */
	isSpanVisible: (start: number, end: number) => boolean;
};

/** No provider (or an unmeasured viewport) → render every row. */
const RENDER_ALL: VirtualRowsValue = {
	isVisible: () => true,
	isSpanVisible: () => true,
};

const Ctx = createContext<VirtualRowsValue>(RENDER_ALL);

/** Read the shared row window. Falls back to render-all outside a provider. */
export function useVirtualRows(): VirtualRowsValue {
	return useContext(Ctx);
}

export function VirtualRowsProvider({
	scrollRef,
	count,
	children,
}: {
	scrollRef: RefObject<HTMLDivElement | null>;
	count: number;
	children: ReactNode;
}) {
	const virtualizer = useVirtualizer({
		count,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => ROW_HEIGHT,
		overscan: 8,
	});

	const virtualItems = virtualizer.getVirtualItems();
	// Until the scroll container has a measured height (initial mount, jsdom),
	// window every row rather than flashing an empty pane.
	const measured =
		virtualItems.length > 0 && (scrollRef.current?.clientHeight ?? 0) > 0;

	let value = RENDER_ALL;
	if (measured) {
		const first = virtualItems[0].index;
		const last = virtualItems[virtualItems.length - 1].index;
		value = {
			isVisible: (index) => index >= first && index <= last,
			isSpanVisible: (start, end) => start <= last && end >= first,
		};
	}

	return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
