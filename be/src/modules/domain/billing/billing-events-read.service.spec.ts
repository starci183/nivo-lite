import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BillingEventsReadService } from "./billing-events-read.service"
import { BillingEventEntity } from "./persistence/entities"

const WHEN = new Date("2026-10-02T00:00:00.000Z")
const event = Object.assign(new BillingEventEntity(), { id: "b-1", workspaceId: "ws-1", kind: "paid", createdAt: WHEN })
const ROW = { id: "b-1", workspaceId: "ws-1", kind: "paid", createdAt: WHEN }
const COLUMNS = { id: true, workspaceId: true, kind: true, createdAt: true }

const build = async () => {
    const em = mockEntityManager({ find: [BillingEventEntity, [event]] })
    const moduleRef = await Test.createTestingModule({
        providers: [BillingEventsReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { em, service: moduleRef.get(BillingEventsReadService) }
}

describe("BillingEventsReadService", () => {
    it("reads the newest events of one workspace", async () => {
        const { em, service } = await build()

        await expect(service.latestOfWorkspace("ws-1", 20)).resolves.toEqual([ROW])
        expect(em.find).toHaveBeenCalledWith(BillingEventEntity, {
            select: COLUMNS,
            where: { workspaceId: "ws-1" },
            order: { createdAt: "DESC" },
            take: 20,
        })
    })

    it("reads the newest events of every workspace", async () => {
        const { em, service } = await build()

        await expect(service.latest(25)).resolves.toEqual([ROW])
        expect(em.find).toHaveBeenCalledWith(BillingEventEntity, {
            select: COLUMNS,
            order: { createdAt: "DESC" },
            take: 25,
        })
    })
})
