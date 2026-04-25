export { cn } from "@orbit/shared";

export function pickFromPalette(str: string): string {
	const palette = [
		"bg-ruby-bg text-ruby-foreground",
		"bg-orange-bg text-orange-foreground",
		"bg-grass-bg text-grass-foreground",
		"bg-jade-bg text-jade-foreground",
		"bg-blue-bg text-blue-foreground",
		"bg-violet-bg text-violet-foreground",
		"bg-pink-bg text-pink-foreground",
	] as const;
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	}
	return palette[Math.abs(hash) % palette.length];
}
