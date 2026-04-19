import { Button } from "@orbit/ui/components/button";
import { Input } from "@orbit/ui/components/input";
import { cn } from "@orbit/ui/lib/utils";
import { useCallback, useRef, useState } from "react";
import { useDeleteOrganization, useUpdateOrganization } from "@/hooks/use-auth";

interface GeneralSettingsProps {
	org: { id: string; name: string; slug: string; logo?: string | null };
	isOwner: boolean;
}

function SettingsRow({
	label,
	hint,
	children,
	last,
}: {
	label: string;
	hint?: string;
	children: React.ReactNode;
	last?: boolean;
}) {
	return (
		<div
			className={cn(
				"flex items-center justify-between gap-10 py-4",
				!last && "border-b",
			)}
		>
			<div className="min-w-0 flex-1">
				<p className="text-sm font-medium">{label}</p>
				{hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
			</div>
			<div className="w-[280px] shrink-0">{children}</div>
		</div>
	);
}

function useSaveIndicator() {
	const [saved, setSaved] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const trigger = useCallback(() => {
		setSaved(true);
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => setSaved(false), 2000);
	}, []);
	return { saved, trigger };
}

export function GeneralSettings({ org, isOwner }: GeneralSettingsProps) {
	const update = useUpdateOrganization();
	const deleteOrg = useDeleteOrganization();
	const nameSave = useSaveIndicator();
	const slugSave = useSaveIndicator();
	const [deleteInput, setDeleteInput] = useState("");
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	function handleBlur(
		field: "name" | "slug",
		value: string,
		indicator: { saved: boolean; trigger: () => void },
	) {
		const trimmed = value.trim();
		if (!trimmed || trimmed === org[field]) return;
		update.mutate(
			{ organizationId: org.id, data: { [field]: trimmed } },
			{ onSuccess: indicator.trigger },
		);
	}

	return (
		<div>
			<h1 className="text-xl font-semibold">General</h1>
			<p className="mb-6 mt-1 text-sm text-muted-foreground">
				Manage your workspace name, URL, and appearance.
			</p>

			<div className="rounded-lg border bg-card px-5">
				<SettingsRow
					label="Workspace name"
					hint="Displayed across the app and in email notifications."
				>
					<div className="relative">
						<Input
							defaultValue={org.name}
							onBlur={(e) => handleBlur("name", e.target.value, nameSave)}
						/>
						{nameSave.saved && (
							<span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-green-500">
								Saved ✓
							</span>
						)}
					</div>
				</SettingsRow>

				<SettingsRow
					label="URL slug"
					hint="Used in all workspace URLs. Changing it will invalidate existing links."
				>
					<div className="relative flex">
						<span className="flex h-9 items-center rounded-l-md border border-r-0 bg-muted px-3 text-xs text-muted-foreground">
							orbit.app/
						</span>
						<Input
							className="rounded-l-none"
							defaultValue={org.slug}
							onBlur={(e) => handleBlur("slug", e.target.value, slugSave)}
						/>
						{slugSave.saved && (
							<span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-green-500">
								Saved ✓
							</span>
						)}
					</div>
				</SettingsRow>

				<SettingsRow label="Logo" hint="PNG or JPG · max 2 MB." last>
					<div className="flex items-center gap-3">
						<div className="flex h-11 w-11 items-center justify-center rounded-lg border bg-muted text-lg font-bold text-primary">
							{org.logo ? (
								<img
									src={org.logo}
									alt="Logo"
									className="h-full w-full rounded-lg object-cover"
								/>
							) : (
								org.name[0]?.toUpperCase()
							)}
						</div>
						<Button variant="outline" size="sm" disabled>
							Upload logo
						</Button>
					</div>
				</SettingsRow>
			</div>

			{isOwner && (
				<div className="mt-10">
					<p className="mb-3 text-sm font-medium text-muted-foreground">
						Danger zone
					</p>
					<div className="rounded-lg border bg-card">
						<div className="flex items-center justify-between gap-6 border-b p-4">
							<div>
								<p className="text-sm font-medium">Transfer ownership</p>
								<p className="mt-0.5 text-xs text-muted-foreground">
									Assign the Owner role to another member. You will become an
									Admin.
								</p>
							</div>
							<Button variant="outline" size="sm" className="shrink-0" disabled>
								Transfer
							</Button>
						</div>
						<div className="flex items-center justify-between gap-6 p-4">
							<div>
								<p className="text-sm font-medium">Delete workspace</p>
								<p className="mt-0.5 text-xs text-muted-foreground">
									Permanently delete this workspace and all its data.
								</p>
							</div>
							<Button
								variant="destructive"
								size="sm"
								className="shrink-0"
								onClick={() => setShowDeleteConfirm(true)}
							>
								Delete workspace
							</Button>
						</div>
					</div>

					{showDeleteConfirm && (
						<div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
							<p className="mb-2 text-sm text-destructive">
								Type <strong>{org.name}</strong> to confirm deletion.
							</p>
							<Input
								value={deleteInput}
								onChange={(e) => setDeleteInput(e.target.value)}
								placeholder={org.name}
								className="mb-3 max-w-[280px]"
							/>
							<div className="flex gap-2">
								<Button
									variant="destructive"
									size="sm"
									disabled={deleteInput !== org.name || deleteOrg.isPending}
									onClick={() => deleteOrg.mutate(org.id)}
								>
									Confirm delete
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										setShowDeleteConfirm(false);
										setDeleteInput("");
									}}
								>
									Cancel
								</Button>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
