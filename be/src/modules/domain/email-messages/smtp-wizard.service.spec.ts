import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import { WorkspacesService } from "@modules/domain/workspaces"
import { MAIL, MAIL_ERROR_KINDS, MailError, renderEmail } from "@modules/integrations/mail"
import type { MailClient } from "@modules/integrations/mail"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { EmailMessagesLogEvent } from "./email-messages.log-events"
import { EmailMessagesService } from "./email-messages.service"
import { EmailMessagesErrorCode } from "./errors/email-messages.error"
import { SmtpWizardService } from "./smtp-wizard.service"
import type { SmtpFormInput } from "./smtp-wizard.contracts"

const actor: ConnectionActor = { principalId: "owner-1", workspaceId: "ws-1" }

const formOf = builder<SmtpFormInput>({
    preset: "gmail",
    host: " SMTP.Gmail.com ",
    port: 465,
    security: "tls",
    user: "shop@gmail.com",
    password: "abcd efgh ijkl mnop",
    fromName: "Flower Shop",
    fromEmail: "Shop@Gmail.com",
    replyTo: "",
})

const connectionOf = builder<ConnectionRecord>({
    id: "smtp-1",
    workspaceId: "ws-1",
    provider: "smtp",
    name: "Flower Shop <shop@gmail.com>",
    meta: {
        preset: "gmail",
        host: "smtp.gmail.com",
        port: "465",
        security: "tls",
        user: "shop@gmail.com",
        from_name: "Flower Shop",
        from_email: "shop@gmail.com",
        reply_to: "",
    },
    status: "pending",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: "owner-1",
    createdAt: "2026-10-13T00:00:00.000Z",
})

const SMTP_CONFIG = {
    host: "smtp.gmail.com",
    port: 465,
    security: "tls",
    user: "shop@gmail.com",
    pass: "abcdefghijklmnop",
    fromName: "Flower Shop",
    fromEmail: "shop@gmail.com",
    replyTo: undefined,
}

const build = async (found: ConnectionRecord | null = connectionOf()) => {
    const mail = mock<MailClient>({
        assertSmtpTarget: jest.fn(() => Promise.resolve()),
        sendThroughSmtp: jest.fn(() => Promise.resolve({ messageId: "<msg-1@gmail.com>" })),
    })
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) })
    const logger = mock<Logger>()
    const connections = mock<ConnectionsService>({
        authorize: jest.fn(() => Promise.resolve({ role: "owner", displayName: "Lan" })),
        create: jest.fn(() => Promise.resolve("smtp-1")),
        find: jest.fn(() => Promise.resolve(found)),
        readSecret: jest.fn(() =>
            Promise.resolve({ plain: JSON.stringify({ password: "abcdefghijklmnop" }), webhookSecret: "w" }),
        ),
        patch: jest.fn(() => Promise.resolve()),
        writeSecret: jest.fn(() => Promise.resolve()),
        defaultSmtpId: jest.fn(() => Promise.resolve(null)),
        setDefaultSmtp: jest.fn(() => Promise.resolve()),
    })
    const log = mock<EmailMessagesService>({ record: jest.fn(() => Promise.resolve("em-1")) })
    const workspaces = mock<WorkspacesService>({ nameOf: jest.fn(() => Promise.resolve("Flower Shop")) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            SmtpWizardService,
            { provide: MAIL, useValue: mail },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
            { provide: ConnectionsService, useValue: connections },
            { provide: EmailMessagesService, useValue: log },
            { provide: WorkspacesService, useValue: workspaces },
        ],
    }).compile()
    return { service: moduleRef.get(SmtpWizardService), mail, logger, connections, log, workspaces }
}

