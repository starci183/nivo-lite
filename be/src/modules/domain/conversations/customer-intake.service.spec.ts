import { mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentConversationsErrorCode, AgentConversationsService } from "@modules/domain/agent-conversations"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import { AgentWakeService, AgentWorkSettingsService } from "@modules/domain/agent-work"
import { ChatTurnQueue } from "@modules/queues/chat-turn"
import type { CustomerIntake, MessageIntake } from "./conversations.contracts"
import { CustomerIntakeService } from "./customer-intake.service"

const MESSAGE: MessageIntake = {
    workspaceId: "ws-1",
    conversationId: "conv-1",
    messageId: "msg-1",
    channelEventId: "tg:555:9",
    lookupName: true,
}

const INTAKE: CustomerIntake = { ...MESSAGE, agentId: "agent-1" }

const turnConversationOf = (agentId: string): TurnConversation => ({
    id: "conv-1",
    workspaceId: "ws-1",
    channel: "website",
    externalId: null,
    connectionId: null,
    leadId: null,
    handledBy: null,
    visitorName: null,
    installationId: null,
    agent: {
        id: agentId,
        name: "Bot",
        handle: "bot",
        role: "Chat",
        module: "chatbot",
        instructions: "",
        knowledge: "",
        approvalRule: "ask",
        greeting: "",
    },
})

const build = async (
    road: Awaited<ReturnType<AgentWorkSettingsService["roadOf"]>>,
    agentOfConversation: string | null = "agent-1",
) => {
    const settings = mock<AgentWorkSettingsService>()
    settings.roadOf.mockResolvedValue(road)
    const wakes = mock<AgentWakeService>()
    wakes.wake.mockResolvedValue(true)
    const queue = mock<ChatTurnQueue>()
    queue.enqueueChatTurn.mockResolvedValue(undefined)
    const conversations = mock<AgentConversationsService>()
    conversations.turnOf.mockResolvedValue(
        agentOfConversation === null
            ? { kind: "refused", code: AgentConversationsErrorCode.NotFound }
            : { kind: "ok", value: turnConversationOf(agentOfConversation) },
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            CustomerIntakeService,
            { provide: AgentWorkSettingsService, useValue: settings },
            { provide: AgentWakeService, useValue: wakes },
            { provide: ChatTurnQueue, useValue: queue },
            { provide: AgentConversationsService, useValue: conversations },
        ],
    }).compile()
    return { service: moduleRef.get(CustomerIntakeService), settings, wakes, queue, conversations }
}

describe("CustomerIntakeService.answer", () => {
    it("queues a chat-turn job on the legacy road, and writes no wake", async () => {
        const manager = mockEntityManager()
        const { service, queue, wakes } = await build("legacy")

        await expect(service.answer(INTAKE, manager)).resolves.toBeUndefined()

        expect(queue.enqueueChatTurn).toHaveBeenCalledWith({ kind: "turn", ...MESSAGE }, manager)
        expect(wakes.wake).not.toHaveBeenCalled()
    })

    it("writes a customer wake keyed by the message on the core road, and queues no job", async () => {
        const manager = mockEntityManager()
        const { service, queue, wakes } = await build("core")

        await expect(service.answer(INTAKE, manager)).resolves.toBeUndefined()

        expect(wakes.wake).toHaveBeenCalledWith(manager, {
            workspaceId: "ws-1",
            agentId: "agent-1",
            source: "customer",
            eventKey: "msg-1",
            context: { conversationId: "conv-1", messageId: "msg-1", channelEventId: "tg:555:9", lookupName: true },
            actorMemberId: null,
        })
        expect(queue.enqueueChatTurn).not.toHaveBeenCalled()
    })
})

describe("CustomerIntakeService.answerChat", () => {
    it("queues a job on the legacy road without reading the conversation", async () => {
        const manager = mockEntityManager()
        const { service, queue, conversations } = await build("legacy")

        await expect(service.answerChat(MESSAGE, manager)).resolves.toBeUndefined()

        expect(queue.enqueueChatTurn).toHaveBeenCalledWith({ kind: "turn", ...MESSAGE }, manager)
        expect(conversations.turnOf).not.toHaveBeenCalled()
    })

    it("wakes the agent that speaks in the conversation on the core road", async () => {
        const manager = mockEntityManager()
        const { service, wakes, queue } = await build("core", "agent-7")

        await expect(service.answerChat(MESSAGE, manager)).resolves.toBeUndefined()

        expect(wakes.wake).toHaveBeenCalledWith(
            manager,
            expect.objectContaining({ agentId: "agent-7", eventKey: "msg-1" }),
        )
        expect(queue.enqueueChatTurn).not.toHaveBeenCalled()
    })

    it("falls back to the job when the conversation cannot be read, so the message is never left unanswered", async () => {
        const manager = mockEntityManager()
        const { service, wakes, queue } = await build("core", null)

        await expect(service.answerChat(MESSAGE, manager)).resolves.toBeUndefined()

        expect(queue.enqueueChatTurn).toHaveBeenCalledTimes(1)
        expect(wakes.wake).not.toHaveBeenCalled()
    })
})
