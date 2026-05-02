import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { Resend } from "resend";
import { EmailService } from "./email.service";

jest.mock("resend");

const mockSend = jest.fn().mockResolvedValue({ data: { id: "test-id" }, error: null });
(Resend as jest.MockedClass<typeof Resend>).mockImplementation(
  () => ({ emails: { send: mockSend } }) as unknown as Resend,
);

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
              if (key === "RESEND_API_KEY") return "re_test";
              if (key === "EMAIL_FROM") return "Orbit <noreply@test.com>";
              return undefined;
            },
          },
        },
      ],
    }).compile();
    service = module.get(EmailService);
    mockSend.mockClear();
  });

  it("sendVerifyEmail calls resend with verify subject", async () => {
    await service.sendVerifyEmail("user@example.com", "Alice", "https://example.com/verify?token=abc");
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["user@example.com"],
        subject: "Verify your Orbit email address",
      }),
    );
  });

  it("sendWelcome calls resend with welcome subject", async () => {
    await service.sendWelcome("user@example.com", "Alice");
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["user@example.com"],
        subject: "Welcome to Orbit!",
      }),
    );
  });

  it("sendResetPassword calls resend with reset subject", async () => {
    await service.sendResetPassword("user@example.com", "Alice", "https://example.com/reset?token=abc");
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["user@example.com"],
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
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["invitee@example.com"],
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
    expect(mockSend).toHaveBeenCalledWith(
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
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("Dave"),
      }),
    );
  });

  it("does not throw when resend returns an error", async () => {
    mockSend.mockResolvedValueOnce({ data: null, error: { message: "bad key" } });
    await expect(service.sendWelcome("user@example.com", "Alice")).resolves.not.toThrow();
  });
});
