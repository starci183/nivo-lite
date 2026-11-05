import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { ConversationHandoverService } from "@modules/domain/agent-conversations"
import { AgentDirectoryService } from "@modules/domain/agents"
import { AgentMessagesService } from "./agent-messages.service"
import { AgentTagConversationService } from "./agent-tag-conversation.service"

const NOTICE = {
    workspaceId: "ws-1",
    conversationId: "c1",
    fromAgentId: "chat",
    toAgentId: "sales",
    text: "Order for 5 baskets",
}

const build = async () => {
    const messages = mock<AgentMessagesService>()
    messages.storeLine.mockResolvedValue(undefined)
    const handover = mock<ConversationHandoverService>()
    handover.handOver.mockResolvedValue(true)
    const directory = mock<AgentDirectoryService>()
    directory.activeInOrder.mockResolvedValue([{ id: "sales", name: "Sales AI", module: "sales", canTagAgentIds: [] }])
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentTagConversationService,
            { provide: AgentMessagesService, useValue: messages },
            { provide: ConversationHandoverService, useValue: handover },
            { provide: AgentDirectoryService, useValue: directory },
        ],
    }).compile()
    return { service: moduleRef.get(AgentTagConversationService), messages, handover, directory }
}

const buildUnbound = async () => {
    const messages = mock<AgentMessagesService>()
    messages.storeLine.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [AgentTagConversationService, { provide: AgentMessagesService, useValue: messages }],
    }).compile()
    return { service: moduleRef.get(AgentTagConversationService), messages }
}

describe("AgentTagConversationService", () => {
    it("writes the tag line with the name of the agent that takes over, in the transaction it is given", async () => {
        const { service, messages } = await build()
        const tx = mockEntityManager()

        await service.announce(NOTICE, tx)

        expect(messages.storeLine).toHaveBeenCalledWith("ws-1", "c1", "@Sales AI Order for 5 baskets", tx)
    })

    it("writes the words alone when the agent cannot be named", async () => {
        const { service, messages } = await buildUnbound()
        const tx = mockEntityManager()

        await service.announce(NOTICE, tx)

        expect(messages.storeLine).toHaveBeenCalledWith("ws-1", "c1", "Order for 5 baskets", tx)
    })

    it("hands the conversation over without a line, and only when an agent hands it over", async () => {
        const { service, handover, messages } = await build()

        await service.redirect(NOTICE)
        await service.redirect({ ...NOTICE, fromAgentId: null })

        expect(handover.handOver).toHaveBeenCalledTimes(1)
        expect(handover.handOver).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "c1",
            fromAgentId: "chat",
            toAgentId: "sales",
            reason: "Order for 5 baskets",
        })
        expect(messages.storeLine).not.toHaveBeenCalled()
    })

    it("moves nothing when the handover is not bound", async () => {
        const { service } = await buildUnbound()

        await expect(service.redirect(NOTICE)).resolves.toBeUndefined()
    })

    it("asks the handover who speaks and hands a done speaker's conversation back; knows no speaker unbound", async () => {
        const { service, handover } = await build()
        const unbound = await buildUnbound()
        handover.speakerOf.mockResolvedValue("sales")
        handover.returnToFront.mockResolvedValue(true)

        await expect(service.holderOf("ws-1", "c1")).resolves.toBe("sales")
        await service.handBack("ws-1", "c1", "sales")
        await expect(unbound.service.holderOf("ws-1", "c1")).resolves.toBeNull()
        await expect(unbound.service.handBack("ws-1", "c1", "sales")).resolves.toBeUndefined()

        expect(handover.speakerOf).toHaveBeenCalledWith("ws-1", "c1")
        expect(handover.returnToFront).toHaveBeenCalledWith("ws-1", "c1", "sales")
    })
})
