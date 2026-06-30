import { Button } from "@orbit/ui/components/button";
import { ListTodoIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { CreateTaskDialog } from "./create-task-dialog";

export default function TimelineEmptyState({
	projectId,
}: {
	projectId: string;
}) {
	const [dialogOpen, setDialogOpen] = useState(false);

	return (
		<div className="flex h-full flex-col items-center justify-center gap-3 text-center">
			<ListTodoIcon className="size-10 text-muted-foreground" />
			<div className="space-y-1">
				<p className="text-sm font-medium text-foreground">No tasks yet</p>
				<p className="text-sm text-muted-foreground">
					Create your first task to start planning.
				</p>
			</div>
			<Button onClick={() => setDialogOpen(true)} className="gap-1.5">
				<PlusIcon className="size-4" />
				Create task
			</Button>
			<CreateTaskDialog
				projectId={projectId}
				open={dialogOpen}
				onOpenChange={setDialogOpen}
			/>
		</div>
	);
}
