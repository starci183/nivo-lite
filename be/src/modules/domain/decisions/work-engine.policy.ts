import type { Locale } from "@modules/platform/i18n"
import type { GateVerdict, Proposal, ProposalFieldValue, ReasonCode, WorkEdits } from "./decisions.contracts"
import type { MergedProposal, OutboundAccess } from "./work-engine.contracts"

/** The longest error text kept on a failed item. */
export const MAX_ERROR_LENGTH = 500

/** Actions that send the customer a message through the channel of their conversation: the agent access of that connection applies to them. */
const CUSTOMER_OUTBOUND_ACTIONS: ReadonlySet<string> = new Set([
    "reply_customer",
    "send_follow_up",
    "send_quote",
    "send_care",
    "issue_invoice",
    "greet_prospect",
    "ask_qualifying",
    "follow_up_lead",
    "close_lead",
    "reply_comment_public",
    "private_reply_comment",
    "message_with_human_agent_tag",
])

/** Whether the action speaks to the customer, so the access of the connection it would leave through is checked. */
export const isCustomerOutbound = (action: string): boolean => CUSTOMER_OUTBOUND_ACTIONS.has(action)

/** Whether an access grant lets the message leave without a person: only "auto" does. */
export const accessLetsRunAlone = (access: OutboundAccess): boolean => access === "auto"

/** The verdict turned into an ask with `reason` first; the other reasons follow, the routine one never does. */
export const askBecause = (verdict: GateVerdict, reason: ReasonCode): GateVerdict => ({
    verdict: "ask",
    reason,
    reasons: [reason, ...verdict.reasons.filter((other) => other !== reason && other !== "routine")],
    missing: verdict.missing,
})

/** The reasons that a person's approval cannot remove: missing data and an unclear outcome. */
export const blockingReasons = (reasons: ReadonlyArray<ReasonCode>): ReadonlyArray<ReasonCode> =>
    reasons.filter((reason) => reason === "missing_data" || reason === "unclear_outcome")

const sameValue = (left: unknown, right: unknown): boolean =>
    JSON.stringify(left ?? null) === JSON.stringify(right ?? null)

/** The number a field edit stands for; text that is not a number is no amount. */
const amountOf = (value: ProposalFieldValue): number | null => {
    if (typeof value === "number") return value
    if (value === null) return null
    return Number(value) || null
}

type FieldEdit = readonly [string, ProposalFieldValue]

const amountAfter = (edits: WorkEdits, fieldEdits: ReadonlyArray<FieldEdit>): number | null | undefined => {
    const edited = fieldEdits.find(([name]) => name === "amount_vnd")
    return edited === undefined ? edits.amount_vnd : amountOf(edited[1])
}

/**
 * The proposal after the person's edits, and whether they changed anything. A new amount is written both on the proposal and
 * in its fields; an edit of the `amount_vnd` field also sets the proposal's amount; a chosen candidate drops the others.
 */
export const mergeEdits = (before: Proposal, edits: WorkEdits): MergedProposal => {
    const draftChanged = edits.draft !== undefined && edits.draft !== before.draft
    const amountChanged = edits.amount_vnd !== undefined && !sameValue(edits.amount_vnd, before.amount_vnd)
    const fieldEdits = Object.entries(edits.fields ?? {}).filter(
        ([name, value]) => !sameValue(value, before.fields[name]),
    )
    const touchedAmount = amountChanged || fieldEdits.some(([name]) => name === "amount_vnd")
    const fields = {
        ...before.fields,
        ...(amountChanged ? { amount_vnd: edits.amount_vnd ?? null } : {}),
        ...Object.fromEntries(fieldEdits),
    }
    const chosen = edits.candidateId === undefined ? undefined : before.candidates
    const proposal: Proposal = {
        ...before,
        ...(draftChanged ? { draft: edits.draft } : {}),
        ...(touchedAmount ? { amount_vnd: amountAfter(edits, fieldEdits) } : {}),
        fields,
        ...(chosen === undefined
            ? {}
            : { candidates: chosen.filter((candidate) => candidate.id === edits.candidateId) }),
    }
    return { proposal, changed: draftChanged || amountChanged || fieldEdits.length > 0 }
}

/**
 * A person reviewed the proposal: the outcome is clear unless a candidate still has to be chosen, and the confidence of a
 * proposal without candidates is complete.
 */
export const reviewedByPerson = (proposal: Proposal): Proposal => {
    if (proposal.candidates !== undefined) {
        return proposal.candidates.length === 1 ? { ...proposal, outcome: "clear" } : proposal
    }
    const unsure = typeof proposal.confidence === "number" && proposal.confidence < 1
    return { ...proposal, outcome: "clear", ...(unsure ? { confidence: 1 } : {}) }
}

/** The text of a failure, cut to what an item keeps. */
export const failureText = (cause: unknown): string => {
    const text = cause instanceof Error ? cause.message : String(cause)
    return text.slice(0, MAX_ERROR_LENGTH)
}

const INTL_LOCALE: Readonly<Record<Locale, string>> = { vi: "vi-VN", en: "en-US" }

/** An amount in dong in the language of the reader. */
export const formatVnd = (amount: number, locale: Locale): string =>
    new Intl.NumberFormat(INTL_LOCALE[locale], { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(
        amount,
    )
