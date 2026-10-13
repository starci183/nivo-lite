import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentBindingsService, PURPOSES } from "@modules/domain/agent-connections"
import type { BoundAgent } from "@modules/domain/agent-connections"
import { AgentConversationsErrorCode, AgentConversationsService } from "@modules/domain/agent-conversations"
import type { ConversationTarget } from "@modules/domain/agent-conversations"
import { AgentsService } from "@modules/domain/agents"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { OutboundAccessService } from "./outbound-access.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "vi" }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "reply_customer",
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
    proposal: { summary: "Reply", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-12T09:00:00.000Z",
    updated_at: "2026-10-12T09:00:00.000Z",
    completed_at: null,
    installation_id: "inst-1",
})

const proposalOf = (conversationId?: Proposal["fields"][string]): Proposal => ({
    summary: "Reply",
    fields: conversationId === undefined ? {} : { conversation_id: conversationId },
})

const targetOf = (connectionId: string | null): ConversationTarget => ({
    id: "conv-1",
    workspaceId: "ws-1",
    channel: "zalo",
    externalId: "ext-1",
    connectionId,
})

const grantOf = (id: string, access: BoundAgent["access"]): BoundAgent => ({
    id,
    module: "sales",
    name: id,
    access,
    purpose: "outbound_chat",
})

describe("OutboundAccessService", () => {
    const build = async () => {
        const conversations = mock<AgentConversationsService>()
        const bindings = mock<AgentBindingsService>()
        const agents = mock<AgentsService>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                OutboundAccessService,
                { provide: AgentConversationsService, useValue: conversations },
                { provide: AgentBindingsService, useValue: bindings },
                { provide: AgentsService, useValue: agents },
            ],
        }).compile()
        return { access: moduleRef.get(OutboundAccessService), conversations, bindings, agents }
    }

    it("uses the access of the department agent on the conversation named in the proposal", async () => {
        const { access, conversations, bindings, agents } = await build()
        conversations.targetOf.mockResolvedValue({ kind: "ok", value: targetOf("conn-1") })
        bindings.agentsFor.mockResolvedValue([grantOf("other", "auto"), grantOf("agent-1", "read")])
        agents.agentOfDepartment.mockResolvedValue({ id: "agent-1", name: "Mai" })

        await expect(access.accessOf(ctx, itemOf(), proposalOf("conv-named"))).resolves.toBe("read")

        expect(conversations.targetOf).toHaveBeenCalledWith("conv-named")
        expect(conversations.latestOfLead).not.toHaveBeenCalled()
        expect(bindings.agentsFor).toHaveBeenCalledWith("conn-1", PURPOSES)
        expect(agents.agentOfDepartment).toHaveBeenCalledWith("ws-1", "sales", "inst-1")
    })

    it("reads a numeric conversation id as its digits", async () => {
        const { access, conversations } = await build()
        conversations.targetOf.mockResolvedValue({ kind: "refused", code: AgentConversationsErrorCode.NotFound })

        await expect(access.accessOf(ctx, itemOf(), proposalOf(0))).resolves.toBe("auto")

        expect(conversations.targetOf).toHaveBeenCalledWith("0")
    })

    it("uses the conversation the item is about when the proposal names none", async () => {
        const { access, conversations, bindings, agents } = await build()
        conversations.targetOf.mockResolvedValue({ kind: "ok", value: targetOf("conn-2") })
        bindings.agentsFor.mockResolvedValue([grantOf("agent-2", "ask")])
        agents.agentOfDepartment.mockResolvedValue({ id: "agent-2", name: "Mai" })
        const item = itemOf({ subject_type: "conversation", subject_id: "conv-subject", installation_id: null })

        await expect(access.accessOf(ctx, item, proposalOf(null))).resolves.toBe("ask")

        expect(conversations.targetOf).toHaveBeenCalledWith("conv-subject")
        expect(agents.agentOfDepartment).toHaveBeenCalledWith("ws-1", "sales", null)
    })

    it("uses the customer's latest conversation when the item is not a conversation", async () => {
        const { access, conversations, bindings, agents } = await build()
        conversations.latestOfLead.mockResolvedValue({
            id: "conv-latest",
            agentId: "agent-1",
            channel: "zalo",
            visitorName: "Lan",
        })
        conversations.targetOf.mockResolvedValue({ kind: "ok", value: targetOf("conn-3") })
        bindings.agentsFor.mockResolvedValue([grantOf("agent-9", "auto")])
        agents.agentOfDepartment.mockResolvedValue({ id: "agent-missing", name: "Mai" })

        await expect(access.accessOf(ctx, itemOf({ subject_id: null }), proposalOf(""))).resolves.toBe("auto")

        expect(conversations.latestOfLead).toHaveBeenCalledWith("ws-1", "lead-1", null)
        expect(conversations.targetOf).toHaveBeenCalledWith("conv-latest")
    })

    it("acts alone when the customer has no conversation", async () => {
        const { access, conversations } = await build()
        conversations.latestOfLead.mockResolvedValue(null)

        await expect(access.accessOf(ctx, itemOf(), proposalOf())).resolves.toBe("auto")

        expect(conversations.latestOfLead).toHaveBeenCalledWith("ws-1", "lead-1", null)
        expect(conversations.targetOf).not.toHaveBeenCalled()
    })

    it("acts alone when there is no lead and no conversation", async () => {
        const { access, conversations } = await build()
        const item = itemOf({ subject_type: "conversation", subject_id: null, lead_id: null })

        await expect(access.accessOf(ctx, item, proposalOf())).resolves.toBe("auto")

        expect(conversations.latestOfLead).not.toHaveBeenCalled()
        expect(conversations.targetOf).not.toHaveBeenCalled()
    })

    it("acts alone when the conversation has no connection", async () => {
        const { access, conversations, bindings } = await build()
        conversations.targetOf.mockResolvedValue({ kind: "ok", value: targetOf(null) })

        await expect(access.accessOf(ctx, itemOf(), proposalOf("conv-1"))).resolves.toBe("auto")

        expect(bindings.agentsFor).not.toHaveBeenCalled()
    })

    it("acts alone when nothing is bound to the connection", async () => {
        const { access, conversations, bindings, agents } = await build()
        conversations.targetOf.mockResolvedValue({ kind: "ok", value: targetOf("conn-1") })
        bindings.agentsFor.mockResolvedValue([])

        await expect(access.accessOf(ctx, itemOf(), proposalOf("conv-1"))).resolves.toBe("auto")

        expect(agents.agentOfDepartment).not.toHaveBeenCalled()
    })

    it("uses the strongest grant when the department has no agent", async () => {
        const { access, conversations, bindings, agents } = await build()
        conversations.targetOf.mockResolvedValue({ kind: "ok", value: targetOf("conn-1") })
        bindings.agentsFor.mockResolvedValue([grantOf("a", "read"), grantOf("b", "ask"), grantOf("c", "read")])
        agents.agentOfDepartment.mockResolvedValue(null)

        await expect(access.accessOf(ctx, itemOf(), proposalOf("conv-1"))).resolves.toBe("ask")
    })

    it("uses the strongest grant when the department agent is not bound", async () => {
        const { access, conversations, bindings, agents } = await build()
        conversations.targetOf.mockResolvedValue({ kind: "ok", value: targetOf("conn-1") })
        bindings.agentsFor.mockResolvedValue([grantOf("a", "ask"), grantOf("b", "auto")])
        agents.agentOfDepartment.mockResolvedValue({ id: "missing", name: "Mai" })

        await expect(access.accessOf(ctx, itemOf(), proposalOf("conv-1"))).resolves.toBe("auto")
    })
})
