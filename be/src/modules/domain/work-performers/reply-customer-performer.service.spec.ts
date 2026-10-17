import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { PerformerKitService } from "./performer-kit.service"
import { ReplyCustomerPerformerService } from "./reply-customer-performer.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "chatbot",
    action: "reply_customer",
    subject_type: "conversation",
    subject_id: "conv-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "waiting_decision",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Answer the price question", draft: "It is 30k a box", fields: { conversation_id: "conv-1" } },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-12T09:00:00.000Z",
    updated_at: "2026-10-12T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const proposalOf = builder<Proposal>({
    summary: "Answer the price question",
    draft: "It is 30k a box",
    fields: { conversation_id: "conv-1" },
})

const build = async () => {
    const kit = mock<PerformerKitService>()
    kit.text.mockImplementation((_ctx, key, params = {}) => [key, ...Object.values(params).map(String)].join("|"))
    const delivery = mock<CustomerDeliveryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ReplyCustomerPerformerService,
            { provide: PerformerKitService, useValue: kit },
            { provide: CustomerDeliveryService, useValue: delivery },
        ],
    }).compile()
    return { service: moduleRef.get(ReplyCustomerPerformerService), delivery }
}

describe("ReplyCustomerPerformerService", () => {
    it("prepares the proposal it was given", async () => {
        const { service } = await build()
        const item = itemOf()

        await expect(service.prepare(ctx, item)).resolves.toEqual({ proposal: item.proposal })
    })

    it("records a simulated reply without delivering it", async () => {
        const { service, delivery } = await build()

        await expect(service.perform(ctx, itemOf({ origin: "simulated" }), proposalOf())).resolves.toEqual({
            summary: "simulatedDelivery|website",
            evidence: "captured",
            href: "/leads/lead-1",
            lead_id: "lead-1",
            detail: "It is 30k a box",
        })
        expect(delivery.inConversation).not.toHaveBeenCalled()
    })

    it("stores the answer under the deciding member's name and reports the channel push", async () => {
        const { service, delivery } = await build()
        delivery.approvedInConversation.mockResolvedValue(true)

        await expect(service.perform(ctx, itemOf(), proposalOf(), { name: "Mai", kind: "staff" })).resolves.toEqual({
            summary: "replyPostedTelegram",
            evidence: "captured",
            href: "/leads/lead-1",
            lead_id: "lead-1",
            detail: "It is 30k a box",
        })
        expect(delivery.approvedInConversation).toHaveBeenCalledWith(
            "ws-1",
            "conv-1",
            "It is 30k a box",
            "Mai",
            "item-1",
        )
    })

    it("stores the answer as the agent when no person decided it", async () => {
        const { service, delivery } = await build()
        delivery.inConversation.mockResolvedValue(false)

        const performed = await service.perform(ctx, itemOf(), proposalOf(), { name: "NIVO engine" })

        expect(performed.summary).toBe("replyPosted")
        expect(delivery.inConversation).toHaveBeenCalledWith("ws-1", "conv-1", "It is 30k a box")
        expect(delivery.approvedInConversation).not.toHaveBeenCalled()
    })

    it("stores the answer as the agent when nobody is named", async () => {
        const { service, delivery } = await build()
        delivery.inConversation.mockResolvedValue(true)

        await expect(service.perform(ctx, itemOf(), proposalOf())).resolves.toMatchObject({
            summary: "replyPostedTelegram",
        })
    })
})

describe("ReplyCustomerPerformerService", () => {
    it("pushes nothing when the proposal names no conversation or has no draft", async () => {
        const { service, delivery } = await build()

        const withoutConversation = await service.perform(ctx, itemOf({ lead_id: null }), proposalOf({ fields: {} }))
        const withoutDraft = await service.perform(ctx, itemOf(), proposalOf({ draft: "" }))

        expect(withoutConversation).toEqual({
            summary: "replyPosted",
            evidence: "captured",
            href: "/chat",
            lead_id: null,
            detail: "It is 30k a box",
        })
        expect(withoutDraft.summary).toBe("replyPosted")
        expect(delivery.inConversation).not.toHaveBeenCalled()
    })

    it("logs no detail when the proposal has no draft", async () => {
        const { service } = await build()

        const performed = await service.perform(ctx, itemOf(), { summary: "s", fields: { conversation_id: "conv-1" } })

        expect(performed.detail).toBeNull()
        expect(performed.summary).toBe("replyPosted")
    })

    it("captures a simulated reply without a draft or a lead", async () => {
        const { service, delivery } = await build()

        await expect(
            service.perform(ctx, itemOf({ origin: "simulated", lead_id: null }), { summary: "s", fields: {} }),
        ).resolves.toEqual({
            summary: "simulatedDelivery|website",
            evidence: "captured",
            href: "/chat",
            lead_id: null,
            detail: null,
        })
        expect(delivery.inConversation).not.toHaveBeenCalled()
        expect(delivery.approvedInConversation).not.toHaveBeenCalled()
    })

    it("stores an owner's approval even when the channel does not push it", async () => {
        const { service, delivery } = await build()
        delivery.approvedInConversation.mockResolvedValue(false)

        await expect(service.perform(ctx, itemOf(), proposalOf(), { name: "Lan", kind: "owner" })).resolves.toEqual({
            summary: "replyPosted",
            evidence: "captured",
            href: "/leads/lead-1",
            lead_id: "lead-1",
            detail: "It is 30k a box",
        })
        expect(delivery.approvedInConversation).toHaveBeenCalledWith(
            "ws-1",
            "conv-1",
            "It is 30k a box",
            "Lan",
            "item-1",
        )
        expect(delivery.inConversation).not.toHaveBeenCalled()
    })
})

describe("ReplyCustomerPerformerService", () => {
    it("stores a named policy actor's reply as the agent", async () => {
        const { service, delivery } = await build()
        const actor = { name: "NIVO policy", kind: "policy" }
        delivery.inConversation.mockResolvedValue(true)

        await expect(service.perform(ctx, itemOf(), proposalOf(), actor)).resolves.toEqual({
            summary: "replyPostedTelegram",
            evidence: "captured",
            href: "/leads/lead-1",
            lead_id: "lead-1",
            detail: "It is 30k a box",
        })
        expect(delivery.inConversation).toHaveBeenCalledWith("ws-1", "conv-1", "It is 30k a box")
        expect(delivery.approvedInConversation).not.toHaveBeenCalled()
    })
})
