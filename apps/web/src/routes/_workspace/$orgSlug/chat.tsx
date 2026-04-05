import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_workspace/$orgSlug/chat")({
	component: ChatPage,
});

function ChatPage() {
	return (
		<div className="flex h-[calc(100vh-8rem)] gap-0 overflow-hidden rounded-xl border">
			{/* Channel list */}
			<div className="w-56 shrink-0 border-r">
				<div className="p-3">
					<p className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Channels</p>
					<div className="mt-2 space-y-0.5">
						{["# general", "# announcements", "# random"].map((ch) => (
							<button
								key={ch}
								type="button"
								className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted first:bg-muted first:font-medium"
							>
								{ch}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* Chat area */}
			<div className="flex flex-1 flex-col">
				<div className="flex h-12 items-center border-b px-4">
					<span className="text-sm font-medium"># general</span>
				</div>
				<div className="flex-1 overflow-y-auto p-4">
					<p className="text-sm text-muted-foreground">No messages yet. Say hello!</p>
				</div>
				<div className="border-t p-3">
					<input
						className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
						placeholder="Message #general…"
					/>
				</div>
			</div>
		</div>
	);
}
