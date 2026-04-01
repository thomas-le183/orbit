export function getInitials(name: string, max = 2): string {
	return name
		.trim()
		.split(/\s+/)
		.slice(0, max)
		.map((word) => word[0].toUpperCase())
		.join("");
}
