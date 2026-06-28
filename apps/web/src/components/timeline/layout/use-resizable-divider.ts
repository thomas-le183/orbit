import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef, useState } from "react";
import { clampTableWidth, DEFAULT_TABLE_WIDTH } from "./divider";

/** Drag-to-resize state for the table | timeline divider. */
export function useResizableDivider(
	initialWidth: number = DEFAULT_TABLE_WIDTH,
): {
	tableWidth: number;
	onDividerPointerDown: (e: ReactPointerEvent) => void;
} {
	const [tableWidth, setTableWidth] = useState(initialWidth);
	const startX = useRef(0);
	const startWidth = useRef(0);

	const onDividerPointerDown = (e: ReactPointerEvent) => {
		e.preventDefault();
		startX.current = e.clientX;
		startWidth.current = tableWidth;

		const onMove = (ev: PointerEvent) => {
			const next = startWidth.current + (ev.clientX - startX.current);
			setTableWidth(clampTableWidth(next));
		};
		const onUp = () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	};

	return { tableWidth, onDividerPointerDown };
}
