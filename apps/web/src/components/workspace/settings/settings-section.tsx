import { cn } from "@orbit/ui/lib/utils";
import type { ReactNode } from "react";

export function SettingsSection({
	heading,
	tone = "default",
	children,
}: {
	heading?: string;
	tone?: "default" | "destructive";
	children: ReactNode;
}) {
	return (
		<section>
			{heading && (
				<h2
					className={cn(
						"mb-2 text-xs font-semibold uppercase tracking-wide",
						tone === "destructive"
							? "text-destructive"
							: "text-muted-foreground",
					)}
				>
					{heading}
				</h2>
			)}
			<div
				className={cn(
					"rounded-lg border bg-card",
					tone === "destructive" && "border-destructive/30",
				)}
			>
				{children}
			</div>
		</section>
	);
}
