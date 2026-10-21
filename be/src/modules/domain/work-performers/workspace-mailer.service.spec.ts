import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkEngineService } from "@modules/domain/decisions"
import { EmailMessagesService, WorkspaceMailService } from "@modules/domain/email-messages"
import type { CustomerEmail } from "@modules/domain/n8n-runs"
import { renderEmail } from "@modules/integrations/mail"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { WorkspaceMailerService } from "./workspace-mailer.service"

const WS = "11111111-1111-4111-8111-111111111111"
const email: CustomerEmail = {
    workspaceId: WS,
    to: "lan@example.com",
    subject: "Your receipt",
    body: "Thanks",
    purpose: "receipt",
    refs: { invoice_id: "inv-1" },
    dedupeKey: "send_email:receipt:inv-1",
    subjectType: "invoice",
    subjectId: "inv-1",
    leadId: "l1",
}

const build = async (hasSmtp: boolean, status: string, waiting = false, error: string | null = null) => {
    const mail = mock<WorkspaceMailService>({
        hasWorkspaceSmtp: jest.fn().mockResolvedValue(hasSmtp),
        send: jest.fn().mockResolvedValue({ status: "sent", via: "platform", emailMessageId: "e1" }),
    })
    const log = mock<EmailMessagesService>({
        record: jest.fn().mockResolvedValue("e9"),
        isWaitingFor: jest.fn().mockResolvedValue(waiting),
    })
    const engine = mock<WorkEngineService>({ runWork: jest.fn().mockResolvedValue({ id: "w1", status, error }) })
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => key) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceMailerService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: WorkspaceMailService, useValue: mail },
            { provide: EmailMessagesService, useValue: log },
            { provide: WorkEngineService, useValue: engine },
        ],
    }).compile()
    return { mailer: moduleRef.get(WorkspaceMailerService), mail, log, engine, catalog }
}

describe("WorkspaceMailerService", () => {
    it("sends a customer email only through the gate; auto sends at once", async () => {
        const { mailer } = await build(true, "done")
        await expect(mailer.requestCustomerEmail(email)).resolves.toEqual({ status: "sent", workItemId: "w1" })
    })

    it("keeps an asked email waiting in Decisions and writes it down once", async () => {
        const { mailer, log } = await build(true, "waiting_decision")
        await expect(mailer.requestCustomerEmail(email)).resolves.toEqual({
            status: "waiting_decision",
            workItemId: "w1",
        })
        expect(log.record).toHaveBeenCalledWith(expect.objectContaining({ status: "waiting_decision" }))
    })

    it("never mails a customer from a workspace without its own SMTP", async () => {
        const { mailer } = await build(false, "done")
        await expect(mailer.requestCustomerEmail(email)).resolves.toMatchObject({
            status: "no_smtp",
            emailMessageId: "e9",
        })
    })

    it("mails an owner with the files the workflow attached", async () => {
        const { mailer, mail } = await build(true, "done")
        const sent = await mailer.sendOwnerEmail({
            workspaceId: WS,
            to: "owner@example.com",
            subject: "Ledger",
            shopName: "Shop",
            text: "See attached",
            attachments: [{ filename: "ledger.csv", content: "a,b", contentType: "text/csv", encoding: "utf8" }],
            purpose: "month_ledger",
            refs: {},
        })
        expect(sent).toMatchObject({ status: "sent", emailMessageId: "e1" })
        expect(mail.send.mock.calls[0]?.[0].attachments).toEqual([
            { filename: "ledger.csv", content: "a,b", contentType: "text/csv", encoding: "utf8" },
        ])
    })

    it("refuses an invalid recipient before checking SMTP or asking the gate", async () => {
        const { mailer, mail, log, engine, catalog } = await build(true, "done")

        await expect(
            mailer.requestCustomerEmail({ ...email, to: " bad recipient ", subject: "  Receipt\r\nfor invoice  " }),
        ).resolves.toEqual({
            status: "blocked",
            via: "none",
            emailMessageId: "e9",
            error: "email.err_bad_recipient",
        })
        expect(catalog.get).toHaveBeenCalledWith("email.err_bad_recipient", {}, "vi")
        expect(log.record).toHaveBeenCalledWith({
            workspaceId: WS,
            connectionId: null,
            to: "bad recipient",
            subject: "Receipt for invoice",
            purpose: "receipt",
            status: "blocked",
            via: "none",
            providerMessageId: null,
            error: "email.err_bad_recipient",
            refs: { invoice_id: "inv-1" },
        })
        expect(mail.hasWorkspaceSmtp).not.toHaveBeenCalled()
        expect(mail.send).not.toHaveBeenCalled()
        expect(engine.runWork).not.toHaveBeenCalled()
    })
})

