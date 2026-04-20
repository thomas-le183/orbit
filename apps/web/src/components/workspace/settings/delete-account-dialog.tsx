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
import { useDeleteAccount } from "@/hooks/use-auth";

export function DeleteAccountDialog({
	open,
	onOpenChange,
	userEmail,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	userEmail: string;
}) {
	const router = useRouter();
	const deleteAccount = useDeleteAccount();
	const [confirm, setConfirm] = useState("");
	const canDelete = confirm === userEmail && !deleteAccount.isPending;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete account</DialogTitle>
					<DialogDescription>
						This permanently deletes your account and all data. This cannot be
						undone.
					</DialogDescription>
				</DialogHeader>
				<p className="text-sm">
					Type <strong>{userEmail}</strong> to confirm.
				</p>
				<Input
					value={confirm}
					onChange={(e) => setConfirm(e.target.value)}
					placeholder={userEmail}
				/>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						disabled={!canDelete}
						onClick={() =>
							deleteAccount.mutate(undefined, {
								onSuccess: () => router.navigate({ to: "/" }),
							})
						}
					>
						Delete account
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
