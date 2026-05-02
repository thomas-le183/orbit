import { cn } from "@orbit/ui/lib/utils";
import type { ReactNode } from "react";

export function SettingsRow({
	label,
	hint,
	last = false,
	children,
}: {
	label: string;
	hint?: string;
	last?: boolean;
	children: ReactNode;
}) {
	return (
		<div
			className={cn(
				"flex items-center justify-between gap-10 px-5 py-4",
				!last && "border-b",
			)}
		>
			<div className="min-w-0 flex-1">
				<p>{label}</p>
				{hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
			</div>
			<div className="relative w-70 shrink-0">
				{children}
			</div>
		</div>
	);
}
