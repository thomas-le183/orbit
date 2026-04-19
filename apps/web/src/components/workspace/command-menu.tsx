import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@orbit/ui/components/command";
import { useParams, useRouter } from "@tanstack/react-router";
import { LogOutIcon, PlusIcon, SettingsIcon } from "lucide-react";
import { useEffect } from "react";
import { OrgAvatar } from "@/components/common/org-avatar";
import { useOrganizations, useSignOut } from "@/hooks/use-auth";

export function CommandMenu({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const router = useRouter();
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const { data: organizations } = useOrganizations();
	const signOut = useSignOut();

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				onOpenChange(!open);
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onOpenChange]);

	function run(fn: () => void) {
		onOpenChange(false);
		fn();
	}

	return (
		<CommandDialog open={open} onOpenChange={onOpenChange}>
			<Command>
				<CommandInput placeholder="Type a command or search..." />
			<CommandList>
				<CommandEmpty>No results found.</CommandEmpty>

				{organizations && organizations.length > 0 && (
					<CommandGroup heading="Workspaces">
						{organizations.map((org) => (
							<CommandItem
								key={org.id}
								value={`workspace ${org.name}`}
								onSelect={() =>
									run(() =>
										router.navigate({
											to: "/$orgSlug",
											params: { orgSlug: org.slug },
										}),
									)
								}
							>
								<OrgAvatar size="sm" name={org.name} logo={org.logo} />
								<span>{org.name}</span>
							</CommandItem>
						))}
						<CommandItem
							value="create workspace"
							onSelect={() =>
								run(() => router.navigate({ to: "/create-workspace" }))
							}
						>
							<PlusIcon />
							<span>Create workspace</span>
						</CommandItem>
					</CommandGroup>
				)}

				<CommandGroup heading="Settings">
					<CommandItem
						value="settings"
						onSelect={() =>
							run(() =>
								router.navigate({
									to: "/$orgSlug/settings",
									params: { orgSlug },
									search: {},
								}),
							)
						}
					>
						<SettingsIcon />
						<span>Open settings</span>
					</CommandItem>
					<CommandItem
						value="sign out"
						onSelect={() =>
							run(() =>
								signOut.mutate(undefined, {
									onSuccess: () => router.navigate({ to: "/" }),
								}),
							)
						}
					>
						<LogOutIcon />
						<span>Sign out</span>
					</CommandItem>
				</CommandGroup>
				</CommandList>
			</Command>
		</CommandDialog>
	);
}
