import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { AgentConversationsReadService } from "@modules/domain/agent-conversations"
import { PublicConversationsService } from "./public-conversations.service"

const CONVERSATION = { id: "conv-1", lead_id: "lead-1" }

const build = async () => {
    const chats = mock<AgentConversationsReadService>()
    const moduleRef = await Test.createTestingModule({
        providers: [PublicConversationsService, { provide: AgentConversationsReadService, useValue: chats }],
    }).compile()
    return { service: moduleRef.get(PublicConversationsService), chats }
}

describe("PublicConversationsService", () => {
    it("finds a customer conversation of the workspace by id inside the caller's transaction", async () => {
        const em = mockEntityManager()
        const { service, chats } = await build()
        chats.customerChat.mockResolvedValue({ id: "conv-1", leadId: "lead-1" })

        await expect(service.find("ws-1", "conv-1", em)).resolves.toEqual(CONVERSATION)

        expect(chats.customerChat).toHaveBeenCalledWith("ws-1", "conv-1", em)
    })

    it("answers nothing for a conversation that is not there", async () => {
        const { service, chats } = await build()
        chats.customerChat.mockResolvedValue(null)

        await expect(service.find("ws-1", "missing", mockEntityManager())).resolves.toBeUndefined()
    })
})
