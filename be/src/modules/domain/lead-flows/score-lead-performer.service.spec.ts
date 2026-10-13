import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { WorkContext, WorkItem, WorkPerformerRegistry } from "@modules/domain/decisions"
import { LeadRecordsService } from "@modules/domain/leads"
import { LeadFlowsError, LeadFlowsErrorCode } from "./errors/lead-flows.error"
import { LeadFlowConversationService } from "./lead-flow-conversation.service"
import { LeadFlowKitService } from "./lead-flow-kit.service"
import { LeadFlowMetaService } from "./lead-flow-meta.service"
import { LeadFlowStoreService } from "./lead-flow-store.service"
import { DEFAULT_CRITERIA, EMPTY_SIGNALS } from "./lead-flow-score.policy"
import { parseAnalysis } from "./lead-flow-steps.policy"
import { LeadFlowTurnService } from "./lead-flow-turn.service"
import type { LeadFlow } from "./lead-flows.contracts"
import { ScoreLeadPerformerService } from "./score-lead-performer.service"

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

const DOT = String.fromCodePoint(0x00b7)

const build = async (flow: LeadFlow = flowOf()) => {
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
    kit.reasonText.mockImplementation((_locale, reason) => `reason.${reason}`)
    store.patch.mockResolvedValue(flow)
    transcript.leadGenAgent.mockResolvedValue(null)
    const turns = mock<LeadFlowTurnService>()
    turns.setup.mockResolvedValue({ questions: ["When?"], criteriaText: "", criteria: DEFAULT_CRITERIA })
    const leads = mock<LeadRecordsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ScoreLeadPerformerService,
            { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
            { provide: LeadFlowKitService, useValue: kit },
            { provide: LeadFlowTurnService, useValue: turns },
            { provide: LeadRecordsService, useValue: leads },
        ],
    }).compile()
    return { performer: moduleRef.get(ScoreLeadPerformerService), registry, kit, store, meta, transcript, turns, leads }
}

const turnItem = (text: string) =>
    itemOf({ proposal: { summary: "", fields: { turn: "t:1", source_kind: "dm", text } } })

describe("ScoreLeadPerformerService", () => {
    it("registers score_lead at boot and says nothing while a person holds the lead", async () => {
        const { performer, registry, transcript, turns } = await build(flowOf({ state: "escalated" }))
        transcript.heldByPerson.mockResolvedValue(true)

        performer.onModuleInit()

        expect(registry.add).toHaveBeenCalledWith("score_lead", performer)
        await expect(performer.prepare(ctx, turnItem("Hello"))).resolves.toEqual({
            proposal: {
                summary: "score.held",
                fields: { turn: "t:1", source_kind: "dm", text: "Hello", step: "hold" },
            },
        })
        expect(turns.read).not.toHaveBeenCalled()
    })

    it("reads a first message once and decides to greet", async () => {
        const flow = flowOf()
        const { performer, kit, store, meta, turns } = await build(flow)
        const analysis = parseAnalysis({ confidence: 0.9, reply: "Hi Lan", signals: { need: "tea" } }, "t:1")
        turns.read.mockResolvedValue({ analysis, keywordReason: null })
        meta.windowOf.mockResolvedValue({ status: "open", msLeft: 1000 })

        const prepared = await performer.prepare(ctx, turnItem("Hello, I need tea"))

        expect(prepared.proposal.fields).toMatchObject({ step: "greet", reply: "Hi Lan", handoff: "", negative: "" })
        expect(turns.read).toHaveBeenCalledWith(ctx, {
            agent: null,
            turn: "t:1",
            kind: "dm",
            text: "Hello, I need tea",
            name: "Lan",
            pendingQuestion: null,
            criteriaText: "",
            first: true,
        })
        expect(store.patch).toHaveBeenCalledWith(flow, { analysis })
        expect(kit.escalate).not.toHaveBeenCalled()
    })

    it("hands an angry or refund turn to a person instead of scoring it", async () => {
        const flow = flowOf()
        const { performer, kit, turns } = await build(flow)
        const analysis = parseAnalysis({ confidence: 1, sentiment: "negative" }, "t:1")
        turns.read.mockResolvedValue({ analysis, keywordReason: "refund" })
        const item = turnItem("I want a refund")

        await expect(performer.prepare(ctx, item)).resolves.toEqual({
            proposal: {
                summary: "score.escalate",
                fields: {
                    turn: "t:1",
                    source_kind: "dm",
                    text: "I want a refund",
                    conversation_id: "conv-1",
                    connection_id: "connection-1",
                    comment_id: "",
                    post_id: "",
                    step: "escalate",
                    escalation: "refund",
                    confidence: 1,
                },
            },
        })

        expect(kit.escalate).toHaveBeenCalledWith(ctx, {
            flow,
            reason: "refund",
            text: "I want a refund",
            turn: "t:1",
            item,
            notify: true,
        })
    })

    it("stores the score and the answer to the pending question", async () => {
        const flow = flowOf({ pending_question: 0, state: "qualifying" })
        const answers = [{ i: 0, question: "When?", answer: "Next week", at: NOW }]
        const { performer, kit, store, leads } = await build(flow)
        store.patch.mockResolvedValue(flowOf({ answers }))
        const fields = {
            step: "follow_up",
            score: "warm",
            score_reasons: "need",
            source_kind: "dm",
            answer: "Next week",
            signals: JSON.stringify({ need: "tea" }),
        }

        await expect(performer.perform(ctx, itemOf(), { summary: "Warm lead", fields })).resolves.toMatchObject({
            summary: "Warm lead",
        })

        expect(store.patch).toHaveBeenCalledWith(flow, {
            signals: { ...EMPTY_SIGNALS, need: "tea" },
            score: "warm",
            score_reasons: ["need"],
            scored_at: NOW,
            pending_question: null,
            answers,
        })
        expect(leads.fillContact).not.toHaveBeenCalled()
        expect(kit.log).toHaveBeenCalledWith(
            ctx,
            flow,
            "item-1",
            "lead_gen.scored",
            "Warm lead",
            `need ${DOT} score.answers`,
        )
    })

    it("stores nothing for an escalated turn and refuses a lead without a flow", async () => {
        const { performer, store } = await build()

        await expect(
            performer.perform(ctx, itemOf(), { summary: "Escalated", fields: { step: "escalate" } }),
        ).resolves.toMatchObject({ summary: "Escalated" })
        store.requireByLead.mockRejectedValue(new LeadFlowsError({ code: LeadFlowsErrorCode.NoFlow }))
        await expect(performer.perform(ctx, itemOf(), { summary: "", fields: {} })).rejects.toMatchObject({
            code: LeadFlowsErrorCode.NoFlow,
        })

        expect(store.patch).not.toHaveBeenCalled()
    })
})
