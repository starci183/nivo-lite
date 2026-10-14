import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { Prepared, WorkContext, WorkItem, WorkPerformerRegistry } from "@modules/domain/decisions"
import { LeadRecordsService } from "@modules/domain/leads"
import { LeadFlowsError, LeadFlowsErrorCode } from "./errors/lead-flows.error"
import { LeadFlowConversationService } from "./lead-flow-conversation.service"
import { LeadFlowKitService } from "./lead-flow-kit.service"
import { LeadFlowMetaService } from "./lead-flow-meta.service"
import { LeadFlowStoreService } from "./lead-flow-store.service"
import { DEFAULT_CRITERIA, EMPTY_SIGNALS } from "./lead-flow-score.policy"
import { parseAnalysis } from "./lead-flow-steps.policy"
import { LeadFlowTurnService } from "./lead-flow-turn.service"
import type { Analysis, LeadFlow, LeadFlowPatch } from "./lead-flows.contracts"
import type { FlowFields } from "./lead-flow-fields.policy"
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
    it.each([
        ["", "", "warm"],
        ["broken JSON", "unknown", null],
        ["null", "cold", "cold"],
        ["{}", "hot", "hot"],
    ])("retains signals and normalizes score %s / %s", async (raw, score, expectedScore) => {
        const signals = { ...EMPTY_SIGNALS, need: "tea" }
        const flow = flowOf({ signals, score: "warm" })
        const { performer, store, kit } = await build(flow)
        await expect(
            performer.perform(ctx, itemOf(), { summary: "Scored", fields: { signals: raw, score, source_kind: "dm" } }),
        ).resolves.toMatchObject({ summary: "Scored" })
        expect(store.patch).toHaveBeenCalledWith(flow, {
            signals,
            score: expectedScore,
            score_reasons: [],
            scored_at: NOW,
        })
        expect(kit.log).toHaveBeenCalledWith(ctx, flow, "item-1", "lead_gen.scored", "Scored", "")
    })
    it.each<readonly [string, string | null, string | null, string | null, LeadFlow["state"], LeadFlowPatch]>([
        ["84901234567", null, null, "lead-1", "new", { phone: "84901234567", state: "scored" }],
        ["lan@example.com", null, null, "lead-1", "new", { email: "lan@example.com", state: "scored" }],
        ["84901234567", "84987654321", null, "lead-1", "new", { state: "scored" }],
        ["lan@example.com", null, "old@example.com", "lead-1", "new", { state: "scored" }],
        ["lan@example.com", null, null, null, "qualifying", { email: "lan@example.com" }],
    ])(
        "fills contact without replacing identity: %s / %s / %s / %s / %s",
        async (contact, phone, email, lead_id, state, patch) => {
            const flow = flowOf({ phone, email, lead_id, state })
            const { performer, store, leads } = await build(flow)
            const signals = { ...EMPTY_SIGNALS, contact }
            await expect(
                performer.perform(ctx, itemOf(), {
                    summary: "Scored",
                    fields: { step: "hold", signals: JSON.stringify(signals) },
                }),
            ).resolves.toMatchObject({ summary: "Scored", lead_id })
            expect(store.patch).toHaveBeenCalledWith(flow, {
                signals,
                score: null,
                score_reasons: [],
                scored_at: NOW,
                ...patch,
            })
            if (lead_id === null) expect(leads.fillContact).not.toHaveBeenCalled()
            else
                expect(leads.fillContact).toHaveBeenCalledWith({
                    workspaceId: "ws-1",
                    leadId: "lead-1",
                    phone: contact.includes("@") ? null : contact,
                    email: contact.includes("@") ? contact : null,
                })
        },
    )
    it.each([null, ""])("clears an unanswered question: %s", async (last_user_text) => {
        const flow = flowOf({ pending_question: 0, last_user_text })
        const { performer, store } = await build(flow)
        await expect(
            performer.perform(ctx, itemOf(), { summary: "Scored", fields: { source_kind: "dm" } }),
        ).resolves.toMatchObject({ summary: "Scored" })
        expect(store.patch).toHaveBeenCalledWith(flow, {
            signals: EMPTY_SIGNALS,
            score: null,
            score_reasons: [],
            scored_at: NOW,
            pending_question: null,
        })
    })
    it("answers a missing setup question from the user's last message", async () => {
        const previous = { i: 0, question: "When?", answer: "Tomorrow", at: NOW }
        const flow = flowOf({ pending_question: 2, last_user_text: "  Green tea  ", answers: [previous] })
        const { performer, store } = await build(flow)
        await expect(
            performer.perform(ctx, itemOf(), {
                summary: "Scored",
                fields: { source_kind: "dm", score_reasons: "one; two" },
            }),
        ).resolves.toMatchObject({ summary: "Scored" })
        expect(store.patch).toHaveBeenCalledWith(flow, {
            signals: EMPTY_SIGNALS,
            score: null,
            score_reasons: ["one", "two"],
            scored_at: NOW,
            pending_question: null,
            answers: [previous, { i: 2, question: "", answer: "Green tea", at: NOW }],
        })
    })
    const cold = parseAnalysis({ confidence: 1 }, "manual:item-1")
    const warm = parseAnalysis({ confidence: 1, signals: { need: "Tea" } }, "manual:item-1")
    const emptyForm = parseAnalysis(
        { confidence: 1, signals: { need: null, contact: "", interest: "medium" } },
        "manual:item-1",
    )
    const filledForm = { ...emptyForm, signals: { ...emptyForm.signals, need: "Tea" } }
    const coffeeForm = { ...emptyForm, signals: { ...emptyForm.signals, need: "Coffee" } }
    const answered = { ...warm, answer: "Tomorrow" }
    const hot = parseAnalysis(
        {
            confidence: 1,
            signals: { need: "Tea", contact: "lan@example.com", asks_price_or_schedule: true },
            sentiment: "negative",
        },
        "manual:item-1",
    )
    const gap = parseAnalysis(
        { confidence: 1, knowledge_gap: { question: "Does it ship?", topic: "delivery" } },
        "manual:item-1",
    )
    const source = {
        kind: "mention",
        platform: "instagram",
        at: NOW,
        post_id: null,
        ad_id: null,
        form_id: null,
        comment_id: null,
        leadgen_id: null,
        referral: null,
    } as const
    type PrepareCase = readonly [
        name: string,
        flow: Partial<LeadFlow>,
        fields: FlowFields,
        expected: FlowFields,
        reading?: Analysis | null,
        stored?: Analysis,
        resume?: LeadFlow,
        emptySplit?: boolean,
    ]
    const unread: Partial<LeadFlow> = { analysis: null }
    const pending: Partial<LeadFlow> = { ...unread, state: "qualifying", last_user_text: "Tomorrow" }
    const gapFields = { source_kind: "comment", text: "Does it ship?" }
    const unreadable = { step: "escalate", escalation: "unreadable", confidence: 0 }
    const lowConfidence = { step: "escalate", escalation: "low_confidence", confidence: 0.6 - 0.05 }
    const hotComment = { step: "comment", score: "hot", handoff: "1", negative: "1" }
    const hotHold = { step: "hold", score: "hot", handoff: "", negative: "" }
    const form = { source_kind: "leadgen", need: "Tea\nCoffee" }
    const formResult = { step: "follow_up", need: "Tea", confidence: 1, score: "warm" }
    const coffeeResult = { ...formResult, need: "Coffee" }
    const blankForm = { source_kind: "leadgen" }
    const nullForm = { ...blankForm, need: null }
    const numericForm = { ...blankForm, need: 12 }
    const newlineForm = { ...blankForm, need: "\nCoffee" }
    const blankResult = { step: "close", need: "", confidence: 1, score: "cold" }
    const noChannel: Partial<LeadFlow> = { ...unread, connection_id: null, conversation_id: null }
    const held: Partial<LeadFlow> = { state: "handed_off", asked: 2, contact_asked_at: NOW, greeted_at: NOW }
    const resumed = flowOf({ analysis: cold, state: "qualifying", source })
    const cases: ReadonlyArray<PrepareCase> = [
        ["empty comment", unread, { source_kind: "comment" }, { step: "comment", confidence: 1 }, undefined, cold],
        ["empty mention", unread, { source_kind: "mention" }, { step: "hold", confidence: 1 }, undefined, cold],
        ["empty form", unread, { ...form, need: "" }, { step: "close", need: "", confidence: 1 }, undefined, emptyForm],
        ["form need", unread, form, formResult, undefined, filledForm],
        ["missing need", unread, blankForm, blankResult, undefined, emptyForm],
        ["null need", unread, nullForm, blankResult, undefined, emptyForm],
        ["numeric need", unread, numericForm, blankResult, undefined, emptyForm],
        ["leading newline", unread, newlineForm, coffeeResult, undefined, coffeeForm],
        ["empty split", unread, form, blankResult, undefined, emptyForm, undefined, true],
        ["empty DM", noChannel, {}, { ...unreadable, connection_id: "", conversation_id: "" }],
        [
            "pending question",
            { ...pending, pending_question: 0 },
            {},
            { step: "ask", question: "When?", answer: "Tomorrow" },
            answered,
        ],
        [
            "missing pending question",
            { ...pending, pending_question: 3 },
            {},
            { step: "ask", question: "When?", answer: "Tomorrow" },
            answered,
        ],
        ["gap", unread, gapFields, lowConfidence, gap],
        ["gap without conversation", { ...unread, conversation_id: null }, gapFields, lowConfidence, gap],
        ["model failure", unread, { source_kind: "mention", text: "A question" }, unreadable, null],
        ["refund model failure", unread, { text: "refund" }, { ...unreadable, escalation: "refund" }, null],
        ["given phone", {}, { contact: "0901234567" }, { contact: "84901234567", step: "greet" }],
        ["given email", {}, { contact: "Lan@Example.com" }, { contact: "lan@example.com", step: "greet" }],
        ["flow phone", { phone: "84987654321", email: "old@example.com" }, {}, { contact: "84987654321" }],
        ["flow email", { email: "old@example.com" }, {}, { contact: "old@example.com" }],
        ["no contact", { psid: null }, {}, { contact: "", need: "" }],
        ["hot comment", { analysis: hot }, { source_kind: "comment" }, hotComment],
        ["hot mention", { analysis: hot }, { source_kind: "mention" }, hotHold],
        ["hot DM", { analysis: hot }, {}, { ...hotHold, step: "handoff" }],
        ["cached form need", {}, form, formResult],
        ["missing question", { state: "qualifying", asked: -1 }, {}, { step: "ask", index: -1, question: "" }],
        ["handed off", held, {}, { step: "hold", index: 2, question: "" }],
        [
            "released source",
            { state: "escalated" },
            {},
            { step: "hold", source_kind: "mention", confidence: 1 },
            undefined,
            undefined,
            resumed,
        ],
    ]
    it.each(cases.map((row) => ({ name: row[0], row })))(
        "prepares $name",
        async ({ row: [_name, patch, fields, expected, reading, stored, resume, emptySplit] }) => {
            const flow = flowOf({ analysis: cold, ...patch })
            const { performer, kit, turns, store, transcript, meta } = await build(flow)
            transcript.heldByPerson.mockResolvedValue(false)
            if (resume !== undefined) kit.resume.mockResolvedValue(resume)
            if (reading !== undefined) turns.read.mockResolvedValue({ analysis: reading, keywordReason: null })
            meta.windowOf.mockResolvedValue({ status: flow.state === "handed_off" ? "closed" : "open", msLeft: 0 })
            const item = itemOf({ proposal: { summary: "Before", fields } })
            // Native split returns an element; fault injection checks both retained empty-array fallbacks.
            const split = emptySplit ? jest.spyOn(String.prototype, "split") : undefined
            split?.mockReturnValueOnce([]).mockReturnValueOnce([])
            let prepared: Prepared
            try {
                prepared = await performer.prepare(ctx, item)
                if (split !== undefined) expect(split.mock.calls).toEqual([["\n"], ["\n"]])
            } finally {
                split?.mockRestore()
            }
            expect(prepared.proposal.fields).toMatchObject(expected)
            if (expected === blankResult)
                expect(prepared.proposal.fields.signals).toBe(JSON.stringify(emptyForm.signals))
            if (reading === undefined) expect(turns.read).not.toHaveBeenCalled()
            else
                expect(turns.read).toHaveBeenCalledWith(ctx, {
                    agent: null,
                    turn: "manual:item-1",
                    kind: fields.source_kind ?? "dm",
                    text: fields.text ?? flow.last_user_text,
                    name: "Lan",
                    pendingQuestion: flow.pending_question === 0 ? "When?" : null,
                    criteriaText: "",
                    first: flow.state === "new" && (fields.source_kind ?? "dm") === "dm",
                })
            const storedAnalysis = stored ?? reading
            if (storedAnalysis === undefined || storedAnalysis === null) expect(store.patch).not.toHaveBeenCalled()
            else expect(store.patch).toHaveBeenCalledWith(flow, { analysis: storedAnalysis })
            if (expected.step === "escalate")
                expect(kit.escalate).toHaveBeenCalledWith(ctx, {
                    flow,
                    reason: expected.escalation,
                    text: fields.text ?? flow.last_user_text ?? "",
                    turn: "manual:item-1",
                    item,
                    notify: (fields.source_kind ?? "dm") === "dm",
                })
            else expect(kit.escalate).not.toHaveBeenCalled()
            if (
                reading?.knowledge_gap !== null &&
                reading?.knowledge_gap !== undefined &&
                flow.conversation_id !== null
            )
                expect(turns.noteGap).toHaveBeenCalledWith("ws-1", {
                    ...reading.knowledge_gap,
                    conversationId: flow.conversation_id,
                })
            else expect(turns.noteGap).not.toHaveBeenCalled()
            if (resume !== undefined) expect(kit.resume).toHaveBeenCalledWith(flow)
        },
    )
})
