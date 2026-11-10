import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ChatConversationsService, ChatMessagesService, ChatRecordsErrorCode } from "@modules/domain/chat-records"
import type { ChatConversationTarget } from "@modules/domain/chat-records"
import { McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import { ChannelCustomerProfileService } from "./channel-customer-profile.service"
import { ChannelDeliveryService } from "./channel-delivery.service"
import type { DeliveryReceipt } from "./channels.contracts"
import { CHAT_MANIFEST, ChatSendNativeService } from "./chat-send-native.service"

const CALLER = { agentId: "agent-1", conversationId: null }
const CONVERSATION = "11111111-1111-4111-8111-111111111111"
const MESSAGE = "22222222-2222-4222-8222-222222222222"
const ARGS = { conversationId: CONVERSATION, text: "Xin chao", key: "work-1" }
const STORED_ARGS = { ...ARGS, key: MESSAGE }
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
    conversations.humansOf.mockResolvedValue([{ ...TARGET, leadId: null, handledBy: null }])
    const messages = mock<ChatMessagesService>()
    messages.find.mockResolvedValue({ kind: "refused", code: ChatRecordsErrorCode.NotFound })
    messages.storeAgentLine.mockResolvedValue({ id: "msg-1", body: "Xin chao", sent: false })
    const delivery = mock<ChannelDeliveryService>()
    delivery.deliver.mockResolvedValue(DELIVERED)
    const customers = mock<ChannelCustomerProfileService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatSendNativeService,
            { provide: ChatConversationsService, useValue: conversations },
            { provide: ChatMessagesService, useValue: messages },
            { provide: ChannelDeliveryService, useValue: delivery },
            { provide: ChannelCustomerProfileService, useValue: customers },
        ],
    }).compile()
    return { service: moduleRef.get(ChatSendNativeService), conversations, messages, delivery, customers }
}

describe("ChatSendNativeService", () => {
    it("announces two internal tools: a write that plays nivo.chat.send and takes its replay key, and a read that plays nivo.chat.profile.get", () => {
        expect(CHAT_MANIFEST.key).toBe("chat")
        expect(CHAT_MANIFEST.tools.map((tool) => [tool.name, tool.scope, tool.domain, tool.internalOnly])).toEqual([
            ["send", "write", "nivo.chat.send", true],
            ["profile.get", "read", "nivo.chat.profile.get", true],
        ])
        expect(CHAT_MANIFEST.tools[0]?.idempotencyArg).toBe("key")
    })

    it("stores the line once under its key, delivers it and answers ok", async () => {
        const { service, conversations, messages, delivery } = await build()

        await expect(service.invoke("ws-1", "send", ARGS, CALLER)).resolves.toEqual({ ok: true })

        expect(conversations.humansOf).toHaveBeenCalledWith("ws-1", [CONVERSATION])
        expect(messages.find).not.toHaveBeenCalled()
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

})

describe("ChatSendNativeService: stored lines", () => {
    it("says the stored line when the key is the id of one of the conversation, and stores nothing twice", async () => {
        const { service, messages, delivery } = await build()
        messages.find.mockResolvedValue({
            kind: "ok",
            value: { id: "msg-9", role: "agent", body: "Stored words", deliveryStatus: null },
        })

        await expect(service.invoke("ws-1", "send", STORED_ARGS, CALLER)).resolves.toEqual({ ok: true })

        expect(messages.find).toHaveBeenCalledWith("ws-1", CONVERSATION, MESSAGE)
        expect(messages.storeAgentLine).not.toHaveBeenCalled()
        expect(delivery.deliver).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: CONVERSATION,
            messageId: "msg-9",
            text: "Stored words",
        })
    })

    it("delivers a person's stored line in a conversation the person holds", async () => {
        const { service, conversations, messages, delivery } = await build()
        conversations.humansOf.mockResolvedValue([{ ...TARGET, leadId: null, handledBy: "Thu Ha" }])
        messages.find.mockResolvedValue({
            kind: "ok",
            value: { id: "msg-9", role: "agent", body: "Stored words", deliveryStatus: null },
        })

        await expect(service.invoke("ws-1", "send", STORED_ARGS, CALLER)).resolves.toEqual({ ok: true })

        expect(delivery.deliver).toHaveBeenCalled()
    })

    it("answers ok for a stored line that already reached the customer", async () => {
        const { service, messages, delivery } = await build()
        messages.find.mockResolvedValue({
            kind: "ok",
            value: { id: "msg-9", role: "agent", body: "Stored words", deliveryStatus: "sent" },
        })

        await expect(service.invoke("ws-1", "send", STORED_ARGS, CALLER)).resolves.toEqual({ ok: true })

        expect(delivery.deliver).not.toHaveBeenCalled()
    })
})

describe("ChatSendNativeService: profile", () => {
    it("answers the name and picture the channel says of the customer of the conversation", async () => {
        const { service, conversations, customers } = await build()
        customers.profileOf.mockResolvedValue({ name: "Minh", avatarUrl: "https://zalo.test/a.png" })

        await expect(service.invoke("ws-1", "profile.get", { conversationId: CONVERSATION }, CALLER)).resolves.toEqual({
            name: "Minh",
            avatarUrl: "https://zalo.test/a.png",
        })

        expect(conversations.targetOf).toHaveBeenCalledWith("ws-1", CONVERSATION)
        expect(customers.profileOf).toHaveBeenCalledWith(TARGET)
    })

    it("refuses a conversation the workspace does not have, a channel that cannot say and arguments that do not fit", async () => {
        const { service, conversations, customers } = await build()
        customers.profileOf.mockResolvedValue(null)

        await expect(service.invoke("ws-1", "profile.get", { conversationId: CONVERSATION }, CALLER)).rejects.toMatchObject(
            { code: McpGatewayErrorCode.NativeRefused, params: { reason: "profile_unavailable" } },
        )
        await expect(service.invoke("ws-1", "profile.get", { conversationId: "x" }, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.InvalidArguments,
        })
        conversations.targetOf.mockResolvedValue({ kind: "refused", code: ChatRecordsErrorCode.NotFound })
        await expect(service.invoke("ws-1", "profile.get", { conversationId: CONVERSATION }, CALLER)).rejects.toMatchObject(
            { code: McpGatewayErrorCode.NativeRefused, params: { reason: "not_found" } },
        )
    })
})

describe("ChatSendNativeService: refusals", () => {
    it("refuses a job's own notice while a person holds the conversation, before storing anything", async () => {
        const { service, conversations, messages, delivery } = await build()
        conversations.humansOf.mockResolvedValue([{ ...TARGET, leadId: null, handledBy: "Thu Ha" }])

        await expect(service.invoke("ws-1", "send", ARGS, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "held_by_person" },
        })
        expect(messages.storeAgentLine).not.toHaveBeenCalled()
        expect(delivery.deliver).not.toHaveBeenCalled()
    })

    it("refuses a conversation the workspace does not have, before storing anything", async () => {
        const { service, conversations, messages } = await build()
        conversations.humansOf.mockResolvedValue([])

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
