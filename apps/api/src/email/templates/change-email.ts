export function changeEmailTemplate(
	name: string,
	newEmail: string,
	url: string,
): { subject: string; html: string } {
	return {
		subject: "Verify your new Orbit email address",
		html: `
      <h2>Hi ${name}, confirm your new email</h2>
      <p>You requested to change your Orbit email address to <strong>${newEmail}</strong>.</p>
      <p>Click the button below to confirm this change.</p>
      <p><a href="${url}" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">Confirm New Email</a></p>
      <p>This link expires in 1 hour. If you didn't request this change, ignore this email — your current address will remain unchanged.</p>
      <p>— The Orbit Team</p>
    `,
	};
}
