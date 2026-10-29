import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { WorkThreadEntity } from "./persistence/entities"
import { WorkThreadsLeadsReadService } from "./work-threads-leads-read.service"

const threadOf = entityOf(WorkThreadEntity, { id: "t-1", leadId: "l-1" })

describe("WorkThreadsLeadsReadService", () => {
    it("names the customer of each thread, nothing for no threads", async () => {
        const em = mockEntityManager({ find: [WorkThreadEntity, [threadOf(), threadOf({ id: "t-2", leadId: null })]] })
        const moduleRef = await Test.createTestingModule({
            providers: [WorkThreadsLeadsReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
        }).compile()
        const service = moduleRef.get(WorkThreadsLeadsReadService)

        await expect(service.leadsOf("ws-1", [])).resolves.toEqual([])
        await expect(service.leadsOf("ws-1", ["t-1", "t-2"])).resolves.toEqual([
            { id: "t-1", leadId: "l-1" },
            { id: "t-2", leadId: null },
        ])
        expect(em.find).toHaveBeenCalledTimes(1)
    })
})
