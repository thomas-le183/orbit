import SplitLayout from "./layout/split-layout";
import TimelineTable, { TimelineTableHeader } from "./layout/timeline-table";

export default function TimelineView() {
	return (
		<div className="h-full">
			<SplitLayout
				tableHeader={<TimelineTableHeader />}
				table={<TimelineTable />}
			/>
		</div>
	);
}
