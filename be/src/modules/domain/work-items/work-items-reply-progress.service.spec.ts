import { Test } from "@nestjs/testing"
import {
    replyItemNaming,
    replyItemOf,
    replyItemWithoutConversation,
} from "@tests/fixtures/builders/work-items-reply-progress.builder"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AgentConversationsReadService } from "@modules/domain/agent-conversations"
import { AgentMessageDeliveriesService } from "@modules/domain/agent-messages"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkItemEntity } from "./persistence/entities"
import { WorkItemsReplyProgressService } from "./work-items-reply-progress.service"

const build = async (entityManager: MockEntityManager) => {
    const conversations = mock<AgentConversationsReadService>()
    conversations.customerChat.mockImplementation((_workspace, id) => Promise.resolve({ id, leadId: null }))
    const deliveries = mock<AgentMessageDeliveriesService>()
    deliveries.humanReplyOf.mockResolvedValue({ id: "w1", deliveryStatus: "sent" })
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkItemsReplyProgressService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: AgentConversationsReadService, useValue: conversations },
            { provide: AgentMessageDeliveriesService, useValue: deliveries },
        ],
    }).compile()
    return { service: moduleRef.get(WorkItemsReplyProgressService), conversations, deliveries }
}

describe("WorkItemsReplyProgressService > answerProgress", () => {
    it("answers how far the reply got and what was delivered, on the conversation of the subject", async () => {
        const em = mockEntityManager({ findOne: [WorkItemEntity, replyItemOf()] })
        const { service, conversations, deliveries } = await build(em)

        await expect(service.answerProgress("ws", "w1")).resolves.toEqual({
            id: "w1",
            work_status: "done",
            message_id: "w1",
            delivery_status: "sent",
        })
        expect(em.findOne).toHaveBeenCalledWith(WorkItemEntity, {
            where: { workspaceId: "ws", id: "w1", action: "reply_customer" },
        })
        expect(conversations.customerChat).toHaveBeenCalledWith("ws", "c-subject")
        expect(deliveries.humanReplyOf).toHaveBeenCalledWith("ws", "c-subject", "w1")
    })

    it("prefers the conversation the proposal names", async () => {
        const item = replyItemNaming("c-field")
        const em = mockEntityManager({ findOne: [WorkItemEntity, item] })
        const { service, conversations } = await build(em)

        await service.answerProgress("ws", "w1")

        expect(conversations.customerChat).toHaveBeenCalledWith("ws", "c-field")
    })

    it("answers no stored answer before the reply was performed", async () => {
        const em = mockEntityManager({ findOne: [WorkItemEntity, replyItemOf()] })
        const { service, deliveries } = await build(em)
        deliveries.humanReplyOf.mockResolvedValue(null)

        await expect(service.answerProgress("ws", "w1")).resolves.toMatchObject({
            message_id: null,
            delivery_status: null,
        })
    })

    it("answers null for an item the workspace does not hold", async () => {
        const { service } = await build(mockEntityManager({ findOne: [WorkItemEntity, null] }))

        await expect(service.answerProgress("ws", "ghost")).resolves.toBeNull()
    })

    it("answers null when the item names no conversation", async () => {
        const item = replyItemWithoutConversation()
        const { service } = await build(mockEntityManager({ findOne: [WorkItemEntity, item] }))

        await expect(service.answerProgress("ws", "w1")).resolves.toBeNull()
    })

    it("answers null when the conversation is not a customer conversation", async () => {
        const em = mockEntityManager({ findOne: [WorkItemEntity, replyItemOf()] })
        const { service, conversations } = await build(em)
        conversations.customerChat.mockResolvedValue(null)

        await expect(service.answerProgress("ws", "w1")).resolves.toBeNull()
    })
})
