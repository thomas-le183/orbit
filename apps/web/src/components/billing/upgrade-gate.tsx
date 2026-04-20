import { TIER_METADATA, type TierFlags } from "@orbit/shared";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@orbit/ui/components/tooltip";
import { useParams } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { useOrgSubscription } from "@/hooks/use-billing";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { UpgradeModal } from "./upgrade-modal";

interface UpgradeGateProps {
	flag: keyof TierFlags;
	children: ReactNode;
	message?: string;
}

export function UpgradeGate({ flag, children, message }: UpgradeGateProps) {
	const { enabled, requiredTier } = useFeatureFlag(flag);
	const [modalOpen, setModalOpen] = useState(false);
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const { data } = useOrgSubscription(orgSlug);

	if (enabled) return <>{children}</>;

	const defaultMessage = `Available on ${TIER_METADATA[requiredTier].label} and above. Click to upgrade.`;

	return (
		<>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger>
						<div
							data-upgrade-gate
							className="relative cursor-pointer opacity-50"
							onClick={() => setModalOpen(true)}
						>
							<div className="pointer-events-none select-none">{children}</div>
						</div>
					</TooltipTrigger>
					<TooltipContent>{message ?? defaultMessage}</TooltipContent>
				</Tooltip>
			</TooltipProvider>
			<UpgradeModal
				open={modalOpen}
				onOpenChange={setModalOpen}
				highlightTier={requiredTier}
				currentTier={data?.tier ?? "free"}
			/>
		</>
	);
}
