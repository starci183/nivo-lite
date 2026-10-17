import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { WorkContext, WorkItem, WorkPerformerRegistry } from "@modules/domain/decisions"
import { LeadRecordsService } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { LeadFlowsError, LeadFlowsErrorCode } from "./errors/lead-flows.error"
import { HandoffToSalesPerformerService } from "./handoff-to-sales-performer.service"
import { LeadFlowConversationService } from "./lead-flow-conversation.service"
import { LeadFlowKitService } from "./lead-flow-kit.service"
import { LeadFlowMetaService } from "./lead-flow-meta.service"
import { LeadFlowStoreService } from "./lead-flow-store.service"
import { EMPTY_SIGNALS } from "./lead-flow-score.policy"
import type { LeadFlow } from "./lead-flows.contracts"

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

const hotFlow = flowOf({
    state: "scored",
    score: "hot",
    score_reasons: ["asked price"],
    phone: "84912345678",
    signals: { ...EMPTY_SIGNALS, need: "Wholesale tea" },
})

const leadOf = builder<LeadRecordRow>({
    id: "lead-1",
    workspace_id: "ws-1",
    contact_name: "Minh",
    company: "Hue Tea",
    channel: "Lead Ads",
    need: "Recorded need",
    stage: "new",
    context_summary: null,
    phone: null,
    email: null,
    origin: "live",
})

