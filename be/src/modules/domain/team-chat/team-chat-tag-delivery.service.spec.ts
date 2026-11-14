import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import { ProviderTriggersService } from "@modules/domain/provider-triggers"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { TEAM_CHAT_MESSAGE_TRIGGER } from "./team-chat-message.trigger"
import { TeamChatTagDeliveryService } from "./team-chat-tag-delivery.service"

const PAYLOAD = { workspaceId: "ws-1", agentId: "agent-1", memberId: "seat-1", roomId: "room-1", messageId: "msg-1", text: "@bot quote" }

const build = async () => {
    const tx = fakeTransaction(mockEntityManager({}))
    const triggers = mock<ProviderTriggersService>()
    triggers.deliver.mockResolvedValue({ status: "delivered", events: 1, dropped: 0, woken: [], repeats: 0, untaken: 0, held: 0 })
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatTagDeliveryService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: ProviderTriggersService, useValue: triggers },
        ],
    }).compile()
    return { service: moduleRef.get(TeamChatTagDeliveryService), triggers }
}

describe("TeamChatTagDeliveryService (the api side of a queued tag)", () => {
    it("hands ONE event per (message, agent) to the delivery for the tagged agent, the member beside it, in one transaction", async () => {
        const { service, triggers } = await build()

        await service.deliverJob(PAYLOAD)

        expect(isTransactionManager(triggers.deliver.mock.calls[0]?.[1])).toBe(true)
        expect(triggers.deliver.mock.calls[0]?.[0]).toEqual({
            workspaceId: "ws-1",
            declaration: TEAM_CHAT_MESSAGE_TRIGGER,
            connectionId: null,
            agentId: "agent-1",
            events: [
                {
                    event: {
                        id: "chat-tag:msg-1:agent-1",
                        data: { threadId: "room-1", roomId: "room-1", messageId: "msg-1", text: "@bot quote", actorMemberId: "seat-1" },
                    },
                    actorMemberId: "seat-1",
                },
            ],
        })
    })

    it("hands the same event id for a replay of the same job, and does nothing for a payload that is no tag", async () => {
        const { service, triggers } = await build()

        await service.deliverJob(PAYLOAD)
        await service.deliverJob(PAYLOAD)
        await service.deliverJob({ agentId: "agent-1" })

        expect(triggers.deliver.mock.calls.map((call) => call[0].events[0]?.event.id)).toEqual(["chat-tag:msg-1:agent-1", "chat-tag:msg-1:agent-1"])
    })
})
