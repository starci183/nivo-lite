import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EventsService } from "./events.service"
import type { EventRecordRow } from "./persistence/events.rows"
import { INSERT_EVENT, LIST_EVENTS, LIST_LEAD_EVENTS } from "./persistence/events.sql"

const rowOf = builder<EventRecordRow>({
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
        it("appends the line to the workspace evidence log", async () => {
            const em = mockEntityManager({ query: [INSERT_EVENT, []] })
            const service = await build(em)

            await expect(
                service.record({
                    workspaceId: "ws-1",
                    kind: "member.invited",
                    actor: "Chu",
                    summary: "an@example.test",
                }),
            ).resolves.toBeUndefined()

            expect(em.query).toHaveBeenCalledWith(INSERT_EVENT, [
                "ws-1",
                "member.invited",
                "Chu",
                "an@example.test",
                null,
                null,
                null,
            ])
        })

        it("carries the customer, the work item and the raw evidence when given", async () => {
            const em = mockEntityManager({ query: [INSERT_EVENT, []] })
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

            expect(em.query).toHaveBeenCalledWith(INSERT_EVENT, [
                "ws-1",
                "work.asked",
                "Sales",
                "ask",
                "lead-1",
                "work-1",
                "raw",
            ])
        })

        it("appends a line about a lead with its evidence in the transaction of the caller", async () => {
            const em = mockEntityManager()
            const tx = mockEntityManager({ query: [INSERT_EVENT, []] })
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

            expect(tx.query).toHaveBeenCalledWith(INSERT_EVENT, [
                "ws-1",
                "outcome.recorded",
                "Linh",
                "Stage",
                "lead-1",
                null,
                "Sent",
            ])
            expect(em.query).not.toHaveBeenCalled()
        })
    })

    describe("leadHistory", () => {
        it("answers the first lines of the customer history", async () => {
            const lines = [
                { summary: "Asked for a price", evidence: "tg:1" },
                { summary: "Sent the quote", evidence: null },
            ]
            const em = mockEntityManager({ query: [LIST_LEAD_EVENTS, lines] })

            await expect((await build(em)).leadHistory("ws-1", "lead-1", 20)).resolves.toEqual(lines)
            expect(em.query).toHaveBeenCalledWith(LIST_LEAD_EVENTS, ["ws-1", "lead-1", 20])
        })
    })

    describe("list", () => {
        it("answers the lines of the filters it is given", async () => {
            const em = mockEntityManager({ query: [LIST_EVENTS, [rowOf()]] })

            await expect(
                (await build(em)).list("ws-1", {
                    leadId: "lead-1",
                    kind: "work.asked",
                    workItemIds: ["work-1"],
                    oldestFirst: true,
                    limit: 50,
                }),
            ).resolves.toEqual([rowOf()])
            expect(em.query).toHaveBeenCalledWith(LIST_EVENTS, ["ws-1", "lead-1", "work.asked", ["work-1"], true, 50])
        })

        it("reads the newest lines of the whole workspace when no filter is set", async () => {
            const em = mockEntityManager({ query: [LIST_EVENTS, []] })

            await expect((await build(em)).list("ws-1", { limit: 10 })).resolves.toEqual([])
            expect(em.query).toHaveBeenCalledWith(LIST_EVENTS, ["ws-1", null, null, null, false, 10])
        })
    })
})
