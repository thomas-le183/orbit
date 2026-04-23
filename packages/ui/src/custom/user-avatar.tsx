import { cn, getInitials, pickFromPalette } from "@orbit/shared";
import { Avatar, AvatarFallback, AvatarImage } from "../components/avatar";

type Size = "sm" | "default" | "lg";

export function UserAvatar({
	colorSeed,
	placeholder,
	avatarUrl,
	size = "default",
	className,
}: {
	colorSeed?: string | null;
	placeholder?: string | null;
	avatarUrl?: string | null;
	size?: Size;
	className?: string;
}) {
	const seed = colorSeed ?? placeholder ?? "";
	const paletteClasses = seed ? pickFromPalette(seed) : "bg-muted";

	return (
		<Avatar size={size} className={className}>
			{avatarUrl && <AvatarImage src={avatarUrl} alt={placeholder ?? ""} />}
			<AvatarFallback
				className={cn("text-[10px]! font-medium", paletteClasses, className)}
			>
				{placeholder ? getInitials(placeholder) : "?"}
			</AvatarFallback>
		</Avatar>
	);
}
