import { MoreThanOrEqual } from "typeorm"
import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EmailMessagesService } from "./email-messages.service"
import type { EmailRecord } from "./email-messages.contracts"
import { EmailMessagesErrorCode } from "./errors/email-messages.error"
import { EmailMessageEntity } from "./persistence/entities"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { MockEntityManager } from "@starci/jest-preset"

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

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [EmailMessagesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(EmailMessagesService)
}

const INSERTED = { identifiers: [{ id: "msg-1" }] }
const SINCE = new Date("2026-10-13T02:00:00.000Z")

describe("EmailMessagesService", () => {
    it("records a send attempt and answers its id", async () => {
        const em = mockEntityManager({ insert: [EmailMessageEntity, INSERTED] })
        const service = await build(em)

        await expect(service.record(ENTRY)).resolves.toBe("msg-1")

        expect(em.insert).toHaveBeenCalledWith(EmailMessageEntity, {
            workspaceId: "ws-1",
            connectionId: "conn-1",
            toAddress: "owner@shop.test",
            subject: "Invoice",
            purpose: "invoice",
            status: "sent",
            via: "workspace",
            providerMessageId: "smtp-9",
            error: null,
            refs: { invoiceId: "inv-1" },
        })
    })

    it("cuts the address, subject, purpose and error to the column limits", async () => {
        const em = mockEntityManager({ insert: [EmailMessageEntity, INSERTED] })
        const service = await build(em)

        await service.record({
            ...ENTRY,
            to: "a".repeat(300),
            subject: "s".repeat(400),
            purpose: "p".repeat(90),
            error: "e".repeat(900),
        })

        expect(em.insert).toHaveBeenCalledWith(
            EmailMessageEntity,
            expect.objectContaining({
                toAddress: "a".repeat(254),
                subject: "s".repeat(300),
                purpose: "p".repeat(60),
                error: "e".repeat(600),
            }),
        )
    })

    it("refuses to record when the insert answers no id", async () => {
        const service = await build(mockEntityManager({ insert: [EmailMessageEntity, { identifiers: [] }] }))

        await expect(service.record(ENTRY)).rejects.toMatchObject({ code: EmailMessagesErrorCode.NotRecorded })
    })
})

describe("EmailMessagesService counts", () => {
    it("counts messages the workspace sent since a time through one sender", async () => {
        const em = mockEntityManager({ count: [EmailMessageEntity, 3] })
        const service = await build(em)

        await expect(service.sentSince("ws-1", SINCE, "workspace")).resolves.toBe(3)

        expect(em.count).toHaveBeenCalledWith(EmailMessageEntity, {
            where: { workspaceId: "ws-1", status: "sent", createdAt: MoreThanOrEqual(SINCE), via: "workspace" },
        })
    })

    it("counts every sender when none is asked for", async () => {
        const em = mockEntityManager({ count: [EmailMessageEntity, 0] })
        const service = await build(em)

        await expect(service.sentSince("ws-1", SINCE, null)).resolves.toBe(0)

        expect(em.count).toHaveBeenCalledWith(EmailMessageEntity, {
            where: { workspaceId: "ws-1", status: "sent", createdAt: MoreThanOrEqual(SINCE) },
        })
    })

    it("knows whether a waiting customer email is already written down for a work item", async () => {
        const em = mockEntityManager({})
        const [found, none] = queueQueryBuilders(em, [{ getOne: { id: "msg-1" } }, { getOne: null }])
        const service = await build(em)

        await expect(service.isWaitingFor("ws-1", "w1")).resolves.toBe(true)
        await expect(service.isWaitingFor("ws-1", "w1")).resolves.toBe(false)

        expect(found?.callsOf("andWhere")).toContainEqual([
            "email.refs ->> 'work_item_id' = :workItemId",
            { workItemId: "w1" },
        ])
        expect(none?.callsOf("limit")).toEqual([[1]])
    })
})
