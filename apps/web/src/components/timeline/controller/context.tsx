import {
	createContext,
	type ReactNode,
	type RefObject,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
} from "react";
import { DEFAULT_ZOOM } from "../constants";
import { startOfUtcDay } from "../units/make-units";
import type { ZoomLevel } from "../units/types";
import { type Geometry, offsetToCenter } from "./geometry";

export type TimelineControllerValue = {
	today: number;
	offsetMs: number;
	zoomLevel: ZoomLevel;
	viewportWidth: number;
	/**
	 * The pannable viewport element. Attach it to the scrolling canvas so
	 * gestures can measure its horizontal edges for edge-triggered auto-scroll.
	 */
	viewportRef: RefObject<HTMLDivElement | null>;
	/**
	 * The vertically-scrolling rows container. Gestures measure its top/bottom
	 * edges and drive its `scrollTop` for edge-triggered vertical auto-scroll.
	 */
	scrollContainerRef: RefObject<HTMLDivElement | null>;
	/** Day the week begins on, 0 = Sunday … 6 = Saturday (user preference). */
	weekStart: number;
	setZoomLevel: (z: ZoomLevel) => void;
	setOffsetMs: (updater: number | ((prev: number) => number)) => void;
	setViewportWidth: (w: number) => void;
	scrollToToday: () => void;
	/** Pan so the given ms-offset-from-today sits at the viewport center. */
	scrollToMs: (ms: number) => void;
};

const TimelineContext = createContext<TimelineControllerValue | null>(null);

/** offsetMs that centers today in the viewport for the given geometry. */
const centeredOffset = (zoom: ZoomLevel, viewportWidth: number): number => {
	if (viewportWidth <= 0) return 0;
	const geom: Geometry = { offsetMs: 0, zoom, viewportWidth };
	return offsetToCenter(0, geom);
};

/** offsetMs that centers an arbitrary ms-offset-from-today in the viewport. */
const offsetForMs = (
	ms: number,
	zoom: ZoomLevel,
	viewportWidth: number,
): number => {
	if (viewportWidth <= 0) return 0;
	const geom: Geometry = { offsetMs: 0, zoom, viewportWidth };
	return offsetToCenter(ms, geom);
};

export function TimelineProvider({
	children,
	initialZoom = DEFAULT_ZOOM,
	weekStart = 1,
}: {
	children: ReactNode;
	initialZoom?: ZoomLevel;
	/** Day the week begins on, 0 = Sunday … 6 = Saturday. Defaults to Monday. */
	weekStart?: number;
}) {
	const [today] = useState(() => startOfUtcDay(Date.now()));
	const [zoomLevel, setZoomLevelState] = useState<ZoomLevel>(initialZoom);
	const [viewportWidth, setViewportWidthState] = useState(0);
	const [offsetMs, setOffsetMsState] = useState(0);
	const viewportRef = useRef<HTMLDivElement | null>(null);
	const scrollContainerRef = useRef<HTMLDivElement | null>(null);

	const zoomLevelRef = useRef(zoomLevel);
	zoomLevelRef.current = zoomLevel;

	const setViewportWidth = useCallback((w: number) => {
		setViewportWidthState((prevW) => {
			// On first real measurement, center today.
			if (prevW === 0 && w > 0) {
				setOffsetMsState(centeredOffset(zoomLevelRef.current, w));
			}
			return w;
		});
	}, []);

	const setZoomLevel = useCallback(
		(z: ZoomLevel) => {
			setZoomLevelState(z);
			// Re-anchor today at center on zoom change.
			setOffsetMsState(centeredOffset(z, viewportWidth));
		},
		[viewportWidth],
	);

	const setOffsetMs = useCallback(
		(updater: number | ((prev: number) => number)) => {
			setOffsetMsState((prev) =>
				typeof updater === "function" ? updater(prev) : updater,
			);
		},
		[],
	);

	const scrollToToday = useCallback(() => {
		setOffsetMsState(centeredOffset(zoomLevelRef.current, viewportWidth));
	}, [viewportWidth]);

	const scrollToMs = useCallback(
		(ms: number) => {
			setOffsetMsState(offsetForMs(ms, zoomLevelRef.current, viewportWidth));
		},
		[viewportWidth],
	);

	const value = useMemo<TimelineControllerValue>(
		() => ({
			today,
			offsetMs,
			zoomLevel,
			viewportWidth,
			viewportRef,
			scrollContainerRef,
			weekStart,
			setZoomLevel,
			setOffsetMs,
			setViewportWidth,
			scrollToToday,
			scrollToMs,
		}),
		[
			today,
			offsetMs,
			zoomLevel,
			viewportWidth,
			weekStart,
			setZoomLevel,
			setOffsetMs,
			setViewportWidth,
			scrollToToday,
			scrollToMs,
		],
	);

	return (
		<TimelineContext.Provider value={value}>
			{children}
		</TimelineContext.Provider>
	);
}

export function useTimelineController(): TimelineControllerValue {
	const ctx = useContext(TimelineContext);
	if (!ctx) {
		throw new Error(
			"useTimelineController must be used within a TimelineProvider",
		);
	}
	return ctx;
}
