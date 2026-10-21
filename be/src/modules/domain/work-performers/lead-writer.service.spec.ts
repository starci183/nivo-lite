import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentConversationsErrorCode, AgentConversationsService } from "@modules/domain/agent-conversations"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import type { LeadDraft, ToolContext } from "@modules/domain/agent-tools"
import { CommandBusService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LeadWriterService } from "./lead-writer.service"

const ctx: ToolContext = { jobId: "job-1", workspaceId: "ws-1", conversationId: "conv-1" }

const draft: LeadDraft = { contactName: "Lan", need: "50 tea boxes", company: null, contact: "0901234567" }

const turnOf = (leadId: string | null): TurnConversation => ({
    id: "conv-1",
    workspaceId: "ws-1",
    channel: "telegram",
    externalId: "ext-1",
    connectionId: "conn-1",
    leadId,
    handledBy: null,
    visitorName: "Lan",
    installationId: null,
    agent: {
        id: "agent-1",
        name: "Mai",
        handle: "mai",
        role: "chatbot",
        module: "chatbot",
        instructions: "Be brief",
        knowledge: "",
        approvalRule: "",
        greeting: "Hello",
    },
})

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "chatbot",
    action: "handoff_lead",
    subject_type: "conversation",
    subject_id: "conv-1",
    lead_id: "lead-9",
    inbound_event_id: "ev-1",
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "done",
    decided_path: "auto",
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Hand Lan to Sales", fields: {} },
    result: null,
    error: null,
    evidence_state: "captured",
    assigned_staff_id: null,
    execution_id: null,
    created_at: "2026-10-12T09:00:00.000Z",
    updated_at: "2026-10-12T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const build = async () => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key) => `label of ${key}`)
    const conversations = mock<AgentConversationsService>()
    conversations.turnOf.mockResolvedValue({ kind: "ok", value: turnOf(null) })
    const inbound = mock<InboundEventsService>()
    inbound.recordInput.mockResolvedValue({ duplicate: false, inboundEventId: "ev-1" })
    const bus = mock<CommandBusService>()
    bus.sendCommandItem.mockResolvedValue(itemOf())
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadWriterService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: InboundEventsService, useValue: inbound },
            { provide: CommandBusService, useValue: bus },
        ],
    }).compile()
    return { writer: moduleRef.get(LeadWriterService), conversations, inbound, bus }
}

describe("LeadWriterService", () => {
    it("records the input, hands the lead to Sales and ties the conversation to it", async () => {
        const { writer, conversations, inbound, bus } = await build()

        await expect(writer.createOrUpdate(ctx, draft)).resolves.toEqual({ leadId: "lead-9", status: "done" })

        expect(inbound.recordInput).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            channel: "telegram",
            kind: "lead",
            senderName: "Lan",
            senderContact: "0901234567",
            body: "50 tea boxes",
            externalRef: "conv-1",
            eventId: "engine:job-1:lead",
        })
        expect(bus.sendCommandItem).toHaveBeenCalledWith(
            { workspaceId: "ws-1", actor: "NIVO engine", locale: "vi" },
            {
                from: "inbound",
                to: "chatbot",
                command: "handoff_lead",
                reason: "the agent captured a lead",
                inboundEventId: "ev-1",
                dedupeKey: "handoff_lead:conversation:conv-1",
                payload: {
                    subject_type: "conversation",
                    subject_id: "conv-1",
                    contact_name: "Lan",
                    company: "",
                    need: "50 tea boxes",
                    contact: "0901234567",
                    channel_label: "label of performers.channel.telegram",
                    conversation_id: "conv-1",
                },
            },
        )
        expect(conversations.rename).toHaveBeenCalledWith("conv-1", "Lan")
        expect(conversations.attachLead).toHaveBeenCalledWith("ws-1", "conv-1", "lead-9")
    })

    it("answers the gate's status and ties nothing when the handoff waits for the owner", async () => {
        const { writer, conversations, bus } = await build()
        bus.sendCommandItem.mockResolvedValue(itemOf({ lead_id: null, status: "waiting_decision" }))

        await expect(writer.createOrUpdate(ctx, { ...draft, company: "Hue Tea" })).resolves.toEqual({
            leadId: null,
            status: "waiting_decision",
        })

        expect(bus.sendCommandItem.mock.calls[0]?.[1].payload?.company).toBe("Hue Tea")
        expect(conversations.attachLead).not.toHaveBeenCalled()
    })

    it("answers unavailable when the conversation cannot be read", async () => {
        const { writer, conversations, inbound } = await build()
        conversations.turnOf.mockResolvedValue({ kind: "refused", code: AgentConversationsErrorCode.NotFound })

        await expect(writer.createOrUpdate(ctx, draft)).resolves.toEqual({ leadId: null, status: "unavailable" })

        expect(inbound.recordInput).not.toHaveBeenCalled()
    })
})

describe("LeadWriterService", () => {
    it("keeps the lead a conversation is already tied to", async () => {
        const { writer, conversations, inbound } = await build()
        conversations.turnOf.mockResolvedValue({ kind: "ok", value: turnOf("lead-1") })

        await expect(writer.createOrUpdate(ctx, draft)).resolves.toEqual({ leadId: "lead-1", status: "exists" })

        expect(inbound.recordInput).not.toHaveBeenCalled()
    })

    it("answers duplicate when the same tool call was recorded before", async () => {
        const { writer, inbound, bus } = await build()
        inbound.recordInput.mockResolvedValue({ duplicate: true, inboundEventId: "ev-1" })

        await expect(writer.createOrUpdate(ctx, draft)).resolves.toEqual({ leadId: null, status: "duplicate" })

        expect(bus.sendCommandItem).not.toHaveBeenCalled()
    })
})
