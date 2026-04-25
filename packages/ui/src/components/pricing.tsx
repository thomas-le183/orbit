import { Button } from "@orbit/ui/components/button";
import { Card } from "@orbit/ui/components/card";
import { Tabs, TabsList, TabsTrigger } from "@orbit/ui/components/tabs";
import { Check } from "lucide-react";
import { useState } from "react";

export interface PricingPlan {
	id: string;
	name: string;
	description: string;
	price: number;
	yearlyPrice?: number;
	period?: string;
	badge?: string;
	featuresPrefix?: string;
	features: string[];
	cta: string;
	ctaDisabled?: boolean;
	onCta?: (period: "monthly" | "yearly") => void;
	highlighted?: boolean;
	isEnterprise?: boolean;
}

interface PricingProps {
	plans: PricingPlan[];
}

type BillingPeriod = "monthly" | "yearly";

export function Pricing({ plans }: PricingProps) {
	const [period, setPeriod] = useState<BillingPeriod>("monthly");

	const regularPlans = plans.filter((p) => !p.isEnterprise);
	const enterprisePlan = plans.find((p) => p.isEnterprise);
	const hasYearly = regularPlans.some((p) => p.yearlyPrice !== undefined);

	return (
		<section className="space-y-6">
			{hasYearly && (
				<div className="flex flex-col items-center gap-2">
					<Tabs
						value={period}
						onValueChange={(v) => setPeriod(v as BillingPeriod)}
					>
						<TabsList>
							<TabsTrigger value="monthly">Monthly</TabsTrigger>
							<TabsTrigger value="yearly">Annually</TabsTrigger>
						</TabsList>
					</Tabs>
					<p>
						Save <span className="font-semibold text-primary">17%</span> on
						annual billing
					</p>
				</div>
			)}

			{/* 3-col grid; each card spans 3 row tracks via subgrid so sections align */}
			<div className="grid gap-x-6 gap-y-0 pt-4 md:grid-cols-2 lg:grid-cols-3">
				{regularPlans.map((plan) => {
					const activePrice =
						period === "yearly" && plan.yearlyPrice !== undefined
							? plan.yearlyPrice
							: plan.price;
					return (
						<Card
							key={plan.id}
							className={`row-span-3 grid grid-rows-subgrid py-0 ${
								plan.highlighted
									? "relative overflow-visible ring-2 ring-primary"
									: "relative"
							}`}
						>
							{plan.badge && (
								<span className="bg-linear-to-br/increasing absolute inset-x-0 -top-3 mx-auto flex h-6 w-fit items-center rounded-full from-purple-400 to-amber-300 px-3 py-1 text-xs font-medium text-amber-950 ring-1 ring-inset ring-white/20 ring-offset-1 ring-offset-gray-950/5">
									{plan.badge}
								</span>
							)}

							{/* Row 1: name + description + price */}
							<div className="px-6 pt-6 space-y-4">
								<p className="font-medium text-base">{plan.name}</p>
								<p className="mt-1 text-sm text-muted-foreground">
									{plan.description}
								</p>
								<div className="mt-3">
									<span className="text-2xl font-semibold">${activePrice}</span>
									{plan.period && (
										<span className="text-muted-foreground">
											{" "}
											{plan.period}
										</span>
									)}
								</div>
							</div>

							{/* Row 2: CTA */}
							<div className="px-6">
								<Button
									className="w-full"
									variant={plan.highlighted ? "default" : "outline"}
									disabled={plan.ctaDisabled}
									onClick={() => plan.onCta?.(period)}
								>
									{plan.cta}
								</Button>
							</div>

							{/* Row 3: features */}
							<div className="px-6 pb-6">
								<hr className="mb-4 border-dashed" />
								{plan.featuresPrefix && (
									<p className="mb-3 font-medium">{plan.featuresPrefix}</p>
								)}
								<ul className="space-y-3 text-muted-foreground">
									{plan.features.map((feature) => (
										<li key={feature} className="flex items-center gap-2">
											<Check className="size-3 shrink-0" />
											{feature}
										</li>
									))}
								</ul>
							</div>
						</Card>
					);
				})}
			</div>

			{enterprisePlan && (
				<Card>
					<div className="flex flex-col gap-6 p-6 md:flex-row md:items-center">
						<div className="flex flex-col gap-3 md:w-56 md:shrink-0">
							<div>
								<h3 className="text-base font-semibold">
									{enterprisePlan.name}
								</h3>
								<p className="mt-1 text-muted-foreground">
									{enterprisePlan.description}
								</p>
							</div>
							<Button
								className="w-fit"
								variant={enterprisePlan.ctaDisabled ? "outline" : "default"}
								disabled={enterprisePlan.ctaDisabled}
								onClick={() => enterprisePlan.onCta?.(period)}
							>
								{enterprisePlan.cta}
							</Button>
						</div>

						<ul className="flex flex-1 flex-wrap gap-x-6 gap-y-2">
							{enterprisePlan.features.map((feature) => (
								<li key={feature} className="flex items-center gap-2">
									<Check className="size-3 shrink-0" />
									{feature}
								</li>
							))}
						</ul>
					</div>
				</Card>
			)}
		</section>
	);
}
