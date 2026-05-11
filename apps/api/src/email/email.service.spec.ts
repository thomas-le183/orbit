import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import * as nodemailer from "nodemailer";
import { EmailService } from "./email.service";

jest.mock("nodemailer");

const mockSendMail = jest.fn().mockResolvedValue({ messageId: "test-id" });
(nodemailer.createTransport as jest.Mock).mockReturnValue({
	sendMail: mockSendMail,
});

describe("EmailService", () => {
	let service: EmailService;

	beforeEach(async () => {
		const module = await Test.createTestingModule({
			providers: [
				EmailService,
				{
					provide: ConfigService,
					useValue: {
						get: (key: string) => {
							if (key === "SMTP_HOST") return "localhost";
							if (key === "SMTP_PORT") return 1025;
							if (key === "EMAIL_FROM") return "Orbit <noreply@test.com>";
							return undefined;
						},
					},
				},
			],
		}).compile();
		service = module.get(EmailService);
		mockSendMail.mockClear();
	});

	it("sendVerifyEmail sends with verify subject", async () => {
		await service.sendVerifyEmail(
			"user@example.com",
			"Alice",
			"https://example.com/verify?token=abc",
		);
		expect(mockSendMail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "user@example.com",
				subject: "Verify your Orbit email address",
			}),
		);
	});

	it("sendWelcome sends with welcome subject", async () => {
		await service.sendWelcome("user@example.com", "Alice");
		expect(mockSendMail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "user@example.com",
				subject: "Welcome to Orbit!",
			}),
		);
	});

	it("sendResetPassword sends with reset subject", async () => {
		await service.sendResetPassword(
			"user@example.com",
			"Alice",
			"https://example.com/reset?token=abc",
		);
		expect(mockSendMail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "user@example.com",
				subject: "Reset your Orbit password",
			}),
		);
	});

	it("sendInvitation includes inviter name in subject", async () => {
		await service.sendInvitation("invitee@example.com", {
			inviterName: "Bob",
			organizationName: "Acme",
			inviteUrl: "http://localhost:5173/invite/abc123",
		});
		expect(mockSendMail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "invitee@example.com",
				subject: expect.stringContaining("Bob"),
			}),
		);
	});

	it("sendWorkspaceCreated includes org name in subject", async () => {
		await service.sendWorkspaceCreated("owner@example.com", {
			ownerName: "Carol",
			organizationName: "My Co",
			workspaceUrl: "http://localhost:5173/my-co",
		});
		expect(mockSendMail).toHaveBeenCalledWith(
			expect.objectContaining({
				subject: expect.stringContaining("My Co"),
			}),
		);
	});

	it("sendMemberJoined includes new member name in subject", async () => {
		await service.sendMemberJoined("owner@example.com", {
			newMemberName: "Dave",
			newMemberEmail: "dave@example.com",
			organizationName: "Acme",
			workspaceUrl: "http://localhost:5173/acme",
		});
		expect(mockSendMail).toHaveBeenCalledWith(
			expect.objectContaining({
				subject: expect.stringContaining("Dave"),
			}),
		);
	});

	it("sendChangeEmail sends with new email in subject", async () => {
		await service.sendChangeEmail(
			"user@example.com",
			"Alice",
			"new@example.com",
			"https://example.com/verify-change?token=abc",
		);
		expect(mockSendMail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "user@example.com",
				subject: "Verify your new Orbit email address",
			}),
		);
	});

	it("sendDeleteAccount sends with deletion subject", async () => {
		await service.sendDeleteAccount(
			"user@example.com",
			"Alice",
			"https://example.com/confirm-delete?token=abc",
		);
		expect(mockSendMail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "user@example.com",
				subject: "Confirm your Orbit account deletion",
			}),
		);
	});

	it("does not throw when sendMail rejects", async () => {
		mockSendMail.mockRejectedValueOnce(new Error("connection refused"));
		await expect(
			service.sendWelcome("user@example.com", "Alice"),
		).resolves.not.toThrow();
	});
});
