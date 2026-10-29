import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { EventsService } from "./events.service"
import type { EventRecordRow } from "./events.contracts"
import { EventEntity } from "./persistence/entities"

const registerWorkspaceEvents = () => {
    it("appends the line to the workspace evidence log", async () => {
        const em = mockEntityManager({ insert: [EventEntity, {}] })
        const service = await build(em)

        await expect(
            service.record({
                workspaceId: "ws-1",
                kind: "member.invited",
                actor: "Chu",
                summary: "an@example.test",
            }),
        ).resolves.toBeUndefined()

        expect(em.insert).toHaveBeenCalledWith(EventEntity, {
            workspaceId: "ws-1",
            kind: "member.invited",
            actor: "Chu",
            summary: "an@example.test",
            leadId: null,
            workItemId: null,
            evidence: null,
        })
    })

    it("carries the customer, the work item and the raw evidence when given", async () => {
        const em = mockEntityManager({ insert: [EventEntity, {}] })
        const service = await build(em)

        await expect(
            service.record({
                workspaceId: "ws-1",
                kind: "work.asked",
                actor: "Sales",
                summary: "ask",
                leadId: "lead-1",
                workItemId: "work-1",
                evidence: "raw",
            }),
        ).resolves.toBeUndefined()

        expect(em.insert).toHaveBeenCalledWith(EventEntity, {
            workspaceId: "ws-1",
            kind: "work.asked",
            actor: "Sales",
            summary: "ask",
            leadId: "lead-1",
            workItemId: "work-1",
            evidence: "raw",
        })
    })
}

const registerTransactionalEvents = () => {
    it("appends a line about a lead with its evidence in the transaction of the caller", async () => {
        const em = mockEntityManager()
        const tx = mockEntityManager({ insert: [EventEntity, {}] })
        const service = await build(em)

        await expect(
            service.record(
                {
                    workspaceId: "ws-1",
                    kind: "outcome.recorded",
                    actor: "Linh",
                    summary: "Stage",
                    leadId: "lead-1",
                    evidence: "Sent",
                },
                tx,
            ),
        ).resolves.toBeUndefined()

        expect(tx.insert).toHaveBeenCalledWith(EventEntity, {
            workspaceId: "ws-1",
            kind: "outcome.recorded",
            actor: "Linh",
            summary: "Stage",
            leadId: "lead-1",
            workItemId: null,
            evidence: "Sent",
        })
        expect(em.insert).not.toHaveBeenCalled()
    })
}

const entityOf = builder<EventEntity>({
    id: "event-1",
    workspaceId: "ws-1",
    leadId: "lead-1",
    kind: "work.asked",
    actor: "Sales",
    summary: "ask",
    evidence: null,
    createdAt: new Date("2026-10-12T10:00:00.000Z"),
    workItemId: "work-1",
})

const recordOf = builder<EventRecordRow>({
    id: "event-1",
    lead_id: "lead-1",
    kind: "work.asked",
    actor: "Sales",
    summary: "ask",
    evidence: null,
    created_at: "2026-10-12T10:00:00.000Z",
    work_item_id: "work-1",
})

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [EventsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(EventsService)
}

describe("EventsService", () => {
    describe("record", () => {
        registerWorkspaceEvents()
        registerTransactionalEvents()
    })

    describe("leadHistory", () => {
        it("answers the first lines of the customer history", async () => {
            const lines = [
                { summary: "Asked for a price", evidence: "tg:1" },
                { summary: "Sent the quote", evidence: null },
            ]
            const em = mockEntityManager({ find: [EventEntity, lines.map((line) => entityOf(line))] })

            await expect((await build(em)).leadHistory("ws-1", "lead-1", 20)).resolves.toEqual(lines)
            expect(em.find).toHaveBeenCalledWith(EventEntity, {
                select: { summary: true, evidence: true },
                where: { workspaceId: "ws-1", leadId: "lead-1" },
                order: { createdAt: "ASC" },
                take: 20,
            })
        })
    })

    describe("list", () => {
        it("answers the lines of the filters it is given, the time as ISO text", async () => {
            const em = mockEntityManager()
            const [query] = queueQueryBuilders(em, [{ getRawMany: [recordOf()] }])

            await expect(
                (await build(em)).list("ws-1", {
                    leadId: "lead-1",
                    kind: "work.asked",
                    workItemIds: ["work-1"],
                    oldestFirst: true,
                    limit: 50,
                }),
            ).resolves.toEqual([recordOf()])
            expect(query?.callsOf("addSelect")).toContainEqual(["to_json(e.created_at) #>> '{}'", "created_at"])
            expect(query?.callsOf("andWhere")).toEqual([
                ["e.leadId = :leadId", { leadId: "lead-1" }],
                ["e.kind = :kind", { kind: "work.asked" }],
                ["e.workItemId = ANY(:workItemIds)", { workItemIds: ["work-1"] }],
            ])
            expect(query?.callsOf("orderBy")).toEqual([["e.createdAt", "ASC"]])
            expect(query?.callsOf("addOrderBy")).toEqual([["e.id", "ASC"]])
            expect(query?.callsOf("limit")).toEqual([[50]])
        })

        it("reads the newest lines of the whole workspace when no filter is set", async () => {
            const em = mockEntityManager()
            const [query] = queueQueryBuilders(em, [{ getRawMany: [] }])

            await expect((await build(em)).list("ws-1", { limit: 10 })).resolves.toEqual([])
            expect(query?.callsOf("where")).toEqual([["e.workspaceId = :workspaceId", { workspaceId: "ws-1" }]])
            expect(query?.callsOf("andWhere")).toEqual([])
            expect(query?.callsOf("orderBy")).toEqual([["e.createdAt", "DESC"]])
            expect(query?.callsOf("limit")).toEqual([[10]])
        })
    })
})
