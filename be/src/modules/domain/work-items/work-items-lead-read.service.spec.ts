import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkItemEntity } from "./persistence/entities"
import { WorkItemsLeadReadService } from "./work-items-lead-read.service"

describe("WorkItemsLeadReadService", () => {
    it("asks whether an item of the action waits for a decision on the customer", async () => {
        const em = mockEntityManager({ exists: [WorkItemEntity, true] })
        const moduleRef = await Test.createTestingModule({
            providers: [WorkItemsLeadReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
        }).compile()

        await expect(moduleRef.get(WorkItemsLeadReadService).hasWaiting("ws-1", "l-1", "send_follow_up")).resolves.toBe(
            true,
        )
        expect(em.exists).toHaveBeenCalledWith(WorkItemEntity, {
            where: { workspaceId: "ws-1", leadId: "l-1", action: "send_follow_up", status: "waiting_decision" },
        })
    })
})
