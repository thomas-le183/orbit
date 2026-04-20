import type { SubscriptionTier } from "@orbit/shared";
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
	highlightTier?: SubscriptionTier;
	currentTier: SubscriptionTier;
}

export function UpgradeModal({
	open,
	onOpenChange,
	highlightTier,
	currentTier,
}: UpgradeModalProps) {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const checkout = useCheckout(orgSlug);

	function handleSelectTier(tier: SubscriptionTier) {
		checkout.mutate(tier, {
			onError: () => toast.error("Could not start checkout. Please try again."),
		});
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-5xl">
				<DialogHeader>
					<DialogTitle>Upgrade your plan</DialogTitle>
				</DialogHeader>
				<PricingTable
					currentTier={currentTier}
					highlightTier={highlightTier}
					onSelectTier={handleSelectTier}
				/>
			</DialogContent>
		</Dialog>
	);
}
