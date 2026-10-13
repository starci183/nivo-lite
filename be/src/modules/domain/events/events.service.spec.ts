import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EventsService } from "./events.service"
import { INSERT_EVENT } from "./persistence/events.sql"

const build = async (em: ReturnType<typeof mockEntityManager>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [EventsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(EventsService)
}

describe("EventsService", () => {
    describe("record", () => {
        it("appends the line to the workspace evidence log", async () => {
            const em = mockEntityManager({ query: [INSERT_EVENT, []] })

            await (
                await build(em)
            ).record({ workspaceId: "ws-1", kind: "member.invited", actor: "Chu", summary: "an@example.test" })

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

            await (
                await build(em)
            ).record({
                workspaceId: "ws-1",
                kind: "work.asked",
                actor: "Sales",
                summary: "ask",
                leadId: "lead-1",
                workItemId: "work-1",
                evidence: "raw",
            })

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

            await (
                await build(em)
            ).record(
                {
                    workspaceId: "ws-1",
                    kind: "outcome.recorded",
                    actor: "Linh",
                    summary: "Stage",
                    leadId: "lead-1",
                    evidence: "Sent",
                },
                tx,
            )

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
})
