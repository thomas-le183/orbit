export function deleteAccountEmail(
	name: string,
	url: string,
): { subject: string; html: string } {
	return {
		subject: "Confirm your Orbit account deletion",
		html: `
      <h2>Hi ${name}, confirm account deletion</h2>
      <p>We received a request to permanently delete your Orbit account and all associated data.</p>
      <p><a href="${url}" style="background:#dc2626;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">Delete My Account</a></p>
      <p>This link expires in 1 hour. If you didn't request this, ignore this email — your account will remain active.</p>
      <p>— The Orbit Team</p>
    `,
	};
}
