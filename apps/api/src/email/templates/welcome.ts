export function welcomeEmail(name: string): { subject: string; html: string } {
	return {
		subject: "Welcome to Orbit!",
		html: `
      <h2>You're all set, ${name}!</h2>
      <p>Your email is verified and your Orbit account is ready. Create a workspace to get started.</p>
      <p>— The Orbit Team</p>
    `,
	};
}
