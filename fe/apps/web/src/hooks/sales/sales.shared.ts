import type { BadgeTone } from "@starci/grammar/common"
import type { FlowDecisionRow, FlowEvidenceState } from "@/modules/types"
import { agentHref } from "@/modules/installations"
import type { AttentionKind, LeadStageId } from "@/modules/types"

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const VN_OFFSET_MS = 7 * HOUR

/** The badge tone of each reason a row needs a person. */
export const ATTENTION_TONES: Readonly<Record<AttentionKind, BadgeTone>> = {
    decision: "warning",
    clarify: "warning",
    failed: "danger",
    overdue: "danger",
    awaiting_reply: "accent",
}

/** The badge tone of how much evidence backs something NIVO did. */
export const EVIDENCE_TONES: Readonly<Record<FlowEvidenceState, BadgeTone>> = {
    pending: "warning",
    captured: "neutral",
    reviewed: "accent",
    verified: "success",
    customer_confirmed: "success",
}

/** The badge tone of how a decision was made. */
export const OUTCOME_TONES: Readonly<Record<FlowDecisionRow["outcome"], BadgeTone>> = {
    auto_done: "success",
    approved: "accent",
    edited: "warning",
    rejected: "danger",
}

/** The badge tone of an invoice status. */
export const INVOICE_TONES: Readonly<Record<string, BadgeTone>> = {
    draft: "neutral",
    issued: "accent",
    paid: "success",
    void: "danger",
}

/** The stages a deal can be moved to. */
export const DEAL_STAGES: ReadonlyArray<LeadStageId> = ["new", "qualified", "proposal", "won", "lost"]

/** The open lanes of the board. */
export const OPEN_LANES: ReadonlyArray<LeadStageId> = ["new", "qualified", "proposal"]

/** The longest-known source names the conversion line names. */
export const SOURCE_KEYS = ["telegram", "zalo", "website", "facebook", "email", "phone", "manual", "bank"] as const

/** The data fields NIVO can ask a person for. */
export const KNOWN_FIELDS = ["contact_name", "need", "contact", "customer", "items", "amount_vnd"] as const

/** The badge tone of a stage on the Sales workbench. */
export const stageToneOf = (stage: LeadStageId): BadgeTone => {
    if (stage === "won") return "success"
    if (stage === "lost") return "danger"
    if (stage === "proposal") return "accent"
    return "neutral"
}

/** The tabs of the Sales workbench. */
export const SALES_TABS = ["attention", "pipeline", "decisions", "handoff", "contracts", "activity"] as const

/** One tab of the Sales workbench. */
export type SalesTab = (typeof SALES_TABS)[number]

/** Narrows a text to a tab of the Sales workbench. */
export const salesTabOf = (key: string | null | undefined): SalesTab | null =>
    SALES_TABS.find((tab) => tab === key) ?? null

/** The Decisions tab opened on one pending decision (a link, so the page keys on it and the tab opens at the row). */
export const decisionHref = (decisionId: string): string =>
    agentHref("sales", null, "workbench", new URLSearchParams({ tab: "decisions", focus: decisionId }).toString())

/** DOM id of one pending decision, so the Attention surface can jump to it. */
export const decisionAnchor = (id: string): string => `sales-decision-${id}`

/** How long ago `sinceIso` was, measured against the server `nowIso` so server and browser render the same text. */
export const ageParts = (
    sinceIso: string,
    nowIso: string,
): { readonly unit: "now" | "minutes" | "hours" | "days"; readonly n: number } => {
    const ms = Math.max(0, Date.parse(nowIso) - Date.parse(sinceIso))
    if (ms < MIN) return { unit: "now", n: 0 }
    if (ms < HOUR) return { unit: "minutes", n: Math.floor(ms / MIN) }
    if (ms < DAY) return { unit: "hours", n: Math.floor(ms / HOUR) }
    return { unit: "days", n: Math.floor(ms / DAY) }
}

/** True when the age is at least a day (rows turn urgent). */
export const isStale = (sinceIso: string, nowIso: string): boolean => Date.parse(nowIso) - Date.parse(sinceIso) >= DAY

/** Digits of a typed amount (45.000.000 becomes 45000000); null when empty. */
export const parseAmount = (value: string): number | null => {
    const only = value.replace(/[^\d]/g, "")
    return only ? Number(only) : null
}

/** Today in Vietnam time as YYYY-MM-DD, from the server instant. */
export const vietnamDay = (nowIso: string): string =>
    new Date(Date.parse(nowIso) + VN_OFFSET_MS).toISOString().slice(0, 10)
