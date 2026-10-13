import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EmailMessagesService } from "./email-messages.service"
import type { EmailRecord } from "./email-messages.contracts"
import { EmailMessagesErrorCode } from "./errors/email-messages.error"
import { COUNT_SENT_EMAILS, INSERT_EMAIL_MESSAGE } from "./persistence/email-messages.sql"

const ENTRY: EmailRecord = {
    workspaceId: "ws-1",
    connectionId: "conn-1",
    to: "owner@shop.test",
    subject: "Invoice",
    purpose: "invoice",
    status: "sent",
    via: "workspace",
    providerMessageId: "smtp-9",
    error: null,
    refs: { invoiceId: "inv-1" },
}

const build = async (sql: string, rows: ReadonlyArray<unknown>) => {
    const entityManager = mockEntityManager({ query: [sql, rows] })
    const moduleRef = await Test.createTestingModule({
        providers: [EmailMessagesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(EmailMessagesService)
}

describe("EmailMessagesService", () => {
    it("records a send attempt and answers its id", async () => {
        const service = await build(INSERT_EMAIL_MESSAGE, [{ id: "msg-1" }])

        await expect(service.record(ENTRY)).resolves.toBe("msg-1")
    })

    it("refuses to record when the insert answers no row", async () => {
        const service = await build(INSERT_EMAIL_MESSAGE, [])

        await expect(service.record(ENTRY)).rejects.toMatchObject({ code: EmailMessagesErrorCode.NotRecorded })
    })

    it("counts messages the workspace sent since a time", async () => {
        const service = await build(COUNT_SENT_EMAILS, [{ n: 3 }])

        await expect(service.sentSince("ws-1", new Date("2026-10-13T02:00:00.000Z"), "workspace")).resolves.toBe(3)
    })

    it("counts zero when the workspace sent nothing", async () => {
        const service = await build(COUNT_SENT_EMAILS, [])

        await expect(service.sentSince("ws-1", new Date("2026-10-13T02:00:00.000Z"), null)).resolves.toBe(0)
    })
})
