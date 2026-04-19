import { getInitials } from "@orbit/shared";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@orbit/ui/components/avatar";
import { cn } from "@orbit/ui/lib/utils";

type Size = "sm" | "default" | "lg";

export function OrgAvatar({
	name,
	logo,
	size = "default",
	className,
}: {
	name?: string | null;
	logo?: string | null;
	size?: Size;
	className?: string;
}) {
	return (
		<Avatar
			size={size}
			className={cn("rounded-b-xs after:rounded-xs", className)}
		>
			{logo && (
				<AvatarImage src={logo} alt={name ?? ""} className="rounded-xs" />
			)}
			<AvatarFallback className="rounded-xs bg-indigo-800 text-white">
				{name ? getInitials(name) : "?"}
			</AvatarFallback>
		</Avatar>
	);
}
