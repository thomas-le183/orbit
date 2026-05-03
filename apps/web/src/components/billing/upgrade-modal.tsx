import type { SubscriptionPlan } from "@orbit/shared";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@orbit/ui/components/dialog";
import { useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCheckout } from "@/hooks/use-billing";
import { PricingTable } from "./pricing-table";

interface UpgradeModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	highlightPlan?: SubscriptionPlan;
	currentPlan: SubscriptionPlan;
}

export function UpgradeModal({
	open,
	onOpenChange,
	highlightPlan,
	currentPlan,
}: UpgradeModalProps) {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const checkout = useCheckout(orgSlug);

	function handleSelectPlan(
		plan: SubscriptionPlan,
		interval: "monthly" | "yearly",
	) {
		checkout.mutate(
			{ plan, interval },
			{
				onError: () =>
					toast.error("Could not start checkout. Please try again."),
			},
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-5xl">
				<DialogHeader>
					<DialogTitle>Upgrade your plan</DialogTitle>
				</DialogHeader>
				<PricingTable
					currentPlan={currentPlan}
					highlightPlan={highlightPlan}
					onSelectPlan={handleSelectPlan}
				/>
			</DialogContent>
		</Dialog>
	);
}
