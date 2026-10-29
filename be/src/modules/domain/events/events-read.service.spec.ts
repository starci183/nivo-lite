import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Between, In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { EventsReadService } from "./events-read.service"
import { EventEntity } from "./persistence/entities"

const eventOf = entityOf(EventEntity, { createdAt: new Date("2026-10-12T03:00:00.000Z") })

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [EventsReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(EventsReadService)
}

describe("EventsReadService", () => {
    it("asks whether a line of the kind falls inside a window", async () => {
        const em = mockEntityManager({ exists: [EventEntity, true] })
        const from = new Date("2026-10-01T00:00:00.000Z")
        const to = new Date("2026-10-31T00:00:00.000Z")

        await expect((await build(em)).existsOfKindBetween("ws-1", "module.purchased", from, to)).resolves.toBe(true)
        expect(em.exists).toHaveBeenCalledWith(EventEntity, {
            where: { workspaceId: "ws-1", kind: "module.purchased", createdAt: Between(from, to) },
        })
    })

    it("asks whether a line of the kind is about any of the customers, and nothing for no customers", async () => {
        const em = mockEntityManager({ exists: [EventEntity, false] })
        const service = await build(em)

        await expect(service.existsOfKindForLeads("ws-1", "outcome.recorded", [])).resolves.toBe(false)
        expect(em.exists).not.toHaveBeenCalled()
        await expect(service.existsOfKindForLeads("ws-1", "outcome.recorded", ["l1"])).resolves.toBe(false)
        expect(em.exists).toHaveBeenCalledWith(EventEntity, {
            where: { workspaceId: "ws-1", kind: "outcome.recorded", leadId: In(["l1"]) },
        })
    })

    it("groups the first time each customer reached one of the kinds", async () => {
        const em = mockEntityManager()
        const at = new Date("2026-10-12T03:00:00.000Z")
        const [fake] = queueQueryBuilders(em, [{ getRawMany: [{ leadId: "l1", at }] }])
        const service = await build(em)

        await expect(service.firstAtByLead("ws-1", ["execution.approved"], ["l1"])).resolves.toEqual([
            { leadId: "l1", at },
        ])
        expect(fake?.callsOf("where")).toEqual([
            [
                "e.workspaceId = :workspaceId AND e.kind IN (:...kinds) AND e.leadId IN (:...leadIds)",
                { workspaceId: "ws-1", kinds: ["execution.approved"], leadIds: ["l1"] },
            ],
        ])
        expect(fake?.callsOf("groupBy")).toEqual([["e.leadId"]])
    })

    it("asks nothing when there is no customer or no kind", async () => {
        const em = mockEntityManager()
        const service = await build(em)

        await expect(service.firstAtByLead("ws-1", ["k"], [])).resolves.toEqual([])
        await expect(service.firstAtByLead("ws-1", [], ["l1"])).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("EventsReadService first and listed lines", () => {
    it("answers when the customer first reached a kind, or null", async () => {
        const em = mockEntityManager({
            findOne: [
                [EventEntity, eventOf()],
                [EventEntity, null],
            ],
        })
        const service = await build(em)

        await expect(service.firstAtOfKind("ws-1", "l1", "execution.approved")).resolves.toEqual(
            new Date("2026-10-12T03:00:00.000Z"),
        )
        await expect(service.firstAtOfKind("ws-1", "l1", "execution.approved")).resolves.toBeNull()
        expect(em.findOne).toHaveBeenCalledWith(EventEntity, {
            select: { createdAt: true },
            where: { workspaceId: "ws-1", leadId: "l1", kind: "execution.approved" },
            order: { createdAt: "ASC" },
        })
    })

    it("lists the lines after an instant, oldest first, in the public shape", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [
            {
                getRawMany: [
                    {
                        id: "e1",
                        kind: "api.lead",
                        actor: "key",
                        summary: "s",
                        evidence: null,
                        lead_id: "l1",
                        created_at: "2026-10-12T03:00:00.123Z",
                    },
                ],
            },
        ])

        await expect((await build(em)).listAfter("ws-1", "2026-10-11T00:00:00.000Z", 100)).resolves.toEqual([
            {
                id: "e1",
                kind: "api.lead",
                actor: "key",
                summary: "s",
                evidence: null,
                leadId: "l1",
                createdAt: "2026-10-12T03:00:00.123Z",
            },
        ])
        expect(fake?.callsOf("where")).toEqual([
            [
                "e.workspaceId = :workspaceId AND e.createdAt > :since",
                { workspaceId: "ws-1", since: "2026-10-11T00:00:00.000Z" },
            ],
        ])
        expect(fake?.callsOf("orderBy")).toEqual([["e.createdAt", "ASC"]])
        expect(fake?.callsOf("limit")).toEqual([[100]])
    })
})
