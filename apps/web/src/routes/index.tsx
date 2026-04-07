import { Button } from "@orbit/ui/components/button";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
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
		<div className="relative min-h-screen overflow-hidden bg-black text-white">
			<style>{`
				@keyframes fadeInUp {
					from { opacity: 0; transform: translateY(24px); }
					to   { opacity: 1; transform: translateY(0); }
				}
				@keyframes float {
					0%, 100% { transform: translateY(0px); }
					50%       { transform: translateY(-16px); }
				}
				@keyframes twinkle {
					0%, 100% { opacity: 0.2; }
					50%       { opacity: 1; }
				}
				@keyframes blobPulse {
					0%, 100% { transform: scale(1); opacity: 0.18; }
					50%       { transform: scale(1.15); opacity: 0.28; }
				}
				@keyframes ringRotate {
					from { transform: rotateX(70deg) rotateZ(0deg); }
					to   { transform: rotateX(70deg) rotateZ(360deg); }
				}
				.anim-fade-up { animation: fadeInUp 0.7s ease both; }
				.anim-float   { animation: float 6s ease-in-out infinite; }
				.anim-blob    { animation: blobPulse 8s ease-in-out infinite; }
				.anim-ring    { animation: ringRotate 18s linear infinite; }
			`}</style>
			{/* Starfield */}
			<div className="absolute inset-0 overflow-hidden">
				<Stars />
			</div>
			{/* Nebula glow blobs */}
			<div className="pointer-events-none absolute inset-0">
				<div className="anim-blob absolute top-1/4 left-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-700/20 blur-[120px]" />
				<div
					className="anim-blob absolute top-2/3 right-1/4 h-80 w-80 rounded-full bg-cyan-500/15 blur-[100px]"
					style={{ animationDelay: "3s" }}
				/>
				<div
					className="anim-blob absolute bottom-10 left-1/4 h-64 w-64 rounded-full bg-indigo-600/15 blur-[80px]"
					style={{ animationDelay: "5s" }}
				/>
			</div>
			{/* Nav */}
			<header className="anim-fade-up relative z-10 flex items-center justify-between px-8 py-6">
				<div className="flex items-center gap-2">
					<span className="text-2xl">🪐</span>
					<span className="text-xl font-semibold tracking-tight">Orbit</span>
				</div>
				<nav className="flex items-center gap-3">
					<Button variant="ghost" size="sm">
						<Link to="/login">Log in</Link>
					</Button>
					<Button size="sm">
						<Link to="/signup">Sign up</Link>
					</Button>
				</nav>
			</header>
			{/* Hero */}
			<main className="relative z-10 flex flex-col items-center justify-center px-6 pt-24 pb-40 text-center">
				<div
					className="anim-fade-up mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/60 backdrop-blur-sm"
					style={{ animationDelay: "0.1s" }}
				>
					<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
					Now in early access
				</div>

				<h1
					className="anim-fade-up mt-6 max-w-3xl text-5xl leading-tight font-bold tracking-tight sm:text-6xl md:text-7xl"
					style={{ animationDelay: "0.2s" }}
				>
					Ship faster.{" "}
					<span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
						Stay aligned.
					</span>
				</h1>

				<p
					className="anim-fade-up mt-6 max-w-xl text-lg text-white/50"
					style={{ animationDelay: "0.35s" }}
				>
					Orbit unifies project management and team chat so your team always
					knows what's happening, what's next, and who's on it.
				</p>

				{/* Floating planet */}
				<div
					className="anim-fade-up mt-24 flex items-center justify-center"
					style={{ animationDelay: "0.65s" }}
				>
					<div className="anim-float relative flex h-48 w-48 items-center justify-center">
						<div className="absolute inset-0 flex items-center justify-center">
							<div className="anim-ring h-12 w-72 rounded-full border border-violet-400/30 bg-transparent" />
						</div>
						<div className="relative z-10 h-32 w-32 rounded-full bg-gradient-to-br from-violet-500 via-indigo-600 to-cyan-500 shadow-[0_0_80px_30px_rgba(139,92,246,0.35)]" />
					</div>
				</div>
			</main>
			{/* Features */}
			<section className="relative z-10 mx-auto max-w-5xl px-6">
				<div className="grid gap-6 sm:grid-cols-3">
					{[
						{
							icon: "◎",
							title: "Projects that move",
							desc: "Boards, timelines, and priorities — built for teams that actually ship.",
							delay: "0s",
						},
						{
							icon: "◈",
							title: "Chat where work lives",
							desc: "Conversations tied to projects and tasks, not buried in a sidebar.",
							delay: "0.1s",
						},
						{
							icon: "⬡",
							title: "Built to grow",
							desc: "From a two-person startup to a multi-team org — Orbit scales with you.",
							delay: "0.2s",
						},
					].map((f) => (
						<div
							key={f.title}
							className="anim-fade-up rounded-2xl border border-white/8 bg-white/4 p-6 backdrop-blur-sm transition-colors hover:border-white/15 hover:bg-white/6"
							style={{ animationDelay: f.delay }}
						>
							<div className="mb-3 text-2xl text-violet-400">{f.icon}</div>
							<h3 className="mb-1 font-semibold text-white">{f.title}</h3>
							<p className="text-sm text-white/50">{f.desc}</p>
						</div>
					))}
				</div>
			</section>
		</div>
	);
}

function Stars() {
	const stars = Array.from({ length: 140 }, (_, i) => {
		const twinkle = Math.random() > 0.65;
		return {
			id: i,
			top: `${Math.random() * 100}%`,
			left: `${Math.random() * 100}%`,
			size: Math.random() < 0.8 ? 1 : 2,
			opacity: 0.2 + Math.random() * 0.6,
			twinkle,
			duration: `${2 + Math.random() * 4}s`,
			delay: `${Math.random() * 5}s`,
		};
	});

	return (
		<>
			{stars.map((s) => (
				<div
					key={s.id}
					className="absolute rounded-full bg-white"
					style={{
						top: s.top,
						left: s.left,
						width: s.size,
						height: s.size,
						opacity: s.opacity,
						animation: s.twinkle
							? `twinkle ${s.duration} ${s.delay} ease-in-out infinite`
							: undefined,
					}}
				/>
			))}
		</>
	);
}
