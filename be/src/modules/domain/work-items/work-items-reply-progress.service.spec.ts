import { Test } from "@nestjs/testing"
import {
    replyItemNaming,
    replyItemOf,
    replyItemWithoutConversation,
} from "@tests/fixtures/builders/work-items-reply-progress.builder"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkItemEntity } from "./persistence/entities"
import { WorkItemsReplyProgressService } from "./work-items-reply-progress.service"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [WorkItemsReplyProgressService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return { service: moduleRef.get(WorkItemsReplyProgressService) }
}

describe("WorkItemsReplyProgressService > replyItemOf", () => {
    it("answers the item and the conversation of its subject", async () => {
        const em = mockEntityManager({ findOne: [WorkItemEntity, replyItemOf()] })
        const { service } = await build(em)

        await expect(service.replyItemOf("ws", "w1")).resolves.toEqual({
            id: "w1",
            status: "done",
            conversationId: "c-subject",
        })
        expect(em.findOne).toHaveBeenCalledWith(WorkItemEntity, {
            where: { workspaceId: "ws", id: "w1", action: "reply_customer" },
        })
    })

    it("prefers the conversation the proposal names", async () => {
        const em = mockEntityManager({ findOne: [WorkItemEntity, replyItemNaming("c-field")] })
        const { service } = await build(em)

        await expect(service.replyItemOf("ws", "w1")).resolves.toMatchObject({ conversationId: "c-field" })
    })

    it("answers null for an item the workspace does not hold", async () => {
        const { service } = await build(mockEntityManager({ findOne: [WorkItemEntity, null] }))

        await expect(service.replyItemOf("ws", "ghost")).resolves.toBeNull()
    })

    it("answers null when the item names no conversation", async () => {
        const item = replyItemWithoutConversation()
        const { service } = await build(mockEntityManager({ findOne: [WorkItemEntity, item] }))

        await expect(service.replyItemOf("ws", "w1")).resolves.toBeNull()
    })
})
