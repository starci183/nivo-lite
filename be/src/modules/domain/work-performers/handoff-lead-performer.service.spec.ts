import { builder, fakeTransaction, mock, mockEntityManager, recordingEventBus } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentsService } from "@modules/domain/agents"
import { EvidenceService } from "@modules/domain/decisions"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { ContractsService } from "@modules/domain/contracts"
import { LeadRecordsService } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { PublicLeadCompletionService } from "@modules/domain/public-api"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { LeadCapturedEvent } from "@modules/events/api"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EVENT_BUS } from "@modules/platform/event-bus"
import type { BaseEvent } from "@modules/platform/event-bus"
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
    const bus = recordingEventBus<BaseEvent>()
    const tx = fakeTransaction(mockEntityManager())
    const apiCompletion = mock<PublicLeadCompletionService>()
    const contracts = mock<ContractsService>()
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
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: EVENT_BUS, useValue: bus },
            { provide: PublicLeadCompletionService, useValue: apiCompletion },
            { provide: ContractsService, useValue: contracts },
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
        bus,
        tx,
        apiCompletion,
        contracts,
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
        const { service, leads, conversations, inbound, responsibilities, evidence, bus, apiCompletion, contracts } =
            await build()

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
        expect(leads.capture).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                contactName: "Lan",
                company: "Hue Tea",
                channel: "Telegram",
                need: "50 tea boxes",
                phone: "84901234567",
                email: null,
            },
            expect.anything(),
        )
        expect(evidence.log).toHaveBeenCalledWith(
            ctx,
            {
                lead_id: "lead-1",
                work_item_id: "item-1",
                kind: "lead.captured",
                actor: "Mai",
                summary: "capturedFrom|Telegram",
                evidence: "Lan: I want 50 boxes",
            },
            expect.anything(),
        )
        expect(inbound.mark).toHaveBeenCalledWith("ws-1", "ev-1", null, "lead-1")
        expect(conversations.attachLead).toHaveBeenCalledWith("ws-1", "conv-1", "lead-1")
        expect(contracts.linkCustomers).toHaveBeenCalledWith("ws-1")
        expect(responsibilities.ensureFor).toHaveBeenCalledWith(ctx, "lead-1")
        expect(bus.writes.map((event) => event.constructor)).toEqual([LeadCapturedEvent])
        expect(apiCompletion.complete).toHaveBeenCalledWith(ctx, itemOf(), "lead-1", { summary: "s", fields }, false)
    })

    it("publishes lead_captured with the captured customer in the capturing transaction", async () => {
        const { service, bus, tx } = await build()

        await service.perform(ctx, itemOf(), { summary: "s", fields })

        expect(bus.eventsOf(LeadCapturedEvent).map((event) => event.payload)).toEqual([
            {
                dedupeKey: "lead.created:lead-1",
                workspaceId: "ws-1",
                leadId: "lead-1",
                contactName: "Lan",
                company: "Hue Tea",
                channel: "Telegram",
                need: "50 tea boxes",
                phone: "84901234567",
            },
        ])
        expect(bus.allInTransaction).toBe(true)
        expect(tx.commits).toBe(1)
    })

    it("rolls the capture back when lead_captured cannot be sent", async () => {
        const failure = new Error("bus down")
        const { service, bus, tx, inbound } = await build()
        bus.failNext("publish", failure)

        await expect(service.perform(ctx, itemOf(), { summary: "s", fields })).rejects.toBe(failure)

        expect(tx.rollbacks).toBe(1)
        expect(inbound.mark).not.toHaveBeenCalled()
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
    it("keeps the customer already linked to the work even when their name no longer matches the original input", async () => {
        const { service, leads, apiCompletion, inbound, bus } = await build()
        leads.require.mockResolvedValue(leadOf({ contact_name: "Renamed customer", phone: null, email: null }))
        const input = itemOf({ lead_id: "lead-1" })
        const proposal = { summary: "Previously linked", fields: { contact_name: "Original name", need: "tea" } }

        await expect(service.perform(ctx, input, proposal)).resolves.toMatchObject({
            summary: "leadMatched|Renamed customer",
            lead_id: "lead-1",
        })

        expect(leads.require).toHaveBeenCalledWith(ctx.workspaceId, "lead-1")
        expect(leads.match).not.toHaveBeenCalled()
        expect(leads.capture).not.toHaveBeenCalled()
        expect(bus.writes).toEqual([])
        expect(inbound.mark).toHaveBeenCalledWith(ctx.workspaceId, "ev-1", null, "lead-1")
        expect(apiCompletion.complete).toHaveBeenCalledWith(ctx, input, "lead-1", proposal, true)
    })

    it("propagates a missing workspace-scoped linked customer without rematching, capture or downstream effects", async () => {
        const { service, leads, inbound, conversations, responsibilities, evidence, bus, apiCompletion } = await build()
        const refusal = new Error("The linked customer does not belong to this workspace")
        leads.require.mockRejectedValue(refusal)

        await expect(service.perform(ctx, itemOf({ lead_id: "foreign-lead" }), { summary: "s", fields })).rejects.toBe(
            refusal,
        )

        expect(leads.require).toHaveBeenCalledWith(ctx.workspaceId, "foreign-lead")
        expect(leads.match).not.toHaveBeenCalled()
        expect(leads.capture).not.toHaveBeenCalled()
        expect(leads.fillContact).not.toHaveBeenCalled()
        expect(inbound.mark).not.toHaveBeenCalled()
        expect(conversations.attachLead).not.toHaveBeenCalled()
        expect(responsibilities.ensureFor).not.toHaveBeenCalled()
        expect(evidence.log).not.toHaveBeenCalled()
        expect(bus.writes).toEqual([])
        expect(apiCompletion.complete).not.toHaveBeenCalled()
    })
})

describe("HandoffLeadPerformerService contact enrichment", () => {
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

    it("settles the admitted API details after customer capture and propagates failure for recovery", async () => {
        const { service, apiCompletion, leads, responsibilities } = await build()
        const item = itemOf({ proposal: { summary: "API handoff", fields: { public_api_lead: "durable metadata" } } })
        apiCompletion.complete.mockRejectedValue(new Error("API settlement unavailable"))

        await expect(service.perform(ctx, item, { summary: "reviewed", fields })).rejects.toThrow(
            "API settlement unavailable",
        )

        expect(leads.capture).toHaveBeenCalled()
        expect(responsibilities.ensureFor).toHaveBeenCalledWith(ctx, "lead-1")
        expect(apiCompletion.complete).toHaveBeenCalledWith(ctx, item, "lead-1", { summary: "reviewed", fields }, false)
    })
})
