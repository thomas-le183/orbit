export interface WorkspaceCreatedEmailData {
	ownerName: string;
	organizationName: string;
	workspaceUrl: string;
}

export function workspaceCreatedEmail(data: WorkspaceCreatedEmailData): {
	subject: string;
	html: string;
} {
	return {
		subject: `Your Orbit workspace "${data.organizationName}" is ready`,
		html: `
      <h2>Workspace created!</h2>
      <p>Hi ${data.ownerName}, your workspace <strong>${data.organizationName}</strong> is all set up.</p>
      <p><a href="${data.workspaceUrl}" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">Open Workspace</a></p>
      <p>— The Orbit Team</p>
    `,
	};
}
