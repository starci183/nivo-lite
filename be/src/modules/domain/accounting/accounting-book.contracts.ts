import type { AccountingAdjustmentRow } from "@modules/domain/accounting-adjustments"
import type { AccountingDecisionRow } from "@modules/domain/decisions"
import type { InvoiceAccountingRow } from "@modules/domain/invoices"
import type { SalesOrderListRow } from "@modules/domain/orders"
import type { TransactionAccountingRow } from "@modules/domain/transactions"
import type { WorkItemsService } from "@modules/domain/work-items"

/** The accounting lineage projection returned by the work-item owner. */
export type BookWork = Awaited<ReturnType<WorkItemsService["listAccounting"]>>[number]

/** The customer labels attached to an accounting order. */
export interface BookLead {
    /** The contact name. */
    readonly contact_name: string | null
    /** The company name. */
    readonly company: string | null
}

/** An order with the customer labels accounting reads. */
export interface BookOrder extends SalesOrderListRow {
    /** The customer names, absent when no lead is attached. */
    readonly lead: BookLead | null
}
/** The workspace-owned records from which the accounting workbench and ledger are derived. */
export interface AccountingBook {
    /** Internal payment records, newest first. */
    readonly invoices: ReadonlyArray<InvoiceAccountingRow>
    /** Bank payments, newest first. */
    readonly transactions: ReadonlyArray<TransactionAccountingRow>
    /** Orders, newest first. */
    readonly orders: ReadonlyArray<BookOrder>
    /** Accounting work item lineage. */
    readonly works: ReadonlyArray<BookWork>
    /** Accounting decision lineage. */
    readonly decisions: ReadonlyArray<AccountingDecisionRow>
    /** Append-only corrections. */
    readonly adjustments: ReadonlyArray<AccountingAdjustmentRow>
    /** Whether correction persistence is available. */
    readonly adjustmentsReady: boolean
}
