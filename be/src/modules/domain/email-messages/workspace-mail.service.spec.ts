import { Test } from "@nestjs/testing"
import { builder, FakeClock, mock } from "@starci/jest-preset"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { MAIL, MAIL_ERROR_KINDS, MailError } from "@modules/integrations/mail"
import type { MailClient } from "@modules/integrations/mail"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { EmailMessagesLogEvent } from "./email-messages.log-events"
import { EmailMessagesService } from "./email-messages.service"
import type { SendEmailInput } from "./email-messages.contracts"
import { WorkspaceMailService } from "./workspace-mail.service"

const WS = "11111111-1111-4111-8111-111111111111"
const owner: SendEmailInput = {
    workspaceId: WS,
    to: "owner@example.com",
    subject: "Daily report",
    html: "<p>Report</p>",
    text: "Report",
    purpose: "daily_report",
    audience: "owner",
}

const build = async () => {
    const log = mock<EmailMessagesService>({
        sentSince: jest.fn().mockResolvedValue(0),
        record: jest.fn().mockResolvedValue("e1"),
    })
    const mail = mock<MailClient>({ hasPlatformSender: jest.fn().mockReturnValue(false) })
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => key) })
    const connections = mock<ConnectionsService>({ listByProvider: jest.fn().mockResolvedValue([]) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceMailService,
            { provide: MAIL, useValue: mail },
            { provide: CLOCK, useValue: new FakeClock("2026-10-13T10:00:00.000Z") },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: EmailMessagesService, useValue: log },
            { provide: ConnectionsService, useValue: connections },
        ],
    }).compile()
    return moduleRef.get(WorkspaceMailService)
}

describe("WorkspaceMailService", () => {
    it("refuses attachments over the size one email may carry, before any sender is tried", async () => {
        const service = await build()
        const big = Buffer.alloc(2_100_000, 1).toString("base64")
        const sent = await service.send({
            ...owner,
            attachments: [{ filename: "big.bin", content: big, encoding: "base64" }],
        })
        expect(sent).toMatchObject({ status: "blocked", failure: "attachment", error: "email.err_attachment" })
    })

    it("refuses a customer email that did not pass the gate", async () => {
        const service = await build()
        await expect(service.send({ ...owner, audience: "customer" })).resolves.toMatchObject({
            status: "blocked",
            failure: "gate",
        })
    })

    it("records an owner notice as no_smtp when neither the workspace nor the platform can send", async () => {
        const service = await build()
        await expect(service.send(owner)).resolves.toMatchObject({ status: "no_smtp", failure: "no_smtp" })
    })
})

const OWNER: SendEmailInput = {
    workspaceId: "ws-1",
    to: "owner@example.com",
    subject: "Daily report",
    html: "<p>Report</p>",
    text: "Report",
    purpose: "daily_report",
    audience: "owner",
}
const connectionOf = builder<ConnectionRecord>({
    id: "smtp-1",
    workspaceId: "ws-1",
    provider: "smtp",
    name: "Shop sender",
    meta: {
        host: "smtp.example.com",
        port: "465",
        security: "tls",
        user: "owner@example.com",
        from_name: "Shop",
        from_email: "owner@example.com",
        reply_to: "help@example.com",
    },
    status: "connected",
    lastError: null,
    environment: "live",
    isDefault: true,
    lastEventAt: null,
    firstEvent: null,
    createdBy: "owner-1",
    createdAt: "2026-10-13T00:00:00.000Z",
})
const SMTP_CONFIG = {
    host: "smtp.example.com",
    port: 465,
    security: "tls",
    user: "owner@example.com",
    pass: "smtp-password",
    fromName: "Shop",
    fromEmail: "owner@example.com",
    replyTo: "help@example.com",
}
const FILE = { filename: "report.csv", content: "value\n1", contentType: "text/csv" }
const SENT_FILE = { filename: "report.csv", content: Buffer.from("value\n1"), contentType: "text/csv" }

const buildDelivery = async (records: ReadonlyArray<ConnectionRecord> = [connectionOf()]) => {
    const mail = mock<MailClient>({
        hasPlatformSender: jest.fn().mockReturnValue(false),
        sendThroughSmtp: jest.fn().mockResolvedValue({ messageId: "smtp-message" }),
        sendThroughPlatform: jest.fn().mockResolvedValue({ messageId: "platform-message" }),
    })
    const log = mock<EmailMessagesService>({
        sentSince: jest.fn().mockResolvedValue(0),
        record: jest.fn().mockResolvedValue("email-1"),
    })
    const connections = mock<ConnectionsService>({
        listByProvider: jest.fn().mockResolvedValue(records),
        readSecret: jest.fn().mockResolvedValue({ plain: '{"password":"smtp-password"}', webhookSecret: "" }),
    })
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => key) })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceMailService,
            { provide: MAIL, useValue: mail },
            { provide: CLOCK, useValue: new FakeClock("2026-10-13T10:00:00.000Z") },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
            { provide: EmailMessagesService, useValue: log },
            { provide: ConnectionsService, useValue: connections },
        ],
    }).compile()
    return { service: moduleRef.get(WorkspaceMailService), mail, log, connections, catalog, logger }
}

