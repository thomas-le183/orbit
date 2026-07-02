import { useCallback, useState } from "react";

/** Which layout the project view renders. */
export type ViewMode = "timeline" | "scheduler";

const STORAGE_KEY = "orbit.project.viewMode";

const isViewMode = (v: unknown): v is ViewMode =>
	v === "timeline" || v === "scheduler";

/**
 * Persisted layout choice (timeline vs. scheduler), stored in localStorage so it
 * survives reloads. Falls back to `defaultMode` when unset or unavailable.
 */
export function useViewMode(
	defaultMode: ViewMode = "timeline",
): [ViewMode, (mode: ViewMode) => void] {
	const [mode, setModeState] = useState<ViewMode>(() => {
		try {
			const stored = window.localStorage.getItem(STORAGE_KEY);
			return isViewMode(stored) ? stored : defaultMode;
		} catch {
			return defaultMode;
		}
	});

	const setMode = useCallback((next: ViewMode) => {
		setModeState(next);
		try {
			window.localStorage.setItem(STORAGE_KEY, next);
		} catch {}
	}, []);

	return [mode, setMode];
}
