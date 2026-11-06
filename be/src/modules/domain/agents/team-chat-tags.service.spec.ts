import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentTagService } from "@modules/domain/agent-work"
import { AgentOwnershipService } from "./agent-ownership.service"
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
    const ownership = mock<AgentOwnershipService>()
    const tags = mock<AgentTagService>()
    ownership.memberIdOf.mockResolvedValue("seat-1")
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatTagsService,
            { provide: AgentOwnershipService, useValue: ownership },
            { provide: AgentTagService, useValue: tags },
        ],
    }).compile()
    return { service: moduleRef.get(TeamChatTagsService), ownership, tags }
}

describe("TeamChatTagsService", () => {
    it("hands the message to the agent through the tag door when the person may hand it work, once per message", async () => {
        const { service, ownership, tags } = await build()
        ownership.canAssign.mockResolvedValue(true)
        tags.tagAgent.mockResolvedValue({ tagged: true, wakeId: "wake-1" })
        await expect(service.handOff(WS, TAG)).resolves.toBe(true)
        expect(ownership.memberIdOf).toHaveBeenCalledWith(TAG.userId, WS)
        expect(ownership.canAssign).toHaveBeenCalledWith("seat-1", TAG.agentId)
        expect(tags.tagAgent).toHaveBeenCalledWith({
            workspaceId: WS,
            toAgentId: TAG.agentId,
            personId: "seat-1",
            text: TAG.text,
            subject: `chat-room:${TAG.roomId}`,
            context: { roomId: TAG.roomId, messageId: TAG.messageId },
            eventKey: `chat-tag:${TAG.messageId}:${TAG.agentId}`,
        })
    })

    it("writes nothing when the person may not hand the agent work, and says the tag was not written when the door found it written", async () => {
        const { service, ownership, tags } = await build()
        ownership.canAssign.mockResolvedValue(false)
        await expect(service.handOff(WS, TAG)).resolves.toBe(false)
        expect(tags.tagAgent).not.toHaveBeenCalled()
        ownership.canAssign.mockResolvedValue(true)
        tags.tagAgent.mockResolvedValue({ tagged: false, reason: "duplicate" })
        await expect(service.handOff(WS, TAG)).resolves.toBe(false)
    })
})
