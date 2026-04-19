import { getInitials } from "@orbit/shared";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@orbit/ui/components/avatar";

type Size = "sm" | "default" | "lg";

export function UserAvatar({
	name,
	image,
	size = "default",
	className,
}: {
	name?: string | null;
	image?: string | null;
	size?: Size;
	className?: string;
}) {
	return (
		<Avatar size={size} className={className}>
			{image && <AvatarImage src={image} alt={name ?? ""} />}
			<AvatarFallback>{name ? getInitials(name) : "?"}</AvatarFallback>
		</Avatar>
	);
}
