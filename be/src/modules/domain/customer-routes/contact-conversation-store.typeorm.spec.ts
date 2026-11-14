import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { ContactEntity } from "@modules/domain/contacts/persistence/entities"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { TypeormContactConversationStore } from "./contact-conversation-store.typeorm"
import { CustomerMessageEntity, CustomerRouteEntity } from "./persistence/entities"

const WS = "11111111-1111-4111-8111-111111111111"
const SAID = new Date("2026-11-13T10:00:00.000Z")
const liveJoin = (alias: string): string =>
    `contact.id = ${alias}.contactId AND contact.workspaceId = ${alias}.workspaceId AND contact.erasedAt IS NULL ` +
    `AND NOT EXISTS (SELECT 1 FROM public.connections removed WHERE removed.id = ${alias}.accountId AND removed.deleted_at IS NOT NULL)`

const lineOf = (seq: number, over: Partial<CustomerMessageEntity> = {}): CustomerMessageEntity =>
    Object.assign(new CustomerMessageEntity(), {
        id: `l${String(seq)}`,
        seq: String(seq),
        workspaceId: WS,
        routeId: "r1",
        contactId: "c1",
        direction: "from_person",
        lineKey: `msg-${String(seq)}`,
        saidAt: new Date(SAID.getTime() + seq * 1000),
        text: "hello",
        files: [],
        orderCard: null,
        eventId: null,
        agentId: null,
        memberId: null,
        runId: null,
        stepKey: null,
        state: null,
        reason: null,
        channel: "zalo",
        accountId: "conn-1",
        deliveredAt: null,
        ...over,
    })

const build = async () => {
    const em = mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [TypeormContactConversationStore, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { store: moduleRef.get(TypeormContactConversationStore), em }
}

describe("TypeormContactConversationStore.linesOf", () => {
    it("reads every route of the contact ids in ONE keyset page, newest first by said-at then insertion order, one row more than asked", async () => {
        const { store, em } = await build()
        const olderOnR2 = lineOf(6, { routeId: "r2", channel: "telegram" })
        const [fake] = queueQueryBuilders(em, [{ getMany: [lineOf(9), olderOnR2, lineOf(3)] }])

        const page = await store.linesOf(WS, ["c1", "c-merged"], { routeId: null, before: null, limit: 2 })

        expect(page.rows.map((row) => [row.routeId, row.key])).toEqual([
            ["r1", "msg-9"],
            ["r2", "msg-6"],
        ])
        expect(page.next).toEqual({ saidAt: olderOnR2.saidAt, seq: "6" })
        expect(fake?.callsOf("innerJoin")[0]).toEqual([ContactEntity, "contact", liveJoin("line")])
        expect(fake?.callsOf("where")[0]).toEqual(["line.workspaceId = :workspaceId", { workspaceId: WS }])
        expect(fake?.callsOf("andWhere").map((call) => call[0])).toEqual(["line.contactId IN (:...contactIds)"])
        expect(fake?.callsOf("andWhere")[0]?.[1]).toEqual({ contactIds: ["c1", "c-merged"] })
        expect(fake?.callsOf("orderBy")[0]).toEqual(["line.saidAt", "DESC"])
        expect(fake?.callsOf("addOrderBy")[0]).toEqual(["line.seq", "DESC"])
        expect(fake?.callsOf("limit")[0]).toEqual([3])
    })

    it("narrows to one route and to lines strictly older than the cursor, every state shown", async () => {
        const { store, em } = await build()
        const [fake] = queueQueryBuilders(em, [{ getMany: [] }])

        const page = await store.linesOf(WS, ["c1"], { routeId: "r2", before: { saidAt: SAID, seq: "5" }, limit: 10 })

        expect(page).toEqual({ rows: [], next: null })
        const wheres = fake?.callsOf("andWhere").map((call) => call[0]) ?? []
        expect(wheres).toEqual([
            "line.contactId IN (:...contactIds)",
            "line.routeId = :routeId",
            "(line.saidAt < :beforeAt OR (line.saidAt = :beforeAt AND line.seq < :beforeSeq))",
        ])
        expect(fake?.callsOf("andWhere")[1]?.[1]).toEqual({ routeId: "r2" })
    })

    it("reads nothing for no contact, without a query", async () => {
        const { store, em } = await build()

        await expect(store.linesOf(WS, [], { routeId: null, before: null, limit: 5 })).resolves.toEqual({ rows: [], next: null })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("TypeormContactConversationStore.activityOf", () => {
    it("answers the newest line of each route and the agent that spoke last, from live-contact lines only", async () => {
        const { store, em } = await build()
        const [lasts, spoke] = queueQueryBuilders(em, [
            {
                getRawMany: [
                    { routeId: "r1", lastAt: new Date("2026-11-14T08:00:00.000Z") },
                    { routeId: "r2", lastAt: "2026-11-14T09:30:00.000Z" },
                ],
            },
            { getMany: [lineOf(4, { routeId: "r1", direction: "to_person", agentId: "agent-1" })] },
        ])

        await expect(store.activityOf(WS, ["r1", "r2"])).resolves.toEqual([
            { routeId: "r1", lastLineAt: "2026-11-14T08:00:00.000Z", lastAgentId: "agent-1" },
            { routeId: "r2", lastLineAt: "2026-11-14T09:30:00.000Z", lastAgentId: null },
        ])
        expect(lasts?.callsOf("innerJoin")[0]).toEqual([ContactEntity, "contact", liveJoin("line")])
        expect(lasts?.callsOf("groupBy")[0]).toEqual(["line.routeId"])
        expect(spoke?.callsOf("innerJoin")[0]).toEqual([ContactEntity, "contact", liveJoin("line")])
        expect(spoke?.callsOf("distinctOn")[0]).toEqual([["line.routeId"]])
        expect(spoke?.callsOf("andWhere").map((call) => call[0])).toContain("line.direction = 'to_person' AND line.agentId IS NOT NULL")
    })

    it("reads nothing for no route, without a query", async () => {
        const { store, em } = await build()

        await expect(store.activityOf(WS, [])).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("TypeormContactConversationStore.holdsOf", () => {
    it("answers the live routes a member holds now, joined to a live contact", async () => {
        const { store, em } = await build()
        const held = Object.assign(new CustomerRouteEntity(), { id: "r1", heldByMemberId: "member-1", heldAt: new Date("2026-11-14T07:00:00.000Z") })
        const [fake] = queueQueryBuilders(em, [{ getMany: [held] }])

        await expect(store.holdsOf(WS, ["r1", "r2"])).resolves.toEqual([
            { routeId: "r1", memberId: "member-1", at: "2026-11-14T07:00:00.000Z" },
        ])
        expect(em.createQueryBuilder).toHaveBeenCalledWith(CustomerRouteEntity, "route")
        expect(fake?.callsOf("innerJoin")[0]).toEqual([ContactEntity, "contact", liveJoin("route")])
        expect(fake?.callsOf("andWhere").map((call) => call[0])).toContain("route.heldByMemberId IS NOT NULL AND route.heldAt IS NOT NULL")
    })

    it("reads nothing for no route, without a query", async () => {
        const { store, em } = await build()

        await expect(store.holdsOf(WS, [])).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})
