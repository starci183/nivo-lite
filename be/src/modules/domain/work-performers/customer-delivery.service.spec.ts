import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ChannelDeliveryService } from "@modules/domain/channels"
import type { RenewalNotification } from "@modules/domain/channels"
import { ChatConversationsService, ChatMessagesService, ChatRecordsErrorCode } from "@modules/domain/chat-records"
import type { ChatStoredReply } from "@modules/domain/chat-records"
import { EvidenceService } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import { ok, refused } from "@modules/platform/primitives"
import { chatTarget } from "@tests/fixtures/builders/chat-features.builder"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { PerformerKitService } from "./performer-kit.service"
import type { DeliveryContact, DeliveryCustomer } from "./work-performers.contracts"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

const customer: DeliveryCustomer = { id: "lead-1", contact_name: "Lan", channel: "zalo" }

const contactOf = builder<DeliveryContact>({ id: "lead-1", phone: null, email: null })

const targetOf = (channel: string) => ok(chatTarget({ channel }))

const storedOf = (patch: Partial<ChatStoredReply> = {}): ChatStoredReply => ({
    id: "msg-1",
    body: "Hello",
    sent: false,
    ...patch,
})

const item: WorkItem = {
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "send_quote",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "queued",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Quote", fields: { conversation_id: "conv-1" } },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    created_at: "2026-10-12T09:00:00.000Z",
    updated_at: "2026-10-12T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
}

const build = async () => {
    const kit = mock<PerformerKitService>()
    kit.text.mockImplementation((_ctx, key, params = {}) => [key, ...Object.values(params).map(String)].join("|"))
    const conversations = mock<ChatConversationsService>()
    const messages = mock<ChatMessagesService>()
    messages.storeAgentLine.mockResolvedValue(storedOf())
    const channels = mock<ChannelDeliveryService>()
    channels.deliver.mockResolvedValue({ delivered: true, outcome: "acknowledged", failure: null })
    const evidence = mock<EvidenceService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            CustomerDeliveryService,
            { provide: PerformerKitService, useValue: kit },
            { provide: ChatConversationsService, useValue: conversations },
            { provide: ChatMessagesService, useValue: messages },
            { provide: ChannelDeliveryService, useValue: channels },
            { provide: EvidenceService, useValue: evidence },
        ],
    }).compile()
    return { service: moduleRef.get(CustomerDeliveryService), conversations, messages, channels, evidence }
}

describe("CustomerDeliveryService contactOf", () => {
    it("answers the phone first, then the email, else nobody", async () => {
        const { service } = await build()

        expect(service.contactOf(contactOf({ phone: "84901", email: "a@b.vn" }))).toBe("84901")
        expect(service.contactOf(contactOf({ email: "a@b.vn" }))).toBe("a@b.vn")
        expect(service.contactOf(contactOf())).toBeNull()
    })
})

