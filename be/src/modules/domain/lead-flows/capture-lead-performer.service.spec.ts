import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { BusinessEventsService } from "@modules/domain/automations"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { WorkContext, WorkItem, WorkPerformerRegistry } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { LeadRecordsService } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { CaptureLeadPerformerService } from "./capture-lead-performer.service"
import { LeadFlowsError, LeadFlowsErrorCode } from "./errors/lead-flows.error"
import { LeadFlowConversationService } from "./lead-flow-conversation.service"
import { LeadFlowKitService } from "./lead-flow-kit.service"
import { LeadFlowMetaService } from "./lead-flow-meta.service"
import { LeadFlowStoreService } from "./lead-flow-store.service"
import { EMPTY_SIGNALS } from "./lead-flow-score.policy"
import type { LeadFlow, LeadSource } from "./lead-flows.contracts"

const NOW = "2026-10-12T10:00:00.000Z"
const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

const flowOf = builder<LeadFlow>({
    id: "flow-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    connection_id: "connection-1",
    conversation_id: "conv-1",
    platform: "facebook",
    psid: "person-1",
    igsid: null,
    phone: null,
    email: null,
    name: "Lan",
    state: "new",
    resume_state: null,
    source: null,
    touches: [],
    answers: [],
    asked: 0,
    pending_question: null,
    contact_asked_at: null,
    signals: EMPTY_SIGNALS,
    score: null,
    score_reasons: [],
    scored_at: null,
    analysis: null,
    last_user_at: null,
    last_user_text: null,
    greeted_at: null,
    handed_off_at: null,
    followed_up_at: null,
    closed_at: null,
    escalated_at: null,
    escalation_reason: null,
})

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "lead_gen",
    action: "greet_prospect",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "chain-1",
    depth: 1,
    status: "queued",
    decided_path: "auto",
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: NOW,
    updated_at: NOW,
    completed_at: null,
    installation_id: null,
})

const leadOf = builder<LeadRecordRow>({
    id: "lead-1",
    workspace_id: "ws-1",
    contact_name: "Lan",
    company: "Hue Tea",
    channel: "Lead Ads",
    need: "want tea",
    stage: "new",
    context_summary: null,
    phone: "84912345678",
    email: null,
    origin: "live",
})

const SOURCE: LeadSource = {
    platform: "facebook",
    kind: "leadgen",
    post_id: null,
    ad_id: null,
    form_id: "form-1",
    comment_id: null,
    leadgen_id: null,
    referral: null,
    at: NOW,
}

const fields = {
    source_kind: "leadgen",
    platform: "facebook",
    form_id: "form-1",
    contact_name: "Lan",
    phone: "0912345678",
    connection_id: "connection-1",
    text: "want tea",
}

