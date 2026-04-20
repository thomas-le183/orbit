import type { ReactNode } from "react";

export function SettingsPage({
	title,
	subtitle,
	children,
}: {
	title: string;
	subtitle?: string;
	children: ReactNode;
}) {
	return (
		<div className="mx-auto max-w-2xl">
			<div className="mb-6">
				<h1 className="text-xl font-semibold">{title}</h1>
				{subtitle && (
					<p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
				)}
			</div>
			<div className="space-y-10">{children}</div>
		</div>
	);
}
