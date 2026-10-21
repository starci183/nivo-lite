import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentsService } from "@modules/domain/agents"
import { BusinessEventsService } from "@modules/domain/automations"
import { EvidenceService } from "@modules/domain/decisions"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { LeadRecordsService } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { HandoffLeadPerformerService } from "./handoff-lead-performer.service"
import { PerformerKitService } from "./performer-kit.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

const fields: Proposal["fields"] = {
    contact_name: "Lan",
    company: "Hue Tea",
    need: "50 tea boxes",
    contact: "0901234567",
    channel_label: "Telegram",
    conversation_id: "conv-1",
    transcript: "Lan: I want 50 boxes",
}

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "chatbot",
    action: "handoff_lead",
    subject_type: "conversation",
    subject_id: "conv-1",
    lead_id: null,
    inbound_event_id: "ev-1",
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "queued",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Hand Lan over", fields },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    created_at: "2026-10-12T09:00:00.000Z",
    updated_at: "2026-10-12T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const leadOf = builder<LeadRecordRow>({
    id: "lead-1",
    workspace_id: "ws-1",
    contact_name: "Lan",
    company: "Hue Tea",
    channel: "Telegram",
    need: "50 tea boxes",
    stage: "new",
    context_summary: null,
    phone: "84901234567",
    email: null,
})

const build = async () => {
    const kit = mock<PerformerKitService>()
    kit.text.mockImplementation((_ctx, key, params = {}) => [key, ...Object.values(params).map(String)].join("|"))
    kit.department.mockResolvedValue("Chatbot")
    const leads = mock<LeadRecordsService>()
    leads.match.mockResolvedValue(null)
    leads.capture.mockResolvedValue(leadOf())
    const agents = mock<AgentsService>()
    agents.agentOfDepartment.mockResolvedValue({ id: "agent-1", name: "Mai" })
    const conversations = mock<AgentConversationsService>()
    const inbound = mock<InboundEventsService>()
    const responsibilities = mock<ResponsibilityJournalService>()
    const evidence = mock<EvidenceService>()
    const events = mock<BusinessEventsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            HandoffLeadPerformerService,
            { provide: PerformerKitService, useValue: kit },
            { provide: LeadRecordsService, useValue: leads },
            { provide: AgentsService, useValue: agents },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: InboundEventsService, useValue: inbound },
            { provide: ResponsibilityJournalService, useValue: responsibilities },
            { provide: EvidenceService, useValue: evidence },
            { provide: BusinessEventsService, useValue: events },
        ],
    }).compile()
    return {
        service: moduleRef.get(HandoffLeadPerformerService),
        leads,
        agents,
        conversations,
        inbound,
        responsibilities,
        evidence,
        events,
    }
}

describe("HandoffLeadPerformerService", () => {
    it("prepares the summary the owner reads", async () => {
        const { service } = await build()

        await expect(service.prepare(ctx, itemOf())).resolves.toEqual({
            proposal: { summary: "handoffSummary|Lan|50 tea boxes", fields },
        })
    })
})

describe("HandoffLeadPerformerService perform", () => {
    it("captures a new customer, logs the capture and ties the input and the conversation to them", async () => {
        const { service, leads, conversations, inbound, responsibilities, evidence, events } = await build()

        await expect(service.perform(ctx, itemOf(), { summary: "s", fields })).resolves.toEqual({
            summary: "handoffDone|Lan",
            evidence: "captured",
            href: "/leads/lead-1",
            lead_id: "lead-1",
        })
        expect(leads.match).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            phone: "84901234567",
            email: null,
            name: "Lan",
            channel: "Telegram",
        })
        expect(leads.capture).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            contactName: "Lan",
            company: "Hue Tea",
            channel: "Telegram",
            need: "50 tea boxes",
            phone: "84901234567",
            email: null,
        })
        expect(evidence.log).toHaveBeenCalledWith(ctx, {
            lead_id: "lead-1",
            work_item_id: "item-1",
            kind: "lead.captured",
            actor: "Mai",
            summary: "capturedFrom|Telegram",
            evidence: "Lan: I want 50 boxes",
        })
        expect(inbound.mark).toHaveBeenCalledWith("ws-1", "ev-1", null, "lead-1")
        expect(conversations.attachLead).toHaveBeenCalledWith("ws-1", "conv-1", "lead-1")
        expect(responsibilities.ensureFor).toHaveBeenCalledWith(ctx, "lead-1")
        expect(events.leadCreated).toHaveBeenCalledWith("ws-1", leadOf())
    })

    it("fills in the blanks of a new customer who shared little", async () => {
        const { service, leads, agents, conversations, inbound, evidence } = await build()
        agents.agentOfDepartment.mockResolvedValue(null)
        const sparse = { contact_name: "Lan", need: "tea", email: "Lan@HueTea.vn" }

        await service.perform(ctx, itemOf({ inbound_event_id: null }), { summary: "s", fields: sparse })

        expect(leads.capture.mock.calls[0]?.[0]).toMatchObject({
            company: "notShared",
            channel: "—",
            phone: null,
            email: "lan@huetea.vn",
        })
        expect(evidence.log.mock.calls[0]?.[1]).toMatchObject({ actor: "Chatbot", evidence: null })
        expect(inbound.mark).not.toHaveBeenCalled()
        expect(conversations.attachLead).not.toHaveBeenCalled()
    })
})

describe("HandoffLeadPerformerService perform", () => {
    it("matches a known customer and fills the contact they lacked", async () => {
        const { service, leads, evidence } = await build()
        leads.match.mockResolvedValue(leadOf({ phone: null, email: "lan@huetea.vn" }))

        await expect(service.perform(ctx, itemOf(), { summary: "s", fields })).resolves.toMatchObject({
            summary: "leadMatched|Lan",
            lead_id: "lead-1",
        })
        expect(leads.capture).not.toHaveBeenCalled()
        expect(evidence.log).not.toHaveBeenCalled()
        expect(leads.fillContact).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            leadId: "lead-1",
            phone: "84901234567",
            email: null,
        })
    })

    it("fills the email a known customer lacked", async () => {
        const { service, leads } = await build()
        leads.match.mockResolvedValue(leadOf())

        await service.perform(ctx, itemOf(), { summary: "s", fields: { ...fields, email: "lan@huetea.vn" } })

        expect(leads.fillContact.mock.calls[0]?.[0].email).toBe("lan@huetea.vn")
    })

    it("leaves a known customer with a full contact as it is", async () => {
        const { service, leads } = await build()
        leads.match.mockResolvedValue(leadOf({ email: "lan@huetea.vn" }))

        await service.perform(ctx, itemOf(), { summary: "s", fields: { ...fields, email: "lan@huetea.vn" } })
        await service.perform(ctx, itemOf(), { summary: "s", fields: { ...fields, contact: null } })

        expect(leads.fillContact).not.toHaveBeenCalled()
    })
})