describe("CustomerDeliveryService toCustomer", () => {
    it("records that nothing was sent when the work names no conversation", async () => {
        const { service, conversations } = await build()

        await expect(service.toCustomer(ctx, customer, null, "item-1", "Hello")).resolves.toEqual({
            summary: "recordedNoConversation|zalo",
            real: false,
        })
        expect(conversations.targetOf).not.toHaveBeenCalled()
    })

    it("records that nothing was sent when the conversation is gone", async () => {
        const { service, conversations, messages } = await build()
        conversations.targetOf.mockResolvedValue(refused(ChatRecordsErrorCode.NotFound))

        await expect(service.toCustomer(ctx, customer, "conv-1", "item-1", "Hello")).resolves.toEqual({
            summary: "recordedNoConversation|zalo",
            real: false,
        })
        expect(messages.storeAgentLine).not.toHaveBeenCalled()
    })

    it("stores the message for a website chat and marks it delivered without pushing it", async () => {
        const { service, conversations, messages, channels } = await build()
        conversations.targetOf.mockResolvedValue(targetOf("website"))

        await expect(service.toCustomer(ctx, customer, "conv-1", "item-1", "Hello")).resolves.toEqual({
            summary: "deliveredWebsite|Lan",
            real: true,
        })
        expect(conversations.targetOf).toHaveBeenCalledWith("ws-1", "conv-1")
        expect(messages.storeAgentLine).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            body: "Hello",
            key: "item-1",
            human: undefined,
        })
        expect(messages.markDelivery).toHaveBeenCalledWith("ws-1", "msg-1", true)
        expect(channels.deliver).not.toHaveBeenCalled()
    })

    it("reports the channel push of a Telegram conversation", async () => {
        const { service, conversations, channels } = await build()
        conversations.targetOf.mockResolvedValue(targetOf("telegram"))

        await expect(service.toCustomer(ctx, customer, "conv-1", "item-1", "Hello")).resolves.toEqual({
            summary: "deliveredTelegram|Lan",
            real: true,
        })
        expect(channels.deliver).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            messageId: "msg-1",
            text: "Hello",
        })
    })

    it("reports a failed channel push honestly", async () => {
        const { service, conversations, channels } = await build()
        conversations.targetOf.mockResolvedValue(targetOf("telegram"))
        channels.deliver.mockResolvedValue({ delivered: false, outcome: "rejected", failure: null })

        await expect(service.toCustomer(ctx, customer, "conv-1", "item-1", "Hello")).resolves.toEqual({
            summary: "telegramFailed|Lan",
            real: false,
        })
    })
})

describe("CustomerDeliveryService toCustomer replays", () => {
    it("does not push a message an earlier attempt already delivered, and does not mark a website chat twice", async () => {
        const { service, conversations, messages, channels } = await build()
        messages.storeAgentLine.mockResolvedValue(storedOf({ sent: true }))
        conversations.targetOf.mockResolvedValueOnce(targetOf("telegram")).mockResolvedValueOnce(targetOf("website"))

        await expect(service.toCustomer(ctx, customer, "conv-1", "item-1", "Hello")).resolves.toEqual({
            summary: "deliveredTelegram|Lan",
            real: true,
        })
        await expect(service.toCustomer(ctx, customer, "conv-1", "item-1", "Hello")).resolves.toEqual({
            summary: "deliveredWebsite|Lan",
            real: true,
        })
        expect(channels.deliver).not.toHaveBeenCalled()
        expect(messages.markDelivery).not.toHaveBeenCalled()
    })
})

describe("CustomerDeliveryService inConversation", () => {
    it("pushes nothing when the conversation cannot be read", async () => {
        const { service, conversations, messages, channels } = await build()
        conversations.targetOf.mockResolvedValue(refused(ChatRecordsErrorCode.NotFound))

        await expect(service.inConversation("ws-1", "conv-1", "key-1", "Hello")).resolves.toBe(false)
        expect(messages.storeAgentLine).not.toHaveBeenCalled()
        expect(channels.deliver).not.toHaveBeenCalled()
    })

    it("stores the message under its key and answers whether the channel accepted it", async () => {
        const { service, conversations, messages } = await build()
        conversations.targetOf.mockResolvedValue(targetOf("telegram"))

        await expect(service.inConversation("ws-1", "conv-1", "key-1", "Hello")).resolves.toBe(true)
        expect(messages.storeAgentLine.mock.calls[0]?.[0].key).toBe("key-1")
    })
})

