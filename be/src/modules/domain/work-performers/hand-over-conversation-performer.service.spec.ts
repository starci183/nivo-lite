import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AgentConversationsErrorCode, AgentConversationsService } from "@modules/domain/agent-conversations"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import { ConversationHandoverService } from "@modules/domain/agent-conversations"
import { AgentsService } from "@modules/domain/agents"
import type { AgentProfile } from "@modules/domain/agents"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { WorkPerformersErrorCode } from "./errors/work-performers.error"
import { HandOverConversationPerformerService } from "./hand-over-conversation-performer.service"
import { PerformerKitService } from "./performer-kit.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

const fields: Proposal["fields"] = { conversation_id: "conv-1", to: "care", note: "booking confirmed" }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "chatbot",
    action: "hand_over_conversation",
    subject_type: "conversation",
    subject_id: "conv-1",
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
    proposal: { summary: "Hand the conversation to AI Care", fields },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    created_at: "2026-10-12T09:00:00.000Z",
    updated_at: "2026-10-12T09:00:00.000Z",
    completed_at: null,
    installation_id: "inst-1",
})

const CONVERSATION: TurnConversation = {
    id: "conv-1",
    workspaceId: "ws-1",
    channel: "zalo",
    externalId: "z1",
    connectionId: "conn",
    leadId: "lead-1",
    handledBy: null,
    visitorName: "Lan",
    installationId: "inst-1",
    agent: {
        id: "sales",
        name: "AI Sales",
        handle: "ai-sales",
        role: "",
        module: "chatbot",
        instructions: "",
        knowledge: "",
        approvalRule: "",
        greeting: "",
    },
    speaksAs: null,
}

const CARE: AgentProfile = {
    id: "care-1",
    module: "chatbot",
    name: "AI Care",
    handle: "ai-care",
    role: "",
    instructions: "",
    knowledge: "",
    approval_rule: "",
}

const build = async (
    options: {
        turn?: { kind: "ok"; value: TurnConversation } | { kind: "refused"; code: AgentConversationsErrorCode }
        target?: AgentProfile | null
        moved?: boolean
    } = {},
) => {
    const kit = mock<PerformerKitService>()
    kit.text.mockImplementation((_ctx, key, params = {}) => [key, ...Object.values(params).map(String)].join("|"))
    const agents = mock<AgentsService>({
        profileByReference: jest.fn().mockResolvedValue(options.target === undefined ? CARE : options.target),
    })
    const conversations = mock<AgentConversationsService>({
        turnOf: jest.fn().mockResolvedValue(options.turn ?? { kind: "ok", value: CONVERSATION }),
    })
    const handover = mock<ConversationHandoverService>({ handOver: jest.fn().mockResolvedValue(options.moved ?? true) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            HandOverConversationPerformerService,
            { provide: PerformerKitService, useValue: kit },
            { provide: AgentsService, useValue: agents },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: ConversationHandoverService, useValue: handover },
        ],
    }).compile()
    return { service: moduleRef.get(HandOverConversationPerformerService), kit, agents, conversations, handover }
}

describe("HandOverConversationPerformerService.prepare", () => {
    it("keeps the proposal the road that held the hand-over preset", async () => {
        const { service } = await build()
        const item = itemOf()

        await expect(service.prepare(ctx, item)).resolves.toEqual({ proposal: item.proposal })
    })
})

describe("HandOverConversationPerformerService.perform", () => {
    it("moves the conversation to the agent the proposal names, through the one hand-over door, and says so", async () => {
        const { service, agents, conversations, handover } = await build()
        const item = itemOf()

        await expect(service.perform(ctx, item, item.proposal)).resolves.toEqual({
            summary: "handedOver|AI Care",
            evidence: "captured",
            lead_id: "lead-1",
        })

        expect(conversations.turnOf).toHaveBeenCalledWith("conv-1")
        expect(agents.profileByReference).toHaveBeenCalledWith("ws-1", "care")
        expect(handover.handOver).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            fromAgentId: "sales",
            toAgentId: "care-1",
            reason: "booking confirmed",
        })
    })

    it("hands over with an empty reason when the proposal gives none", async () => {
        const { service, handover } = await build()
        const item = itemOf()

        await service.perform(ctx, item, { summary: "Hand over", fields: { conversation_id: "conv-1", to: "care" } })

        expect(handover.handOver).toHaveBeenCalledWith(expect.objectContaining({ reason: "" }))
    })

    it.each([
        ["a conversation that is gone", { turn: { kind: "refused", code: AgentConversationsErrorCode.NotFound } }],
        ["an agent that is gone", { target: null }],
        [
            "a conversation of another workspace",
            { turn: { kind: "ok", value: { ...CONVERSATION, workspaceId: "other" } } },
        ],
        ["a conversation that did not move", { moved: false }],
    ] as const)("refuses the approval, moving nothing it claims, for %s", async (_label, options) => {
        const { service } = await build(options)
        const item = itemOf()

        await expect(service.perform(ctx, item, item.proposal)).rejects.toEqual(
            expect.objectContaining({ code: WorkPerformersErrorCode.ApprovalInvalid, params: { item: "item-1" } }),
        )
    })

    it("does not hand the conversation over when the agent or the conversation is refused", async () => {
        const { service, handover } = await build({ target: null })
        const item = itemOf()

        await expect(service.perform(ctx, item, item.proposal)).rejects.toBeDefined()

        expect(handover.handOver).not.toHaveBeenCalled()
    })
})
