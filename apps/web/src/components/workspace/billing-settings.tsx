import type { SubscriptionTier } from "@orbit/shared";
import { TIER_METADATA } from "@orbit/shared";
import { Badge } from "@orbit/ui/components/badge";
import { Button } from "@orbit/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@orbit/ui/components/card";
import {
	Progress,
	ProgressIndicator,
	ProgressTrack,
} from "@orbit/ui/components/progress";
import { cn } from "@orbit/ui/lib/utils";
import {
	CheckIcon,
	CrownIcon,
	ExternalLinkIcon,
	Loader2Icon,
} from "lucide-react";
import {
	useCheckout,
	useOrgSubscription,
	usePortal,
} from "@/hooks/use-billing";

const tierColors: Record<SubscriptionTier, string> = {
	free: "bg-muted text-muted-foreground",
	team: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
	pro: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
	enterprise: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export function BillingSettings({ orgSlug }: { orgSlug: string }) {
	const { data, isLoading, error, refetch } = useOrgSubscription(orgSlug);
	const { mutate: checkout, isPending: checkoutLoading } = useCheckout(orgSlug);
	const { mutate: openPortal, isPending: portalLoading } = usePortal(orgSlug);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2Icon className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5">
				<p className="text-sm text-destructive">
					Failed to load billing information: {error.message}
				</p>
				<Button
					variant="outline"
					size="sm"
					className="mt-3"
					onClick={() => refetch()}
				>
					Retry
				</Button>
			</div>
		);
	}

	if (!data) return null;

	const currentTier = data.tier;
	const metadata = TIER_METADATA[currentTier];
	const usagePercent =
		metadata.memberLimit === -1
			? 0
			: Math.round((data.usage.members.current / metadata.memberLimit) * 100);

	return (
		<div className="space-y-8">
			{/* Current plan overview */}
			<div className="space-y-4">
				<div className="flex items-center gap-3">
					<h3 className="text-lg font-semibold">Current plan</h3>
					<Badge className={cn(tierColors[currentTier])}>
						{currentTier === "enterprise" && (
							<CrownIcon className="mr-1 size-3" />
						)}
						{metadata.label}
					</Badge>
				</div>

				{/* Member usage */}
				<Card>
					<CardContent className="space-y-3">
						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground">Members</span>
							<span className="font-medium">
								{data.usage.members.current}
								{metadata.memberLimit === -1
									? " (unlimited)"
									: ` / ${metadata.memberLimit}`}
							</span>
						</div>
						{metadata.memberLimit !== -1 && (
							<Progress value={usagePercent}>
								<ProgressTrack>
									<ProgressIndicator />
								</ProgressTrack>
							</Progress>
						)}
					</CardContent>
				</Card>

				{/* Subscription status */}
				{data.subscription && (
					<Card>
						<CardContent className="space-y-2">
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">Status</span>
								<Badge
									variant={
										data.subscription.status === "active"
											? "default"
											: "destructive"
									}
								>
									{data.subscription.status}
								</Badge>
							</div>
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">
									{data.subscription.cancelAtPeriodEnd
										? "Expires on"
										: "Renews on"}
								</span>
								<span className="font-medium">
									{new Date(
										data.subscription.currentPeriodEnd,
									).toLocaleDateString()}
								</span>
							</div>
							{data.subscription.cancelAtPeriodEnd && (
								<p className="text-xs text-amber-600 dark:text-amber-400">
									Your subscription will not renew. You'll revert to the Free
									plan after the current period ends.
								</p>
							)}
						</CardContent>
						<CardFooter>
							<Button
								variant="outline"
								size="sm"
								onClick={() => openPortal()}
								disabled={portalLoading}
							>
								{portalLoading ? (
									<Loader2Icon className="mr-2 size-4 animate-spin" />
								) : (
									<ExternalLinkIcon className="mr-2 size-4" />
								)}
								Manage subscription
							</Button>
						</CardFooter>
					</Card>
				)}
			</div>

			{/* Plan cards */}
			<div className="space-y-4">
				<h3 className="text-lg font-semibold">Plans</h3>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{(Object.keys(TIER_METADATA) as SubscriptionTier[]).map((tier) => {
						const plan = TIER_METADATA[tier];
						const isCurrent = tier === currentTier;
						const tiers = Object.keys(TIER_METADATA) as SubscriptionTier[];
						const isUpgrade =
							tiers.indexOf(tier) > tiers.indexOf(currentTier);

						return (
							<Card
								key={tier}
								className={cn(isCurrent && "ring-2 ring-primary")}
							>
								<CardHeader>
									<div className="flex items-center gap-2">
										<CardTitle>{plan.label}</CardTitle>
										{isCurrent && (
											<Badge variant="outline" className="text-[0.625rem]">
												Current
											</Badge>
										)}
									</div>
									<CardDescription>
										{plan.monthlyPriceUsd === 0 ? (
											"Free forever"
										) : (
											<>
												<span className="text-2xl font-bold text-foreground">
													${plan.monthlyPriceUsd}
												</span>
												<span className="text-muted-foreground"> / month</span>
											</>
										)}
									</CardDescription>
								</CardHeader>
								<CardContent>
									<ul className="space-y-2">
										{plan.features.map((feature) => (
											<li
												key={feature}
												className="flex items-start gap-2 text-sm"
											>
												<CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
												<span>{feature}</span>
											</li>
										))}
									</ul>
								</CardContent>
								<CardFooter>
									{isCurrent ? (
										<Button
											variant="outline"
											size="sm"
											disabled
											className="w-full"
										>
											Current plan
										</Button>
									) : tier === "free" ? (
										<Button
											variant="outline"
											size="sm"
											disabled
											className="w-full"
										>
											Free
										</Button>
									) : (
										<Button
											size="sm"
											className="w-full"
											disabled={checkoutLoading}
											onClick={() => checkout(tier)}
										>
											{checkoutLoading ? (
												<Loader2Icon className="mr-2 size-4 animate-spin" />
											) : null}
											{isUpgrade ? "Upgrade" : "Switch"} to {plan.label}
										</Button>
									)}
								</CardFooter>
							</Card>
						);
					})}
				</div>
			</div>
		</div>
	);
}