describe("CustomerDeliveryService finalInConversation", () => {
    it("stores the agent's reply once under its work item and sends it through the channel", async () => {
        const { service, conversations, messages, channels } = await build()
        conversations.targetOf.mockResolvedValue(targetOf("website"))

        await expect(service.finalInConversation("ws-1", "conv-1", "Done", "item-1")).resolves.toBe("acknowledged")
        expect(messages.storeAgentLine).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            body: "Done",
            key: "item-1",
        })
        expect(channels.deliver).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            messageId: "msg-1",
            text: "Hello",
        })
    })

    it("does not push a reply already sent, so a retry sends nothing twice", async () => {
        const { service, conversations, messages, channels } = await build()
        conversations.targetOf.mockResolvedValue(targetOf("telegram"))
        messages.storeAgentLine.mockResolvedValue(storedOf({ sent: true }))

        await expect(service.finalInConversation("ws-1", "conv-1", "Done", "item-1")).resolves.toBe("acknowledged")
        expect(channels.deliver).not.toHaveBeenCalled()
    })

    it("stores nothing for a conversation it cannot read", async () => {
        const { service, conversations, messages } = await build()
        conversations.targetOf.mockResolvedValue(refused(ChatRecordsErrorCode.NotFound))

        await expect(service.finalInConversation("ws-1", "conv-1", "Done", "item-1")).resolves.toBe("rejected")
        expect(messages.storeAgentLine).not.toHaveBeenCalled()
    })
})

describe("CustomerDeliveryService approvedInConversation", () => {
    it("stores nothing for a conversation it cannot read", async () => {
        const { service, conversations, messages } = await build()
        conversations.targetOf.mockResolvedValue(refused(ChatRecordsErrorCode.NotFound))

        await expect(service.approvedInConversation("ws-1", "conv-1", "Hello", "Mai", "item-1")).resolves.toBe(false)
        expect(messages.storeAgentLine).not.toHaveBeenCalled()
    })

    it("stores the answer under the member's name and does not push a message already sent again", async () => {
        const { service, conversations, messages, channels } = await build()
        messages.storeAgentLine.mockResolvedValue(storedOf({ sent: true }))
        conversations.targetOf.mockResolvedValue(targetOf("telegram"))

        await expect(service.approvedInConversation("ws-1", "conv-1", "Hello", "Mai", "item-1")).resolves.toBe(true)
        expect(messages.storeAgentLine).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            body: "Hello",
            key: "item-1",
            human: { name: "Mai", userId: null },
        })
        expect(channels.deliver).not.toHaveBeenCalled()
    })

    it("marks a website answer delivered without pushing it", async () => {
        const { service, conversations, messages, channels } = await build()
        conversations.targetOf.mockResolvedValue(targetOf("website"))

        await expect(service.approvedInConversation("ws-1", "conv-1", "Hello", "Mai", "item-1")).resolves.toBe(false)
        expect(messages.markDelivery).toHaveBeenCalledWith("ws-1", "msg-1", true)
        expect(channels.deliver).not.toHaveBeenCalled()
    })

    it("pushes a pending answer to the customer's channel", async () => {
        const { service, conversations, channels } = await build()
        conversations.targetOf.mockResolvedValue(targetOf("telegram"))
        channels.deliver.mockResolvedValue({ delivered: false, outcome: "rejected", failure: null })

        await expect(service.approvedInConversation("ws-1", "conv-1", "Hello", "Mai", "item-1")).resolves.toBe(false)
        expect(channels.deliver).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            messageId: "msg-1",
            text: "Hello",
        })
    })
})

describe("CustomerDeliveryService sendAndLog", () => {
    it("leaves the evidence line of its kind and reports that nothing was sent without a conversation", async () => {
        const { service, evidence } = await build()
        const unnamed: WorkItem = { ...item, proposal: { summary: "Quote", fields: {} } }

        await expect(
            service.sendAndLog(ctx, unnamed, customer, "Hello", { name: "Mai" }, "quote.sent"),
        ).resolves.toEqual({
            summary: "recordedNoConversation|zalo",
            evidence: "captured",
            href: "/leads/lead-1",
            lead_id: "lead-1",
            detail: "Hello",
        })
        expect(evidence.log).toHaveBeenCalledWith(ctx, {
            lead_id: "lead-1",
            work_item_id: "item-1",
            kind: "quote.sent",
            actor: "Mai",
            summary: "recordedNoConversation|zalo",
            evidence: "Hello",
        })
    })

    it("delivers in the conversation the proposal names", async () => {
        const { service, conversations, channels } = await build()
        conversations.targetOf.mockResolvedValue(targetOf("telegram"))

        const performed = await service.sendAndLog(ctx, item, customer, "Hello", { name: "Mai" }, "quote.sent")

        expect(performed.summary).toBe("deliveredTelegram|Lan")
        expect(conversations.targetOf).toHaveBeenCalledWith("ws-1", "conv-1")
        expect(channels.deliver).toHaveBeenCalledTimes(1)
    })
})

