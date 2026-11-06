import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ChatConversationsService, ChatMessagesService, ChatRecordsErrorCode } from "@modules/domain/chat-records"
import type { ChatConversationTarget } from "@modules/domain/chat-records"
import { McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import { ChannelDeliveryService } from "./channel-delivery.service"
import type { DeliveryReceipt } from "./channels.contracts"
import { CHAT_MANIFEST, ChatSendNativeService } from "./chat-send-native.service"

const CALLER = { agentId: "agent-1", conversationId: null }
const CONVERSATION = "11111111-1111-4111-8111-111111111111"
const ARGS = { conversationId: CONVERSATION, text: "Xin chao", key: "work-1" }
const TARGET: ChatConversationTarget = {
    id: CONVERSATION,
    workspaceId: "ws-1",
    channel: "telegram",
    externalId: "555",
    connectionId: "c-1",
}
const DELIVERED: DeliveryReceipt = { delivered: true, failure: null, outcome: "acknowledged" }
const REJECTED: DeliveryReceipt = { delivered: false, failure: null, outcome: "rejected" }
const AMBIGUOUS: DeliveryReceipt = { delivered: false, failure: null, outcome: "ambiguous" }

const build = async () => {
    const conversations = mock<ChatConversationsService>()
    conversations.targetOf.mockResolvedValue({ kind: "ok", value: TARGET })
    const messages = mock<ChatMessagesService>()
    messages.find.mockResolvedValue({ kind: "refused", code: ChatRecordsErrorCode.NotFound })
    messages.storeAgentLine.mockResolvedValue({ id: "msg-1", body: "Xin chao", sent: false })
    const delivery = mock<ChannelDeliveryService>()
    delivery.deliver.mockResolvedValue(DELIVERED)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatSendNativeService,
            { provide: ChatConversationsService, useValue: conversations },
            { provide: ChatMessagesService, useValue: messages },
            { provide: ChannelDeliveryService, useValue: delivery },
        ],
    }).compile()
    return { service: moduleRef.get(ChatSendNativeService), conversations, messages, delivery }
}

describe("ChatSendNativeService", () => {
    it("announces one internal write tool that plays the domain tool chat.send and takes its replay key", () => {
        expect(CHAT_MANIFEST.key).toBe("chat")
        expect(CHAT_MANIFEST.tools.map((tool) => [tool.name, tool.scope, tool.domain, tool.internalOnly])).toEqual([
            ["send", "write", "chat.send", true],
        ])
        expect(CHAT_MANIFEST.tools[0]?.idempotencyArg).toBe("key")
    })

    it("stores the line once under its key, delivers it and answers ok", async () => {
        const { service, conversations, messages, delivery } = await build()

        await expect(service.invoke("ws-1", "send", ARGS, CALLER)).resolves.toEqual({ ok: true })

        expect(conversations.targetOf).toHaveBeenCalledWith("ws-1", CONVERSATION)
        expect(messages.storeAgentLine).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: CONVERSATION,
            body: "Xin chao",
            key: "work-1",
        })
        expect(delivery.deliver).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: CONVERSATION,
            messageId: "msg-1",
            text: "Xin chao",
        })
    })

    it("answers ok without sending again a line that already reached the customer", async () => {
        const { service, messages, delivery } = await build()
        messages.storeAgentLine.mockResolvedValue({ id: "msg-1", body: "Xin chao", sent: true })

        await expect(service.invoke("ws-1", "send", ARGS, CALLER)).resolves.toEqual({ ok: true })

        expect(delivery.deliver).not.toHaveBeenCalled()
    })

    it("says the stored line when the key is the id of one of the conversation, and stores nothing twice", async () => {
        const { service, messages, delivery } = await build()
        messages.find.mockResolvedValue({
            kind: "ok",
            value: { id: "msg-9", role: "agent", body: "Stored words", deliveryStatus: null },
        })

        await expect(service.invoke("ws-1", "send", ARGS, CALLER)).resolves.toEqual({ ok: true })

        expect(messages.storeAgentLine).not.toHaveBeenCalled()
        expect(delivery.deliver).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: CONVERSATION,
            messageId: "msg-9",
            text: "Stored words",
        })
    })

    it("answers ok for a stored line that already reached the customer", async () => {
        const { service, messages, delivery } = await build()
        messages.find.mockResolvedValue({
            kind: "ok",
            value: { id: "msg-9", role: "agent", body: "Stored words", deliveryStatus: "sent" },
        })

        await expect(service.invoke("ws-1", "send", ARGS, CALLER)).resolves.toEqual({ ok: true })

        expect(delivery.deliver).not.toHaveBeenCalled()
    })
})

describe("ChatSendNativeService: refusals", () => {
    it("refuses a conversation the workspace does not have, before storing anything", async () => {
        const { service, conversations, messages } = await build()
        conversations.targetOf.mockResolvedValue({ kind: "refused", code: ChatRecordsErrorCode.NotFound })

        await expect(service.invoke("ws-1", "send", ARGS, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "not_found" },
        })
        expect(messages.storeAgentLine).not.toHaveBeenCalled()
    })

    it.each([
        [REJECTED, "connection_refused"],
        [AMBIGUOUS, "delivery_unknown"],
    ])("refuses with the reason when the channel did not take the text (%j)", async (receipt, reason) => {
        const { service, delivery } = await build()
        delivery.deliver.mockResolvedValue(receipt)

        await expect(service.invoke("ws-1", "send", ARGS, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason },
        })
    })

    it("refuses arguments that do not fit and a tool it does not have", async () => {
        const { service, delivery } = await build()

        await expect(service.invoke("ws-1", "send", { ...ARGS, text: "" }, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.InvalidArguments,
        })
        await expect(service.invoke("ws-1", "fly", {}, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.UnknownTool,
        })
        expect(delivery.deliver).not.toHaveBeenCalled()
    })
})
