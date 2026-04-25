import { Button } from "@orbit/ui/components/button";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldSet,
} from "@orbit/ui/components/field";
import { Input } from "@orbit/ui/components/input";
import { ImageIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useSession, useUpdateUser } from "@/hooks/use-auth";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { SettingsPage } from "./settings-page";

export function ProfileSettings() {
	const { data: session } = useSession();
	const update = useUpdateUser();
	const [deleteOpen, setDeleteOpen] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const avatarId = useId();
	const nameId = useId();
	const emailId = useId();

	const user = session?.user;
	if (!user) return null;

	function saveName(value: string) {
		if (!user) return;
		const next = value.trim();
		if (next === (user.name ?? "").trim()) return;
		update.mutate(
			{ name: next },
			{ onSuccess: () => toast.success("Name updated") },
		);
	}

	function saveAvatar(value: string) {
		if (!user) return;
		const next = value.trim();
		const prev = (user.image ?? "").trim();
		if (next === prev) return;
		update.mutate(
			{ image: next === "" ? null : next },
			{
				onSuccess: () =>
					toast.success(next === "" ? "Picture removed" : "Picture updated"),
			},
		);
	}

	return (
		<SettingsPage
			title="Profile"
			subtitle="Personal info visible across Orbit."
		>
			<FieldGroup>
				<Field>
					<FieldLabel>Picture</FieldLabel>
					<div className="flex items-center gap-4">
						<button
							type="button"
							onClick={() => fileInputRef.current?.click()}
							className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							aria-label="Upload picture"
						>
							{user.image ? (
								<img
									src={user.image}
									alt={user.name ?? ""}
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
									onClick={() => fileInputRef.current?.click()}
								>
									<UploadIcon />
									Upload
								</Button>
								<Button
									variant="outline"
									size="sm"
									disabled={!user.image}
									onClick={() => saveAvatar("")}
								>
									<Trash2Icon />
									Remove
								</Button>
								<input
									ref={fileInputRef}
									id={avatarId}
									type="file"
									accept="image/png,image/jpeg,image/gif"
									className="hidden"
									onChange={(e) => {
										const file = e.target.files?.[0];
										if (!file) return;
										if (file.size > 10 * 1024 * 1024) {
											toast.error("Image must be under 10 MB");
											e.target.value = "";
											return;
										}
										const reader = new FileReader();
										reader.onload = () =>
											saveAvatar(String(reader.result ?? ""));
										reader.readAsDataURL(file);
										e.target.value = "";
									}}
								/>
							</div>
							<FieldDescription>
								We support your square PNGs, JPEGs and GIFs under 10MB
							</FieldDescription>
						</div>
					</div>
				</Field>

				<Field>
					<FieldContent>
						<FieldLabel htmlFor={nameId}>Name</FieldLabel>
						<FieldDescription>Shown everywhere you appear.</FieldDescription>
					</FieldContent>
					<Input
						id={nameId}
						className="w-70 shrink-0"
						defaultValue={user.name ?? ""}
						onBlur={(e) => saveName(e.target.value)}
					/>
				</Field>

				<Field>
					<FieldContent>
						<FieldLabel htmlFor={emailId}>Email</FieldLabel>
						<FieldDescription>
							The email associated to your account
						</FieldDescription>
					</FieldContent>
					<div className="flex w-70 shrink-0 items-center gap-2">
						<Input id={emailId} defaultValue={user.email} disabled />
					</div>
				</Field>
			</FieldGroup>

			<FieldSet className="mt-8">
				<FieldGroup>
					<Field>
						<FieldContent>
							<FieldLabel>Danger zone</FieldLabel>
							<FieldDescription>
								Permanently delete your account and data.
							</FieldDescription>
						</FieldContent>
						<Button variant="destructive" onClick={() => setDeleteOpen(true)}>
							Delete account
						</Button>
					</Field>
				</FieldGroup>
			</FieldSet>

			<DeleteAccountDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				userEmail={user.email}
			/>
		</SettingsPage>
	);
}
