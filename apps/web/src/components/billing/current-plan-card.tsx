import { PLAN_METADATA } from "@orbit/shared";
import { Badge } from "@orbit/ui/components/badge";
import { Button } from "@orbit/ui/components/button";
import { useParams } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useOrgSubscription, usePortal } from "@/hooks/use-billing";

const STATUS_BADGE: Record<
	string,
	{ label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
	active: { label: "Active", variant: "default" },
	trialing: { label: "Trial", variant: "secondary" },
	past_due: { label: "Past due", variant: "destructive" },
	canceled: { label: "Canceled", variant: "destructive" },
	unpaid: { label: "Unpaid", variant: "destructive" },
};

function formatDate(date: Date | string) {
	return new Date(date).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function getBillingInterval(
	start: Date | string,
	end: Date | string,
): "Monthly" | "Yearly" {
	const days =
		(new Date(end).getTime() - new Date(start).getTime()) / 86_400_000;
	return days > 60 ? "Yearly" : "Monthly";
}

export function CurrentPlanCard() {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const { data, isLoading } = useOrgSubscription(orgSlug);
	const portal = usePortal(orgSlug);

	if (isLoading || !data) {
		return <div className="h-36 animate-pulse rounded-lg bg-muted" />;
	}

	const meta = PLAN_METADATA[data.plan];
	const sub = data.subscription;

	const statusInfo = sub
		? (STATUS_BADGE[sub.status] ?? { label: sub.status, variant: "secondary" as const })
		: null;

	const isPastDue = sub?.status === "past_due";
	const isCancelingAtEnd = sub?.cancelAtPeriodEnd && sub.status !== "canceled";
	const isCanceled = sub?.status === "canceled";
	const interval = sub
		? getBillingInterval(sub.currentPeriodStart, sub.currentPeriodEnd)
		: null;

	const renewalLabel = isCanceled || isCancelingAtEnd ? "Access until" : "Renews";

	function handlePortal() {
		portal.mutate(undefined, {
			onError: () => toast.error("Could not open billing portal."),
		});
	}

	return (
		<div className="rounded-lg border bg-card">
			{/* Header */}
			<div className="flex items-start justify-between gap-4 p-6 pb-4">
				<div className="space-y-1.5">
					<div className="flex flex-wrap items-center gap-2">
						<span className="text-base font-semibold">{meta.label}</span>
						{statusInfo && (
							<Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
						)}
						{interval && (
							<Badge variant="outline">{interval}</Badge>
						)}
					</div>
					<p className="text-sm text-muted-foreground">{meta.description}</p>
				</div>

				{sub && (
					<Button
						variant="outline"
						size="sm"
						className="shrink-0"
						onClick={handlePortal}
						disabled={portal.isPending}
					>
						Manage
					</Button>
				)}
			</div>

			{/* Alerts */}
			{isPastDue && (
				<div className="mx-6 mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					<AlertTriangle className="mt-0.5 size-4 shrink-0" />
					<span>
						Your last payment failed. Please update your payment method to avoid
						service interruption.
					</span>
				</div>
			)}

			{isCancelingAtEnd && (
				<div className="mx-6 mb-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
					<AlertTriangle className="mt-0.5 size-4 shrink-0" />
					<span>
						Subscription cancels on{" "}
						<strong>{formatDate(sub.currentPeriodEnd)}</strong>. You'll keep
						full access until then.
					</span>
				</div>
			)}

			{isCanceled && (
				<div className="mx-6 mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					<AlertTriangle className="mt-0.5 size-4 shrink-0" />
					<span>
						Subscription canceled. Access continues until{" "}
						<strong>{formatDate(sub.currentPeriodEnd)}</strong>.
					</span>
				</div>
			)}

			{/* Details grid */}
			<div className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-2 px-6 pb-6 text-sm">
				{sub && (
					<>
						<span className="text-muted-foreground">{renewalLabel}</span>
						<span
							className={
								isCancelingAtEnd || isCanceled
									? "font-medium text-amber-600 dark:text-amber-400"
									: ""
							}
						>
							{formatDate(sub.currentPeriodEnd)}
						</span>
					</>
				)}

				<span className="text-muted-foreground">Seats</span>
				<span>
					{data.usage.members.current}
					{data.usage.members.limit !== -1 && (
						<span className="text-muted-foreground">
							{" "}
							/ {data.usage.members.limit}
						</span>
					)}
				</span>
			</div>
		</div>
	);
}
