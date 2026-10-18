"use client"

import type {
    LeadFlowDecisionType as DecisionRow,
    LeadFlowInvoiceType as Invoice,
    LeadFlowType as LeadFlow,
    LeadFlowOrderType as Order,
    LeadFlowTransactionType as Transaction,
    LeadFlowWorkItemType as WorkItemView,
} from "@/hooks/swr"
import type { BadgeTone } from "@starci/grammar/common"
import { useFormatter, useTranslations } from "next-intl"
import { flowViewMapper } from "./leads.shared"

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

const line = (id: string, text: string | null | undefined, strong = false) => (text ? [{ id, text, strong }] : [])

const joined = (parts: ReadonlyArray<string | null | undefined>): string => parts.filter(Boolean).join(" · ")

/** The words and formats the work flow card needs, resolved once; the returned function turns one lead flow into its view. */
export const useLeadFlowView = (): ((flow: LeadFlow) => FlowView) => {
    const t = useTranslations("lead")
    const g = useTranslations("governance")
    const format = useFormatter()
    const vnd = (amount: number | null | undefined): string =>
        amount == null ? "—" : format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const when = (iso: string) => ({
        iso,
        label: format.dateTime(new Date(iso), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
    })
    const day = (iso: string): string =>
        format.dateTime(new Date(iso), { day: "2-digit", month: "short", year: "numeric" })

    const stepOf = stepOfOf(g, when, t)
    const orderOf = orderEntryMapper(g, vnd)

    const invoiceOf = (invoice: Invoice, orderNo: ReadonlyMap<string, string>): FlowEntryView => ({
        id: invoice.id,
        head: `${invoice.invoiceNo} · ${vnd(invoice.amountVnd)}`,
        when: null,
        badge: { label: g(`invoice_${invoice.status}`), tone: toneOf(INVOICE_TONES, invoice.status, "neutral") },
        reason: null,
        lines: line(
            "meta",
            joined([
                invoice.orderId ? (orderNo.get(invoice.orderId) ?? null) : null,
                invoice.issuedBy ? t("flowInvoiceBy", { name: invoice.issuedBy }) : null,
                invoice.dueAt ? t("flowDueOn", { date: day(invoice.dueAt) }) : null,
                invoice.paidAt ? t("flowPaidOn", { date: day(invoice.paidAt) }) : null,
                g("internalInvoice"),
            ]),
        ),
    })
    const paymentOf = (payment: Transaction): FlowEntryView => ({
        id: payment.id,
        head: `${vnd(payment.amountVnd)} · ${payment.payer ?? g("channel_bank")}`,
        when: null,
        badge: { label: g(`tx_${payment.status}`), tone: toneOf(PAYMENT_TONES, payment.status, "warning") },
        reason: null,
        lines: line(
            "meta",
            joined([
                payment.reference ? t("flowUnmatchedRef", { ref: payment.reference }) : null,
                when(payment.occurredAt).label,
            ]),
        ),
    })
    const decisionOf = (decision: DecisionRow): FlowEntryView => {
        const department = g(`dept_${decision.department}`)
        const action = g(`action_${decision.action}`)
        const gateReason = decision.reason ? g(`reason_${decision.reason}`) : null
        return {
            id: decision.id,
            head: `${department} · ${action}`,
            when: null,
            badge: {
                label: g(`outcome_${decision.outcome}`),
                tone: toneOf(DECISION_TONES, decision.outcome, "success"),
            },
            reason: null,
            lines: [
                ...line(
                    "by",
                    t("flowDecidedBy", {
                        name: decision.deciderKind === "policy" ? g("decider_policy") : decision.decidedBy,
                        time: when(decision.createdAt).label,
                    }),
                ),
                ...line("gate", decision.reason ? `${t("flowGate")}: ${gateReason}` : null),
                ...line("note", decision.note, true),
            ],
        }
    }

    return flowViewMapper(t, stepOf, orderOf, invoiceOf, paymentOf, decisionOf)
}

const stepOfOf = (
    g: ReturnType<typeof useTranslations<"governance">>,
    when: (iso: string) => { iso: string; label: string },
    t: ReturnType<typeof useTranslations<"lead">>,
) => {
    return (item: WorkItemView): FlowEntryView => {
        const summary = item.result?.summary ?? item.proposal.summary
        return {
            id: item.id,
            head: joined([
                g(`dept_${item.department}`),
                g(`action_${item.action}`),
                g(`status_${item.status}`),
                item.decidedPath ? g(`path_${item.decidedPath}`) : null,
            ]),
            when: when(item.createdAt),
            badge: { label: g(`status_${item.status}`), tone: toneOf(STEP_TONES, item.status, "neutral") },
            reason: item.reason ? g(`reason_${item.reason}`) : null,
            lines: [
                ...line(
                    "evidence",
                    joined([
                        g(`evidence_${item.evidenceState}`),
                        item.origin === "simulated" ? g("origin_simulated") : null,
                    ]),
                ),
                ...line("summary", summary, true),
                ...line("error", item.error ? `${t("flowError")}: ${item.error}` : null),
                ...line("staff", item.assignedStaffName ? t("flowAssignedTo", { name: item.assignedStaffName }) : null),
            ],
        }
    }
}

/** Presents the order identity, value and status for the lead flow. */
const orderEntryMapper =
    (g: ReturnType<typeof useTranslations<"governance">>, vnd: (amount: number | null | undefined) => string) =>
    (order: Order): FlowEntryView => ({
        id: order.id,
        head: `${order.orderNo} · ${vnd(order.amountVnd)}`,
        when: null,
        badge: { label: g(`order_${order.status}`), tone: toneOf(ORDER_TONES, order.status, "success") },
        reason: null,
        lines: line("items", order.items || null),
    })
