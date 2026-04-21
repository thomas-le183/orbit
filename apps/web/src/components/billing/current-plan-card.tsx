import { TIER_METADATA } from "@orbit/shared";
import { Badge } from "@orbit/ui/components/badge";
import { Button } from "@orbit/ui/components/button";
import { Separator } from "@orbit/ui/components/separator";
import { useParams } from "@tanstack/react-router";
import { CalendarDays, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { useOrgSubscription, usePortal } from "@/hooks/use-billing";

const STATUS_BADGE: Record<
	string,
	{
		label: string;
		variant: "default" | "secondary" | "destructive" | "outline";
	}
> = {
	active: { label: "Active", variant: "default" },
	trialing: { label: "Trial", variant: "secondary" },
	past_due: { label: "Past due", variant: "destructive" },
	canceled: { label: "Canceled", variant: "destructive" },
	unpaid: { label: "Unpaid", variant: "destructive" },
};

export function CurrentPlanCard() {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const { data, isLoading } = useOrgSubscription(orgSlug);
	const portal = usePortal(orgSlug);

	if (isLoading || !data) {
		return <div className="h-48 animate-pulse rounded-lg bg-muted" />;
	}

	const meta = TIER_METADATA[data.tier];
	const { current } = data.usage.members;

	const statusInfo = data.subscription
		? (STATUS_BADGE[data.subscription.status] ?? {
				label: data.subscription.status,
				variant: "secondary" as const,
			})
		: null;

	const periodEnd = data.subscription
		? new Date(data.subscription.currentPeriodEnd).toLocaleDateString(
				undefined,
				{
					month: "short",
					day: "numeric",
					year: "numeric",
				},
			)
		: null;

	function handlePortal() {
		portal.mutate(undefined, {
			onError: () => toast.error("Could not open billing portal."),
		});
	}

	return (
		<div className="rounded-lg border p-6 space-y-5 bg-card">
			{/* Header */}
			<div className="flex items-start justify-between gap-4">
				<div className="space-y-1">
					<div className="flex items-center gap-2 flex-wrap">
						<span>{meta.label}</span>
						<Badge variant="secondary" className="capitalize">
							{data.tier}
						</Badge>
						{statusInfo && (
							<Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
						)}
					</div>
				</div>
			</div>

			{/* Billing cycle */}
			{data.subscription && periodEnd && (
				<div className="flex items-center gap-2 text-sm">
					<CalendarDays className="size-4 text-muted-foreground shrink-0" />
					<span className="text-muted-foreground">
						{data.subscription.cancelAtPeriodEnd ? "Cancels on" : "Renews on"}
					</span>
					<span>{periodEnd}</span>
				</div>
			)}

			{/* Seat usage */}
			<div className="flex items-center gap-2 text-sm">
				<Users className="size-4 text-muted-foreground shrink-0" />
				<span className="text-muted-foreground">Total members</span>
				<span>{current}</span>
			</div>

			{/* Feature flags */}
			<div className="flex items-center gap-2 flex-wrap">
				<Zap className="size-4 text-muted-foreground shrink-0" />
				{meta.flags.hasAdvancedAnalytics && (
					<Badge variant="outline" className="text-xs">
						Advanced analytics
					</Badge>
				)}
				{meta.flags.hasCustomBranding && (
					<Badge variant="outline" className="text-xs">
						Custom branding
					</Badge>
				)}
				{meta.flags.hasSSO && (
					<Badge variant="outline" className="text-xs">
						SSO
					</Badge>
				)}
				{!meta.flags.hasAdvancedAnalytics &&
					!meta.flags.hasCustomBranding &&
					!meta.flags.hasSSO && (
						<span className="text-xs text-muted-foreground">
							Basic features
						</span>
					)}
			</div>

			{/* Actions */}
			{data.subscription && (
				<>
					<Separator />
					<Button
						variant="outline"
						size="sm"
						onClick={handlePortal}
						disabled={portal.isPending}
					>
						Manage subscription
					</Button>
				</>
			)}
		</div>
	);
}
