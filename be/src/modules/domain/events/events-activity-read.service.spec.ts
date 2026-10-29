import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { EventsActivityReadService } from "./events-activity-read.service"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [EventsActivityReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(EventsActivityReadService)
}

describe("EventsActivityReadService", () => {
    it("reads the newest line of each customer, and nothing for no customers", async () => {
        const em = mockEntityManager()
        const at = new Date("2026-10-12T03:00:00.000Z")
        const [fake] = queueQueryBuilders(em, [{ getRawMany: [{ lead_id: "l1", last_at: at }] }])
        const service = await build(em)

        await expect(service.lastAtByLead("ws-1", [], 10)).resolves.toEqual([])
        await expect(service.lastAtByLead("ws-1", ["l1"], 10)).resolves.toEqual([{ lead_id: "l1", last_at: at }])
        expect(fake?.callsOf("groupBy")).toEqual([["e.leadId"]])
        expect(fake?.callsOf("limit")).toEqual([[10]])
    })

    it("lists the customers a kind was logged about since an instant", async () => {
        const em = mockEntityManager()
        const since = new Date("2026-10-12T00:00:00.000Z")
        const [fake] = queueQueryBuilders(em, [{ getRawMany: [{ lead_id: "l1" }, { lead_id: "l2" }] }])

        await expect((await build(em)).leadIdsOfKindSince("ws-1", "outcome.recorded", since, 50)).resolves.toEqual([
            "l1",
            "l2",
        ])
        expect(fake?.callsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws-1", kind: "outcome.recorded", since })
    })
})
