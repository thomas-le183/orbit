export function resetPasswordEmail(
	name: string,
	url: string,
): { subject: string; html: string } {
	return {
		subject: "Reset your Orbit password",
		html: `
      <h2>Hi ${name}, reset your password</h2>
      <p>Click the button below to choose a new password.</p>
      <p><a href="${url}" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">Reset Password</a></p>
      <p>This link expires in 1 hour. If you didn't request a password reset, ignore this email.</p>
      <p>— The Orbit Team</p>
    `,
	};
}
