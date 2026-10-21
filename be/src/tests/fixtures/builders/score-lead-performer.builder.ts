import { builder } from "@starci/jest-preset"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import { EMPTY_SIGNALS, parseAnalysis, type LeadFlow, type Analysis, type FlowFields } from "@modules/domain/lead-flows"
/** Shared, complete test data for the capability cases. */
export const NOW = "2026-10-12T10:00:00.000Z"

/** Shared, complete test data for the capability cases. */
export const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

/** Shared, complete test data for the capability cases. */
export const flowOf = builder<LeadFlow>({
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

/** Shared, complete test data for the capability cases. */
export const itemOf = builder<WorkItem>({
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

/** Shared, complete test data for the capability cases. */
export const DOT = String.fromCodePoint(0x00b7)

/** Shared, complete test data for the capability cases. */
export const turnItem = (text: string) =>
    itemOf({ proposal: { summary: "", fields: { turn: "t:1", source_kind: "dm", text } } })

/** Shared, complete test data for the capability cases. */
export const cold = parseAnalysis({ confidence: 1 }, "manual:item-1")

/** Shared, complete test data for the capability cases. */
export const warm = parseAnalysis({ confidence: 1, signals: { need: "Tea" } }, "manual:item-1")

/** Shared, complete test data for the capability cases. */
export const emptyForm = parseAnalysis(
    { confidence: 1, signals: { need: null, contact: "", interest: "medium" } },
    "manual:item-1",
)

/** Shared, complete test data for the capability cases. */
export const filledForm = { ...emptyForm, signals: { ...emptyForm.signals, need: "Tea" } }

/** Shared, complete test data for the capability cases. */
export const coffeeForm = { ...emptyForm, signals: { ...emptyForm.signals, need: "Coffee" } }

/** Shared, complete test data for the capability cases. */
export const answered = { ...warm, answer: "Tomorrow" }

/** Shared, complete test data for the capability cases. */
export const hot = parseAnalysis(
    {
        confidence: 1,
        signals: { need: "Tea", contact: "lan@example.com", asks_price_or_schedule: true },
        sentiment: "negative",
    },
    "manual:item-1",
)

/** Shared, complete test data for the capability cases. */
export const gap = parseAnalysis(
    { confidence: 1, knowledge_gap: { question: "Does it ship?", topic: "delivery" } },
    "manual:item-1",
)

/** Shared, complete test data for the capability cases. */
export const source = {
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

/** Shared, complete test data for the capability cases. */
export type PrepareCase = readonly [
    name: string,
    flow: Partial<LeadFlow>,
    fields: FlowFields,
    expected: FlowFields,
    reading?: Analysis | null,
    stored?: Analysis,
    resume?: LeadFlow,
    emptySplit?: boolean,
]

/** Shared, complete test data for the capability cases. */
export const unread: Partial<LeadFlow> = { analysis: null }

/** Shared, complete test data for the capability cases. */
export const pending: Partial<LeadFlow> = { ...unread, state: "qualifying", last_user_text: "Tomorrow" }

/** Shared, complete test data for the capability cases. */
export const gapFields = { source_kind: "comment", text: "Does it ship?" }

/** Shared, complete test data for the capability cases. */
export const unreadable = { step: "escalate", escalation: "unreadable", confidence: 0 }

/** Shared, complete test data for the capability cases. */
export const lowConfidence = { step: "escalate", escalation: "low_confidence", confidence: 0.6 - 0.05 }

/** Shared, complete test data for the capability cases. */
export const hotComment = { step: "comment", score: "hot", handoff: "1", negative: "1" }

/** Shared, complete test data for the capability cases. */
export const hotHold = { step: "hold", score: "hot", handoff: "", negative: "" }

/** Shared, complete test data for the capability cases. */
export const form = { source_kind: "leadgen", need: "Tea\nCoffee" }

/** Shared, complete test data for the capability cases. */
export const formResult = { step: "follow_up", need: "Tea", confidence: 1, score: "warm" }

/** Shared, complete test data for the capability cases. */
export const coffeeResult = { ...formResult, need: "Coffee" }

/** Shared, complete test data for the capability cases. */
export const blankForm = { source_kind: "leadgen" }

/** Shared, complete test data for the capability cases. */
export const nullForm = { ...blankForm, need: null }

/** Shared, complete test data for the capability cases. */
export const numericForm = { ...blankForm, need: 12 }

/** Shared, complete test data for the capability cases. */
export const newlineForm = { ...blankForm, need: "\nCoffee" }

/** Shared, complete test data for the capability cases. */
export const blankResult = { step: "close", need: "", confidence: 1, score: "cold" }

/** Shared, complete test data for the capability cases. */
export const noChannel: Partial<LeadFlow> = { ...unread, connection_id: null, conversation_id: null }

/** Shared, complete test data for the capability cases. */
export const held: Partial<LeadFlow> = { state: "handed_off", asked: 2, contact_asked_at: NOW, greeted_at: NOW }

/** Shared, complete test data for the capability cases. */
export const resumed = flowOf({ analysis: cold, state: "qualifying", source })

/** Shared, complete test data for the capability cases. */
export const cases: ReadonlyArray<PrepareCase> = [
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
