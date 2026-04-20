import { Badge } from "@orbit/ui/components/badge";
import { Button } from "@orbit/ui/components/button";
import { Input } from "@orbit/ui/components/input";
import { useState } from "react";
import { UserAvatar } from "@/components/common/user-avatar";
import { useSession, useUpdateUser } from "@/hooks/use-auth";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { SettingsPage } from "./settings-page";
import { SettingsRow } from "./settings-row";
import { SettingsSection } from "./settings-section";
import { useSaveIndicator } from "./use-save-indicator";

export function ProfileSettings() {
	const { data: session } = useSession();
	const update = useUpdateUser();
	const nameSave = useSaveIndicator();
	const avatarSave = useSaveIndicator();
	const [deleteOpen, setDeleteOpen] = useState(false);

	const user = session?.user;
	if (!user) return null;

	function saveName(value: string) {
		if (!user) return;
		const next = value.trim();
		if (next === (user.name ?? "").trim()) return;
		update.mutate({ name: next }, { onSuccess: nameSave.trigger });
	}

	function saveAvatar(value: string) {
		if (!user) return;
		const next = value.trim();
		const prev = (user.image ?? "").trim();
		if (next === prev) return;
		update.mutate(
			{ image: next === "" ? null : next },
			{ onSuccess: avatarSave.trigger },
		);
	}

	return (
		<SettingsPage
			title="Profile"
			subtitle="Personal info visible across Orbit."
		>
			<SettingsSection>
				<SettingsRow
					label="Avatar"
					hint="Paste an image URL. Upload is coming later."
					saved={avatarSave.saved}
				>
					<div className="flex items-center gap-2">
						<UserAvatar name={user.name} image={user.image} size="sm" />
						<Input
							defaultValue={user.image ?? ""}
							placeholder="https://…"
							onBlur={(e) => saveAvatar(e.target.value)}
						/>
					</div>
				</SettingsRow>
				<SettingsRow
					label="Full name"
					hint="Shown everywhere you appear."
					saved={nameSave.saved}
				>
					<Input
						defaultValue={user.name ?? ""}
						onBlur={(e) => saveName(e.target.value)}
					/>
				</SettingsRow>
				<SettingsRow label="Email" hint="Contact your admin to change." last>
					<div className="flex items-center gap-2">
						<Input defaultValue={user.email} disabled />
						<Badge variant="secondary">Verified</Badge>
					</div>
				</SettingsRow>
			</SettingsSection>

			<SettingsSection heading="Danger zone" tone="destructive">
				<SettingsRow
					label="Delete account"
					hint="Permanently delete your account and data."
					last
				>
					<Button variant="destructive" onClick={() => setDeleteOpen(true)}>
						Delete account
					</Button>
				</SettingsRow>
			</SettingsSection>

			<DeleteAccountDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				userEmail={user.email}
			/>
		</SettingsPage>
	);
}
