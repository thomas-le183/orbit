export function verifyEmailTemplate(name: string, url: string): { subject: string; html: string } {
  return {
    subject: "Verify your Orbit email address",
    html: `
      <h2>Hi ${name}, please verify your email</h2>
      <p>Click the button below to verify your email address and activate your account.</p>
      <p><a href="${url}" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">Verify Email</a></p>
      <p>This link expires in 24 hours. If you didn't create an Orbit account, ignore this email.</p>
      <p>— The Orbit Team</p>
    `,
  };
}