describe("WorkspaceMailService delivery", () => {
    it("records a trimmed invalid recipient before checking limits or senders", async () => {
        const { service, log, mail, connections, catalog } = await buildDelivery()

        await expect(service.send({ ...OWNER, to: " invalid " })).resolves.toEqual({
            status: "blocked",
            via: "none",
            emailMessageId: "email-1",
            messageId: undefined,
            error: "email.err_bad_recipient",
            failure: "recipient",
        })
        expect(log.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            connectionId: null,
            to: "invalid",
            subject: "Daily report",
            purpose: "daily_report",
            status: "blocked",
            via: "none",
            providerMessageId: null,
            error: "email.err_bad_recipient",
            refs: {},
        })
        expect(catalog.get).toHaveBeenCalledWith("email.err_bad_recipient", {}, "vi")
        expect(log.sentSince).not.toHaveBeenCalled()
        expect(connections.listByProvider).not.toHaveBeenCalled()
        expect(mail.sendThroughSmtp).not.toHaveBeenCalled()
        expect(mail.sendThroughPlatform).not.toHaveBeenCalled()
    })

    it("treats an omitted audience as customer mail and requires an approved work item", async () => {
        const { service, log, connections } = await buildDelivery()

        await expect(service.send({ ...OWNER, audience: undefined })).resolves.toMatchObject({
            status: "blocked",
            via: "none",
            failure: "gate",
            error: "email.err_gate",
        })
        expect(log.sentSince).not.toHaveBeenCalled()
        expect(connections.listByProvider).not.toHaveBeenCalled()
    })

    it("blocks the hundred-and-twenty-first hourly email before selecting a sender", async () => {
        const { service, log, connections } = await buildDelivery()
        log.sentSince.mockResolvedValue(120)

        await expect(service.send(OWNER)).resolves.toMatchObject({
            status: "rate_limited",
            via: "none",
            failure: "rate",
            error: "email.err_rate",
        })
        expect(log.sentSince).toHaveBeenCalledWith("ws-1", new Date("2026-10-13T09:00:00.000Z"), null)
        expect(connections.listByProvider).not.toHaveBeenCalled()
    })
})

describe("WorkspaceMailService delivery", () => {
    it("sends gated customer mail through the requested SMTP and records its references", async () => {
        const { service, log, mail, connections } = await buildDelivery()
        log.sentSince.mockResolvedValue(119)

        await expect(
            service.send({
                ...OWNER,
                to: " customer@example.com ",
                audience: "customer",
                workItemId: "work-1",
                refs: { invoice_id: "invoice-1", work_item_id: "stale" },
                connectionId: "smtp-1",
                attachments: [FILE],
            }),
        ).resolves.toEqual({
            status: "sent",
            via: "workspace",
            emailMessageId: "email-1",
            messageId: "smtp-message",
            error: undefined,
            failure: undefined,
        })
        expect(connections.listByProvider).toHaveBeenCalledWith("ws-1", "smtp", { includeDisconnected: false })
        expect(connections.readSecret).toHaveBeenCalledWith("smtp-1")
        expect(mail.sendThroughSmtp).toHaveBeenCalledWith(SMTP_CONFIG, {
            to: "customer@example.com",
            subject: "Daily report",
            html: "<p>Report</p>",
            text: "Report",
            attachments: [SENT_FILE],
        })
        expect(log.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            connectionId: "smtp-1",
            to: "customer@example.com",
            subject: "Daily report",
            purpose: "daily_report",
            status: "sent",
            via: "workspace",
            providerMessageId: "smtp-message",
            error: null,
            refs: { invoice_id: "invoice-1", work_item_id: "work-1" },
        })
        expect(mail.hasPlatformSender).not.toHaveBeenCalled()
    })

    it("sends an owner email without adding an empty attachment list", async () => {
        const { service, mail } = await buildDelivery()

        await expect(service.send(OWNER)).resolves.toMatchObject({ status: "sent", via: "workspace" })
        expect(mail.sendThroughSmtp).toHaveBeenCalledWith(SMTP_CONFIG, {
            to: "owner@example.com",
            subject: "Daily report",
            html: "<p>Report</p>",
            text: "Report",
            attachments: undefined,
        })
    })
})

describe("WorkspaceMailService delivery", () => {
    it.each([
        [true, "errors.MAIL_AUTH"],
        [false, "errors.MAIL_UNKNOWN"],
    ])("records and translates a known SMTP delivery failure: %s", async (known, error) => {
        const { service, mail, log, catalog } = await buildDelivery()
        const authCode = Object.keys(MAIL_ERROR_KINDS).find((code): code is MailError["code"] => code === "MAIL_AUTH")
        expect(authCode).toBe("MAIL_AUTH")
        if (authCode === undefined) return
        const cause = known ? new MailError({ code: authCode }) : new Error("socket failed")
        mail.sendThroughSmtp.mockRejectedValue(cause)

        await expect(service.send(OWNER)).resolves.toEqual({
            status: "failed",
            via: "workspace",
            emailMessageId: "email-1",
            messageId: undefined,
            error,
            failure: "mail",
        })
        expect(catalog.get).toHaveBeenCalledWith(error, {}, "vi")
        expect(log.record).toHaveBeenCalledWith(
            expect.objectContaining({ connectionId: "smtp-1", status: "failed", error, providerMessageId: null }),
        )
    })

    it("never falls back to the platform for gated customer mail", async () => {
        const { service, mail } = await buildDelivery([])
        mail.hasPlatformSender.mockReturnValue(true)

        await expect(service.send({ ...OWNER, audience: "customer", workItemId: "work-1" })).resolves.toMatchObject({
            status: "no_smtp",
            via: "none",
            failure: "no_smtp",
            error: "email.err_no_smtp",
        })
        expect(mail.hasPlatformSender).not.toHaveBeenCalled()
        expect(mail.sendThroughPlatform).not.toHaveBeenCalled()
    })
})

