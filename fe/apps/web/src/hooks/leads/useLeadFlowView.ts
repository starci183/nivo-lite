import type { BadgeTone } from "@starci/grammar/common"
import { useFormatter, useTranslations } from "next-intl"
import type { DecisionRow, Invoice, LeadFlow, Order, Transaction, WorkItemView } from "@/lib/flow-types"

/** One entry of the work flow card: what happened, when, how it stands and the lines that qualify it. */
export interface FlowEntryView {
    readonly id: string
    readonly head: string
    readonly when: { readonly iso: string; readonly label: string } | null
    readonly badge: { readonly label: string; readonly tone: BadgeTone } | null
    readonly reason: string | null
    readonly lines: ReadonlyArray<{ readonly id: string; readonly text: string; readonly strong: boolean }>
}

/** One section of the card: its heading, what to say when it is empty and its entries. */
export interface FlowSectionView {
    readonly id: string
    readonly title: string
    readonly emptyText: string
    readonly entries: ReadonlyArray<FlowEntryView>
}

/** Everything the work flow card shows about one lead, already worded. */
export interface FlowView {
    readonly fact: string
    readonly steps: ReadonlyArray<FlowEntryView>
    readonly hasSimulated: boolean
    readonly sections: ReadonlyArray<FlowSectionView>
}

type Tones = Readonly<Record<string, BadgeTone>>

const STEP_TONES: Tones = { done: "success", waiting_decision: "warning", failed: "danger", rejected: "danger" }
const ORDER_TONES: Tones = { cancelled: "danger", draft: "neutral" }
const INVOICE_TONES: Tones = { paid: "success", void: "danger" }
const PAYMENT_TONES: Tones = { matched: "success" }
const DECISION_TONES: Tones = { rejected: "danger", auto_done: "neutral" }

const toneOf = (tones: Tones, key: string, fallback: BadgeTone): BadgeTone => tones[key] ?? fallback

const line = (id: string, text: string | null, strong = false) => (text ? [{ id, text, strong }] : [])

const joined = (parts: ReadonlyArray<string | null>): string => parts.filter(Boolean).join(" · ")

/** The words and formats the work flow card needs, resolved once; the returned function turns one lead flow into its view. */
export const useLeadFlowView = (): ((flow: LeadFlow) => FlowView) => {
    const t = useTranslations("lead")
    const g = useTranslations("governance")
    const format = useFormatter()
    const vnd = (amount: number | null): string =>
        amount === null ? "—" : format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const when = (iso: string) => ({
        iso,
        label: format.dateTime(new Date(iso), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
    })
    const day = (iso: string): string =>
        format.dateTime(new Date(iso), { day: "2-digit", month: "short", year: "numeric" })

    const stepOf = (item: WorkItemView): FlowEntryView => {
        const summary = item.result?.summary ?? item.proposal.summary
        return {
            id: item.id,
            head: joined([
                g(`dept_${item.department}`),
                g(`action_${item.action}`),
                g(`status_${item.status}`),
                item.decided_path ? g(`path_${item.decided_path}`) : null,
            ]),
            when: when(item.created_at),
            badge: { label: g(`status_${item.status}`), tone: toneOf(STEP_TONES, item.status, "neutral") },
            reason: item.reason ? g(`reason_${item.reason}`) : null,
            lines: [
                ...line(
                    "evidence",
                    joined([
                        g(`evidence_${item.evidence_state}`),
                        item.origin === "simulated" ? g("origin_simulated") : null,
                    ]),
                ),
                ...line("summary", summary, true),
                ...line("error", item.error ? `${t("flowError")}: ${item.error}` : null),
                ...line("staff", item.assignedStaffName ? t("flowAssignedTo", { name: item.assignedStaffName }) : null),
            ],
        }
    }
    const orderOf = (order: Order): FlowEntryView => ({
        id: order.id,
        head: `${order.order_no} · ${vnd(order.amount_vnd)}`,
        when: null,
        badge: { label: g(`order_${order.status}`), tone: toneOf(ORDER_TONES, order.status, "success") },
        reason: null,
        lines: line("items", order.items || null),
    })
    const invoiceOf = (invoice: Invoice, orderNo: ReadonlyMap<string, string>): FlowEntryView => ({
        id: invoice.id,
        head: `${invoice.invoice_no} · ${vnd(invoice.amount_vnd)}`,
        when: null,
        badge: { label: g(`invoice_${invoice.status}`), tone: toneOf(INVOICE_TONES, invoice.status, "neutral") },
        reason: null,
        lines: line(
            "meta",
            joined([
                invoice.order_id ? (orderNo.get(invoice.order_id) ?? null) : null,
                invoice.issued_by ? t("flowInvoiceBy", { name: invoice.issued_by }) : null,
                invoice.due_at ? t("flowDueOn", { date: day(invoice.due_at) }) : null,
                invoice.paid_at ? t("flowPaidOn", { date: day(invoice.paid_at) }) : null,
                g("internalInvoice"),
            ]),
        ),
    })
    const paymentOf = (payment: Transaction): FlowEntryView => ({
        id: payment.id,
        head: `${vnd(payment.amount_vnd)} · ${payment.payer ?? g("channel_bank")}`,
        when: null,
        badge: { label: g(`tx_${payment.status}`), tone: toneOf(PAYMENT_TONES, payment.status, "warning") },
        reason: null,
        lines: line(
            "meta",
            joined([
                payment.reference ? t("flowUnmatchedRef", { ref: payment.reference }) : null,
                when(payment.occurred_at).label,
            ]),
        ),
    })
    const decisionOf = (decision: DecisionRow): FlowEntryView => ({
        id: decision.id,
        head: `${g(`dept_${decision.department}`)} · ${g(`action_${decision.action}`)}`,
        when: null,
        badge: { label: g(`outcome_${decision.outcome}`), tone: toneOf(DECISION_TONES, decision.outcome, "success") },
        reason: null,
        lines: [
            ...line(
                "by",
                t("flowDecidedBy", {
                    name: decision.decider_kind === "policy" ? g("decider_policy") : decision.decided_by,
                    time: when(decision.created_at).label,
                }),
            ),
            ...line("gate", decision.reason ? `${t("flowGate")}: ${g(`reason_${decision.reason}`)}` : null),
            ...line("note", decision.note, true),
        ],
    })

    return (flow) => {
        const items = [...flow.workItems].sort((a, b) => a.created_at.localeCompare(b.created_at))
        const orderNo = new Map(flow.orders.map((order) => [order.id, order.order_no]))
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
