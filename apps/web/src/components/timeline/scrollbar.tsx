import { cn } from "@orbit/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTimelineController } from "./controller/context";
import { pxPerMs } from "./controller/geometry";

/** Fraction of a viewport to jump when clicking the empty track (port of SCROLL_BUTTON_STEP). */
const SCROLL_STEP = 0.25;
/** Small inset so the thumb never quite fills the track at full zoom-out. */
const THUMB_GAP_PX = 7;

type ContentBound = { offset: number; width: number };

/**
 * The scrollable extent the thumb maps against. Defaults to one year before today
 * through two years after, and is expanded to always contain the current viewport.
 * While dragging (`freeze`), the bound also includes the last-seen extent so the
 * thumb does not jump under the cursor.
 */
function useContentBound(freeze: boolean): ContentBound {
	const { offsetMs, viewportWidth, zoomLevel, today } = useTimelineController();
	const msToPx = (ms: number) => ms * pxPerMs(zoomLevel);
	const pxToMs = (px: number) => px / pxPerMs(zoomLevel);

	const [stickyMin, setStickyMin] = useState(Number.POSITIVE_INFINITY);
	const [stickyMax, setStickyMax] = useState(Number.NEGATIVE_INFINITY);

	// Default bound: today − 1 year → today + 2 years, as ms offsets relative to today.
	const cursor = new Date(today);
	cursor.setUTCFullYear(cursor.getUTCFullYear() - 1);
	const defaultFrom = cursor.getTime() - today;
	cursor.setUTCFullYear(cursor.getUTCFullYear() + 3);
	const defaultTo = cursor.getTime() - today;

	const viewportTo = offsetMs + pxToMs(viewportWidth);

	const fromValues = [offsetMs, defaultFrom];
	const toValues = [viewportTo, defaultTo];
	if (freeze) {
		fromValues.push(stickyMin);
		toValues.push(stickyMax);
	}
	const offsetFrom = Math.min(...fromValues);
	const offsetTo = Math.max(...toValues);

	useEffect(() => {
		setStickyMin(offsetFrom);
		setStickyMax(offsetTo);
	}, [offsetFrom, offsetTo]);

	return { offset: offsetFrom, width: msToPx(offsetTo - offsetFrom) };
}

/** Wires mouse interaction on the track and thumb to the controller's offsetMs. */
function useDragHandling(
	trackEl: HTMLElement | null,
	thumbEl: HTMLElement | null,
): boolean {
	const { offsetMs, viewportWidth, zoomLevel, setOffsetMs } =
		useTimelineController();

	const [isDragging, setIsDragging] = useState(false);
	const mouseDownX = useRef<number | null>(null);
	const originOffset = useRef(0);
	const thumbWidth = useRef(0);

	const handleMouseDownInThumb = useCallback(
		(e: MouseEvent) => {
			if (!thumbEl) return;
			setIsDragging(true);
			e.preventDefault(); // no text selection
			e.stopPropagation();
			thumbWidth.current = thumbEl.getBoundingClientRect().width;
			mouseDownX.current = e.clientX;
			originOffset.current = offsetMs;
		},
		[thumbEl, offsetMs],
	);

	const handleMouseDownInTrack = useCallback(
		(e: MouseEvent) => {
			if (!trackEl || !thumbEl) return;
			const { left: thumbX } = thumbEl.getBoundingClientRect();
			const direction = e.clientX < thumbX ? -1 : 1;
			const distancePx = viewportWidth * SCROLL_STEP * direction;
			setOffsetMs((offset) => offset + distancePx / pxPerMs(zoomLevel));
			e.preventDefault();
		},
		[trackEl, thumbEl, viewportWidth, setOffsetMs, zoomLevel],
	);

	const handleMouseDown = useCallback(
		(e: MouseEvent) => {
			if (e.target === thumbEl) return handleMouseDownInThumb(e);
			if (e.target === trackEl) return handleMouseDownInTrack(e);
		},
		[thumbEl, trackEl, handleMouseDownInThumb, handleMouseDownInTrack],
	);

	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			if (mouseDownX.current === null || thumbWidth.current === 0) return;
			const deltaX = e.clientX - mouseDownX.current;
			// Moving the thumb across the track scrolls the viewport across the content.
			const distancePx = (deltaX / thumbWidth.current) * viewportWidth;
			setOffsetMs(originOffset.current + distancePx / pxPerMs(zoomLevel));
		},
		[viewportWidth, setOffsetMs, zoomLevel],
	);

	const handleMouseUp = useCallback(() => {
		mouseDownX.current = null;
		setIsDragging(false);
	}, []);

	useEffect(() => {
		document.addEventListener("mousedown", handleMouseDown);
		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);
		return () => {
			document.removeEventListener("mousedown", handleMouseDown);
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, [handleMouseDown, handleMouseMove, handleMouseUp]);

	return isDragging;
}

export default function TimelineScrollbar() {
	const { offsetMs, viewportWidth, zoomLevel } = useTimelineController();
	const trackRef = useRef<HTMLDivElement>(null);
	const thumbRef = useRef<HTMLDivElement>(null);
	const isDragging = useDragHandling(trackRef.current, thumbRef.current);
	const contentBound = useContentBound(isDragging);

	const msToPx = (ms: number) => ms * pxPerMs(zoomLevel);
	// scale maps content-space px into the track (which is viewportWidth wide).
	const scale = contentBound.width > 0 ? viewportWidth / contentBound.width : 1;

	const thumb =
		viewportWidth === 0
			? { width: 0, left: 0 }
			: {
					width: Math.max(0, viewportWidth * Math.min(scale, 1) - THUMB_GAP_PX),
					left: msToPx(offsetMs - contentBound.offset) * scale,
				};

	return (
		<div className="relative h-2.5 w-full shrink-0">
			<div
				ref={trackRef}
				data-testid="timeline-scrollbar-track"
				className={cn(
					"absolute inset-x-0 bottom-0 h-2.5 rounded-full bg-muted/60",
					"transition-colors hover:bg-muted",
				)}
			>
				<div
					ref={thumbRef}
					data-testid="timeline-scrollbar-thumb"
					className="absolute bottom-0 h-2.5 cursor-grab rounded-full bg-foreground/30 hover:bg-foreground/40 active:cursor-grabbing"
					style={{
						width: `${thumb.width}px`,
						transform: `translateX(${thumb.left}px)`,
					}}
				/>
			</div>
		</div>
	);
}
