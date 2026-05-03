export interface InvitationEmailData {
	inviterName: string;
	organizationName: string;
	inviteUrl: string;
}

export function invitationEmail(data: InvitationEmailData): {
	subject: string;
	html: string;
} {
	return {
		subject: `${data.inviterName} invited you to ${data.organizationName} on Orbit`,
		html: `
      <h2>You're invited!</h2>
      <p><strong>${data.inviterName}</strong> has invited you to join <strong>${data.organizationName}</strong> on Orbit.</p>
      <p><a href="${data.inviteUrl}" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">Accept Invitation</a></p>
      <p>This link expires in 48 hours.</p>
      <p>— The Orbit Team</p>
    `,
	};
}
