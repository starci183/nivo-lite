import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { WorkContext, WorkItem, WorkPerformerRegistry } from "@modules/domain/decisions"
import { AskQualifyingPerformerService } from "./ask-qualifying-performer.service"
import { LeadFlowsError, LeadFlowsErrorCode } from "./errors/lead-flows.error"
import { LeadFlowConversationService } from "./lead-flow-conversation.service"
import type { FlowFields } from "./lead-flow-fields.policy"
import { LeadFlowKitService } from "./lead-flow-kit.service"
import { LeadFlowMetaService } from "./lead-flow-meta.service"
import { LeadFlowStoreService } from "./lead-flow-store.service"
import { DEFAULT_CRITERIA, EMPTY_SIGNALS } from "./lead-flow-score.policy"
import { LeadFlowTurnService } from "./lead-flow-turn.service"
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
    created_at: NOW,
    updated_at: NOW,
    completed_at: null,
    installation_id: null,
})

const build = async (flow: LeadFlow = flowOf({ state: "greeted" })) => {
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
    const turns = mock<LeadFlowTurnService>()
    turns.setup.mockResolvedValue({
        questions: ["What do you need?", "When?"],
        criteriaText: "",
        criteria: DEFAULT_CRITERIA,
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AskQualifyingPerformerService,
            { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
            { provide: LeadFlowKitService, useValue: kit },
            { provide: LeadFlowTurnService, useValue: turns },
        ],
    }).compile()
    return { performer: moduleRef.get(AskQualifyingPerformerService), registry, kit, store, turns }
}

const asking = {
    summary: "",
    fields: { index: 0, question: "What do you need?" },
    draft: "Thanks!\n\nWhat do you need?",
}

describe("AskQualifyingPerformerService", () => {
    it("registers ask_qualifying at boot", async () => {
        const { performer, registry } = await build()

        performer.onModuleInit()

        expect(registry.add).toHaveBeenCalledWith("ask_qualifying", performer)
    })
    it("asks the owner's next question after the reply of the turn", async () => {
        const { performer, turns } = await build()

        await expect(performer.prepare(ctx, itemOf())).resolves.toEqual({
            proposal: {
                summary: "ask.summary",
                draft: "line.thanks\n\nWhat do you need?",
                fields: { index: 0, question_kind: "" },
            },
        })

        expect(turns.setup).toHaveBeenCalledWith("ws-1")
    })
    it("sends the question, counts it and waits for the answer", async () => {
        const flow = flowOf({ state: "greeted" })
        const { performer, kit, store } = await build(flow)
        kit.dmOrExplain.mockResolvedValue({ sent: true, line: "" })

        await expect(performer.perform(ctx, itemOf(), asking)).resolves.toEqual({
            summary: "ask.done (What do you need?)",
            evidence: "captured",
            lead_id: "lead-1",
            detail: asking.draft,
        })

        expect(kit.dmOrExplain).toHaveBeenCalledWith(ctx, itemOf(), flow, asking.draft, true)
        expect(store.patch).toHaveBeenCalledWith(flow, {
            state: "qualifying",
            asked: 1,
            pending_question: 0,
            greeted_at: NOW,
        })
    })
    it("asks nothing more when four questions were asked or one still waits for its answer", async () => {
        const { performer, kit, store } = await build(flowOf({ asked: 4 }))

        await expect(performer.perform(ctx, itemOf(), asking)).resolves.toMatchObject({ summary: "ask.maxed" })
        store.requireByLead.mockResolvedValue(flowOf({ asked: 1, pending_question: 0 }))
        await expect(performer.perform(ctx, itemOf(), asking)).resolves.toMatchObject({ summary: "ask.waiting" })
        await expect(performer.perform(ctx, itemOf(), { summary: "", fields: {} })).resolves.toMatchObject({
            summary: "ask.no-question",
        })

        expect(kit.dmOrExplain).not.toHaveBeenCalled()
        expect(store.patch).not.toHaveBeenCalled()
    })
    it("explains a question that could not go", async () => {
        const { performer, kit, store } = await build()
        kit.dmOrExplain.mockResolvedValue({ sent: false, line: "tag.proposed" })

        await expect(performer.perform(ctx, itemOf(), asking)).resolves.toMatchObject({ summary: "tag.proposed" })

        expect(store.patch).not.toHaveBeenCalled()
    })
})

describe("AskQualifyingPerformerService", () => {
    it.each<{ fields: FlowFields; index: number; draft: string; kind: string }>([
        {
            fields: { index: "1", reply: "Here is the answer", question: "Your budget?" },
            index: 1,
            draft: "Here is the answer\n\nYour budget?",
            kind: "",
        },
        { fields: { index: "invalid" }, index: 1, draft: "line.thanks\n\nWhen?", kind: "" },
        { fields: { index: "" }, index: 1, draft: "line.thanks\n\nWhen?", kind: "" },
        { fields: { index: "7" }, index: 7, draft: "", kind: "" },
        { fields: { question_kind: "contact" }, index: 1, draft: "line.thanks\n\nline.ask-contact", kind: "contact" },
    ])(
        "prepares the explicit question, next question or contact request: $fields",
        async ({ fields, index, draft, kind }) => {
            const { performer, kit } = await build(flowOf({ asked: 1 }))

            await expect(performer.prepare(ctx, itemOf({ proposal: { summary: "", fields } }))).resolves.toEqual({
                proposal: { summary: "ask.summary", draft, fields: { ...fields, index, question_kind: kind } },
            })

            expect(kit.text).toHaveBeenCalledWith("en", "ask.summary", { name: "Lan", n: 2 })
        },
    )
    it("asks for contact despite a pending question and keeps the original greeting time", async () => {
        const flow = flowOf({ asked: 1, pending_question: 0, greeted_at: NOW })
        const { performer, kit, store } = await build(flow)
        const proposal = { summary: "", fields: { question_kind: "contact" }, draft: "Share your contact" }
        kit.dmOrExplain.mockResolvedValue({ sent: true, line: "" })

        await expect(performer.perform(ctx, itemOf(), proposal)).resolves.toEqual({
            summary: "ask.done",
            evidence: "captured",
            lead_id: "lead-1",
            detail: "Share your contact",
        })

        expect(store.patch).toHaveBeenCalledWith(flow, {
            state: "qualifying",
            asked: 2,
            pending_question: null,
            contact_asked_at: NOW,
        })
    })
    it.each<{ fields: FlowFields; pending: number }>([
        { fields: { index: 2 }, pending: 2 },
        { fields: {}, pending: 0 },
    ])("records the question index $pending when the proposal has no question label", async ({ fields, pending }) => {
        const flow = flowOf({ greeted_at: NOW })
        const { performer, kit, store } = await build(flow)
        kit.dmOrExplain.mockResolvedValue({ sent: true, line: "" })

        await expect(performer.perform(ctx, itemOf(), { summary: "", fields, draft: "When?" })).resolves.toEqual({
            summary: "ask.done",
            evidence: "captured",
            lead_id: "lead-1",
            detail: "When?",
        })

        expect(store.patch).toHaveBeenCalledWith(flow, { state: "qualifying", asked: 1, pending_question: pending })
    })
})
