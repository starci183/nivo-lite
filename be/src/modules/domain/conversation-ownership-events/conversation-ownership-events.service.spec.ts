import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConversationOwnershipEventsService } from "./conversation-ownership-events.service"
import { ConversationOwnershipEventEntity } from "./persistence/entities"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [ConversationOwnershipEventsService] }).compile()
    return moduleRef.get(ConversationOwnershipEventsService)
}

describe("ConversationOwnershipEventsService", () => {
    it("records the move in the caller's transaction, in column order", async () => {
        const service = await build()
        const manager = mockEntityManager({ insert: [ConversationOwnershipEventEntity, {}] })

        await expect(
            service.record({
                manager,
                workspaceId: "ws-1",
                conversationId: "conv-1",
                fromAgentId: "sales",
                toAgentId: "care",
                reason: "booking confirmed",
            }),
        ).resolves.toBeUndefined()

        expect(manager.insert).toHaveBeenCalledWith(ConversationOwnershipEventEntity, {
            workspaceId: "ws-1",
            conversationId: "conv-1",
            fromAgentId: "sales",
            toAgentId: "care",
            reason: "booking confirmed",
        })
    })

    it("records a move with no previous agent as null", async () => {
        const service = await build()
        const manager = mockEntityManager({ insert: [ConversationOwnershipEventEntity, {}] })

        await service.record({
            manager,
            workspaceId: "ws-1",
            conversationId: "conv-1",
            fromAgentId: null,
            toAgentId: "sales",
            reason: "first owner",
        })

        expect(manager.insert).toHaveBeenCalledWith(ConversationOwnershipEventEntity, {
            workspaceId: "ws-1",
            conversationId: "conv-1",
            fromAgentId: null,
            toAgentId: "sales",
            reason: "first owner",
        })
    })
})
