import { Button } from "@orbit/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@orbit/ui/components/card";
import { Check } from "lucide-react";

export interface PricingPlan {
	id: string;
	name: string;
	description: string;
	price: string;
	period?: string;
	badge?: string;
	features: string[];
	cta: string;
	ctaDisabled?: boolean;
	onCta?: () => void;
	highlighted?: boolean;
}

interface PricingProps {
	plans: PricingPlan[];
}

export function Pricing({ plans }: PricingProps) {
	return (
		<section>
			<div className="grid gap-6 pt-4 md:grid-cols-2 lg:grid-cols-4">
				{plans.map((plan) => (
					<Card
						key={plan.id}
						className={
							plan.highlighted
								? "relative overflow-visible ring-2 ring-primary"
								: "relative"
						}
					>
						{plan.badge && (
							<span className="bg-linear-to-br/increasing absolute inset-x-0 -top-3 mx-auto flex h-6 w-fit items-center rounded-full from-purple-400 to-amber-300 px-3 py-1 text-xs font-medium text-amber-950 ring-1 ring-inset ring-white/20 ring-offset-1 ring-offset-gray-950/5">
								{plan.badge}
							</span>
						)}

						<CardHeader>
							<CardTitle className="font-medium">{plan.name}</CardTitle>

							<span className="my-3 block text-2xl font-semibold">
								{plan.price}
								{plan.period && (
									<span className="text-base font-normal text-muted-foreground">
										{" "}
										{plan.period}
									</span>
								)}
							</span>
							{plan.period && (
								<p className="text-xs text-muted-foreground">per seat</p>
							)}

							<CardDescription className="mt-1 text-sm">
								{plan.description}
							</CardDescription>
						</CardHeader>

						<CardContent className="flex flex-1 flex-col space-y-4">
							<hr className="border-dashed" />

							<ul className="list-outside space-y-3 text-sm">
								{plan.features.map((feature) => (
									<li key={feature} className="flex items-center gap-2">
										<Check className="size-3 shrink-0" />
										{feature}
									</li>
								))}
							</ul>
						</CardContent>

						<CardFooter>
							<Button
								className="w-full"
								variant={plan.highlighted ? "default" : "outline"}
								disabled={plan.ctaDisabled}
								onClick={plan.onCta}
							>
								{plan.cta}
							</Button>
						</CardFooter>
					</Card>
				))}
			</div>
		</section>
	);
}