describe("WorkspaceMailerService", () => {
    it("records the unavailable workspace sender and skips the gate", async () => {
        const { mailer, mail, log, engine, catalog } = await build(false, "done")

        await expect(mailer.requestCustomerEmail({ ...email, to: " lan@example.com " })).resolves.toEqual({
            status: "no_smtp",
            via: "none",
            emailMessageId: "e9",
            error: "email.err_no_smtp",
        })
        expect(mail.hasWorkspaceSmtp).toHaveBeenCalledWith(WS)
        expect(catalog.get).toHaveBeenCalledWith("email.err_no_smtp", {}, "vi")
        expect(log.record).toHaveBeenCalledWith({
            workspaceId: WS,
            connectionId: null,
            to: "lan@example.com",
            subject: "Your receipt",
            purpose: "receipt",
            status: "no_smtp",
            via: "none",
            providerMessageId: null,
            error: "email.err_no_smtp",
            refs: { invoice_id: "inv-1" },
        })
        expect(engine.runWork).not.toHaveBeenCalled()
        expect(mail.send).not.toHaveBeenCalled()
    })

    it("normalizes the subject for the gate and its shorter approval summary", async () => {
        const { mailer, mail, log, engine, catalog } = await build(true, "done")
        const subject = `  Receipt\r\n${"x".repeat(220)}  `

        await expect(mailer.requestCustomerEmail({ ...email, to: " lan@example.com ", subject })).resolves.toEqual({
            status: "sent",
            workItemId: "w1",
        })
        expect(catalog.get).toHaveBeenCalledWith(
            "performers.emailRequestSummary",
            { to: "lan@example.com", subject: `Receipt ${"x".repeat(112)}` },
            "vi",
        )
        expect(engine.runWork).toHaveBeenCalledWith(
            { workspaceId: WS, actor: "NIVO", locale: "vi" },
            {
                action: "send_email",
                subject_type: "invoice",
                subject_id: "inv-1",
                lead_id: "l1",
                dedupeKey: "send_email:receipt:inv-1",
                preset: true,
                noChain: true,
                seed: {
                    summary: "performers.emailRequestSummary",
                    draft: "Thanks",
                    fields: {
                        contact: "lan@example.com",
                        subject: `Receipt ${"x".repeat(192)}`,
                        purpose: "receipt",
                        refs: '{"invoice_id":"inv-1"}',
                    },
                },
            },
        )
        expect(log.record).not.toHaveBeenCalled()
        expect(log.isWaitingFor).not.toHaveBeenCalled()
        expect(mail.send).not.toHaveBeenCalled()
    })
})

describe("WorkspaceMailerService", () => {
    it("returns a failed gate item with its recorded failure", async () => {
        const { mailer, log, mail } = await build(true, "failed", false, "SMTP rejected")

        await expect(mailer.requestCustomerEmail(email)).resolves.toEqual({
            status: "failed",
            workItemId: "w1",
            error: "SMTP rejected",
        })
        expect(log.record).not.toHaveBeenCalled()
        expect(log.isWaitingFor).not.toHaveBeenCalled()
        expect(mail.send).not.toHaveBeenCalled()
    })

    it.each(["queued", "running", "cancelled"])("reports a %s item as a duplicate", async (status) => {
        const { mailer, log, mail } = await build(true, status)

        await expect(mailer.requestCustomerEmail(email)).resolves.toEqual({ status: "duplicate", workItemId: "w1" })
        expect(log.record).not.toHaveBeenCalled()
        expect(log.isWaitingFor).not.toHaveBeenCalled()
        expect(mail.send).not.toHaveBeenCalled()
    })

    it("records a waiting request with the work item reference", async () => {
        const { mailer, log } = await build(true, "waiting_decision")

        await expect(mailer.requestCustomerEmail(email)).resolves.toEqual({
            status: "waiting_decision",
            workItemId: "w1",
        })
        expect(log.isWaitingFor).toHaveBeenCalledWith(WS, "w1")
        expect(log.record).toHaveBeenCalledWith({
            workspaceId: WS,
            connectionId: null,
            to: "lan@example.com",
            subject: "Your receipt",
            purpose: "receipt",
            status: "waiting_decision",
            via: "none",
            providerMessageId: null,
            error: null,
            refs: { invoice_id: "inv-1", work_item_id: "w1" },
        })
        expect(email.refs).toEqual({ invoice_id: "inv-1" })
    })

    it("reuses a waiting email log on retry", async () => {
        const { mailer, log, mail } = await build(true, "waiting_decision", true)

        await expect(mailer.requestCustomerEmail(email)).resolves.toEqual({
            status: "waiting_decision",
            workItemId: "w1",
        })
        expect(log.isWaitingFor).toHaveBeenCalledWith(WS, "w1")
        expect(log.record).not.toHaveBeenCalled()
        expect(mail.send).not.toHaveBeenCalled()
    })
})

describe("WorkspaceMailerService", () => {
    it("renders an owner's email and returns the sender's message and error", async () => {
        const { mailer, mail, catalog, engine, log } = await build(true, "done")
        mail.send.mockResolvedValue({
            status: "failed",
            via: "workspace",
            emailMessageId: "e2",
            messageId: "smtp-2",
            error: "Delivery failed",
        })
        const rendered = renderEmail({
            shopName: "Shop",
            title: "Daily report",
            body: "Today's sales",
            footer: "performers.emailFooter",
            lang: "vi",
        })

        await expect(
            mailer.sendOwnerEmail({
                workspaceId: WS,
                to: "owner@example.com",
                subject: "Daily report",
                shopName: "Shop",
                text: "Today's sales",
                attachments: [],
                purpose: "daily_report",
                refs: { date: "2026-10-14" },
            }),
        ).resolves.toEqual({
            status: "failed",
            via: "workspace",
            emailMessageId: "e2",
            messageId: "smtp-2",
            error: "Delivery failed",
        })
        expect(catalog.get).toHaveBeenCalledWith("performers.emailFooter", { shop: "Shop" }, "vi")
        expect(mail.send).toHaveBeenCalledWith({
            workspaceId: WS,
            to: "owner@example.com",
            subject: "Daily report",
            html: rendered.html,
            text: rendered.text,
            purpose: "daily_report",
            refs: { date: "2026-10-14" },
            audience: "owner",
            attachments: [],
        })
        expect(engine.runWork).not.toHaveBeenCalled()
        expect(log.record).not.toHaveBeenCalled()
    })
})
