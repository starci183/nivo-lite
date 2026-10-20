import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { WorkPerformerRegistry } from "@modules/domain/decisions"
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
import type { Prepared } from "@modules/domain/decisions"
import type { LeadFlowPatch } from "./lead-flows.contracts"
import {
    NOW,
    ctx,
    flowOf,
    itemOf,
    DOT,
    turnItem,
    cold,
    emptyForm,
    blankResult,
    cases,
} from "@tests/fixtures/builders/score-lead-performer.builder"

/** The separator shape of the String.prototype.split overload the spy replaces. */
type Splitter = { [Symbol.split](text: string, limit?: number): Array<string> }

/** Whether a split separator is the line break the spy empties (separators are strings, regexes or splitters). */
const isNewline = (separator: unknown): boolean => separator === "\n"

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
})

describe("ScoreLeadPerformerService", () => {
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
})

describe("ScoreLeadPerformerService", () => {
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

describe("ScoreLeadPerformerService", () => {
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
})

describe("ScoreLeadPerformerService", () => {
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
})

describe("ScoreLeadPerformerService", () => {
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
            const nativeSplit = String.prototype.split
            const split = emptySplit ? jest.spyOn(String.prototype, "split") : undefined
            split?.mockImplementation(function (this: string, separator: Splitter, limit?: number) {
                return isNewline(separator) ? [] : nativeSplit.call(this, separator, limit)
            })
            let prepared: Prepared
            try {
                prepared = await performer.prepare(ctx, item)
                if (split !== undefined)
                    expect(split.mock.calls.filter(([separator]) => isNewline(separator))).toEqual([["\n"], ["\n"]])
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
