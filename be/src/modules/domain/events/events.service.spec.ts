import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EventsService } from "./events.service"
import { INSERT_EVENT } from "./persistence/events.sql"

describe("EventsService", () => {
    describe("record", () => {
        it("appends the line to the workspace's evidence log", async () => {
            const em = mockEntityManager({ query: [INSERT_EVENT, []] })
            const moduleRef = await Test.createTestingModule({
                providers: [EventsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
            }).compile()

            await moduleRef
                .get(EventsService)
                .record({ workspaceId: "ws-1", kind: "member.invited", actor: "Chu", summary: "an@example.test" })

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
            const moduleRef = await Test.createTestingModule({
                providers: [EventsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
            }).compile()

            await moduleRef.get(EventsService).record({
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
    })
})
