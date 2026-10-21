import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConversationOwnershipEventsService } from "./conversation-ownership-events.service"
import { INSERT_OWNERSHIP_EVENT } from "./persistence/conversation-ownership-events.sql"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [ConversationOwnershipEventsService] }).compile()
    return moduleRef.get(ConversationOwnershipEventsService)
}

describe("ConversationOwnershipEventsService", () => {
    it("records the move in the caller's transaction, in column order", async () => {
        const service = await build()
        const manager = mockEntityManager({ query: [INSERT_OWNERSHIP_EVENT, []] })

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

        expect(manager.query).toHaveBeenCalledWith(INSERT_OWNERSHIP_EVENT, [
            "ws-1",
            "conv-1",
            "sales",
            "care",
            "booking confirmed",
        ])
    })

    it("records a move with no previous agent as null", async () => {
        const service = await build()
        const manager = mockEntityManager({ query: [INSERT_OWNERSHIP_EVENT, []] })

        await service.record({
            manager,
            workspaceId: "ws-1",
            conversationId: "conv-1",
            fromAgentId: null,
            toAgentId: "sales",
            reason: "first owner",
        })

        expect(manager.query).toHaveBeenCalledWith(INSERT_OWNERSHIP_EVENT, [
            "ws-1",
            "conv-1",
            null,
            "sales",
            "first owner",
        ])
    })
})