describe("SmtpWizardService", () => {
    describe("start", () => {
        it("stores the cleaned form as a pending connection", async () => {
            const { service, mail, connections } = await build()

            await expect(service.start(actor, formOf())).resolves.toEqual({
                id: "smtp-1",
                host: "smtp.gmail.com",
                fromEmail: "shop@gmail.com",
                isDefault: false,
            })

            expect(connections.authorize).toHaveBeenCalledWith(actor, ["owner"])
            expect(mail.assertSmtpTarget).toHaveBeenCalledWith("smtp.gmail.com", 465)
            const [input] = connections.create.mock.calls[0] ?? []
            expect(input).toMatchObject({
                workspaceId: "ws-1",
                createdBy: "owner-1",
                provider: "smtp",
                name: "Flower Shop <shop@gmail.com>",
                status: "pending",
                environment: "live",
                meta: connectionOf().meta,
            })
            expect(input?.secret?.plain).toBe(JSON.stringify({ password: "abcdefghijklmnop" }))
            expect(input?.secret?.webhookSecret).not.toBe("")
        })

        it("refuses an invalid form before touching the mail server", async () => {
            const { service, mail, connections } = await build()

            await expect(service.start(actor, formOf({ port: 0 }))).rejects.toMatchObject({
                code: EmailMessagesErrorCode.SmtpPort,
            })
            expect(mail.assertSmtpTarget).not.toHaveBeenCalled()
            expect(connections.create).not.toHaveBeenCalled()
        })
    })
})

describe("SmtpWizardService", () => {
    describe("sendTest", () => {
        it("sends a real test email, logs it, connects the connection and makes it the first default", async () => {
            const { service, mail, connections, log } = await build()

            await expect(
                service.sendTest(actor, { connectionId: "smtp-1", to: " Lan@Example.test ", makeDefault: false }),
            ).resolves.toEqual({ to: "lan@example.test", isDefault: true })

            const rendered = renderEmail({
                shopName: "Flower Shop",
                title: "[email.test_subject]",
                body: "[email.test_body]",
                footer: "[email.test_footer]",
                lang: "vi",
            })
            expect(mail.sendThroughSmtp).toHaveBeenCalledWith(SMTP_CONFIG, {
                to: "lan@example.test",
                subject: "[email.test_subject]",
                html: rendered.html,
                text: rendered.text,
            })
            expect(log.record).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                connectionId: "smtp-1",
                to: "lan@example.test",
                subject: "[email.test_subject]",
                purpose: "test",
                status: "sent",
                via: "workspace",
                providerMessageId: "<msg-1@gmail.com>",
                error: null,
                refs: {},
            })
            expect(connections.patch).toHaveBeenCalledWith("ws-1", "smtp-1", { status: "connected", lastError: null })
            expect(connections.setDefaultSmtp).toHaveBeenCalledWith("ws-1", "smtp-1")
        })

        it("keeps another default sender unless asked", async () => {
            const { service, connections } = await build()
            connections.defaultSmtpId.mockResolvedValue("smtp-0")

            await expect(
                service.sendTest(actor, { connectionId: "smtp-1", to: "lan@example.test", makeDefault: false }),
            ).resolves.toEqual({ to: "lan@example.test", isDefault: false })
            expect(connections.setDefaultSmtp).not.toHaveBeenCalled()
        })

        it("replaces an existing default when the owner asks", async () => {
            const { service, connections } = await build()
            connections.defaultSmtpId.mockResolvedValue("smtp-0")

            await expect(
                service.sendTest(actor, { connectionId: "smtp-1", to: "lan@example.test", makeDefault: true }),
            ).resolves.toEqual({ to: "lan@example.test", isDefault: true })
            expect(connections.setDefaultSmtp).toHaveBeenCalledWith("ws-1", "smtp-1")
        })
    })
})

describe("SmtpWizardService", () => {
    describe("sendTest", () => {
        it("reports the existing default without changing it again", async () => {
            const { service, connections } = await build()
            connections.defaultSmtpId.mockResolvedValue("smtp-1")

            await expect(
                service.sendTest(actor, { connectionId: "smtp-1", to: "lan@example.test", makeDefault: false }),
            ).resolves.toEqual({ to: "lan@example.test", isDefault: true })
            expect(connections.setDefaultSmtp).not.toHaveBeenCalled()
        })
    })
})

