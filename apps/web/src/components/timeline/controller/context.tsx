import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
} from "react";
import { DEFAULT_ZOOM } from "../constants";
import { startOfUtcDay } from "../units/make-units";
import type { ZoomLevel } from "../units/types";
import { type Geometry, msPerViewport } from "./geometry";

export type TimelineControllerValue = {
	today: number;
	offsetMs: number;
	zoomLevel: ZoomLevel;
	viewportWidth: number;
	setZoomLevel: (z: ZoomLevel) => void;
	setOffsetMs: (updater: number | ((prev: number) => number)) => void;
	setViewportWidth: (w: number) => void;
};

const TimelineContext = createContext<TimelineControllerValue | null>(null);

/** offsetMs that centers today in the viewport for the given geometry. */
const centeredOffset = (zoom: ZoomLevel, viewportWidth: number): number => {
	if (viewportWidth <= 0) return 0;
	const geom: Geometry = { offsetMs: 0, zoom, viewportWidth };
	return -msPerViewport(geom) / 2;
};

export function TimelineProvider({
	children,
	initialZoom = DEFAULT_ZOOM,
}: {
	children: ReactNode;
	initialZoom?: ZoomLevel;
}) {
	const [today] = useState(() => startOfUtcDay(Date.now()));
	const [zoomLevel, setZoomLevelState] = useState<ZoomLevel>(initialZoom);
	const [viewportWidth, setViewportWidthState] = useState(0);
	const [offsetMs, setOffsetMsState] = useState(0);

	const zoomLevelRef = useRef(zoomLevel);
	zoomLevelRef.current = zoomLevel;

	const setViewportWidth = useCallback(
		(w: number) => {
			setViewportWidthState((prevW) => {
				// On first real measurement, center today.
				if (prevW === 0 && w > 0) {
					setOffsetMsState(centeredOffset(zoomLevelRef.current, w));
				}
				return w;
			});
		},
		[zoomLevelRef],
	);

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

	const value = useMemo<TimelineControllerValue>(
		() => ({
			today,
			offsetMs,
			zoomLevel,
			viewportWidth,
			setZoomLevel,
			setOffsetMs,
			setViewportWidth,
		}),
		[today, offsetMs, zoomLevel, viewportWidth, setZoomLevel, setOffsetMs, setViewportWidth],
	);

	return <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>;
}

export function useTimelineController(): TimelineControllerValue {
	const ctx = useContext(TimelineContext);
	if (!ctx) {
		throw new Error("useTimelineController must be used within a TimelineProvider");
	}
	return ctx;
}
