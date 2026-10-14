import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import type { AgentProfile } from "@modules/domain/agents"
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
import type { FlowFields } from "./lead-flow-fields.policy"
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
    leads.capture.mockResolvedValue(leadOf())
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
        transcript,
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

    const captured = { summary: "capture.done", evidence: "captured", lead_id: "lead-1", detail: null }
    const merged = { ...captured, summary: "capture.merged" }

    it("uses source defaults without identity, and explicit details with email identity", async () => {
        const { performer, leads, kit } = await build()
        leads.capture.mockResolvedValue(leadOf())
        leads.match.mockResolvedValue(null)
        await expect(performer.prepare(ctx, itemOf())).resolves.toEqual({
            proposal: { summary: "capture.summary", fields: {} },
        })
        expect(kit.text).toHaveBeenCalledWith("en", "capture.summary", {
            name: "guest.facebook",
            source: "Facebook form",
        })
        await expect(performer.perform(ctx, itemOf(), { summary: "", fields: {} })).resolves.toEqual(captured)
        expect(leads.match).not.toHaveBeenCalled()
        expect(leads.capture).toHaveBeenLastCalledWith({
            workspaceId: "ws-1",
            contactName: "guest.facebook",
            company: "not-shared",
            channel: "channel.lead-ads",
            need: "Facebook form",
            phone: null,
            email: null,
            origin: "live",
        })
        expect(kit.log).toHaveBeenCalledWith(
            ctx,
            { lead_id: "lead-1" },
            "item-1",
            "lead.captured",
            "capture.created",
            "want tea",
        )
        const incoming = {
            contact_name: "Minh",
            company: "Tea Shop",
            channel_label: "Owner channel",
            need: "Owner need",
            email: "minh@example.com",
        }
        await expect(performer.perform(ctx, itemOf(), { summary: "", fields: incoming })).resolves.toEqual(captured)
        expect(leads.capture).toHaveBeenLastCalledWith({
            workspaceId: "ws-1",
            contactName: "Minh",
            company: "Tea Shop",
            channel: "Owner channel",
            need: "Owner need",
            phone: null,
            email: "minh@example.com",
            origin: "live",
        })
        expect(leads.match).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            phone: null,
            email: "minh@example.com",
            name: null,
            channel: null,
            origin: "live",
        })
    })

    it("uses the matching flow's existing lead and preserves its completed contact", async () => {
        const flow = flowOf({ phone: "84912345678", psid: null, email: "minh@example.com" })
        const { performer, store, leads } = await build(flow)
        store.candidates.mockResolvedValue([flow])
        leads.find.mockResolvedValue(leadOf({ email: "minh@example.com" }))
        await expect(
            performer.perform(ctx, itemOf(), { summary: "", fields: { ...fields, email: "minh@example.com" } }),
        ).resolves.toEqual(merged)
        expect(leads.find).toHaveBeenCalledWith("ws-1", "lead-1")
        expect(leads.match).not.toHaveBeenCalled()
        expect(leads.fillContact).not.toHaveBeenCalled()
        expect(store.byLead).not.toHaveBeenCalled()
        expect(store.open).not.toHaveBeenCalled()
    })

    it("links an unassigned matching flow and fills its missing email and metadata", async () => {
        const flow = flowOf({
            lead_id: null,
            phone: "84912345678",
            psid: null,
            platform: null,
            name: null,
            connection_id: null,
        })
        const { performer, store, leads } = await build(flow)
        store.candidates.mockResolvedValue([flow])
        leads.match.mockResolvedValue(leadOf())
        await expect(
            performer.perform(ctx, itemOf(), { summary: "", fields: { ...fields, email: "minh@example.com" } }),
        ).resolves.toEqual({ ...merged, lead_id: null })
        expect(leads.find).not.toHaveBeenCalled()
        expect(leads.fillContact).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            leadId: "lead-1",
            phone: "84912345678",
            email: "minh@example.com",
        })
        expect(store.patch).toHaveBeenCalledWith(flow, {
            email: "minh@example.com",
            touches: [SOURCE],
            lead_id: "lead-1",
            connection_id: "connection-1",
            platform: "facebook",
            name: "Lan",
        })
    })

    it("matches email when a flow's previous lead is missing and metadata is absent", async () => {
        const flow = flowOf({ psid: null, email: "minh@example.com", name: null, connection_id: null })
        const { performer, store, leads } = await build(flow)
        store.candidates.mockResolvedValue([flow])
        leads.find.mockResolvedValue(null)
        leads.match.mockResolvedValue(leadOf({ email: "minh@example.com" }))
        const incoming = { email: "minh@example.com" }
        await expect(performer.perform(ctx, itemOf(), { summary: "", fields: incoming })).resolves.toEqual(merged)
        expect(leads.match).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            phone: null,
            email: "minh@example.com",
            name: null,
            channel: null,
            origin: "live",
        })
        expect(leads.fillContact).not.toHaveBeenCalled()
        expect(store.patch).toHaveBeenCalledWith(flow, { touches: [{ ...SOURCE, form_id: null }] })
    })

    it.each<readonly [LeadSource["kind"], LeadSource["platform"], string, string, string, string | null]>([
        ["dm", "facebook", "person-1", "", "attachment", "conv-1"],
        ["dm", "instagram", "instagram-1", "want tea", "want tea", null],
        ["comment", "facebook", "comment-1", "", "", "conv-1"],
    ])("records a %s transcript on %s", async (kind, platform, person, text, body, conversationId) => {
        const flow = flowOf({
            platform,
            psid: platform === "facebook" ? person : null,
            igsid: platform === "instagram" ? person : null,
        })
        const { performer, store, transcript } = await build(flow)
        const agent = mock<AgentProfile>({ id: "agent-1" })
        transcript.leadGenAgent.mockResolvedValue(agent)
        transcript.ensure.mockResolvedValue(conversationId)
        const commentId = kind === "comment" ? person : null
        const source: LeadSource = { ...SOURCE, kind, platform, form_id: null, comment_id: commentId }
        const incoming = {
            source_kind: kind,
            platform,
            psid: flow.psid,
            igsid: flow.igsid,
            comment_id: commentId,
            text,
        }
        await expect(performer.perform(ctx, itemOf(), { summary: "", fields: incoming })).resolves.toEqual(captured)
        expect(store.open).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            leadId: "lead-1",
            connectionId: null,
            platform,
            identity: { psid: flow.psid, igsid: flow.igsid, phone: null, email: null },
            name: null,
            source,
            lastUserAt: kind === "dm" ? NOW : null,
            lastUserText: kind === "dm" ? text : null,
        })
        expect(store.patch).toHaveBeenCalledWith(flow, {
            touches: [source],
            ...(kind === "dm" ? { last_user_at: NOW, last_user_text: text } : {}),
        })
        expect(transcript.leadGenAgent).toHaveBeenCalledWith("ws-1", "connection-1")
        expect(transcript.ensure).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            flow,
            externalId: kind === "comment" ? "comment:comment-1" : person,
            agentId: "agent-1",
        })
        expect(transcript.say).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId,
            role: "user",
            body,
            delivery: null,
        })
        expect(store.patch.mock.calls).toHaveLength(conversationId === null ? 1 : 2)
        if (conversationId !== null) expect(store.patch).toHaveBeenCalledWith(flow, { conversation_id: conversationId })
    })

    it.each<readonly [string, string | null, boolean]>([
        ["dm", "person-1", false],
        ["dm", null, true],
        ["comment", "person-1", true],
    ])("keeps %s flows without an agent or usable thread identity", async (kind, person, hasAgent) => {
        const flow = flowOf({ psid: person })
        const { performer, store, transcript } = await build(flow)
        const agent = mock<AgentProfile>({ id: "agent-1" })
        transcript.leadGenAgent.mockResolvedValue(hasAgent ? agent : null)
        await expect(performer.perform(ctx, itemOf(), { summary: "", fields: { source_kind: kind } })).resolves.toEqual(
            captured,
        )
        expect(transcript.ensure).not.toHaveBeenCalled()
        expect(transcript.say).not.toHaveBeenCalled()
        expect(store.patch).toHaveBeenCalledTimes(1)
    })

    it.each<{ identity: FlowFields; concurrent: LeadFlow }>([
        { identity: {}, concurrent: flowOf() },
        { identity: { psid: "messenger-1" }, concurrent: flowOf({ lead_id: "other-lead", psid: "messenger-1" }) },
        {
            identity: { igsid: "instagram-1" },
            concurrent: flowOf({ lead_id: "other-lead", psid: null, igsid: "instagram-1" }),
        },
    ])("uses a concurrent flow matching the lead or platform identity: $identity", async ({ identity, concurrent }) => {
        const { performer, store, leads } = await build()
        leads.capture.mockResolvedValue(leadOf())
        store.open.mockResolvedValue(null)
        store.candidates.mockResolvedValueOnce([])
        store.candidates.mockResolvedValueOnce([
            flowOf({ lead_id: "unrelated", psid: "different", igsid: "different" }),
            concurrent,
        ])
        await expect(performer.perform(ctx, itemOf(), { summary: "", fields: identity })).resolves.toEqual(captured)
        expect(store.candidates).toHaveBeenCalledTimes(2)
        expect(store.patch).toHaveBeenCalledWith(concurrent, { touches: [{ ...SOURCE, form_id: null }] })
    })
})
