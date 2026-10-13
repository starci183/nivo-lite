import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkEngineService } from "@modules/domain/decisions"
import { EmailMessagesService, WorkspaceMailService } from "@modules/domain/email-messages"
import type { CustomerEmail } from "@modules/domain/n8n-runs"
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

const build = async (hasSmtp: boolean, status: string, waiting = false) => {
    const mail = mock<WorkspaceMailService>({
        hasWorkspaceSmtp: jest.fn().mockResolvedValue(hasSmtp),
        send: jest.fn().mockResolvedValue({ status: "sent", via: "platform", emailMessageId: "e1" }),
    })
    const log = mock<EmailMessagesService>({
        record: jest.fn().mockResolvedValue("e9"),
        isWaitingFor: jest.fn().mockResolvedValue(waiting),
    })
    const engine = mock<WorkEngineService>({ runWork: jest.fn().mockResolvedValue({ id: "w1", status, error: null }) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceMailerService,
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn((key: string) => key) }) },
            { provide: WorkspaceMailService, useValue: mail },
            { provide: EmailMessagesService, useValue: log },
            { provide: WorkEngineService, useValue: engine },
        ],
    }).compile()
    return { mailer: moduleRef.get(WorkspaceMailerService), mail, log }
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
})
