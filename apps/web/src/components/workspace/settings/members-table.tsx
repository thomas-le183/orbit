import { Button } from "@orbit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@orbit/ui/components/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@orbit/ui/components/table";
import { UserAvatar } from "@orbit/ui/custom/user-avatar";
import { cn } from "@orbit/ui/lib/utils";
import { MoreHorizontalIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import {
	useCancelInvitation,
	useRemoveMember,
	useUpdateMemberRole,
} from "@/hooks/use-auth";
import { formatLastSeen, useOrgPresence } from "@/hooks/use-presence";
import { SettingsPage } from "./settings-page";

type Member = {
	id: string;
	userId: string;
	role: string;
	createdAt: Date | string;
	user: { id: string; name: string; email: string; image?: string | null };
};

type Invitation = {
	id: string;
	email: string;
	role: string | null;
	status: string;
	expiresAt: Date | string;
	inviterId: string;
};

const rolePillClass: Record<string, string> = {
	owner:
		"bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
	admin: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
	member: "bg-muted text-muted-foreground border-border",
};

function RolePill({ role }: { role: string }) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded border px-2 py-0.5 text-xs capitalize",
				rolePillClass[role] ?? rolePillClass.member,
			)}
		>
			{role}
		</span>
	);
}

export function MembersTable({
	members,
	invitations,
	organizationId,
	currentUserId,
	currentRole,
	inviteSlot,
}: {
	members: Member[];
	invitations: Invitation[];
	organizationId: string;
	currentUserId: string;
	currentRole: string;
	inviteSlot?: ReactNode;
}) {
	const removeMember = useRemoveMember();
	const updateRole = useUpdateMemberRole();
	const cancelInvitation = useCancelInvitation();
	const { data: presenceList } = useOrgPresence();
	const [search, setSearch] = useState("");
	const [roleFilter, setRoleFilter] = useState("all");

	const presenceMap = new Map(presenceList?.map((p) => [p.userId, p]));

	const filtered = members.filter((m) => {
		const q = search.toLowerCase();
		const matchesSearch =
			m.user.name.toLowerCase().includes(q) ||
			m.user.email.toLowerCase().includes(q);
		const matchesRole = roleFilter === "all" || m.role === roleFilter;
		return matchesSearch && matchesRole;
	});

	const canManage = currentRole === "admin" || currentRole === "owner";

	return (
		<SettingsPage
			title="Members"
			subtitle="Manage who has access to this workspace."
			action={inviteSlot}
		>
			{/* Toolbar */}
			<div className="flex items-center gap-2">
				<input
					type="text"
					placeholder="Filter by name or email…"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="h-8 w-56 rounded-md border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
				/>
				<select
					value={roleFilter}
					onChange={(e) => setRoleFilter(e.target.value)}
					className="h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
				>
					<option value="all">All roles</option>
					<option value="owner">Owner</option>
					<option value="admin">Admin</option>
					<option value="member">Member</option>
				</select>
				<span className="ml-auto text-xs text-muted-foreground">
					{members.length} member{members.length !== 1 ? "s" : ""}
					{invitations.length > 0 && ` · ${invitations.length} pending`}
				</span>
			</div>

			<section>
				<h2 className="mb-2 capitalize text-foreground">Active members</h2>
				<div className="rounded-lg border bg-card">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Email</TableHead>
								<TableHead className="w-25">Role</TableHead>
								<TableHead className="w-27.5">Joined</TableHead>
								<TableHead className="w-32.5">Last seen</TableHead>
								<TableHead className="w-9" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{filtered.map((m) => {
								const presence = presenceMap.get(m.userId);
								const isYou = m.userId === currentUserId;
								return (
									<TableRow key={m.id}>
										<TableCell>
											<div className="flex items-center gap-2.5">
												<UserAvatar
													size="sm"
													colorSeed={m.user.id}
													placeholder={m.user.name}
													avatarUrl={m.user.image}
												/>
												<p>
													{m.user.name}
													{isYou && (
														<span className="ml-1.5 rounded bg-muted px-1 py-px text-[9px] text-muted-foreground">
															you
														</span>
													)}
												</p>
											</div>
										</TableCell>
										<TableCell className="text-muted-foreground">
											{m.user.email}
										</TableCell>
										<TableCell>
											<RolePill role={m.role} />
										</TableCell>
										<TableCell className="text-xs text-muted-foreground">
											{new Date(m.createdAt).toLocaleDateString("en-US", {
												month: "short",
												day: "numeric",
												year: "numeric",
											})}
										</TableCell>
										<TableCell>
											<span
												className={cn(
													"text-xs",
													presence?.status === "online"
														? "text-green-500"
														: "text-muted-foreground",
												)}
											>
												{formatLastSeen(presence)}
											</span>
										</TableCell>
										<TableCell>
											{canManage && !isYou && (
												<DropdownMenu>
													<DropdownMenuTrigger
														render={
															<Button
																variant="ghost"
																size="icon"
																className="h-7 w-7"
															>
																<MoreHorizontalIcon className="size-4" />
															</Button>
														}
													/>
													<DropdownMenuContent align="end">
														{(["admin", "member"] as const).map((r) => (
															<DropdownMenuItem
																key={r}
																disabled={m.role === r}
																onClick={() =>
																	updateRole.mutate({
																		organizationId,
																		memberId: m.id,
																		role: r,
																	})
																}
															>
																Change to {r}
															</DropdownMenuItem>
														))}
														<DropdownMenuSeparator />
														<DropdownMenuItem
															variant="destructive"
															onClick={() =>
																removeMember.mutate({
																	organizationId,
																	memberIdOrEmail: m.id,
																})
															}
														>
															Remove from workspace
														</DropdownMenuItem>
													</DropdownMenuContent>
												</DropdownMenu>
											)}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>
			</section>

			{invitations.length > 0 && (
				<section>
					<h2 className="mb-2 capitalize text-foreground">
						Pending invitations
					</h2>
					<div className="rounded-lg border bg-card">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Email</TableHead>
									<TableHead className="w-25">Role</TableHead>
									<TableHead className="w-32.5">Expires</TableHead>
									<TableHead className="w-9" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{invitations.map((inv) => {
									const daysLeft = Math.ceil(
										(new Date(inv.expiresAt).getTime() - Date.now()) /
											86_400_000,
									);
									return (
										<TableRow key={inv.id}>
											<TableCell>
												<div className="flex items-center gap-2.5">
													<div className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed bg-muted text-xs text-muted-foreground">
														+
													</div>
													<p className="text-sm text-muted-foreground">
														{inv.email}
													</p>
												</div>
											</TableCell>
											<TableCell>
												<RolePill role={inv.role ?? "member"} />
											</TableCell>
											<TableCell>
												<span
													className={cn(
														"text-xs",
														daysLeft <= 3
															? "text-amber-500"
															: "text-muted-foreground",
													)}
												>
													{daysLeft > 0 ? `${daysLeft}d` : "Expired"}
												</span>
											</TableCell>
											<TableCell>
												<DropdownMenu>
													<DropdownMenuTrigger
														render={
															<Button
																variant="ghost"
																size="icon"
																className="h-7 w-7"
															>
																<MoreHorizontalIcon className="size-4" />
															</Button>
														}
													/>
													<DropdownMenuContent align="end">
														<DropdownMenuItem
															variant="destructive"
															onClick={() => cancelInvitation.mutate(inv.id)}
														>
															Revoke invitation
														</DropdownMenuItem>
													</DropdownMenuContent>
												</DropdownMenu>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
				</section>
			)}
		</SettingsPage>
	);
}
