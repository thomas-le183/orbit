export interface MemberJoinedEmailData {
	newMemberName: string;
	newMemberEmail: string;
	organizationName: string;
	workspaceUrl: string;
}

export function memberJoinedEmail(data: MemberJoinedEmailData): {
	subject: string;
	html: string;
} {
	return {
		subject: `${data.newMemberName} joined ${data.organizationName} on Orbit`,
		html: `
      <h2>New member joined!</h2>
      <p><strong>${data.newMemberName}</strong> (${data.newMemberEmail}) accepted their invitation and joined <strong>${data.organizationName}</strong>.</p>
      <p><a href="${data.workspaceUrl}" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">View Workspace</a></p>
      <p>— The Orbit Team</p>
    `,
	};
}
