import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import { AgentOwnershipService } from "@modules/domain/agents"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { TEAM_CHAT_TAG_QUEUE, TeamChatTagJob } from "@modules/queues/team-chat-tag"
import { TeamChatTagsService } from "./team-chat-tags.service"

const WS = "11111111-1111-4111-8111-111111111111"
const TAG = {
    userId: "22222222-2222-4222-8222-222222222222",
    agentId: "33333333-3333-4333-8333-333333333333",
    roomId: "44444444-4444-4444-8444-444444444444",
    messageId: "55555555-5555-4555-8555-555555555555",
    text: "@bot please quote 2 lanterns",
}

const build = async () => {
    const tx = fakeTransaction(mockEntityManager({}))
    const ownership = mock<AgentOwnershipService>()
    ownership.memberIdOf.mockResolvedValue("seat-1")
    const outbox = recordingQueueOutbox()
    const write = jest.spyOn(outbox, "write")
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatTagsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: AgentOwnershipService, useValue: ownership },
        ],
    }).compile()
    return { service: moduleRef.get(TeamChatTagsService), ownership, write, outbox }
}

describe("TeamChatTagsService", () => {
    it("queues the tag for the api's delivery when the person may hand the agent work, once per message and agent", async () => {
        const { service, ownership, write } = await build()
        ownership.canAssign.mockResolvedValue(true)

        await expect(service.handOff(WS, TAG)).resolves.toBe(true)

        expect(ownership.memberIdOf).toHaveBeenCalledWith(TAG.userId, WS)
        expect(ownership.canAssign).toHaveBeenCalledWith("seat-1", TAG.agentId)
        expect(isTransactionManager(write.mock.calls[0]?.[0])).toBe(true)
        expect(write.mock.calls[0]?.slice(1)).toEqual([
            TEAM_CHAT_TAG_QUEUE,
            { workspaceId: WS, agentId: TAG.agentId, memberId: "seat-1", roomId: TAG.roomId, messageId: TAG.messageId, text: TAG.text },
            { job: TeamChatTagJob.Deliver, dedupeKey: `team-chat-tag:${TAG.messageId}:${TAG.agentId}` },
        ])
    })

    it("queues nothing when the person may not hand the agent work", async () => {
        const { service, ownership, outbox } = await build()
        ownership.canAssign.mockResolvedValue(false)

        await expect(service.handOff(WS, TAG)).resolves.toBe(false)

        expect(outbox.jobs).toEqual([])
    })
})
