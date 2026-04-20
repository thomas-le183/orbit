import { TIER_METADATA } from "@orbit/shared";
import { Badge } from "@orbit/ui/components/badge";
import { Button } from "@orbit/ui/components/button";
import { useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { useOrgSubscription, usePortal } from "@/hooks/use-billing";

export function CurrentPlanCard() {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const { data, isLoading } = useOrgSubscription(orgSlug);
	const portal = usePortal(orgSlug);

	if (isLoading || !data) {
		return <div className="h-32 animate-pulse rounded-lg bg-muted" />;
	}

	const meta = TIER_METADATA[data.tier];
	const { current, limit } = data.usage.members;
	const usagePercent = limit === -1 ? 0 : Math.round((current / limit) * 100);

	function handlePortal() {
		portal.mutate(undefined, {
			onError: () => toast.error("Could not open billing portal."),
		});
	}

	return (
		<div className="space-y-4 rounded-lg border p-6">
			<div className="flex items-center justify-between">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<span className="font-semibold">{meta.label}</span>
						<Badge variant="secondary">{data.tier}</Badge>
					</div>
					{data.subscription && (
						<p className="text-sm text-muted-foreground">
							{data.subscription.cancelAtPeriodEnd
								? `Cancels on ${new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}`
								: `Renews ${new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}`}
						</p>
					)}
				</div>
				{data.subscription && (
					<Button
						variant="outline"
						size="sm"
						onClick={handlePortal}
						disabled={portal.isPending}
					>
						Manage subscription
					</Button>
				)}
			</div>

			<div className="space-y-1">
				<div className="flex justify-between text-sm">
					<span className="text-muted-foreground">Members</span>
					<span>
						{current} / {limit === -1 ? "Unlimited" : limit}
					</span>
				</div>
				{limit !== -1 && (
					<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-primary transition-all"
							style={{ width: `${usagePercent}%` }}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
