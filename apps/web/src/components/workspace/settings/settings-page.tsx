import type { ReactNode } from "react";

export function SettingsPage({
	title,
	subtitle,
	action,
	children,
}: {
	title: string;
	subtitle?: string;
	action?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="mx-auto max-w-2xl">
			<div className="mb-6 flex items-start justify-between gap-4">
				<div>
					<h1 className="text-xl font-semibold">{title}</h1>
					{subtitle && (
						<p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
					)}
				</div>
				{action && <div className="shrink-0">{action}</div>}
			</div>
			<div className="space-y-10">{children}</div>
		</div>
	);
}