describe("SmtpWizardService", () => {
    describe("sendTest", () => {
        it("uses NIVO as the shop name when the workspace has no name", async () => {
            const { service, mail, workspaces } = await build()
            workspaces.nameOf.mockResolvedValue("")

            await expect(
                service.sendTest(actor, { connectionId: "smtp-1", to: "lan@example.test", makeDefault: false }),
            ).resolves.toEqual({ to: "lan@example.test", isDefault: true })

            const rendered = renderEmail({
                shopName: "NIVO",
                title: "[email.test_subject]",
                body: "[email.test_body]",
                footer: "[email.test_footer]",
                lang: "vi",
            })
            expect(workspaces.nameOf).toHaveBeenCalledWith("ws-1")
            expect(mail.sendThroughSmtp).toHaveBeenCalledWith(SMTP_CONFIG, {
                to: "lan@example.test",
                subject: "[email.test_subject]",
                html: rendered.html,
                text: rendered.text,
            })
        })

        it("records the translated mail integration error and rethrows it", async () => {
            const { service, mail, connections, log } = await build()
            const authCode = Object.keys(MAIL_ERROR_KINDS).find(
                (code): code is MailError["code"] => code === "MAIL_AUTH",
            )
            expect(authCode).toBe("MAIL_AUTH")
            if (authCode === undefined) return
            const failure = new MailError({ code: authCode })
            mail.sendThroughSmtp.mockRejectedValue(failure)

            await expect(
                service.sendTest(actor, { connectionId: "smtp-1", to: "lan@example.test", makeDefault: false }),
            ).rejects.toBe(failure)
            expect(log.record).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                connectionId: "smtp-1",
                to: "lan@example.test",
                subject: "[email.test_subject]",
                purpose: "test",
                status: "failed",
                via: "workspace",
                providerMessageId: null,
                error: "[errors.MAIL_AUTH]",
                refs: {},
            })
            expect(connections.patch).toHaveBeenCalledWith("ws-1", "smtp-1", {
                status: "pending",
                lastError: "[errors.MAIL_AUTH]",
            })
        })
    })
})

describe("SmtpWizardService", () => {
    describe("sendTest", () => {
        it("keeps a failed send's reason on a connected connection and rethrows", async () => {
            const { service, mail, connections, log } = await build(connectionOf({ status: "connected" }))
            const failure = new Error("socket hang up")
            mail.sendThroughSmtp.mockRejectedValue(failure)

            await expect(
                service.sendTest(actor, { connectionId: "smtp-1", to: "lan@example.test", makeDefault: true }),
            ).rejects.toBe(failure)

            expect(log.record.mock.calls[0]?.[0]).toMatchObject({
                status: "failed",
                providerMessageId: null,
                error: "[errors.MAIL_UNKNOWN]",
            })
            expect(connections.patch.mock.calls).toEqual([
                ["ws-1", "smtp-1", { status: "error", lastError: "[errors.MAIL_UNKNOWN]" }],
            ])
            expect(connections.setDefaultSmtp).not.toHaveBeenCalled()
        })

        it("keeps a pending connection pending when its first test fails", async () => {
            const { service, mail, connections } = await build()
            mail.sendThroughSmtp.mockRejectedValue(new Error("timeout"))

            await expect(
                service.sendTest(actor, { connectionId: "smtp-1", to: "lan@example.test", makeDefault: false }),
            ).rejects.toThrow("timeout")
            expect(connections.patch).toHaveBeenCalledWith("ws-1", "smtp-1", {
                status: "pending",
                lastError: "[errors.MAIL_UNKNOWN]",
            })
        })

        it("refuses a malformed recipient", async () => {
            const { service, mail } = await build()

            await expect(
                service.sendTest(actor, { connectionId: "smtp-1", to: "not-an-address", makeDefault: false }),
            ).rejects.toMatchObject({ code: EmailMessagesErrorCode.SmtpEmail })
            expect(mail.sendThroughSmtp).not.toHaveBeenCalled()
        })

        it("refuses an unreadable credential and logs why", async () => {
            const { service, connections, logger, mail } = await build()
            connections.readSecret.mockResolvedValue({ plain: "{broken", webhookSecret: "w" })

            await expect(
                service.sendTest(actor, { connectionId: "smtp-1", to: "lan@example.test", makeDefault: false }),
            ).rejects.toMatchObject({ code: EmailMessagesErrorCode.SmtpPassword })
            expect(logger.error.mock.calls[0]?.[0]).toBe(EmailMessagesLogEvent.Undecryptable)
            expect(logger.error.mock.calls[0]?.[2]).toEqual({ connectionId: "smtp-1" })
            expect(mail.sendThroughSmtp).not.toHaveBeenCalled()
        })

        it("refuses a connection without a stored secret", async () => {
            const { service, connections } = await build()
            connections.readSecret.mockResolvedValue(null)

            await expect(
                service.sendTest(actor, { connectionId: "smtp-1", to: "lan@example.test", makeDefault: false }),
            ).rejects.toMatchObject({ code: EmailMessagesErrorCode.SmtpPassword })
        })
    })
})