const renewal: RenewalNotification = {
    kind: "renewal",
    phone: "0912345678",
    fields: {
        customerName: "Lan",
        plan: "Pro",
        endDate: "2026-11-27",
        amount: 1_500_000,
        transferContent: "INV2026100001",
        invoiceNumber: "INV-202610-0001",
    },
}

const onZalo = async () => {
    const built = await build()
    built.conversations.targetOf.mockResolvedValue(targetOf("zalo"))
    return built
}

describe("CustomerDeliveryService toCustomer on Zalo", () => {
    it("passes the notice to the channel and reports a consultation message", async () => {
        const { service, channels } = await onZalo()
        channels.deliver.mockResolvedValue({
            delivered: true,
            outcome: "acknowledged",
            failure: null,
            via: "consultation",
        })

        await expect(service.toCustomer(ctx, customer, "conv-1", "item-1", "Hello", renewal)).resolves.toEqual({
            summary: "deliveredZalo|Lan",
            real: true,
        })
        expect(channels.deliver).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            messageId: "msg-1",
            text: "Hello",
            notification: renewal,
        })
    })

    it("reports a ZNS notification outside the window", async () => {
        const { service, channels } = await onZalo()
        channels.deliver.mockResolvedValue({ delivered: true, outcome: "acknowledged", failure: null, via: "zns" })

        await expect(service.toCustomer(ctx, customer, "conv-1", "item-1", "Hello", renewal)).resolves.toEqual({
            summary: "deliveredZaloZns|Lan",
            real: true,
        })
    })

    it("reports a text whose QR image did not follow", async () => {
        const { service, channels } = await onZalo()
        channels.deliver.mockResolvedValue({
            delivered: true,
            outcome: "acknowledged",
            failure: null,
            via: "consultation",
            note: "qr_image_failed",
        })

        await expect(service.toCustomer(ctx, customer, "conv-1", "item-1", "Hello")).resolves.toEqual({
            summary: "deliveredZaloNoQr|Lan",
            real: true,
        })
    })

    it("explains a refusal with its reason and the missing ZNS condition", async () => {
        const { service, channels } = await onZalo()
        channels.deliver.mockResolvedValue({
            delivered: false,
            outcome: "rejected",
            failure: "zalo_window_expired",
            note: "zns_not_configured",
        })

        await expect(service.toCustomer(ctx, customer, "conv-1", "item-1", "Hello", renewal)).resolves.toEqual({
            summary: "zaloFailed|Lan|zaloFailure.zalo_window_expired zaloNote.zns_not_configured",
            real: false,
        })
    })

    it("names a generic failure when the channel gave no reason", async () => {
        const { service, channels } = await onZalo()
        channels.deliver.mockResolvedValue({ delivered: false, outcome: "rejected", failure: null })

        await expect(service.toCustomer(ctx, customer, "conv-1", "item-1", "Hello")).resolves.toEqual({
            summary: "zaloFailed|Lan|zaloFailure.zalo_error",
            real: false,
        })
    })
})

describe("CustomerDeliveryService notices in a conversation", () => {
    it("passes the notice with a pushed agent message", async () => {
        const { service, channels } = await onZalo()

        await expect(service.inConversation("ws-1", "conv-1", "key-1", "Hello", renewal)).resolves.toBe(true)
        expect(channels.deliver).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            messageId: "msg-1",
            text: "Hello",
            notification: renewal,
        })
    })

    it("passes the notice with an approved answer", async () => {
        const { service, channels } = await onZalo()

        await expect(service.approvedInConversation("ws-1", "conv-1", "Hello", "Mai", "item-1", renewal)).resolves.toBe(
            true,
        )
        expect(channels.deliver.mock.calls[0]?.[0].notification).toBe(renewal)
    })
})
