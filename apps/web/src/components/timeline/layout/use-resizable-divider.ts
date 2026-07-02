import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef, useState } from "react";
import { clampTableWidth, DEFAULT_TABLE_WIDTH } from "./divider";

/** Drag-to-resize + collapse state for the table | timeline divider. */
export function useResizableDivider(
	initialWidth: number = DEFAULT_TABLE_WIDTH,
): {
	/** Effective table width (0 while collapsed). */
	tableWidth: number;
	/** Whether the table column is collapsed to zero width. */
	collapsed: boolean;
	/** Toggle the table column between collapsed and its last dragged width. */
	toggleCollapsed: () => void;
	onDividerPointerDown: (e: ReactPointerEvent) => void;
} {
	const [width, setWidth] = useState(initialWidth);
	const [collapsed, setCollapsed] = useState(false);
	const startX = useRef(0);
	const startWidth = useRef(0);

	const onDividerPointerDown = (e: ReactPointerEvent) => {
		// The divider is hidden while collapsed; ignore any stray drag.
		if (collapsed) return;
		e.preventDefault();
		startX.current = e.clientX;
		startWidth.current = width;

		const onMove = (ev: PointerEvent) => {
			const next = startWidth.current + (ev.clientX - startX.current);
			setWidth(clampTableWidth(next));
		};
		const onUp = () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	};

	return {
		tableWidth: collapsed ? 0 : width,
		collapsed,
		toggleCollapsed: () => setCollapsed((c) => !c),
		onDividerPointerDown,
	};
}
