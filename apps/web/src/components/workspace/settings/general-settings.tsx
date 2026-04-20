import { Button } from "@orbit/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@orbit/ui/components/dialog";
import { Input } from "@orbit/ui/components/input";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { OrgAvatar } from "@/components/common/org-avatar";
import { useDeleteOrganization, useUpdateOrganization } from "@/hooks/use-auth";
import { SettingsPage } from "./settings-page";
import { SettingsRow } from "./settings-row";
import { SettingsSection } from "./settings-section";
import { useSaveIndicator } from "./use-save-indicator";

interface GeneralSettingsProps {
	org: { id: string; name: string; slug: string; logo?: string | null };
	isOwner: boolean;
}

export function GeneralSettings({ org, isOwner }: GeneralSettingsProps) {
	const router = useRouter();
	const update = useUpdateOrganization();
	const deleteOrg = useDeleteOrganization();
	const nameSave = useSaveIndicator();
	const slugSave = useSaveIndicator();
	const logoSave = useSaveIndicator();
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteConfirm, setDeleteConfirm] = useState("");

	function saveIf(
		field: "name" | "slug" | "logo",
		value: string,
		prev: string | null | undefined,
		indicator: ReturnType<typeof useSaveIndicator>,
	) {
		const next = value.trim();
		const prevTrimmed = (prev ?? "").trim();
		if (next === prevTrimmed) return;
		update.mutate(
			{
				organizationId: org.id,
				data: { [field]: field === "logo" ? next || null : next },
			},
			{ onSuccess: indicator.trigger },
		);
	}

	const canDelete = deleteConfirm === org.name && !deleteOrg.isPending;

	return (
		<SettingsPage
			title="Workspace"
			subtitle="Manage your workspace name, URL, and logo."
		>
			<SettingsSection>
				<SettingsRow
					label="Logo"
					hint="Paste an image URL. Upload is coming later."
					saved={logoSave.saved}
				>
					<div className="flex items-center gap-2">
						<OrgAvatar name={org.name} logo={org.logo} size="sm" />
						<Input
							defaultValue={org.logo ?? ""}
							placeholder="https://…"
							onBlur={(e) => saveIf("logo", e.target.value, org.logo, logoSave)}
						/>
					</div>
				</SettingsRow>
				<SettingsRow
					label="Workspace name"
					hint="Displayed across the app."
					saved={nameSave.saved}
				>
					<Input
						defaultValue={org.name}
						onBlur={(e) => saveIf("name", e.target.value, org.name, nameSave)}
					/>
				</SettingsRow>
				<SettingsRow
					label="URL slug"
					hint="Changing invalidates existing links."
					saved={slugSave.saved}
					last
				>
					<div className="flex">
						<span className="flex h-9 items-center rounded-l-md border border-r-0 bg-muted px-3 text-xs text-muted-foreground">
							orbit.app/
						</span>
						<Input
							className="rounded-l-none"
							defaultValue={org.slug}
							onBlur={(e) => saveIf("slug", e.target.value, org.slug, slugSave)}
						/>
					</div>
				</SettingsRow>
			</SettingsSection>

			{isOwner && (
				<SettingsSection heading="Danger zone" tone="destructive">
					<SettingsRow
						label="Transfer ownership"
						hint="Assign Owner to another member. You become Admin."
					>
						<Button variant="outline" disabled>
							Transfer
						</Button>
					</SettingsRow>
					<SettingsRow
						label="Delete workspace"
						hint="Permanently delete this workspace and all its data."
						last
					>
						<Button variant="destructive" onClick={() => setDeleteOpen(true)}>
							Delete workspace
						</Button>
					</SettingsRow>
				</SettingsSection>
			)}

			<Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete workspace</DialogTitle>
						<DialogDescription>
							This permanently deletes the workspace and all its data.
						</DialogDescription>
					</DialogHeader>
					<p className="text-sm">
						Type <strong>{org.name}</strong> to confirm.
					</p>
					<Input
						value={deleteConfirm}
						onChange={(e) => setDeleteConfirm(e.target.value)}
						placeholder={org.name}
					/>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteOpen(false)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							disabled={!canDelete}
							onClick={() =>
								deleteOrg.mutate(org.id, {
									onSuccess: () => router.navigate({ to: "/" }),
								})
							}
						>
							Delete workspace
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</SettingsPage>
	);
}