const build = async (flow: LeadFlow = flowOf({ phone: "84912345678", psid: null })) => {
    const registry = mock<WorkPerformerRegistry>()
    const store = mock<LeadFlowStoreService>()
    const meta = mock<LeadFlowMetaService>()
    const transcript = mock<LeadFlowConversationService>()
    const kit = mock<LeadFlowKitService>({
        store,
        meta,
        transcript,
    })
    kit.text.mockImplementation((_locale, key) => key)
    kit.nameOf.mockReturnValue("Lan")
    kit.now.mockReturnValue(NOW)
    kit.done.mockImplementation((summary, done, detail = null) => ({
        summary,
        evidence: "captured",
        lead_id: done?.lead_id ?? null,
        detail,
    }))
    kit.metaRefused.mockImplementation(
        (failure) =>
            new LeadFlowsError({ code: LeadFlowsErrorCode.MetaRefused, params: { failure: failure ?? "error" } }),
    )
    store.requireByLead.mockResolvedValue(flow)
    kit.sourceLine.mockReturnValue("Facebook form")
    const leads = mock<LeadRecordsService>()
    const inbound = mock<InboundEventsService>()
    const responsibilities = mock<ResponsibilityJournalService>()
    const events = mock<BusinessEventsService>()
    store.candidates.mockResolvedValue([])
    store.byLead.mockResolvedValue(null)
    store.open.mockResolvedValue(flow)
    store.patch.mockResolvedValue(flow)
    const moduleRef = await Test.createTestingModule({
        providers: [
            CaptureLeadPerformerService,
            { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
            { provide: LeadFlowKitService, useValue: kit },
            { provide: LeadRecordsService, useValue: leads },
            { provide: InboundEventsService, useValue: inbound },
            { provide: ResponsibilityJournalService, useValue: responsibilities },
            { provide: BusinessEventsService, useValue: events },
        ],
    }).compile()
    return {
        performer: moduleRef.get(CaptureLeadPerformerService),
        registry,
        kit,
        store,
        leads,
        inbound,
        responsibilities,
        events,
    }
}

describe("CaptureLeadPerformerService", () => {
    it("registers capture_lead at boot and summarises where the lead came from", async () => {
        const { performer, registry, kit } = await build()

        performer.onModuleInit()

        expect(registry.add).toHaveBeenCalledWith("capture_lead", performer)
        await expect(performer.prepare(ctx, itemOf({ proposal: { summary: "", fields } }))).resolves.toEqual({
            proposal: { summary: "capture.summary", fields },
        })
        expect(kit.sourceLine).toHaveBeenCalledWith("en", SOURCE)
    })

    it("creates a new lead, opens its flow and links the inbound event", async () => {
        const { performer, store, leads, inbound, responsibilities, events } = await build()
        leads.match.mockResolvedValue(null)
        leads.capture.mockResolvedValue(leadOf())

        await expect(
            performer.perform(ctx, itemOf({ inbound_event_id: "event-1" }), { summary: "", fields }),
        ).resolves.toMatchObject({ summary: "capture.done", lead_id: "lead-1" })

        expect(leads.capture).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            contactName: "Lan",
            company: "not-shared",
            channel: "channel.lead-ads",
            need: "want tea",
            phone: "84912345678",
            email: null,
            origin: "live",
        })
        expect(responsibilities.ensureFor).toHaveBeenCalledWith(ctx, "lead-1")
        expect(events.leadCreated).toHaveBeenCalledWith("ws-1", leadOf(), "live")
        expect(store.open).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            leadId: "lead-1",
            connectionId: "connection-1",
            platform: "facebook",
            identity: { psid: null, igsid: null, phone: "84912345678", email: null },
            name: "Lan",
            source: SOURCE,
            lastUserAt: null,
            lastUserText: null,
        })
        expect(inbound.mark).toHaveBeenCalledWith("ws-1", "event-1", null, "lead-1")
    })

    it("merges a known lead, fills its missing contact and keeps the touch", async () => {
        const flow = flowOf({ phone: "84912345678", psid: null })
        const { performer, store, leads, events, kit } = await build(flow)
        leads.match.mockResolvedValue(leadOf({ phone: null }))
        store.byLead.mockResolvedValue(flow)

        await expect(performer.perform(ctx, itemOf(), { summary: "", fields })).resolves.toMatchObject({
            summary: "capture.merged",
        })

        expect(leads.fillContact).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            leadId: "lead-1",
            phone: "84912345678",
            email: null,
        })
        expect(leads.capture).not.toHaveBeenCalled()
        expect(events.leadCreated).not.toHaveBeenCalled()
        expect(store.open).not.toHaveBeenCalled()
        expect(store.patch).toHaveBeenCalledWith(flow, { touches: [SOURCE] })
        expect(kit.log).toHaveBeenCalledWith(
            ctx,
            { lead_id: "lead-1" },
            "item-1",
            "lead.touch",
            "capture.touch",
            "want tea",
        )
    })

    it("refuses when the flow can neither be opened nor found again", async () => {
        const { performer, store, leads } = await build()
        leads.match.mockResolvedValue(leadOf())
        store.open.mockResolvedValue(null)

        await expect(performer.perform(ctx, itemOf(), { summary: "", fields })).rejects.toEqual(
            new LeadFlowsError({ code: LeadFlowsErrorCode.NotStored }),
        )

        expect(store.patch).not.toHaveBeenCalled()
    })
})
