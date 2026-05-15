export const QUEUES = {
	EMAIL: "email",
	BILLING: "billing",
	NOTIFICATION: "notification",
} as const;

export const NOTIFICATION_JOBS = {
	MEMBER_JOINED: "member_joined",
	CHANNEL_ADDED: "channel_added",
} as const;

export const EMAIL_JOBS = {
	SEND_VERIFY_EMAIL: "send-verify-email",
	SEND_WELCOME: "send-welcome",
	SEND_RESET_PASSWORD: "send-reset-password",
	SEND_INVITATION: "send-invitation",
	SEND_WORKSPACE_CREATED: "send-workspace-created",
	SEND_MEMBER_JOINED: "send-member-joined",
	SEND_CHANGE_EMAIL: "send-change-email",
	SEND_DELETE_ACCOUNT: "send-delete-account",
} as const;
