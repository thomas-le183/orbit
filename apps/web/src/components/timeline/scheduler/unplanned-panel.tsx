import { cn } from "@orbit/shared";
import { Input } from "@orbit/ui/components/input";
import { Plus, Search } from "lucide-react";
import {
	type PointerEvent as ReactPointerEvent,
	type RefObject,
	useMemo,
	useState,
} from "react";
import { useTimelineData } from "../data/context";

const PANEL_WIDTH = 340;

/**
 * Right-edge list of tasks with no start or end date. Search filters by name.
 *
 * Overlays the split region rather than taking a column, so toggling it never
 * changes the timeline viewport width. z-50 clears the group column (z-30) and
 * the resize divider (z-40).
 */
export default function UnplannedPanel({
	beginDrag,
	draggingId,
	containerRef,
}: {
	beginDrag: (e: ReactPointerEvent, task: { id: string; name: string }) => void;
	draggingId: string | null;
	containerRef: RefObject<HTMLDivElement | null>;
}) {
	const { undatedTaskRows, createTask, projectId } = useTimelineData();
	const [query, setQuery] = useState("");
	const [newName, setNewName] = useState("");
	const [creating, setCreating] = useState(false);

	const visible = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return undatedTaskRows;
		return undatedTaskRows.filter((t) => t.name.toLowerCase().includes(q));
	}, [undatedTaskRows, query]);

	// Omitting both dates is what makes the task unplanned; it lands back in this
	// list once the create invalidates the tasks query.
	const submitNewTask = async () => {
		const name = newName.trim();
		if (!name || creating) return;
		setCreating(true);
		try {
			await createTask({ name });
			setNewName("");
		} catch {
			/* useCreateTask surfaces the error toast */
		} finally {
			setCreating(false);
		}
	};

	return (
		<div
			ref={containerRef}
			data-testid="scheduler-unplanned-panel"
			className="absolute inset-y-0 right-0 z-50 flex flex-col border-l border-border bg-background-primary shadow-lg"
			style={{ width: PANEL_WIDTH }}
		>
			<div className="shrink-0 border-b border-border px-3 py-2">
				<div className="flex items-center justify-between gap-2">
					<span className="text-sm font-medium">Unplanned</span>
					<span className="text-xs text-muted-foreground">
						{undatedTaskRows.length}
					</span>
				</div>
				<div className="relative mt-2">
					<Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search tasks"
						aria-label="Search unplanned tasks"
						className="h-8 pl-7 text-sm"
					/>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto p-2">
				{visible.length === 0 ? (
					<p className="px-1 py-6 text-center text-xs text-muted-foreground">
						{undatedTaskRows.length === 0 ? "No unplanned tasks" : "No matches"}
					</p>
				) : (
					<ul className="flex flex-col gap-1">
						{visible.map((task) => (
							<li key={task.id}>
								<div
									data-testid="unplanned-task"
									data-task-id={task.id}
									onPointerDown={(e) =>
										beginDrag(e, { id: task.id, name: task.name })
									}
									className={cn(
										"cursor-grab touch-none truncate rounded-md border border-border px-2 py-1.5 text-sm select-none hover:bg-accent",
										draggingId === task.id && "opacity-50",
									)}
								>
									{task.name}
								</div>
							</li>
						))}
					</ul>
				)}
			</div>

			<form
				className="shrink-0 border-t border-border p-2"
				onSubmit={(e) => {
					e.preventDefault();
					submitNewTask();
				}}
			>
				<div className="relative">
					<Plus className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={newName}
						onChange={(e) => setNewName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Escape") setNewName("");
						}}
						placeholder="Add task"
						aria-label="New task name"
						disabled={!projectId || creating}
						className="h-8 pl-7 text-sm"
					/>
				</div>
			</form>
		</div>
	);
}
