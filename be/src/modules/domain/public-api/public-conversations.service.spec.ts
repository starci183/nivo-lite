import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ChatConversationsService } from "@modules/domain/chat-records"
import { humanConversation } from "@tests/fixtures/builders/chat-features.builder"
import { PublicConversationsService } from "./public-conversations.service"

const CONVERSATION = { id: "conv-1", lead_id: "lead-1" }

const build = async () => {
    const chats = mock<ChatConversationsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [PublicConversationsService, { provide: ChatConversationsService, useValue: chats }],
    }).compile()
    return { service: moduleRef.get(PublicConversationsService), chats }
}

describe("PublicConversationsService", () => {
    it("finds a customer conversation of the workspace by id", async () => {
        const { service, chats } = await build()
        chats.humanOf.mockResolvedValue(humanConversation({ leadId: "lead-1" }))

        await expect(service.find("ws-1", "conv-1")).resolves.toEqual(CONVERSATION)

        expect(chats.humanOf).toHaveBeenCalledWith("ws-1", "conv-1")
    })

    it("answers nothing for a conversation that is not there", async () => {
        const { service, chats } = await build()
        chats.humanOf.mockResolvedValue(null)

        await expect(service.find("ws-1", "missing")).resolves.toBeUndefined()
    })
})
