import type { LeadFlowType as LeadFlow, LeadRecordType } from "@/hooks/swr"
import type {
    LeadJourney,
    LeadPrimaryAction,
    LeadRecord,
    LeadStageId,
    ResponsibilityRecord,
    StepStatus,
} from "@/modules/types"
import type { BadgeTone } from "@starci/grammar/common"
import type { useTranslations } from "next-intl"
import type { FlowEntryView, FlowView } from "./useLeadFlowView"

/** The stages in journey order, as the tabs and the stage choice list them. */
export const STAGE_ORDER: ReadonlyArray<LeadStageId> = ["new", "qualified", "proposal", "won", "lost"]

/** The badge tone of each stage. */
export const STAGE_TONES: Readonly<Record<LeadStageId, BadgeTone>> = {
    new: "neutral",
    qualified: "accent",
    proposal: "warning",
    won: "success",
    lost: "danger",
}

/** The catalog key of the label of each stage in the leads namespace. */
export const STAGE_KEYS = {
    new: "stageNew",
    qualified: "stageQualified",
    proposal: "stageProposal",
    won: "stageWon",
    lost: "stageLost",
} as const satisfies Record<LeadStageId, string>

/** The badge tone of each step status. */
export const STATUS_TONES: Readonly<Record<StepStatus, BadgeTone>> = {
    open: "neutral",
    waiting_approval: "warning",
    done: "success",
}

/** The catalog key of the label of each step status. */
export const STATUS_KEYS = {
    open: "statusOpen",
    waiting_approval: "statusWaiting",
    done: "statusDone",
} as const satisfies Record<StepStatus, string>

/** The latest step that is not done, else the latest one, and the earlier ones, newest first. */
export const splitResponsibilities = (
    all: ReadonlyArray<ResponsibilityRecord>,
): { readonly current: ResponsibilityRecord | null; readonly previous: ReadonlyArray<ResponsibilityRecord> } => {
    const sorted = [...all].sort((a, b) => b.created_at.localeCompare(a.created_at))
    const current = sorted.find((item) => item.status !== "done") ?? sorted[0] ?? null
    return { current, previous: sorted.filter((item) => item !== current) }
}

/** What the header single primary action does for a lead right now. */
export const primaryActionOf = (detail: LeadJourney): LeadPrimaryAction => {
    const open = [...detail.responsibilities]
        .filter((step) => step.status !== "done")
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    if (detail.executions.some((draft) => draft.status === "pending_approval")) return { kind: "review" }
    if (open !== undefined) return { kind: "draft", responsibilityId: open.id }
    if (detail.lead.stage === "won" || detail.lead.stage === "lost") return { kind: "none" }
    return { kind: "propose" }
}

/** Date-only value (yyyy-mm-dd) of a due timestamp for the date field. */
export const dateOnly = (dueAt: string | null): string | null => (dueAt ? dueAt.slice(0, 10) : null)

/** Storage value for a picked date: noon UTC so every time zone shows the same day. */
export const dueFromDate = (date: string | null): string | null => (date ? `${date}T12:00:00.000Z` : null)

const DAY_MS = 86_400_000

const utcDay = (date: Date): number => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())

/** Whole days from the reader day to the due day (negative once overdue), compared by UTC calendar day; null without a valid due date. */
export const daysUntil = (dueAt: string | null, now: Date): number | null => {
    if (!dueAt) return null
    const due = new Date(dueAt)
    if (Number.isNaN(due.getTime())) return null
    return Math.round((utcDay(due) - utcDay(now)) / DAY_MS)
}

/** How long ago an instant was, in the largest whole unit; the reader formats it. */
export type AgeUnit = "now" | "minutes" | "hours" | "days" | "older"

/** The age of an instant against a server-supplied now, so server and browser agree. */
export const ageOf = (iso: string, nowIso: string): { readonly unit: AgeUnit; readonly n: number } => {
    const minutes = Math.max(0, Math.round((new Date(nowIso).getTime() - new Date(iso).getTime()) / 60_000))
    if (minutes < 1) return { unit: "now", n: 0 }
    if (minutes < 60) return { unit: "minutes", n: minutes }
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return { unit: "hours", n: hours }
    const days = Math.floor(hours / 24)
    return days < 30 ? { unit: "days", n: days } : { unit: "older", n: days }
}

/** The lead record every lead read carries, with the stage narrowed to a known one (an unknown stage reads as new). */
export const leadRecordOf = (lead: LeadRecordType): LeadRecord => {
    const { id, company, channel, need } = lead
    return {
        id,
        contact_name: lead.contactName,
        company,
        channel,
        need,
        stage: STAGE_ORDER.find((stage) => stage === lead.stage) ?? "new",
        context_summary: lead.contextSummary ?? null,
        origin: lead.origin ?? null,
        created_at: lead.createdAt,
    }
}

/** Groups lead activity into the sections drawn by the work-flow card. */
export const flowViewMapper = (
    t: ReturnType<typeof useTranslations<"lead">>,
    stepOf: (item: LeadFlow["workItems"][number]) => FlowEntryView,
    orderOf: (order: LeadFlow["orders"][number]) => FlowEntryView,
    invoiceOf: (invoice: LeadFlow["invoices"][number], orderNo: ReadonlyMap<string, string>) => FlowEntryView,
    paymentOf: (payment: LeadFlow["transactions"][number]) => FlowEntryView,
    decisionOf: (decision: LeadFlow["decisions"][number]) => FlowEntryView,
): ((flow: LeadFlow) => FlowView) => {
    return (flow) => {
        const items = [...flow.workItems].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        const orderNo = new Map(flow.orders.map((order) => [order.id, order.orderNo]))
        const none = t("flowNone")
        return {
            fact: t("flowFact", { count: items.length }),
            steps: items.map(stepOf),
            hasSimulated:
                items.some((item) => item.origin === "simulated") ||
                flow.orders.some((order) => order.origin === "simulated"),
            sections: [
                { id: "orders", title: t("flowOrders"), emptyText: none, entries: flow.orders.map(orderOf) },
                {
                    id: "invoices",
                    title: t("flowInvoices"),
                    emptyText: none,
                    entries: flow.invoices.map((invoice) => invoiceOf(invoice, orderNo)),
                },
                {
                    id: "payments",
                    title: t("flowPayments"),
                    emptyText: none,
                    entries: flow.transactions.map(paymentOf),
                },
                {
                    id: "decisions",
                    title: t("flowDecisions"),
                    emptyText: none,
                    entries: flow.decisions.map(decisionOf),
                },
            ],
        }
    }
}
