import type { AccountingLedgerEntry } from "@modules/domain/ledger"
import type { AccountingWaitingWorkRow as WorkItemView } from "@modules/domain/decisions"
import type { StaffRow as Staff } from "@modules/domain/staff"
import type { UpcomingDue } from "./accounting-desk.contracts"

/**
 * Plain data of the Accounting workbench (read side). Everything is derived from the records the flow already keeps:
 * invoices (internal payment records), transactions (bank credits), orders, accounting work items and decisions.
 * Only live records are read; test runs are left out of every figure and counted in `excludedTest`.
 */

/** One figure: money and record count. */
export interface AccountingMeasure {
    /** The VND amount. */
    readonly vnd: number
    /** The record count. */
    readonly count: number
}

/** One week of paid income. */
export interface AccountingWeekBar {
    /** The beginning of this week, ISO text. */
    readonly startIso: string
    /** The paid income of the week, VND. */
    readonly vnd: number
}

/** The month being looked at: the current one or the one before. */
export type AccountingPeriodKey = "this" | "last"

/** The figures of one calendar month (Vietnam time). */
export interface AccountingPeriod {
    /** The calendar month selector. */
    readonly key: AccountingPeriodKey
    /** The inclusive period beginning, ISO text. */
    readonly fromIso: string
    /** The exclusive period ending, ISO text. */
    readonly toIso: string
    /** Paid invoices whose payment date falls in the period. */
    readonly income: AccountingMeasure
    /** Invoices issued in the period that are still unpaid. */
    readonly receivable: AccountingMeasure
    /** Money received in the period that is not tied to an invoice yet. */
    readonly unmatched: AccountingMeasure
    /** The paid income bars for each week. */
    readonly weeks: ReadonlyArray<AccountingWeekBar>
}

/**
 * Receivable ageing: every open invoice by how old it is. The age counts from the due date when the invoice has one,
 * else from the day it was issued. d0 is 0 to 30 days, d30 is 31 to 60 days, d60 is more than 60 days.
 */
export interface AccountingAgeing {
    /** Open invoices aged zero to thirty days. */
    readonly d0: AccountingMeasure
    /** Open invoices aged thirty one to sixty days. */
    readonly d30: AccountingMeasure
    /** Open invoices aged more than sixty days. */
    readonly d60: AccountingMeasure
}

/** Work items waiting for a person, with the money already known. */
export interface AccountingWaiting {
    /** The number of waiting items. */
    readonly count: number
    /** The known amount of waiting work, in VND. */
    readonly knownVnd: number
    /** The number of waiting items without a known amount. */
    readonly unknownAmount: number
}

/** Whether a bank credit is tied to an invoice, needs a person, or has no invoice. */
export type AccountingMatchState = "matched" | "unclear" | "unmatched"
/** Where a bank credit was recorded from: the payment connector's feed, a person's manual entry, another input, or unknown. */
export type AccountingSourceKind = "connector" | "inbox" | "manual" | "other"
/** The state of an internal payment record. */
export type AccountingInvoiceStatus = "draft" | "issued" | "paid" | "void"

/** One bank credit with its match state. */
export interface AccountingCredit {
    /** The record identifier. */
    readonly id: string
    /** When the payment occurred, ISO text. */
    readonly occurredAt: string
    /** The amount, in VND. */
    readonly amount: number
    /** The payer name when known. */
    readonly payer: string | null
    /** The bank transfer reference when known. */
    readonly reference: string | null
    /** The payment matching state. */
    readonly match: AccountingMatchState
    /** The internal payment record number. */
    readonly invoiceNo: string | null
    /** The payment source kind. */
    readonly sourceKind: AccountingSourceKind
}

/** One invoice (an internal payment record). */
export interface AccountingInvoice {
    /** The record identifier. */
    readonly id: string
    /** The internal payment record number. */
    readonly invoiceNo: string
    /** The amount, in VND. */
    readonly amount: number
    /** The current record state. */
    readonly status: AccountingInvoiceStatus
    /** The customer name when known. */
    readonly customer: string | null
    /** The invoice issue time, ISO text. */
    readonly issuedAt: string | null
    /** The payment time, ISO text. */
    readonly paidAt: string | null
    /** The invoice due time, ISO text. */
    readonly dueAt: string | null
    /** The record creation time, ISO text. */
    readonly createdAt: string
    /** The order number when known. */
    readonly orderNo: string | null
}

/** An order that has no invoice yet. */
export interface AccountingOrder {
    /** The record identifier. */
    readonly id: string
    /** The order number when known. */
    readonly orderNo: string
    /** What the customer ordered. */
    readonly items: string
    /** The amount, in VND. */
    readonly amount: number | null
    /** The customer name when known. */
    readonly customer: string | null
    /** The record creation time, ISO text. */
    readonly createdAt: string
}

/** What a waiting accounting question is about. */
export type AccountingQuestionGroup = "unclear_payment" | "over_limit" | "missing_data" | "other"

/** One waiting accounting work item and what it is about. */
export interface AccountingQuestion {
    /** The waiting accounting work item. */
    readonly item: WorkItemView
    /** The reason this work needs a person. */
    readonly group: AccountingQuestionGroup
}

/** The two calendar months shown by the accounting workbench. */
export interface AccountingPeriods {
    /** The current calendar month. */
    readonly this: AccountingPeriod
    /** The previous calendar month. */
    readonly last: AccountingPeriod
}

/** The whole Accounting workbench for the signed-in workspace. */
export interface AccountingWorkbenchData {
    /** The read-side clock time, ISO text. */
    readonly now: string
    /** The current and previous calendar month figures. */
    readonly periods: AccountingPeriods
    /** All unpaid invoices grouped by their age. */
    readonly ageing: AccountingAgeing
    /** Waiting work counts and known amounts. */
    readonly waiting: AccountingWaiting
    /** The newest bank payment evidence. */
    readonly credits: ReadonlyArray<AccountingCredit>
    /** The display name of the connector that feeds payment credits (`payment.credits.list`), or null when none is connected. */
    readonly creditsSource: string | null
    /** The display name of the connector that feeds supplier invoices (`invoice.list`), or null when none is connected. */
    readonly payablesSource: string | null
    /** The tax deadlines and open supplier invoices due within the horizon, soonest first; null when the Brain has no tax profile. */
    readonly upcoming: ReadonlyArray<UpcomingDue> | null
    /** The days before a due date from which it counts as near (the tax profile's reminder days); null with no tax profile. */
    readonly reminderDays: number | null
    /** The newest internal invoice evidence. */
    readonly invoices: ReadonlyArray<AccountingInvoice>
    /** Orders that have not been invoiced. */
    readonly ordersWithoutInvoice: ReadonlyArray<AccountingOrder>
    /** Waiting accounting questions. */
    readonly questions: ReadonlyArray<AccountingQuestion>
    /** The staff assignment choices. */
    readonly staff: ReadonlyArray<Staff>
    /** The verified caller display name. */
    readonly ownerName: string
    /** The income and receivable ledger with lineage. */
    readonly ledger: ReadonlyArray<AccountingLedgerEntry>
    /** Whether the caller may add a correction. */
    readonly canAdjust: boolean
    /** False until the accounting_adjustments migration is applied: the correction form is then withheld. */
    readonly adjustmentsReady: boolean
    /** The test records left out of accounting figures. */
    readonly excludedTest: number
}
