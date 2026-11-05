import type { useFormatter, useTranslations } from "next-intl"
import { actionWordOf } from "@/hooks/actionWord"
import type {
    DeciderKind,
    DecisionKind,
    DecisionOutcome,
    DecisionRecord,
    GateReason,
    DecisionHistoryRowView,
} from "@/modules/types"
import { CONSOLE_ROUTES, leadHref } from "@/modules/routes"

/** The decision history filters, in the order the tabs show them. */
export const DECISION_KINDS: ReadonlyArray<DecisionKind> = ["policy", "human", "rejected"]

/** How many decisions the history reads at most. */
export const DECISIONS_LIMIT = 100

/** The message key of each kind filter. */
export const KIND_KEYS: Readonly<Record<DecisionKind, string>> = {
    policy: "kindPolicy",
    human: "kindHuman",
    rejected: "kindRejected",
}

/** The kind a query-string value names, or none. */
export const decisionKindOf = (value: string): DecisionKind | null =>
    DECISION_KINDS.find((kind) => kind === value) ?? null

/** The badge tone of a decision outcome. */
export const outcomeTone = (outcome: DecisionOutcome): "success" | "accent" | "warning" | "danger" => {
    if (outcome === "auto_done" || outcome === "completed") return "success"
    if (outcome === "approved") return "accent"
    if (outcome === "edited") return "warning"
    return "danger"
}

/** The history address for one pair of filters. */
export const decisionsHref = (kind: DecisionKind | null, department: string | null): string => {
    const query = new URLSearchParams()
    if (kind !== null) query.set("kind", kind)
    if (department !== null) query.set("dept", department)
    const text = query.toString()
    return text === "" ? CONSOLE_ROUTES.decisions : `${CONSOLE_ROUTES.decisions}?${text}`
}

/** The written basis of a decision note and what remains of it. */
export interface NoteParts {
    readonly basis: string | null
    readonly rest: string | null
}

const BASIS_PATTERN = /^(?:Căn cứ|Basis):([\s\S]+)$/ // vn-ok: matches the stored vi prefix of the basis note

/** Splits the owner's written basis out of a decision note; any other note is returned whole as the rest. */
const splitBasis = (note: string | null): NoteParts => {
    if (note === null || note === "") return { basis: null, rest: null }
    const match = BASIS_PATTERN.exec(note.trim())
    return match === null ? { basis: null, rest: note } : { basis: match[1]?.trim() ?? null, rest: null }
}

const DECIDERS: ReadonlyArray<DeciderKind> = ["policy", "owner", "staff"]
const OUTCOMES: ReadonlyArray<DecisionOutcome> = ["auto_done", "approved", "edited", "rejected", "expired", "completed"]
const REASONS: ReadonlyArray<GateReason> = [
    "routine",
    "missing_data",
    "over_authority",
    "unclear_outcome",
    "not_allowed",
]

/** The wire line of the back end `decisionHistory` query (text fields; the closed sets are checked here). */
interface DecisionWire {
    readonly id: string
    readonly work_item_id?: string | null
    readonly lead_id?: string | null
    readonly leadName?: string | null
    readonly department: string
    readonly action: string
    readonly decided_by: string
    readonly decider_kind: string
    readonly outcome: string
    readonly reason?: string | null
    readonly note: string
    readonly created_at: string
}

/** One back end decision line as the history screens use it: a value outside a closed set reads as the safe one. */
export const toDecisionRecord = (row: DecisionWire): DecisionRecord => ({
    id: row.id,
    work_item_id: row.work_item_id ?? null,
    lead_id: row.lead_id ?? null,
    leadName: row.leadName ?? null,
    department: row.department,
    action: row.action,
    decided_by: row.decided_by,
    decider_kind: DECIDERS.find((kind) => kind === row.decider_kind) ?? "policy",
    outcome: OUTCOMES.find((outcome) => outcome === row.outcome) ?? "rejected",
    reason: REASONS.find((reason) => reason === row.reason) ?? null,
    note: row.note,
    created_at: row.created_at,
})

/** The translators and formatter the rows of the history are worded with. */
export interface DecisionWords {
    readonly t: ReturnType<typeof useTranslations>
    readonly g: ReturnType<typeof useTranslations>
    readonly format: ReturnType<typeof useFormatter>
    readonly now: Date
}

/** The calendar day of an instant, as text. */
const dayOf = (words: DecisionWords, date: Date): string =>
    words.format.dateTime(date, { day: "2-digit", month: "2-digit", year: "numeric" })

/** The clock time of an instant, as text. */
const timeOf = (words: DecisionWords, date: Date): string =>
    words.format.dateTime(date, { hour: "2-digit", minute: "2-digit" })

/** When it happened for the list: the time today, "yesterday", or the day and month. */
const shortWhenOf = (words: DecisionWords, date: Date): string => {
    if (dayOf(words, date) === dayOf(words, words.now)) return timeOf(words, date)
    if (dayOf(words, date) === dayOf(words, new Date(words.now.getTime() - 86_400_000))) return words.t("yesterday")
    return words.format.dateTime(date, { day: "2-digit", month: "2-digit" })
}

/** One decision of the history in the words of the reader: the list line, the facts and why the gate asked. */
export const decisionRowViewOf = (words: DecisionWords, row: DecisionRecord): DecisionHistoryRowView => {
    const { g, t } = words
    const parts = splitBasis(row.note)
    const at = new Date(row.created_at)
    const decider = row.decider_kind === "policy" ? g("decider_policy") : row.decided_by
    const hasReason = row.reason !== null && row.reason !== "routine"
    return {
        id: row.id,
        title: actionWordOf(g, row.action),
        departmentLabel: g(`dept_${row.department}`),
        decider,
        isPolicy: row.decider_kind === "policy",
        outcomeLabel: g(`outcome_${row.outcome}`),
        outcomeTone: outcomeTone(row.outcome),
        line: [g(`dept_${row.department}`), decider, shortWhenOf(words, at)].join(" · "),
        whenShort: shortWhenOf(words, at),
        whenLong: `${timeOf(words, at)}, ${dayOf(words, at)}`,
        reasonTitle: hasReason ? g(`reason_${row.reason}`) : null,
        reasonHint: hasReason ? g(`reasonHint_${row.reason}`) : null,
        basis: parts.basis,
        note: parts.rest,
        leadHref: row.lead_id === null ? null : leadHref(row.lead_id),
        leadLabel: row.leadName ?? t("openLead"),
    }
}
