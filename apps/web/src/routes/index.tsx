import { Button } from "@orbit/ui/components/button";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
	ArrowRightIcon,
	LayoutDashboardIcon,
	MessageSquareIcon,
	UsersIcon,
} from "lucide-react";
import { loadAuthState, resolveAuthenticatedLanding } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
	beforeLoad: async ({ context }) => {
		const state = await loadAuthState(context.queryClient);
		const landing = resolveAuthenticatedLanding(state);
		if (landing) {
			throw redirect(landing);
		}
	},
	component: LandingPage,
});

function LandingPage() {
	return (
		<div className="min-h-screen bg-background text-foreground">
			{/* Nav */}
			<header className="flex items-center justify-between border-b border-border px-10 py-[18px]">
				<div className="flex items-center gap-2.5">
					<OrbitMark />
					<span className="text-sm font-bold tracking-tight">Orbit</span>
				</div>
				<nav className="flex items-center gap-1.5">
					<Button variant="ghost" size="sm">
						<Link to="/login">Log in</Link>
					</Button>
					<Button size="sm">
						<Link to="/signup">Get started</Link>
					</Button>
				</nav>
			</header>

			{/* Hero */}
			<section className="mx-auto grid max-w-6xl grid-cols-2 items-center gap-12 px-10 py-20">
				{/* Left */}
				<div>
					<div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 font-mono text-[10px] text-primary">
						<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
						v0.1 · early access
					</div>

					<h1 className="mb-4 text-5xl font-extrabold leading-[1.07] tracking-[-1.5px]">
						The workspace
						<br />
						built for <em className="not-italic text-primary">teams</em>
						<br />
						that ship.
					</h1>

					<p className="mb-7 max-w-xs text-sm leading-relaxed text-muted-foreground">
						Channels, tasks, and real-time presence — all in one place. No
						context switching. Just work.
					</p>

					<div className="flex items-center gap-3">
						<Link to="/signup">
							<Button size="lg" className="gap-2">
								Start for free
								<ArrowRightIcon className="size-4" />
							</Button>
						</Link>
						<Button size="lg" variant="outline">
							<Link to="/login">Sign in</Link>
						</Button>
					</div>

					<p className="mt-4 font-mono text-[10px] text-muted-foreground/40">
						// free for small teams · no credit card
					</p>
				</div>

				{/* Terminal */}
				<Terminal />
			</section>

			{/* Stats bar */}
			<div className="border-y border-border">
				<div className="mx-auto flex max-w-6xl items-center justify-center gap-12 px-10 py-6">
					{[
						{ value: "5,000+", label: "teams active" },
						{ value: "99.9%", label: "uptime" },
						{ value: "< 50ms", label: "avg latency" },
						{ value: "E2E", label: "encrypted" },
					].map((stat, i) => (
						<div key={stat.label} className="flex items-center gap-12">
							{i > 0 && (
								<div className="h-7 w-px bg-border" aria-hidden="true" />
							)}
							<div className="text-center">
								<div className="text-lg font-bold tabular-nums text-foreground">
									{stat.value}
								</div>
								<div className="mt-0.5 font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/60">
									{stat.label}
								</div>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Features */}
			<section className="mx-auto max-w-6xl px-10 py-14">
				<div className="mb-8">
					<div className="mb-2.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[2px] text-primary">
						<span className="text-muted-foreground/40">//</span>
						core modules
					</div>
					<h2 className="text-2xl font-bold tracking-tight">
						Everything your team needs. Nothing it doesn't.
					</h2>
				</div>

				<div className="grid grid-cols-3 gap-4">
					{features.map((f) => (
						<div
							key={f.title}
							className="group relative overflow-hidden rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/30"
						>
							<div className="mb-3.5 flex h-8 w-8 items-center justify-center rounded-md border border-primary/20 bg-primary/5">
								<f.Icon className="size-3.5 text-primary" />
							</div>
							<h3 className="mb-1.5 text-xs font-semibold tracking-tight text-foreground">
								{f.title}
							</h3>
							<p className="text-[11px] leading-relaxed text-muted-foreground">
								{f.desc}
							</p>
						</div>
					))}
				</div>
			</section>

			{/* CTA */}
			<section className="border-t border-border">
				<div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-10 py-12">
					<div>
						<h2 className="mb-1.5 text-[22px] font-bold tracking-tight">
							Ready to reach orbit?
						</h2>
						<p className="text-sm text-muted-foreground">
							Join 5,000+ teams already shipping faster.
						</p>
					</div>
					<div className="flex shrink-0 flex-col items-end gap-1.5">
						<Link to="/signup">
							<Button size="lg">
								Get started free
								<ArrowRightIcon className="size-4" />
							</Button>
						</Link>
						<span className="font-mono text-[10px] text-muted-foreground/40">
							// no credit card required
						</span>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="border-t border-border">
				<div className="mx-auto flex max-w-6xl items-center justify-between px-10 py-5">
					<div className="flex items-center gap-2">
						<OrbitMark size={18} />
						<span className="text-xs font-semibold text-muted-foreground">
							Orbit
						</span>
					</div>
					<nav className="flex gap-5">
						{["Features", "Pricing", "Docs", "Changelog"].map((item) => (
							<a
								key={item}
								href="#"
								className="text-[10px] text-muted-foreground/50 transition-colors hover:text-muted-foreground"
							>
								{item}
							</a>
						))}
					</nav>
					<span className="font-mono text-[10px] text-muted-foreground/40">
						© 2026 Orbit
					</span>
				</div>
			</footer>
		</div>
	);
}

// ── Sub-components ─────────────────────────────────────────────────────────

function OrbitMark({ size = 24 }: { size?: number }) {
	return (
		<div
			className="flex shrink-0 items-center justify-center rounded-[5px] bg-primary"
			style={{ width: size, height: size }}
		>
			<svg
				width={size * 0.54}
				height={size * 0.54}
				viewBox="0 0 13 13"
				fill="none"
				aria-hidden="true"
			>
				<circle cx="6.5" cy="6.5" r="2.5" fill="white" />
				<circle
					cx="6.5"
					cy="6.5"
					r="5.5"
					stroke="white"
					strokeWidth="1"
					strokeDasharray="2 2"
					fill="none"
				/>
			</svg>
		</div>
	);
}

function Terminal() {
	return (
		<div className="overflow-hidden rounded-lg border border-border bg-card shadow-lg">
			{/* Chrome */}
			<div className="flex items-center gap-1.5 border-b border-border bg-muted px-3.5 py-2.5">
				<span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
				<span className="h-2 w-2 rounded-full bg-[#febc2e]" />
				<span className="h-2 w-2 rounded-full bg-[#28c840]" />
				<span className="ml-2 font-mono text-[10px] text-muted-foreground">
					orbit — workspace shell
				</span>
			</div>

			{/* Body */}
			<div className="space-y-0 p-4 font-mono text-[11px] leading-[2]">
				<TermLine prompt cmd="orbit auth login" />
				<TermLine ok val="you@company.com" prefix="Authenticated as" />
				<div className="h-2" />
				<TermLine prompt cmd="orbit workspace connect acme-corp" />
				<TermLine
					ok
					val="acme-corp"
					prefix="Workspace"
					suffix="synced in 48ms"
					dim
				/>
				<TermLine ok dim="14 channels · 6 members online" />
				<div className="h-2" />
				<TermLine prompt cmd="orbit status" />
				<TermLine active val="design-system" suffix="— 3 unread" dim />
				<TermLine active val="backend" suffix="— aria typing..." dim />
				<TermLine idle dim="announcements" />
				<div className="h-2" />
				<div>
					<span className="text-muted-foreground/30">$</span>{" "}
					<span className="inline-block h-[11px] w-1.5 translate-y-[2px] animate-pulse bg-primary" />
				</div>
			</div>
		</div>
	);
}

function TermLine({
	prompt,
	cmd,
	ok,
	active,
	idle,
	val,
	prefix,
	suffix,
	dim,
}: {
	prompt?: boolean;
	cmd?: string;
	ok?: boolean;
	active?: boolean;
	idle?: boolean;
	val?: string;
	prefix?: string;
	suffix?: string;
	dim?: boolean | string;
}) {
	if (prompt) {
		return (
			<div>
				<span className="text-muted-foreground/30">$</span>{" "}
				<span className="text-muted-foreground">{cmd}</span>
			</div>
		);
	}
	if (ok) {
		return (
			<div>
				<span className="text-primary">✓</span>{" "}
				{prefix && <span className="text-muted-foreground/60">{prefix} </span>}
				{val && <span className="text-foreground">{val}</span>}
				{suffix && <span className="text-muted-foreground/60"> {suffix}</span>}
				{typeof dim === "string" && (
					<span className="text-muted-foreground/60">{dim}</span>
				)}
			</div>
		);
	}
	if (active) {
		return (
			<div>
				<span className="text-green-500">●</span>{" "}
				<span className="text-foreground">{val}</span>
				{suffix && <span className="text-muted-foreground/60"> {suffix}</span>}
			</div>
		);
	}
	if (idle) {
		return (
			<div>
				<span className="text-muted-foreground/30">○</span>{" "}
				{typeof dim === "string" && (
					<span className="text-muted-foreground/60">{dim}</span>
				)}
			</div>
		);
	}
	return null;
}

// ── Data ───────────────────────────────────────────────────────────────────

const features = [
	{
		Icon: MessageSquareIcon,
		title: "Channels & threads",
		desc: "Organized messaging around projects, not buried in a sidebar. Threads keep context intact.",
	},
	{
		Icon: LayoutDashboardIcon,
		title: "Tasks & projects",
		desc: "Boards, priorities, and deadlines. See what's shipping and who's on it — in one view.",
	},
	{
		Icon: UsersIcon,
		title: "Presence & status",
		desc: "Real-time indicators, typing signals, and activity status. Always know who's available.",
	},
];
