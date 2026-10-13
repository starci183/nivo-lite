import { textOf, textOrNull } from "./lead-flow-identity.policy"
import { EMPTY_SIGNALS, cleanSignals, recordOf } from "./lead-flow-score.policy"
import { parseAnalysis } from "./lead-flow-steps.policy"
import type {
    Analysis,
    Answer,
    FlowState,
    LeadFlow,
    LeadSource,
    Level,
    Platform,
    Referral,
    SourceKind,
} from "./lead-flows.contracts"
import type { LeadFlowRow } from "./persistence/lead-flows.rows"

const STATES: ReadonlyArray<FlowState> = [
    "new",
    "greeted",
    "qualifying",
    "scored",
    "handed_off",
    "nurturing",
    "closed",
    "escalated",
]
const KINDS: ReadonlyArray<SourceKind> = ["leadgen", "dm", "comment", "mention"]

const stateOf = (value: unknown): FlowState | null => STATES.find((state) => state === value) ?? null

/** The platform a value names; Facebook unless it says Instagram. */
export const platformOf = (value: unknown): Platform => (value === "instagram" ? "instagram" : "facebook")

/** The source kind a value names, or the fallback. */
export const sourceKindOf = (value: unknown, fallback: SourceKind): SourceKind =>
    KINDS.find((kind) => kind === value) ?? fallback

const isoOf = (value: Date | string | null): string | null => {
    if (value === null) return null
    return value instanceof Date ? value.toISOString() : value
}

const referralOf = (value: unknown): Referral | null => {
    if (typeof value !== "object" || value === null) return null
    const source = recordOf(value)
    return {
        ref: textOrNull(source.ref),
        source: textOrNull(source.source),
        type: textOrNull(source.type),
        ad_id: textOrNull(source.ad_id),
    }
}

/** A stored touch, or null when the value holds none. */
export const leadSourceOf = (value: unknown): LeadSource | null => {
    const source = recordOf(value)
    if (source.kind === undefined && source.platform === undefined) return null
    return {
        platform: platformOf(source.platform),
        kind: sourceKindOf(source.kind, "leadgen"),
        post_id: textOrNull(source.post_id),
        ad_id: textOrNull(source.ad_id),
        form_id: textOrNull(source.form_id),
        comment_id: textOrNull(source.comment_id),
        leadgen_id: textOrNull(source.leadgen_id),
        referral: referralOf(source.referral),
        at: textOrNull(source.at),
    }
}

const listOf = (value: unknown): ReadonlyArray<unknown> => (Array.isArray(value) ? value : [])

const answerOf = (value: unknown): Answer | null => {
    const source = recordOf(value)
    return typeof source.i === "number"
        ? { i: source.i, question: textOf(source.question), answer: textOf(source.answer), at: textOf(source.at) }
        : null
}

const analysisOf = (value: unknown): Analysis | null => {
    const turn = textOf(recordOf(value).turn)
    return turn === "" ? null : parseAnalysis(value, turn)
}

const levelOf = (value: string | null): Level | null =>
    value === "hot" || value === "warm" || value === "cold" ? value : null

/** One stored row as the domain reads it. */
export const toLeadFlow = (row: LeadFlowRow): LeadFlow => ({
    id: row.id,
    workspace_id: row.workspace_id,
    lead_id: row.lead_id,
    connection_id: row.connection_id,
    conversation_id: row.conversation_id,
    platform: row.platform === null ? null : platformOf(row.platform),
    psid: row.psid,
    igsid: row.igsid,
    phone: row.phone,
    email: row.email,
    name: row.name,
    state: stateOf(row.state) ?? "new",
    resume_state: stateOf(row.resume_state),
    source: leadSourceOf(row.source),
    touches: listOf(row.touches)
        .map(leadSourceOf)
        .filter((touch): touch is LeadSource => touch !== null),
    answers: listOf(row.answers)
        .map(answerOf)
        .filter((answer): answer is Answer => answer !== null),
    asked: row.asked,
    pending_question: row.pending_question,
    contact_asked_at: isoOf(row.contact_asked_at),
    signals: row.signals === null ? EMPTY_SIGNALS : cleanSignals(row.signals),
    score: levelOf(row.score),
    score_reasons: listOf(row.score_reasons).map(textOf),
    scored_at: isoOf(row.scored_at),
    analysis: analysisOf(row.analysis),
    last_user_at: isoOf(row.last_user_at),
    last_user_text: row.last_user_text,
    greeted_at: isoOf(row.greeted_at),
    handed_off_at: isoOf(row.handed_off_at),
    followed_up_at: isoOf(row.followed_up_at),
    closed_at: isoOf(row.closed_at),
    escalated_at: isoOf(row.escalated_at),
    escalation_reason: row.escalation_reason,
})

/** The parameters of SAVE_FLOW for a flow. */
export const saveParams = (flow: LeadFlow): Array<unknown> => [
    flow.id,
    flow.workspace_id,
    flow.lead_id,
    flow.connection_id,
    flow.conversation_id,
    flow.platform,
    flow.psid,
    flow.igsid,
    flow.phone,
    flow.email,
    flow.name,
    flow.state,
    flow.resume_state,
    JSON.stringify(flow.source ?? {}),
    JSON.stringify(flow.touches),
    JSON.stringify(flow.answers),
    flow.asked,
    flow.pending_question,
    flow.contact_asked_at,
    JSON.stringify(flow.signals),
    flow.score,
    JSON.stringify(flow.score_reasons),
    flow.scored_at,
    flow.analysis === null ? null : JSON.stringify(flow.analysis),
    flow.last_user_at,
    flow.last_user_text,
    flow.greeted_at,
    flow.handed_off_at,
    flow.followed_up_at,
    flow.closed_at,
    flow.escalated_at,
    flow.escalation_reason,
]