describe("WorkspaceMailService delivery", () => {
    it.each([false, true])("sends an owner notice through the platform with attachments: %s", async (withFile) => {
        const { service, mail, log } = await buildDelivery([])
        mail.hasPlatformSender.mockReturnValue(true)
        log.sentSince.mockResolvedValueOnce(0).mockResolvedValueOnce(19)

        await expect(service.send({ ...OWNER, attachments: withFile ? [FILE] : [] })).resolves.toEqual({
            status: "sent",
            via: "platform",
            emailMessageId: "email-1",
            messageId: "platform-message",
            error: undefined,
            failure: undefined,
        })
        expect(log.sentSince).toHaveBeenNthCalledWith(2, "ws-1", new Date("2026-10-12T10:00:00.000Z"), "platform")
        expect(mail.sendThroughPlatform).toHaveBeenCalledWith({
            to: "owner@example.com",
            subject: "Daily report",
            html: "<p>Report</p>",
            text: "Report",
            attachments: withFile ? [SENT_FILE] : undefined,
        })
        expect(log.record).toHaveBeenCalledWith(
            expect.objectContaining({ connectionId: null, status: "sent", via: "platform", error: null }),
        )
    })
})

describe("WorkspaceMailService delivery", () => {
    it("refuses a platform notice once the daily limit is reached", async () => {
        const { service, mail, log } = await buildDelivery([])
        mail.hasPlatformSender.mockReturnValue(true)
        log.sentSince.mockResolvedValueOnce(0).mockResolvedValueOnce(20)

        await expect(service.send(OWNER)).resolves.toMatchObject({
            status: "rate_limited",
            via: "platform",
            failure: "rate",
            error: "email.err_rate",
        })
        expect(mail.sendThroughPlatform).not.toHaveBeenCalled()
    })

    it("records an unexpected platform delivery failure", async () => {
        const { service, mail, log } = await buildDelivery([])
        mail.hasPlatformSender.mockReturnValue(true)
        mail.sendThroughPlatform.mockRejectedValue(new Error("platform unavailable"))

        await expect(service.send(OWNER)).resolves.toMatchObject({
            status: "failed",
            via: "platform",
            failure: "mail",
            error: "errors.MAIL_UNKNOWN",
        })
        expect(log.record).toHaveBeenCalledWith(
            expect.objectContaining({ status: "failed", via: "platform", error: "errors.MAIL_UNKNOWN" }),
        )
    })
})

describe("WorkspaceMailService delivery", () => {
    describe("hasWorkspaceSmtp", () => {
        it("recognizes a connected SMTP with a readable password", async () => {
            const { service, connections } = await buildDelivery()

            await expect(service.hasWorkspaceSmtp("ws-1")).resolves.toBe(true)
            expect(connections.readSecret).toHaveBeenCalledWith("smtp-1")
        })

        it("answers false when there is no connected SMTP", async () => {
            const { service, connections } = await buildDelivery([])

            await expect(service.hasWorkspaceSmtp("ws-1")).resolves.toBe(false)
            expect(connections.readSecret).not.toHaveBeenCalled()
        })

        it("answers false when the connection secret is missing", async () => {
            const { service, connections } = await buildDelivery()
            connections.readSecret.mockResolvedValue(null)

            await expect(service.hasWorkspaceSmtp("ws-1")).resolves.toBe(false)
        })

        it.each(["null", "17", '"password"', "{}", '{"password":42}'])(
            "answers false when the credential has no string password: %s",
            async (plain) => {
                const { service, connections, logger } = await buildDelivery()
                connections.readSecret.mockResolvedValue({ plain, webhookSecret: "" })

                await expect(service.hasWorkspaceSmtp("ws-1")).resolves.toBe(false)
                expect(logger.error).not.toHaveBeenCalled()
            },
        )

        it("logs invalid JSON against its connection and answers false", async () => {
            const { service, connections, logger } = await buildDelivery()
            connections.readSecret.mockResolvedValue({ plain: "invalid-json", webhookSecret: "" })

            await expect(service.hasWorkspaceSmtp("ws-1")).resolves.toBe(false)
            expect(logger.error).toHaveBeenCalledWith(EmailMessagesLogEvent.Undecryptable, expect.any(SyntaxError), {
                connectionId: "smtp-1",
            })
        })
    })
})
