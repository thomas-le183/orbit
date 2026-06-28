import type { InvitationEmailData } from "./templates/invitation";
import type { MemberJoinedEmailData } from "./templates/member-joined";
import type { WorkspaceCreatedEmailData } from "./templates/workspace-created";

export type EmailJobData =
	| { type: "send-verify-email"; to: string; name: string; url: string }
	| { type: "send-welcome"; to: string; name: string }
	| { type: "send-reset-password"; to: string; name: string; url: string }
	| { type: "send-invitation"; to: string; data: InvitationEmailData }
	| {
			type: "send-workspace-created";
			to: string;
			data: WorkspaceCreatedEmailData;
	  }
	| { type: "send-member-joined"; to: string; data: MemberJoinedEmailData }
	| {
			type: "send-change-email";
			to: string;
			name: string;
			newEmail: string;
			url: string;
	  }
	| { type: "send-delete-account"; to: string; name: string; url: string };