const build = async (flow: LeadFlow = hotFlow) => {
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
    const leads = mock<LeadRecordsService>()
    kit.sourceLine.mockReturnValue("Facebook dm")
    const moduleRef = await Test.createTestingModule({
        providers: [
            HandoffToSalesPerformerService,
            { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
            { provide: LeadFlowKitService, useValue: kit },
            { provide: LeadRecordsService, useValue: leads },
        ],
    }).compile()
    return { performer: moduleRef.get(HandoffToSalesPerformerService), registry, kit, store, leads }
}

describe("HandoffToSalesPerformerService", () => {
    it("registers handoff_to_sales at boot", async () => {
        const { performer, registry } = await build()

        performer.onModuleInit()

        expect(registry.add).toHaveBeenCalledWith("handoff_to_sales", performer)
    })
    it("lets a hot lead go on its own with the contact and need the gate requires", async () => {
        const { performer, store, leads } = await build()
        store.byLead.mockResolvedValue(hotFlow)
        leads.find.mockResolvedValue(null)

        await expect(performer.prepare(ctx, itemOf())).resolves.toEqual({
            proposal: {
                summary: "handoff.hot",
                fields: { contact: "84912345678", need: "Wholesale tea", score: "hot" },
            },
        })

        expect(leads.find).toHaveBeenCalledWith("ws-1", "lead-1")
    })
    it("leaves a lead that is not hot unclear to the gate so a person decides", async () => {
        const { performer, store, kit } = await build()
        store.byLead.mockResolvedValue(null)
        const item = itemOf({ lead_id: null, proposal: { summary: "", fields: { score: "warm" } } })

        await expect(performer.prepare(ctx, item)).resolves.toEqual({
            proposal: { summary: "handoff.ask", outcome: "unclear", fields: { contact: "", need: "", score: "warm" } },
        })

        expect(kit.text).toHaveBeenCalledWith("en", "handoff.ask", { name: "", level: "level.warm" })
    })
    it("writes the package as the brief for Sales, closes the bot's part and logs the hand-off", async () => {
        const { performer, kit, store, leads } = await build()
        const pack = "Wholesale tea\nlabel.score: hot (asked price)\nlabel.source: Facebook dm"

        await expect(
            performer.perform(ctx, itemOf(), { summary: "", fields: { need: "Wholesale tea" } }),
        ).resolves.toMatchObject({ summary: "handoff.done", lead_id: "lead-1" })

        expect(leads.handOver).toHaveBeenCalledWith("ws-1", "lead-1", pack)
        expect(store.patch).toHaveBeenCalledWith(hotFlow, {
            state: "handed_off",
            handed_off_at: NOW,
            pending_question: null,
        })
        expect(kit.log).toHaveBeenCalledWith(ctx, hotFlow, "item-1", "lead_gen.handoff", "handoff.evidence", pack)
    })
    it("refuses a lead without a flow", async () => {
        const { performer, store, leads } = await build()
        store.requireByLead.mockRejectedValue(new LeadFlowsError({ code: LeadFlowsErrorCode.NoFlow }))

        await expect(performer.perform(ctx, itemOf(), { summary: "", fields: {} })).rejects.toMatchObject({
            code: LeadFlowsErrorCode.NoFlow,
        })

        expect(leads.handOver).not.toHaveBeenCalled()
    })
})

describe("HandoffToSalesPerformerService", () => {
    it("defaults a missing score to cold when neither the lead nor its flow exists", async () => {
        const { performer, store, kit, leads } = await build()
        store.byLead.mockResolvedValue(null)

        await expect(performer.prepare(ctx, itemOf({ lead_id: null }))).resolves.toEqual({
            proposal: {
                summary: "handoff.ask",
                outcome: "unclear",
                fields: { contact: "", need: "", score: "" },
            },
        })

        expect(kit.text).toHaveBeenCalledWith("en", "handoff.ask", { name: "", level: "level.cold" })
        expect(leads.find).not.toHaveBeenCalled()
    })
    it("uses the recorded lead's name and need when the flow has neither", async () => {
        const { performer, store, kit, leads } = await build()
        store.byLead.mockResolvedValue(flowOf({ name: null, psid: null }))
        leads.find.mockResolvedValue(leadOf())

        await expect(
            performer.prepare(ctx, itemOf({ proposal: { summary: "", fields: { score: "warm" } } })),
        ).resolves.toEqual({
            proposal: {
                summary: "handoff.ask",
                outcome: "unclear",
                fields: { contact: "", need: "Recorded need", score: "warm" },
            },
        })

        expect(kit.text).toHaveBeenCalledWith("en", "handoff.ask", { name: "Minh", level: "level.warm" })
    })
    it("retains the proposal's contact and need over values from a nameless flow", async () => {
        const { performer, store, kit, leads } = await build()
        store.byLead.mockResolvedValue({ ...hotFlow, name: null })
        leads.find.mockResolvedValue(null)

        await expect(
            performer.prepare(
                ctx,
                itemOf({
                    proposal: { summary: "", fields: { contact: "owner@example.com", need: "Owner supplied need" } },
                }),
            ),
        ).resolves.toEqual({
            proposal: {
                summary: "handoff.hot",
                fields: { contact: "owner@example.com", need: "Owner supplied need", score: "hot" },
            },
        })

        expect(kit.text).toHaveBeenCalledWith("en", "handoff.hot", { name: "" })
    })
})

describe("HandoffToSalesPerformerService", () => {
    it("uses an empty need when the flow and recorded lead have no need", async () => {
        const { performer, store, leads } = await build()
        store.byLead.mockResolvedValue(flowOf({ psid: null }))
        leads.find.mockResolvedValue(null)

        await expect(performer.prepare(ctx, itemOf())).resolves.toEqual({
            proposal: {
                summary: "handoff.ask",
                outcome: "unclear",
                fields: { contact: "", need: "", score: "" },
            },
        })
    })
})

describe("HandoffToSalesPerformerService", () => {
    it("logs and closes an unlinked flow with the default hot score and no need", async () => {
        const flow = flowOf({ lead_id: null })
        const { performer, kit, store, leads } = await build(flow)
        const pack = "label.score: hot ()\nlabel.source: Facebook dm"

        await expect(performer.perform(ctx, itemOf({ lead_id: null }), { summary: "", fields: {} })).resolves.toEqual({
            summary: "handoff.done",
            evidence: "captured",
            lead_id: null,
            detail: null,
        })

        expect(leads.handOver).not.toHaveBeenCalled()
        expect(store.patch).toHaveBeenCalledWith(flow, {
            state: "handed_off",
            handed_off_at: NOW,
            pending_question: null,
        })
        expect(kit.text).toHaveBeenCalledWith("en", "handoff.evidence", { level: "hot" })
        expect(kit.log).toHaveBeenCalledWith(ctx, flow, "item-1", "lead_gen.handoff", "handoff.evidence", pack)
    })
})
