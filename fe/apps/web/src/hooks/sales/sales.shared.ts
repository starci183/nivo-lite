import { SALES_WORKBENCH_TABS as SALES_TABS } from "@/modules/types"
import type { BadgeTone } from "@starci/grammar/common"
import { leadStageLabel } from "@/modules/utils"
import type {
    FlowDecisionRow,
    FlowEvidenceState,
    AttentionKind,
    LeadStageId,
    HandoffRow,
    HandoffItemView,
} from "@/modules/types"
import type { useFormatter, useTranslations } from "next-intl"
import { agentHref } from "@/modules/installations"
import { leadPath } from "@/modules/routes"
const MIN = 60000
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
export { DEAL_STAGES } from "@/modules/sales"
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
export { SALES_TABS }
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
): {
    readonly unit: "now" | "minutes" | "hours" | "days"
    readonly n: number
} => {
    const ms = Math.max(0, Date.parse(nowIso) - Date.parse(sinceIso))
    if (ms < MIN) return { unit: "now", n: 0 }
    if (ms < HOUR) return { unit: "minutes", n: Math.floor(ms / MIN) }
    if (ms < DAY) return { unit: "hours", n: Math.floor(ms / HOUR) }
    return { unit: "days", n: Math.floor(ms / DAY) }
}
/** True when the age is at least a day (rows turn urgent). */
export const isStale = (sinceIso: string, nowIso: string): boolean => Date.parse(nowIso) - Date.parse(sinceIso) >= DAY
/** Today in Vietnam time as YYYY-MM-DD, from the server instant. */
export const vietnamDay = (nowIso: string): string =>
    new Date(Date.parse(nowIso) + VN_OFFSET_MS).toISOString().slice(0, 10)
/** Facts used to resolve the confirmed-order and invoice rows. */
interface HandoffItemsInput {
    readonly t: ReturnType<typeof useTranslations<"workbenchSales">>
    readonly format: ReturnType<typeof useFormatter>
    readonly rows: ReadonlyArray<HandoffRow>
    readonly notes: Readonly<Record<string, string>>
    readonly activeKey: string | null
}
/** The existing invoice tone, else the failed or waiting hand-off tone. */
const handoffInvoiceToneOf = (row: HandoffRow): BadgeTone => {
    if (row.invoice) return INVOICE_TONES[row.invoice.status] ?? "neutral"
    return row.work?.status === "failed" ? "danger" : "warning"
}
/** Resolves the original hand-off rows without carrying a command or a drawing through data. */
export const handoffItemsOf = ({
    t,
    format,
    rows,
    notes,
    activeKey,
}: HandoffItemsInput): ReadonlyArray<HandoffItemView> => {
    const money = (amount: number | null) =>
        amount === null ? "—" : format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const day = (iso: string) => format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit" })
    return rows.map((row) => {
        const isFailed = row.work?.status === "failed" && !row.invoice
        return {
            key: row.key,
            orderId: row.orderId,
            orderLabel: t(`order_${row.orderStatus}`),
            orderTone: row.orderStatus === "won_without_order" ? "neutral" : "success",
            invoiceLabel: row.invoice ? t(`invoice_${row.invoice.status}`) : t("invoiceNone"),
            invoiceTone: handoffInvoiceToneOf(row),
            confirmed: row.confirmedAt ? day(row.confirmedAt) : null,
            customer: row.customer,
            leadHref: row.leadId === null ? null : leadPath(row.leadId),
            detail: [row.orderNo, row.items].filter(Boolean).join(" · "),
            amount: money(row.invoice?.amountVnd ?? row.amountVnd),
            invoiceLine: row.invoice ? t("invoiceLine", { no: row.invoice.no }) : null,
            shippedLine: row.shippedAt
                ? t("shippedLine", {
                      carrier: row.carrier ?? "—",
                      code: row.trackingCode ?? "—",
                      date: day(row.shippedAt),
                  })
                : null,
            workText: row.work && !row.invoice ? t(`work_${row.work.status}`) : null,
            errorText: isFailed && row.work?.error ? row.work.error : null,
            hint: row.orderStatus === "won_without_order" && !row.work ? t("wonNoOrderHint") : null,
            note: notes[row.key] || null,
            error: null,
            canRun:
                row.orderId !== null && row.orderStatus === "confirmed" && !row.invoice && (row.canHandoff || isFailed),
            runLabel: isFailed ? t("handoffRetry") : t("handoff"),
            canShip: row.canShip,
            isRunBusy: activeKey === row.key,
        }
    })
}

/** The words of a lead stage in the language of the page that asks, the one set the desk and the pipeline share. */
export const stageWordOf = (t: Parameters<typeof leadStageLabel>[0], stage: LeadStageId): string =>
    leadStageLabel(t, stage)
