import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentConversationsErrorCode, AgentConversationsService } from "@modules/domain/agent-conversations"
import type { ConversationTarget } from "@modules/domain/agent-conversations"
import { AgentMessagesErrorCode, AgentMessagesService } from "@modules/domain/agent-messages"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { EvidenceService } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { PerformerKitService } from "./performer-kit.service"
import type { DeliveryContact, DeliveryCustomer } from "./work-performers.contracts"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

const customer: DeliveryCustomer = { id: "lead-1", contact_name: "Lan", channel: "zalo" }

const contactOf = builder<DeliveryContact>({ id: "lead-1", phone: null, email: null })

const targetOf = (channel: string, workspaceId = "ws-1"): ConversationTarget => ({
    id: "conv-1",
    workspaceId,
    channel,
    externalId: "ext-1",
    connectionId: "conn-1",
})

const conversationOf = (channel: string) => ({ id: "conv-1", agentId: "agent-1", channel, visitorName: "Lan" })

const storedOf = (deliveryStatus: string | null): Awaited<ReturnType<AgentMessagesService["find"]>> => ({
    kind: "ok",
    value: { id: "msg-1", role: "human", body: "Hello", deliveryStatus },
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
    proposal: { summary: "Quote", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "simulated",
    created_at: "2026-10-12T09:00:00.000Z",
    updated_at: "2026-10-12T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
}

describe("CustomerDeliveryService", () => {
    const build = async () => {
        const kit = mock<PerformerKitService>()
        kit.text.mockImplementation((_ctx, key, params = {}) => [key, ...Object.values(params).map(String)].join("|"))
        const conversations = mock<AgentConversationsService>()
        const messages = mock<AgentMessagesService>()
        messages.storeAgentMessage.mockResolvedValue("msg-1")
        messages.storeHumanMessage.mockResolvedValue("msg-1")
        const channels = mock<ChannelDeliveryService>()
        channels.deliver.mockResolvedValue({ delivered: true, failure: null })
        const evidence = mock<EvidenceService>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                CustomerDeliveryService,
                { provide: PerformerKitService, useValue: kit },
                { provide: AgentConversationsService, useValue: conversations },
                { provide: AgentMessagesService, useValue: messages },
                { provide: ChannelDeliveryService, useValue: channels },
                { provide: EvidenceService, useValue: evidence },
            ],
        }).compile()
        return { service: moduleRef.get(CustomerDeliveryService), conversations, messages, channels, evidence }
    }

    describe("contactOf", () => {
        it("answers the phone first, then the email", async () => {
            const { service, conversations } = await build()

            await expect(service.contactOf("ws-1", contactOf({ phone: "84901", email: "a@b.vn" }))).resolves.toBe(
                "84901",
            )
            await expect(service.contactOf("ws-1", contactOf({ email: "a@b.vn" }))).resolves.toBe("a@b.vn")
            expect(conversations.latestOfLead).not.toHaveBeenCalled()
        })

        it("answers website when the customer only chats on the site, else null", async () => {
            const { service, conversations } = await build()
            conversations.latestOfLead.mockResolvedValueOnce(conversationOf("website")).mockResolvedValueOnce(null)

            await expect(service.contactOf("ws-1", contactOf())).resolves.toBe("website")
            await expect(service.contactOf("ws-1", contactOf())).resolves.toBeNull()
            expect(conversations.latestOfLead).toHaveBeenCalledWith("ws-1", "lead-1", null)
        })
    })

    describe("toCustomer", () => {
        it("records simulated work without delivering it", async () => {
            const { service, conversations } = await build()

            await expect(service.toCustomer(ctx, customer, "Hello", "simulated")).resolves.toEqual({
                summary: "simulatedDelivery|zalo",
                real: false,
            })
            expect(conversations.latestOfLead).not.toHaveBeenCalled()
        })

        it("records a simulation when the customer has no conversation", async () => {
            const { service, conversations } = await build()
            conversations.latestOfLead.mockResolvedValue(null)

            await expect(service.toCustomer(ctx, customer, "Hello")).resolves.toEqual({
                summary: "simulatedDelivery|zalo",
                real: false,
            })
        })

        it("stores the message for a website chat without pushing it", async () => {
            const { service, conversations, messages, channels } = await build()
            conversations.latestOfLead.mockResolvedValue(conversationOf("website"))
            conversations.targetOf.mockResolvedValue({ kind: "ok", value: targetOf("website") })

            await expect(service.toCustomer(ctx, customer, "Hello", "live")).resolves.toEqual({
                summary: "deliveredWebsite|Lan",
                real: true,
            })
            expect(messages.storeAgentMessage).toHaveBeenCalledWith("ws-1", "conv-1", "Hello")
            expect(channels.deliver).not.toHaveBeenCalled()
        })

        it("reports the channel push of a Telegram conversation", async () => {
            const { service, conversations, channels } = await build()
            conversations.latestOfLead.mockResolvedValue(conversationOf("telegram"))
            conversations.targetOf.mockResolvedValue({ kind: "ok", value: targetOf("telegram") })

            await expect(service.toCustomer(ctx, customer, "Hello")).resolves.toEqual({
                summary: "deliveredTelegram|Lan",
                real: true,
            })
            expect(channels.deliver).toHaveBeenCalledWith({
                conversationId: "conv-1",
                messageId: "msg-1",
                text: "Hello",
            })
        })

        it("reports a failed channel push honestly", async () => {
            const { service, conversations, channels } = await build()
            conversations.latestOfLead.mockResolvedValue(conversationOf("telegram"))
            conversations.targetOf.mockResolvedValue({ kind: "ok", value: targetOf("telegram") })
            channels.deliver.mockResolvedValue({ delivered: false, failure: null })

            await expect(service.toCustomer(ctx, customer, "Hello")).resolves.toEqual({
                summary: "telegramFailed|Lan",
                real: false,
            })
        })
    })

    describe("inConversation", () => {
        it("pushes nothing when the conversation cannot be read", async () => {
            const { service, conversations, messages, channels } = await build()
            conversations.targetOf.mockResolvedValue({ kind: "refused", code: AgentConversationsErrorCode.NotFound })

            await expect(service.inConversation("ws-1", "conv-1", "Hello")).resolves.toBe(false)
            expect(messages.storeAgentMessage).toHaveBeenCalledWith("ws-1", "conv-1", "Hello")
            expect(channels.deliver).not.toHaveBeenCalled()
        })
    })

    describe("approvedInConversation", () => {
        it("stores nothing for a conversation it cannot read or of another workspace", async () => {
            const { service, conversations, messages } = await build()
            conversations.targetOf
                .mockResolvedValueOnce({ kind: "refused", code: AgentConversationsErrorCode.NotFound })
                .mockResolvedValueOnce({ kind: "ok", value: targetOf("telegram", "ws-2") })

            await expect(service.approvedInConversation("ws-1", "conv-1", "Hello", "Mai", "item-1")).resolves.toBe(
                false,
            )
            await expect(service.approvedInConversation("ws-1", "conv-1", "Hello", "Mai", "item-1")).resolves.toBe(
                false,
            )
            expect(messages.storeHumanMessage).not.toHaveBeenCalled()
        })

        it("does not push a message already sent again", async () => {
            const { service, conversations, messages, channels } = await build()
            conversations.targetOf
                .mockResolvedValueOnce({ kind: "ok", value: targetOf("telegram") })
                .mockResolvedValueOnce({ kind: "ok", value: targetOf("website") })
            messages.find.mockResolvedValue(storedOf("sent"))

            await expect(service.approvedInConversation("ws-1", "conv-1", "Hello", "Mai", "item-1")).resolves.toBe(true)
            await expect(service.approvedInConversation("ws-1", "conv-1", "Hello", "Mai", "item-1")).resolves.toBe(
                false,
            )
            expect(messages.storeHumanMessage).toHaveBeenCalledWith(
                "ws-1",
                "conv-1",
                "Hello",
                "Mai",
                undefined,
                "item-1",
            )
            expect(channels.deliver).not.toHaveBeenCalled()
        })

        it("marks a website answer delivered without pushing it", async () => {
            const { service, conversations, messages, channels } = await build()
            conversations.targetOf.mockResolvedValue({ kind: "ok", value: targetOf("website") })
            messages.find.mockResolvedValue(storedOf(null))

            await expect(service.approvedInConversation("ws-1", "conv-1", "Hello", "Mai", "item-1")).resolves.toBe(
                false,
            )
            expect(messages.markDelivery).toHaveBeenCalledWith("msg-1", true)
            expect(channels.deliver).not.toHaveBeenCalled()
        })

        it("pushes a pending answer to the customer's channel", async () => {
            const { service, conversations, messages, channels } = await build()
            conversations.targetOf.mockResolvedValue({ kind: "ok", value: targetOf("telegram") })
            messages.find.mockResolvedValue({ kind: "refused", code: AgentMessagesErrorCode.NotFound })
            channels.deliver.mockResolvedValue({ delivered: false, failure: null })

            await expect(service.approvedInConversation("ws-1", "conv-1", "Hello", "Mai", "item-1")).resolves.toBe(
                false,
            )
            expect(channels.deliver).toHaveBeenCalledWith({
                conversationId: "conv-1",
                messageId: "msg-1",
                text: "Hello",
            })
        })
    })

    describe("sendAndLog", () => {
        it("delivers, leaves the evidence line of its kind and reports what was done", async () => {
            const { service, evidence } = await build()

            await expect(
                service.sendAndLog(ctx, item, customer, "Hello", { name: "Mai" }, "quote.sent"),
            ).resolves.toEqual({
                summary: "simulatedDelivery|zalo",
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
                summary: "simulatedDelivery|zalo",
                evidence: "Hello",
            })
        })
    })
})