describe("SmtpWizardService", () => {
    describe("sendTest", () => {
        it("refuses a disconnected or foreign connection", async () => {
            const disconnected = await build(connectionOf({ status: "disconnected" }))
            const other = await build(connectionOf({ provider: "telegram" }))
            const missing = await build(null)
            const input = { connectionId: "smtp-1", to: "lan@example.test", makeDefault: false }

            await expect(disconnected.service.sendTest(actor, input)).rejects.toMatchObject({
                code: EmailMessagesErrorCode.SmtpNone,
            })
            await expect(other.service.sendTest(actor, input)).rejects.toMatchObject({
                code: EmailMessagesErrorCode.SmtpNone,
            })
            await expect(missing.service.sendTest(actor, input)).rejects.toMatchObject({
                code: EmailMessagesErrorCode.SmtpNone,
            })
        })
    })

    describe("changePassword", () => {
        it("stores the cleaned password and asks for a new test", async () => {
            const { service, connections } = await build(connectionOf({ status: "connected" }))

            await service.changePassword(actor, "smtp-1", " wxyz 1234 ")

            expect(connections.writeSecret).toHaveBeenCalledWith("smtp-1", JSON.stringify({ password: "wxyz1234" }))
            expect(connections.patch).toHaveBeenCalledWith("ws-1", "smtp-1", { status: "pending", lastError: null })
        })

        it("refuses an empty password", async () => {
            const { service, connections } = await build()

            await expect(service.changePassword(actor, "smtp-1", "   ")).rejects.toMatchObject({
                code: EmailMessagesErrorCode.SmtpPassword,
            })
            expect(connections.writeSecret).not.toHaveBeenCalled()
        })

        it("trims passwords without stripping internal spaces when no preset is stored", async () => {
            const { service, connections } = await build(connectionOf({ meta: {} }))

            await service.changePassword(actor, "smtp-1", "  word one two  ")

            expect(connections.writeSecret).toHaveBeenCalledWith("smtp-1", JSON.stringify({ password: "word one two" }))
            expect(connections.patch).toHaveBeenCalledWith("ws-1", "smtp-1", { status: "pending", lastError: null })
        })
    })
})

describe("SmtpWizardService", () => {
    describe("setDefault", () => {
        it("makes a connected connection the default sender", async () => {
            const { service, connections } = await build(connectionOf({ status: "connected" }))

            await service.setDefault(actor, "smtp-1")

            expect(connections.setDefaultSmtp).toHaveBeenCalledWith("ws-1", "smtp-1")
        })

        it("refuses a connection that is not connected", async () => {
            const { service, connections } = await build(connectionOf({ status: "disconnected" }))

            await expect(service.setDefault(actor, "smtp-1")).rejects.toMatchObject({
                code: EmailMessagesErrorCode.SmtpNotConnected,
            })
            expect(connections.setDefaultSmtp).not.toHaveBeenCalled()
        })
    })
})
