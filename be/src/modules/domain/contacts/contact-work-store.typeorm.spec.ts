import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { TypeormContactWorkStore } from "./contact-work-store.typeorm"
import { ContactEntity, ContactMemoryEntryEntity } from "./persistence/entities"

const WS = "11111111-1111-4111-8111-111111111111"

const entryOf = (id: string, over: Partial<ContactMemoryEntryEntity> = {}): ContactMemoryEntryEntity =>
    Object.assign(new ContactMemoryEntryEntity(), {
        id,
        namespace: "sales.consult",
        nodeKey: "talk[r1].opening",
        step: "chatbot.answer",
        kind: "done",
        agentId: "agent-1",
        workflowId: "wf-1",
        runId: "run-1",
        writtenAt: new Date("2026-11-14T10:00:00.000Z"),
        ...over,
    })

const build = async () => {
    const em = mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [TypeormContactWorkStore, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { store: moduleRef.get(TypeormContactWorkStore), em }
}

describe("TypeormContactWorkStore.recentOf", () => {
    it("reads the step kinds only under the subject key, newest first and bounded, leaving out a deleted contact's entries", async () => {
        const { store, em } = await build()
        const [fake] = queueQueryBuilders(em, [{ getMany: [entryOf("e2", { kind: "failed" }), entryOf("e1")] }])

        const rows = await store.recentOf(WS, "contact:c1", 20)

        expect(em.createQueryBuilder).toHaveBeenCalledWith(ContactMemoryEntryEntity, "entry")
        expect(fake?.callsOf("leftJoin")[0]).toEqual([ContactEntity, "contact", "contact.id = entry.contactId"])
        expect(fake?.callsOf("where")[0]).toEqual(["entry.workspaceId = :workspaceId", { workspaceId: WS }])
        expect(fake?.callsOf("andWhere").map((call) => call[0])).toEqual([
            "entry.subjectKey = :subjectKey",
            "entry.kind IN (:...kinds)",
            "(entry.contactId IS NULL OR contact.erasedAt IS NULL)",
        ])
        expect(fake?.callsOf("andWhere")[1]?.[1]).toEqual({ kinds: ["done", "failed", "passed_over"] })
        expect(fake?.callsOf("orderBy")[0]).toEqual(["entry.writtenAt", "DESC"])
        expect(fake?.callsOf("addOrderBy")[0]).toEqual(["entry.id", "DESC"])
        expect(fake?.callsOf("limit")[0]).toEqual([20])
        expect(rows.map((row) => [row.id, row.status, row.at])).toEqual([
            ["e2", "failed", "2026-11-14T10:00:00.000Z"],
            ["e1", "done", "2026-11-14T10:00:00.000Z"],
        ])
        expect(rows[0]).toEqual({
            id: "e2",
            namespace: "sales.consult",
            nodeKey: "talk[r1].opening",
            step: "chatbot.answer",
            status: "failed",
            at: "2026-11-14T10:00:00.000Z",
            agentId: "agent-1",
            workflowId: "wf-1",
            runId: "run-1",
        })
    })
})
