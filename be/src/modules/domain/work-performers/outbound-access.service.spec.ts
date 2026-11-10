import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentsService } from "@modules/domain/agents"
import { ChatConversationsService, ChatRecordsErrorCode } from "@modules/domain/chat-records"
import type { ChatConversationTarget } from "@modules/domain/chat-records"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { ProviderAbilitiesService } from "@modules/domain/mcp-gateway"
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
    created_at: "2026-10-12T09:00:00.000Z",
    updated_at: "2026-10-12T09:00:00.000Z",
    completed_at: null,
    installation_id: "inst-1",
})

const proposalOf = (conversationId?: Proposal["fields"][string]): Proposal => ({
    summary: "Reply",
    fields: conversationId === undefined ? {} : { conversation_id: conversationId },
})

const targetOf = (connectionId: string | null): ChatConversationTarget => ({
    id: "conv-1",
    workspaceId: "ws-1",
    channel: "zalo",
    externalId: "ext-1",
    connectionId,
})

const build = async () => {
    const conversations = mock<ChatConversationsService>()
    const agents = mock<AgentsService>()
    const abilities = mock<ProviderAbilitiesService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            OutboundAccessService,
            { provide: ChatConversationsService, useValue: conversations },
            { provide: AgentsService, useValue: agents },
            { provide: ProviderAbilitiesService, useValue: abilities },
        ],
    }).compile()
    return { access: moduleRef.get(OutboundAccessService), conversations, agents, abilities }
}

const verdictOf = (kind: "allow" | "approval") => ({ kind, provider: "zalo_oa", ability: "customer.send", connectionId: "conn-1" })

describe("OutboundAccessService: the department agent's attachment to the conversation's account decides", () => {
    it("runs alone when the attachment allows customer.send on that account (judged on the account, never a binding level)", async () => {
        const { access, conversations, agents, abilities } = await build()
        conversations.targetOf.mockResolvedValue({ kind: "ok", value: targetOf("conn-1") })
        agents.agentOfDepartment.mockResolvedValue({ id: "agent-1", name: "Mai" })
        abilities.judge.mockResolvedValue(verdictOf("allow"))

        await expect(access.accessOf(ctx, itemOf(), proposalOf("conv-named"))).resolves.toBe("auto")

        expect(conversations.targetOf).toHaveBeenCalledWith("ws-1", "conv-named")
        expect(agents.agentOfDepartment).toHaveBeenCalledWith("ws-1", "sales", "inst-1")
        expect(abilities.judge).toHaveBeenCalledWith("ws-1", "agent-1", "nivo.lead.message.send", false, {
            provider: "zalo_oa",
            connectionId: "conn-1",
        })
    })

    it("asks a person when the attachment asks for approval", async () => {
        const { access, conversations, agents, abilities } = await build()
        conversations.targetOf.mockResolvedValue({ kind: "ok", value: targetOf("conn-1") })
        agents.agentOfDepartment.mockResolvedValue({ id: "agent-1", name: "Mai" })
        abilities.judge.mockResolvedValue(verdictOf("approval"))

        await expect(access.accessOf(ctx, itemOf(), proposalOf("conv-1"))).resolves.toBe("ask")
    })

    it("asks a person when the agent holds no such right on that account (refused)", async () => {
        const { access, conversations, agents, abilities } = await build()
        conversations.targetOf.mockResolvedValue({ kind: "ok", value: targetOf("conn-1") })
        agents.agentOfDepartment.mockResolvedValue({ id: "agent-1", name: "Mai" })
        abilities.judge.mockResolvedValue({ kind: "refuse", reason: "not_attached" } as never)

        await expect(access.accessOf(ctx, itemOf(), proposalOf("conv-1"))).resolves.toBe("ask")
    })

    it("runs alone on a channel with no provider (website chat: the send is no provider right)", async () => {
        const { access, conversations, agents, abilities } = await build()
        conversations.targetOf.mockResolvedValue({ kind: "ok", value: { ...targetOf("conn-web"), channel: "web" } })
        agents.agentOfDepartment.mockResolvedValue({ id: "agent-1", name: "Mai" })
        abilities.judge.mockResolvedValue(null)

        await expect(access.accessOf(ctx, itemOf(), proposalOf("conv-1"))).resolves.toBe("auto")
    })

    it("asks a person when the department has no agent", async () => {
        const { access, conversations, agents, abilities } = await build()
        conversations.targetOf.mockResolvedValue({ kind: "ok", value: targetOf("conn-1") })
        agents.agentOfDepartment.mockResolvedValue(null)

        await expect(access.accessOf(ctx, itemOf(), proposalOf("conv-1"))).resolves.toBe("ask")
        expect(abilities.judge).not.toHaveBeenCalled()
    })

    it("reads a numeric conversation id as its digits", async () => {
        const { access, conversations } = await build()
        conversations.targetOf.mockResolvedValue({ kind: "refused", code: ChatRecordsErrorCode.NotFound })

        await expect(access.accessOf(ctx, itemOf(), proposalOf(0))).resolves.toBe("auto")

        expect(conversations.targetOf).toHaveBeenCalledWith("ws-1", "0")
    })

    it("uses the conversation the item is about when the proposal names none", async () => {
        const { access, conversations, agents, abilities } = await build()
        conversations.targetOf.mockResolvedValue({ kind: "ok", value: targetOf("conn-2") })
        agents.agentOfDepartment.mockResolvedValue({ id: "agent-2", name: "Mai" })
        abilities.judge.mockResolvedValue(verdictOf("allow"))
        const item = itemOf({ subject_type: "conversation", subject_id: "conv-subject", installation_id: null })

        await expect(access.accessOf(ctx, item, proposalOf(null))).resolves.toBe("auto")

        expect(conversations.targetOf).toHaveBeenCalledWith("ws-1", "conv-subject")
        expect(agents.agentOfDepartment).toHaveBeenCalledWith("ws-1", "sales", null)
    })

    it("acts alone when the work names no conversation, the conversation is gone or it has no connection", async () => {
        const { access, conversations, abilities } = await build()
        await expect(access.accessOf(ctx, itemOf(), proposalOf())).resolves.toBe("auto")
        conversations.targetOf.mockResolvedValueOnce({ kind: "refused", code: ChatRecordsErrorCode.NotFound })
        await expect(access.accessOf(ctx, itemOf(), proposalOf("conv-1"))).resolves.toBe("auto")
        conversations.targetOf.mockResolvedValueOnce({ kind: "ok", value: targetOf(null) })
        await expect(access.accessOf(ctx, itemOf(), proposalOf("conv-1"))).resolves.toBe("auto")
        expect(abilities.judge).not.toHaveBeenCalled()
    })
})
