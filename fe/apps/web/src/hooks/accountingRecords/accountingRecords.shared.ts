import {
    dayOf,
    invoiceToneOf,
    ledgerToneOf,
    matchToneOf,
    moneyOf,
    originLabelOf,
    sourceKeyOf,
    accountingStampOf,
    type AccountingFormat,
    type AccountingTone,
    type AccountingTranslator,
} from "@/modules/utils"
import type { AccountingCredit, AccountingInvoice, AccountingLedgerEntry, AccountingOrder } from "@/modules/types"

/** One status mark on a record row. */
export interface AccountingRecordBadgeView {
    readonly id: string
    readonly label: string
    readonly tone: AccountingTone
    readonly isDot: boolean
}

/** One record row, as plain words. */
export interface AccountingRecordView {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly badges: ReadonlyArray<AccountingRecordBadgeView>
    readonly amount: string
    readonly footnote: string
}

/** The status of a record: its words and its tone. */
interface RecordStatus {
    readonly label: string
    readonly tone: AccountingTone
}

/** A status mark with a dot and its tone, followed by a plain neutral mark. */
const marksOf = (status: RecordStatus, second: string): ReadonlyArray<AccountingRecordBadgeView> => [
    { id: "status", label: status.label, tone: status.tone, isDot: true },
    { id: "second", label: second, tone: "neutral", isDot: false },
]

/** The date line of an invoice: when it was paid, else when it is due, else when it was issued. */
const invoiceDateOf = (t: AccountingTranslator, format: AccountingFormat, invoice: AccountingInvoice): string => {
    if (invoice.status === "paid") return t("paidOn", { date: dayOf(format, invoice.paidAt) })
    if (invoice.dueAt !== null) return t("dueOn", { date: dayOf(format, invoice.dueAt) })
    return t("issuedOn", { date: dayOf(format, invoice.issuedAt ?? invoice.createdAt) })
}

/** Bank credits as record rows. */
export const creditRecordsOf = (
    t: AccountingTranslator,
    format: AccountingFormat,
    credits: ReadonlyArray<AccountingCredit>,
): ReadonlyArray<AccountingRecordView> =>
    credits.map((credit) => ({
        id: credit.id,
        title: credit.payer ?? t("payerUnknown"),
        description: credit.reference ?? t("noReference"),
        badges: marksOf(
            { label: t(`match_${credit.match}`), tone: matchToneOf(credit.match) },
            originLabelOf(t, credit.origin),
        ),
        amount: moneyOf(format, credit.amount),
        footnote: [
            `${dayOf(format, credit.occurredAt)} · ${t(sourceKeyOf(credit.sourceKind))}`,
            credit.invoiceNo === null ? "" : t("matchedTo", { no: credit.invoiceNo }),
        ]
            .filter(Boolean)
            .join(" · "),
    }))

/** Invoices as record rows. */
export const invoiceRecordsOf = (
    t: AccountingTranslator,
    format: AccountingFormat,
    invoices: ReadonlyArray<AccountingInvoice>,
): ReadonlyArray<AccountingRecordView> =>
    invoices.map((invoice) => ({
        id: invoice.id,
        title: invoice.invoiceNo,
        description:
            [invoice.customer, invoice.orderNo === null ? null : t("fromOrder", { no: invoice.orderNo })]
                .filter(Boolean)
                .join(" · ") || "-",
        badges: marksOf(
            { label: t(`invoice_${invoice.status}`), tone: invoiceToneOf(invoice.status) },
            originLabelOf(t, invoice.origin),
        ),
        amount: moneyOf(format, invoice.amount),
        footnote: invoiceDateOf(t, format, invoice),
    }))

/** Orders that have no invoice yet as record rows. */
export const orderRecordsOf = (
    t: AccountingTranslator,
    format: AccountingFormat,
    orders: ReadonlyArray<AccountingOrder>,
): ReadonlyArray<AccountingRecordView> =>
    orders.map((order) => ({
        id: order.id,
        title: order.orderNo,
        description: [order.customer, order.items].filter(Boolean).join(" · ") || "-",
        badges: marksOf({ label: t("noInvoiceYet"), tone: "warning" }, originLabelOf(t, order.origin)),
        amount: order.amount === null ? t("noAmount") : moneyOf(format, order.amount),
        footnote: dayOf(format, order.createdAt),
    }))

/** Ledger lines as record rows. */
export const ledgerRecordsOf = (
    t: AccountingTranslator,
    format: AccountingFormat,
    entries: ReadonlyArray<AccountingLedgerEntry>,
): ReadonlyArray<AccountingRecordView> =>
    entries.map((entry) => ({
        id: entry.id,
        title: entry.description,
        description: [
            accountingStampOf(format, entry.at),
            entry.linked === null ? null : t("linkedTo", { ref: entry.linked }),
        ]
            .filter(Boolean)
            .join(" · "),
        badges: marksOf(
            { label: t(`ledgerStatus_${entry.status}`), tone: ledgerToneOf(entry.status) },
            t(`kind_${entry.kind}`),
        ),
        amount: moneyOf(format, entry.amount),
        footnote: [
            originLabelOf(t, entry.origin),
            entry.adjustmentCount > 0 ? t("adjustedN", { n: entry.adjustmentCount }) : "",
        ]
            .filter(Boolean)
            .join(" · "),
    }))
