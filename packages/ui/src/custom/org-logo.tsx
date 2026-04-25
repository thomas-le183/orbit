import { getInitials } from "@orbit/shared";
import { Avatar, AvatarFallback, AvatarImage } from "../components/avatar";
import { cn, pickFromPalette } from "../lib/utils";

type Size = "sm" | "default" | "lg";

export function OrgLogo({
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
		<Avatar
			size={size}
			className={cn("rounded-xs after:rounded-xs", className)}
		>
			{avatarUrl && (
				<AvatarImage
					src={avatarUrl}
					alt={placeholder ?? ""}
					className="rounded-xs"
				/>
			)}
			<AvatarFallback
				className={cn("rounded-xs text-[10px]! font-medium", paletteClasses)}
			>
				{placeholder ? getInitials(placeholder) : "?"}
			</AvatarFallback>
		</Avatar>
	);
}
