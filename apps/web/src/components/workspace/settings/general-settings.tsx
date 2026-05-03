import { Button } from "@orbit/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@orbit/ui/components/dialog";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldSet,
} from "@orbit/ui/components/field";
import { Input } from "@orbit/ui/components/input";
import { useRouter } from "@tanstack/react-router";
import { ImageIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useDeleteOrganization, useUpdateOrganization } from "@/hooks/use-auth";
import { useUploadFile } from "@/hooks/use-upload-file";
import { SettingsPage } from "./settings-page";

interface GeneralSettingsProps {
	org: { id: string; name: string; slug: string; logo?: string | null };
	isOwner: boolean;
}

export function GeneralSettings({ org, isOwner }: GeneralSettingsProps) {
	const router = useRouter();
	const update = useUpdateOrganization();
	const deleteOrg = useDeleteOrganization();
	const { upload } = useUploadFile();
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteConfirm, setDeleteConfirm] = useState("");
	const [uploading, setUploading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const logoId = useId();
	const nameId = useId();
	const slugId = useId();

	function saveIf(
		field: "name" | "slug" | "logo",
		value: string,
		prev: string | null | undefined,
	) {
		const next = value.trim();
		const prevTrimmed = (prev ?? "").trim();
		if (next === prevTrimmed) return;
		update.mutate(
			{
				organizationId: org.id,
				data: { [field]: field === "logo" ? next || null : next },
			},
			{ onSuccess: () => toast.success("Saved") },
		);
	}

	async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;
		if (file.size > 10 * 1024 * 1024) {
			toast.error("Logo must be under 10 MB");
			return;
		}
		setUploading(true);
		try {
			const publicUrl = await upload(file, "logo", org.id);
			await update.mutateAsync(
				{
					organizationId: org.id,
					data: { logo: publicUrl },
				},
				{ onSuccess: () => toast.success("Saved") },
			);
		} catch {
			toast.error("Upload failed, please try again");
		} finally {
			setUploading(false);
		}
	}

	const canDelete = deleteConfirm === org.name && !deleteOrg.isPending;

	return (
		<SettingsPage
			title="Workspace"
			subtitle="Manage your workspace name, URL, and logo."
		>
			<FieldGroup>
				<Field>
					<FieldLabel>Logo</FieldLabel>
					<div className="flex items-center gap-4">
						<button
							type="button"
							onClick={() => fileInputRef.current?.click()}
							disabled={uploading}
							className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
							aria-label="Upload logo"
						>
							{org.logo ? (
								<img
									src={org.logo}
									alt={org.name}
									className="size-full object-cover"
								/>
							) : (
								<ImageIcon className="size-6 text-muted-foreground" />
							)}
						</button>
						<div className="flex flex-col gap-2">
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									disabled={uploading}
									onClick={() => fileInputRef.current?.click()}
								>
									<UploadIcon />
									{uploading ? "Uploading…" : "Upload"}
								</Button>
								<Button
									variant="outline"
									size="sm"
									disabled={!org.logo || uploading}
									onClick={() => saveIf("logo", "", org.logo)}
								>
									<Trash2Icon />
									Remove
								</Button>
								<input
									ref={fileInputRef}
									id={logoId}
									type="file"
									accept="image/png,image/jpeg,image/gif,image/webp"
									className="hidden"
									onChange={handleFileChange}
								/>
							</div>
							<FieldDescription>
								We support your square PNGs, JPEGs, GIFs and WebPs under 10MB
							</FieldDescription>
						</div>
					</div>
				</Field>

				<Field>
					<FieldContent>
						<FieldLabel htmlFor={nameId}>Workspace name</FieldLabel>
						<FieldDescription>Displayed across the app.</FieldDescription>
					</FieldContent>
					<Input
						id={nameId}
						className="w-70 shrink-0"
						defaultValue={org.name}
						onBlur={(e) => saveIf("name", e.target.value, org.name)}
					/>
				</Field>

				<Field>
					<FieldContent>
						<FieldLabel htmlFor={slugId}>URL slug</FieldLabel>
						<FieldDescription>
							Changing invalidates existing links.
						</FieldDescription>
					</FieldContent>
					<div className="flex w-70 shrink-0">
						<span className="flex h-9 items-center rounded-l-md border border-r-0 bg-muted px-3 text-xs text-muted-foreground">
							orbit.app/
						</span>
						<Input
							id={slugId}
							className="rounded-l-none"
							defaultValue={org.slug}
							onBlur={(e) => saveIf("slug", e.target.value, org.slug)}
						/>
					</div>
				</Field>
			</FieldGroup>

			{isOwner && (
				<FieldSet className="mt-8">
					<FieldGroup>
						<Field>
							<FieldContent>
								<FieldLabel>Transfer ownership</FieldLabel>
								<FieldDescription>
									Assign Owner to another member. You become Admin.
								</FieldDescription>
							</FieldContent>
							<Button variant="outline" disabled>
								Transfer
							</Button>
						</Field>
						<Field>
							<FieldContent>
								<FieldLabel>Delete workspace</FieldLabel>
								<FieldDescription>
									Permanently delete this workspace and all its data.
								</FieldDescription>
							</FieldContent>
							<Button variant="destructive" onClick={() => setDeleteOpen(true)}>
								Delete workspace
							</Button>
						</Field>
					</FieldGroup>
				</FieldSet>
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
