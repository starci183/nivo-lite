import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { InboxLeadsEventsService } from "./inbox-leads-events.service"

const build = async () => {
    const em = mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [InboxLeadsEventsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { events: moduleRef.get(InboxLeadsEventsService), em }
}

describe("InboxLeadsEventsService", () => {
    it("groups the inputs of the given leads, and asks nothing when there are none", async () => {
        const { events, em } = await build()
        await expect(events.groupsOf("ws-1", [])).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()

        const [read] = queueQueryBuilders(em, [{ getRawMany: [{ lead_id: "l1", event_count: 2 }] }])
        await expect(events.groupsOf("ws-1", ["l1"])).resolves.toEqual([{ lead_id: "l1", event_count: 2 }])
        expect(read?.callsOf("where")[0]).toEqual(["e.workspace_id = :workspaceId", { workspaceId: "ws-1" }])
        expect(read?.callsOf("andWhere")[0]).toEqual(["e.lead_id IN (:...leadIds)", { leadIds: ["l1"] }])
    })

    it("reads the newest customers that are no lead yet", async () => {
        const { events, em } = await build()
        const [read] = queueQueryBuilders(em, [{ getRawMany: [{ id: "key:phone:1" }] }])

        await expect(events.straysOf("ws-1")).resolves.toEqual([{ id: "key:phone:1" }])
        expect(read?.callsOf("andWhere")[0]).toEqual(["e.lead_id IS NULL"])
        expect(read?.callsOf("limit")[0]).toEqual([50])
    })

    it("counts the work items of each lead that wait for a decision", async () => {
        const { events, em } = await build()
        await expect(events.waitingOf("ws-1", [])).resolves.toEqual(new Map())

        queueQueryBuilders(em, [{ getRawMany: [{ lead_id: "l1", n: 2 }] }])
        await expect(events.waitingOf("ws-1", ["l1"])).resolves.toEqual(new Map([["l1", 2]]))
    })

    it("reads what the agents did alone and how fast, with zeros when nothing was raised", async () => {
        const { events, em } = await build()
        const since = new Date("2026-11-02T00:00:00.000Z")
        const [counts] = queueQueryBuilders(em, [
            { getRawOne: { total: 4, auto: 3 } },
            { getRawOne: { mean_seconds: 40 } },
        ])

        await expect(events.weekOf("ws-1", since)).resolves.toEqual({ total: 4, auto: 3, mean_seconds: 40 })
        expect(counts?.callsOf("andWhere")[0]).toEqual(["w.created_at >= :since", { since }])

        queueQueryBuilders(em, [{ getRawOne: undefined }, { getRawOne: undefined }])
        await expect(events.weekOf("ws-1", since)).resolves.toEqual({ total: 0, auto: 0, mean_seconds: null })
    })

    it("reads the inputs of a lead by its id, of a stray by its key, and of a lone input by its id", async () => {
        const { events, em } = await build()
        const [byLead, byKey, byEvent] = queueQueryBuilders(em, [
            { getRawMany: [] },
            { getRawMany: [] },
            { getRawMany: [] },
        ])

        await events.journeyOf("ws-1", { leadId: "l1" })
        await events.journeyOf("ws-1", { stray: "key:phone:1" })
        await events.journeyOf("ws-1", { stray: "event:e1" })

        expect(byLead?.callsOf("andWhere")[0]).toEqual(["e.lead_id = :leadId", { leadId: "l1" }])
        expect(byKey?.callsOf("andWhere")[0]).toEqual([
            "e.customer_key = :key AND e.lead_id IS NULL",
            { key: "phone:1" },
        ])
        expect(byEvent?.callsOf("andWhere")[0]).toEqual(["e.id = :eventId AND e.lead_id IS NULL", { eventId: "e1" }])
    })

    it("reads the work and the decisions of one lead, newest first", async () => {
        const { events, em } = await build()
        const [work, decisions] = queueQueryBuilders(em, [
            { getRawMany: [{ id: "w1" }] },
            { getRawMany: [{ id: "d1" }] },
        ])

        await expect(events.workOf("ws-1", "l1")).resolves.toEqual([{ id: "w1" }])
        await expect(events.decisionsOf("ws-1", "l1")).resolves.toEqual([{ id: "d1" }])
        expect(work?.callsOf("andWhere")[0]).toEqual(["w.lead_id = :leadId", { leadId: "l1" }])
        expect(decisions?.callsOf("andWhere")[0]).toEqual(["d.lead_id = :leadId", { leadId: "l1" }])
    })
})
