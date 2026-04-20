import { useCallback, useRef, useState } from "react";

export function useSaveIndicator(durationMs = 1500) {
	const [saved, setSaved] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const trigger = useCallback(() => {
		setSaved(true);
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => setSaved(false), durationMs);
	}, [durationMs]);
	return { saved, trigger };
}
