import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentConversationsErrorCode, AgentConversationsService } from "@modules/domain/agent-conversations"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ChatFilesService } from "@modules/domain/chat-files"
import { FlowTriggerMessagesService } from "./flow-trigger-messages.service"

const AGENT: TurnConversation["agent"] = {
    id: "a-1",
    name: "Chatbot",
    handle: "chatbot",
    role: "Customer chat",
    module: "chatbot",
    instructions: "Be kind",
    knowledge: "Tea",
    approvalRule: "ask",
    greeting: "Hi",
}

const conversation: TurnConversation = {
    id: "c-1",
    workspaceId: "ws-1",
    channel: "zalo",
    externalId: "555",
    connectionId: "k1",
    leadId: "l-1",
    handledBy: null,
    visitorName: null,
    installationId: null,
    agent: AGENT,
    speaksAs: null,
}

const build = async () => {
    const messages = mock<AgentMessagesService>()
    const files = mock<ChatFilesService>()
    const conversations = mock<AgentConversationsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            FlowTriggerMessagesService,
            { provide: AgentMessagesService, useValue: messages },
            { provide: ChatFilesService, useValue: files },
            { provide: AgentConversationsService, useValue: conversations },
        ],
    }).compile()
    return { service: moduleRef.get(FlowTriggerMessagesService), messages, files, conversations }
}

describe("FlowTriggerMessagesService", () => {
    it("answers the customer's messages in the order said, each with the files sent with it", async () => {
        const { service, messages, files } = await build()
        messages.customerLinesOf.mockResolvedValue([
            { id: "m-1", body: "Hello shop", at: new Date("2026-11-04T01:00:00.000Z") },
            { id: "m-2", body: "Transfer done", at: new Date("2026-11-04T01:00:05.000Z") },
        ])
        messages.unansweredLinesOf.mockResolvedValue([])
        const view = { id: "f-1", name: "bidv.jpg", contentType: "image/jpeg", url: "https://files.test/f-1" }
        files.viewsOf.mockResolvedValue([{ ...view, messageId: "m-2" }])

        await expect(service.messagesOf("ws-1", "c-1", ["m-2", "m-1"])).resolves.toEqual([
            { id: "m-1", text: "Hello shop", at: "2026-11-04T01:00:00.000Z", attachments: [] },
            { id: "m-2", text: "Transfer done", at: "2026-11-04T01:00:05.000Z", attachments: [view] },
        ])
        expect(messages.customerLinesOf).toHaveBeenCalledWith("c-1", ["m-2", "m-1"])
        expect(files.viewsOf).toHaveBeenCalledWith("ws-1", ["m-1", "m-2"])
        expect(messages.unansweredLinesOf).toHaveBeenCalledWith("c-1", 30)
    })

    it("answers a burst of five coalesced wakes whole, in order and once each, though the surviving wake named only one", async () => {
        const said = [
            "Hello, please order one pot for Dinh",
            "deliver to 69 Hang Xanh",
            "I need some advice",
            "I transferred 5k",
            "name BUI NGUYEN DINH",
        ]
        const lines = said.map((body, index) => ({
            id: `m-${index + 1}`,
            body,
            at: new Date(Date.UTC(2026, 10, 4, 1, 0, Math.min(index, 3))),
        }))
        const { service, messages, files } = await build()
        messages.customerLinesOf.mockResolvedValue(lines.slice(3, 4))
        messages.unansweredLinesOf.mockResolvedValue([...lines].reverse())
        files.viewsOf.mockResolvedValue([])

        const answered = await service.messagesOf("ws-1", "c-1", ["m-4"])

        expect(answered.map((message) => message.text)).toEqual(said)
        expect(answered.map((message) => message.id)).toEqual(["m-1", "m-2", "m-3", "m-4", "m-5"])
    })
})

describe("FlowTriggerMessagesService conversationOf", () => {
    it("answers the conversation's customer and channel, and null for one that is gone", async () => {
        const { service, conversations } = await build()
        conversations.turnOf
            .mockResolvedValueOnce({ kind: "ok", value: conversation })
            .mockResolvedValueOnce({ kind: "refused", code: AgentConversationsErrorCode.NotFound })

        await expect(service.conversationOf("c-1")).resolves.toEqual({ leadId: "l-1", channel: "zalo" })
        await expect(service.conversationOf("c-2")).resolves.toBeNull()
    })
})
