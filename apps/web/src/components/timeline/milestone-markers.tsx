import { useTimelineController } from "./controller/context";
import { useHorizontalPercentageOffset } from "./controller/hooks";
import { useTimelineData } from "./data/context";
import { startOfUtcDay } from "./units/make-units";

/**
 * Diamond markers on the timeline axis, one per project milestone, positioned
 * at the milestone's date. Rendered over the pinned timeline background band.
 */
export default function MilestoneMarkers() {
	const { milestoneMarkers } = useTimelineData();
	const { today } = useTimelineController();
	const { getPercentageOffset } = useHorizontalPercentageOffset();

	if (milestoneMarkers.length === 0) return null;

	return (
		<div className="pointer-events-none absolute inset-0 z-10">
			{milestoneMarkers.map((m) => {
				const ms = startOfUtcDay(Date.parse(m.date)) - today;
				const left = getPercentageOffset(ms);
				if (!Number.isFinite(left) || left < 0 || left > 100) return null;
				return (
					<div
						key={m.id}
						data-testid="timeline-milestone-marker"
						aria-label={m.name}
						title={m.name}
						className="pointer-events-auto absolute top-0 -translate-x-1/2"
						style={{ left: `${left}%` }}
					>
						<div
							className="size-2.5 rotate-45 rounded-[2px] border border-background shadow-sm"
							style={{ backgroundColor: m.color }}
						/>
					</div>
				);
			})}
		</div>
	);
}
