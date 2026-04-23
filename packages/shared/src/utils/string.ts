 const BRAND_PALETTE = [
	"bg-ruby-bg text-ruby-foreground",
	"bg-orange-bg text-orange-foreground",
	"bg-grass-bg text-grass-foreground",
	"bg-jade-bg text-jade-foreground",
	"bg-blue-bg text-blue-foreground",
	"bg-violet-bg text-violet-foreground",
	"bg-pink-bg text-pink-foreground",
] as const;


export function getInitials(name: string, max = 1): string {
	return name
		.trim()
		.split(/\s+/)
		.slice(0, max)
		.map((word) => word[0].toUpperCase())
		.join("");
}

export function pickFromPalette(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	}
	return BRAND_PALETTE[Math.abs(hash) % BRAND_PALETTE.length];
}
