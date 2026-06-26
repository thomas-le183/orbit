import { useHorizontalPercentageOffset } from "./controller/hooks";

export default function NowLine() {
	const { getPercentageOffset } = useHorizontalPercentageOffset();

	// today is the origin, so the offset of "today" in ms-relative-to-today is 0.
	const leftPercent = getPercentageOffset(0);

	if (!Number.isFinite(leftPercent)) return null;

	return (
		<div
			data-testid="timeline-now-line"
			className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-sky-500"
			style={{ left: `${leftPercent}%` }}
		>
			<span className="absolute -top-px -left-[3px] h-0 w-0 border-r-4 border-l-4 border-t-[7px] border-r-transparent border-l-transparent border-t-sky-500" />
		</div>
	);
}
