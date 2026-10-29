import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity"
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
import type { LeadFlowEntity } from "./persistence/entities"

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

const isoOf = (value: Date | null): string | null => (value === null ? null : value.toISOString())

const dateOf = (value: string | null): Date | null => (value === null ? null : new Date(value))

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
export const toLeadFlow = (row: LeadFlowEntity): LeadFlow => ({
    id: row.id,
    workspace_id: row.workspaceId,
    lead_id: row.leadId,
    connection_id: row.connectionId,
    conversation_id: row.conversationId,
    platform: row.platform === null ? null : platformOf(row.platform),
    psid: row.psid,
    igsid: row.igsid,
    phone: row.phone,
    email: row.email,
    name: row.name,
    state: stateOf(row.state) ?? "new",
    resume_state: stateOf(row.resumeState),
    source: leadSourceOf(row.source),
    touches: listOf(row.touches)
        .map(leadSourceOf)
        .filter((touch): touch is LeadSource => touch !== null),
    answers: listOf(row.answers)
        .map(answerOf)
        .filter((answer): answer is Answer => answer !== null),
    asked: row.asked,
    pending_question: row.pendingQuestion,
    contact_asked_at: isoOf(row.contactAskedAt),
    signals: row.signals === null ? EMPTY_SIGNALS : cleanSignals(row.signals),
    score: levelOf(row.score),
    score_reasons: listOf(row.scoreReasons).map(textOf),
    scored_at: isoOf(row.scoredAt),
    analysis: analysisOf(row.analysis),
    last_user_at: isoOf(row.lastUserAt),
    last_user_text: row.lastUserText,
    greeted_at: isoOf(row.greetedAt),
    handed_off_at: isoOf(row.handedOffAt),
    followed_up_at: isoOf(row.followedUpAt),
    closed_at: isoOf(row.closedAt),
    escalated_at: isoOf(row.escalatedAt),
    escalation_reason: row.escalationReason,
})

/** Every mutable column of a flow, as the values an update writes (the key columns stay out). */
export const saveValues = (flow: LeadFlow): QueryDeepPartialEntity<LeadFlowEntity> => ({
    leadId: flow.lead_id,
    connectionId: flow.connection_id,
    conversationId: flow.conversation_id,
    platform: flow.platform,
    psid: flow.psid,
    igsid: flow.igsid,
    phone: flow.phone,
    email: flow.email,
    name: flow.name,
    state: flow.state,
    resumeState: flow.resume_state,
    source: flow.source ?? {},
    touches: flow.touches,
    answers: flow.answers,
    asked: flow.asked,
    pendingQuestion: flow.pending_question,
    contactAskedAt: dateOf(flow.contact_asked_at),
    signals: flow.signals,
    score: flow.score,
    scoreReasons: flow.score_reasons,
    scoredAt: dateOf(flow.scored_at),
    analysis: flow.analysis,
    lastUserAt: dateOf(flow.last_user_at),
    lastUserText: flow.last_user_text,
    greetedAt: dateOf(flow.greeted_at),
    handedOffAt: dateOf(flow.handed_off_at),
    followedUpAt: dateOf(flow.followed_up_at),
    closedAt: dateOf(flow.closed_at),
    escalatedAt: dateOf(flow.escalated_at),
    escalationReason: flow.escalation_reason,
})
