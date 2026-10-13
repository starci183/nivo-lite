import type { Staff, WorkItemView } from "@/lib/flow-types"

/**
 * Plain data of the Accounting workbench (read side). Everything is derived from the records the flow already keeps:
 * invoices (internal payment records), transactions (bank credits), orders, accounting work items and decisions.
 * Test runs are left out of every figure and counted in `excludedTest`.
 */

/** Where a record came from. Live and simulated money are never added together. */
export type AccountingOrigin = "live" | "simulated"

/** A number split by where the records came from. */
export interface AccountingSplit {
    readonly live: number
    readonly simulated: number
}

/** One figure: money and record count, each split by origin. Never merged into one number. */
export interface AccountingMeasure {
    readonly vnd: AccountingSplit
    readonly count: AccountingSplit
}

/** One week of paid income, split by origin. */
export interface AccountingWeekBar {
    readonly startIso: string
    readonly live: number
    readonly simulated: number
}

/** The month being looked at: the current one or the one before. */
export type AccountingPeriodKey = "this" | "last"

/** The figures of one calendar month (Vietnam time). */
export interface AccountingPeriod {
    readonly key: AccountingPeriodKey
    readonly fromIso: string
    readonly toIso: string
    /** Paid invoices whose payment date falls in the period. */
    readonly income: AccountingMeasure
    /** Invoices issued in the period that are still unpaid. */
    readonly receivable: AccountingMeasure
    /** Money received in the period that is not tied to an invoice yet. */
    readonly unmatched: AccountingMeasure
    readonly weeks: ReadonlyArray<AccountingWeekBar>
}

/**
 * Receivable ageing: every open invoice by how old it is. The age counts from the due date when the invoice has one,
 * else from the day it was issued. d0 is 0 to 30 days, d30 is 31 to 60 days, d60 is more than 60 days.
 */
export interface AccountingAgeing {
    readonly d0: AccountingMeasure
    readonly d30: AccountingMeasure
    readonly d60: AccountingMeasure
}

/** Work items waiting for a person, by origin, with the money already known. */
export interface AccountingWaiting {
    readonly count: AccountingSplit
    readonly knownVnd: number
    readonly unknownAmount: number
}

/** Whether a bank credit is tied to an invoice, needs a person, or has no invoice. */
export type AccountingMatchState = "matched" | "unclear" | "unmatched"
/** Where a bank credit was recorded from. */
export type AccountingSourceKind = "vietcombank" | "inbox" | "manual" | "other"
/** The state of an internal payment record. */
export type AccountingInvoiceStatus = "draft" | "issued" | "paid" | "void"

/** One bank credit with its match state. */
export interface AccountingCredit {
    readonly id: string
    readonly occurredAt: string
    readonly amount: number
    readonly payer: string | null
    readonly reference: string | null
    readonly origin: AccountingOrigin
    readonly match: AccountingMatchState
    readonly invoiceNo: string | null
    readonly sourceKind: AccountingSourceKind
}

/** One invoice (an internal payment record). */
export interface AccountingInvoice {
    readonly id: string
    readonly invoiceNo: string
    readonly amount: number
    readonly status: AccountingInvoiceStatus
    readonly origin: AccountingOrigin
    readonly customer: string | null
    readonly issuedAt: string | null
    readonly paidAt: string | null
    readonly dueAt: string | null
    readonly createdAt: string
    readonly orderNo: string | null
}

/** An order that has no invoice yet. */
export interface AccountingOrder {
    readonly id: string
    readonly orderNo: string
    readonly items: string
    readonly amount: number | null
    readonly origin: AccountingOrigin
    readonly customer: string | null
    readonly createdAt: string
}

/** What kind of record a lineage step is. */
export type AccountingLineageKind = "order" | "invoice" | "payment" | "decision" | "adjustment"

/** One step of where a ledger line came from. */
export interface AccountingLineageStep {
    readonly kind: AccountingLineageKind
    readonly title: string
    readonly detail: string | null
    readonly at: string | null
    readonly status: string | null
    readonly amount: number | null
}

/** Whether a ledger line is money in or an amount owed. */
export type AccountingLedgerKind = "income" | "receivable"
/** The state of a ledger line. */
export type AccountingLedgerStatus = "issued" | "paid" | "void" | "settled" | "matched" | "unmatched" | "needs_review"
/** The kind of record a correction points at. */
export type AccountingTargetType = "invoice" | "transaction"

/** One line of the ledger derived from invoices and payments. */
export interface AccountingLedgerEntry {
    /** "inv:<id>" or "tx:<id>" */
    readonly id: string
    readonly targetType: AccountingTargetType
    readonly targetId: string
    readonly at: string
    readonly description: string
    readonly kind: AccountingLedgerKind
    readonly amount: number
    readonly status: AccountingLedgerStatus
    readonly linked: string | null
    readonly origin: AccountingOrigin
    readonly lineage: ReadonlyArray<AccountingLineageStep>
    readonly adjustmentCount: number
}

/** What a waiting accounting question is about. */
export type AccountingQuestionGroup = "unclear_payment" | "over_limit" | "missing_data" | "other"

/** One waiting accounting work item and what it is about. */
export interface AccountingQuestion {
    readonly item: WorkItemView
    readonly group: AccountingQuestionGroup
}

/** The whole Accounting workbench for the signed-in workspace. */
export interface AccountingWorkbenchData {
    readonly now: string
    readonly periods: { readonly this: AccountingPeriod; readonly last: AccountingPeriod }
    readonly ageing: AccountingAgeing
    readonly waiting: AccountingWaiting
    readonly credits: ReadonlyArray<AccountingCredit>
    readonly invoices: ReadonlyArray<AccountingInvoice>
    readonly ordersWithoutInvoice: ReadonlyArray<AccountingOrder>
    readonly questions: ReadonlyArray<AccountingQuestion>
    readonly staff: ReadonlyArray<Staff>
    readonly ownerName: string
    readonly ledger: ReadonlyArray<AccountingLedgerEntry>
    readonly canAdjust: boolean
    /** False until the accounting_adjustments migration is applied: the correction form is then withheld. */
    readonly adjustmentsReady: boolean
    readonly excludedTest: number
}
