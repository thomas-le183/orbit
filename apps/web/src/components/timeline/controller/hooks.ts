import { useMemo } from "react";
import { RENDER_BUFFER_SCREENS } from "../constants";
import type { ZoomLevel } from "../units/types";
import { useTimelineController } from "./context";
import { type Geometry, msPerViewport, msToPercent } from "./geometry";

export function useZoomLevel(): [ZoomLevel, (z: ZoomLevel) => void] {
	const { zoomLevel, setZoomLevel } = useTimelineController();
	return [zoomLevel, setZoomLevel];
}

export function useRenderingWindow(): { today: number; from: number; to: number } {
	const { today, offsetMs, zoomLevel, viewportWidth } = useTimelineController();
	return useMemo(() => {
		const span = msPerViewport({ offsetMs, zoom: zoomLevel, viewportWidth });
		const buffer = span * RENDER_BUFFER_SCREENS;
		return { today, from: offsetMs - buffer, to: offsetMs + span + buffer };
	}, [today, offsetMs, zoomLevel, viewportWidth]);
}

export function useHorizontalPercentageOffset(): {
	getPercentageOffset: (ms: number) => number;
} {
	const { offsetMs, zoomLevel, viewportWidth } = useTimelineController();
	return useMemo(() => {
		const geom: Geometry = { offsetMs, zoom: zoomLevel, viewportWidth };
		return { getPercentageOffset: (ms: number) => msToPercent(ms, geom) };
	}, [offsetMs, zoomLevel, viewportWidth]);
}
