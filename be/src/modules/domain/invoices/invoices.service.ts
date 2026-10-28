import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InvoicesError, InvoicesErrorCode } from "./errors/invoices.error"
import { INVOICE_NUMBER_ATTEMPTS, dueAtOf, invoicePrefixOf, nextInvoiceNumber } from "./invoice-number.policy"
import type {
    ClaimableState,
    IssuedInvoice,
    NewInvoice,
    NewRenewalInvoice,
    OptionalInvoice,
} from "./invoices.contracts"
import type {
    InvoiceAccountingRow,
    InvoiceListingRow,
    InvoiceRow,
    LastInvoiceNumberRow,
    ReconcileInvoiceRow,
} from "./persistence/invoices.rows"
import type { InvoiceViewRow } from "./persistence/invoice-views.rows"
import { LIST_LEAD_INVOICES, LIST_WORKBENCH_INVOICES } from "./persistence/invoice-views.sql"
import {
    FIND_CONTRACT_PERIOD_INVOICE,
    FIND_INVOICE,
    FIND_INVOICE_OF_ORDER,
    FIND_LATEST_LEAD_INVOICE,
    INSERT_INVOICE,
    INSERT_RENEWAL_INVOICE,
    LAST_INVOICE_NUMBER,
    LIST_ACCOUNTING_INVOICES,
    LIST_ISSUED_INVOICES,
    LIST_RECONCILE_INVOICES,
    MARK_INVOICE_PAID,
} from "./persistence/invoices.sql"

/** What every issued invoice bills, whatever it is issued for. */
interface InvoiceBilling {
    /** The workspace. */
    readonly workspaceId: string
    /** The customer. */
    readonly leadId: string | null
    /** The amount, VND. */
    readonly amountVnd: number
    /** The display name of the issuer, or null. */
    readonly issuedBy: string | null
}

/**
 * One way of writing an invoice under a number: the billing, the insert that ends its statement parameters with
 * (lead, number, amount, due, issuer, issue time), and the invoice already in place after a conflict, if any.
 */
interface InvoiceInsertAttempt {
    /** What the invoice bills. */
    readonly billing: InvoiceBilling
    /** Inserts with the billed tail of the parameters; no row when the insert conflicted. */
    readonly write: (billed: ReadonlyArray<string | number | null>) => Promise<Array<InvoiceRow>>
    /** The invoice the conflict found already in place, or null when only the number was taken. */
    readonly existing: () => Promise<OptionalInvoice>
}

@Injectable()
/** The invoices of a workspace: the only writer of public.invoices. */
export class InvoicesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** The invoice of the workspace, or null when there is none with that id. */
    async find(workspaceId: string, invoiceId: string): Promise<OptionalInvoice> {
        const rows = await this.entityManager.query<Array<InvoiceRow>>(FIND_INVOICE, [workspaceId, invoiceId])
        return rows[0] ?? null
    }

    /** The customer's newest open ("issued") or paid invoice, or null. */
    async latestOfLead(workspaceId: string, leadId: string, status: ClaimableState): Promise<OptionalInvoice> {
        const rows = await this.entityManager.query<Array<InvoiceRow>>(FIND_LATEST_LEAD_INVOICE, [
            workspaceId,
            leadId,
            status,
        ])
        return rows[0] ?? null
    }

    /** The invoice an order has, or null. */
    async ofOrder(workspaceId: string, orderId: string): Promise<OptionalInvoice> {
        const rows = await this.entityManager.query<Array<InvoiceRow>>(FIND_INVOICE_OF_ORDER, [workspaceId, orderId])
        return rows[0] ?? null
    }

    /** The newest unpaid invoices a payment can settle. */
    listIssued(workspaceId: string, limit: number): Promise<Array<InvoiceListingRow>> {
        return this.entityManager.query<Array<InvoiceListingRow>>(LIST_ISSUED_INVOICES, [workspaceId, limit])
    }

    /** The newest invoices and their related records for the accounting book. */
    listAccounting(workspaceId: string, limit: number = 1000): Promise<Array<InvoiceAccountingRow>> {
        return this.entityManager.query<Array<InvoiceAccountingRow>>(LIST_ACCOUNTING_INVOICES, [workspaceId, limit])
    }

    /** The invoices named by a reconciliation, at most fifty, after the caller proved membership. */
    listForReconcile(workspaceId: string, ids: ReadonlyArray<string>): Promise<Array<ReconcileInvoiceRow>> {
        if (ids.length === 0) return Promise.resolve([])
        return this.entityManager.query<Array<ReconcileInvoiceRow>>(LIST_RECONCILE_INVOICES, [
            workspaceId,
            ids.slice(0, 50),
        ])
    }

    /** The invoices shown in Sales handoffs, after the caller's membership was proved by the composer. */
    listForWorkbench(workspaceId: string): Promise<Array<InvoiceViewRow>> {
        return this.entityManager.query<Array<InvoiceViewRow>>(LIST_WORKBENCH_INVOICES, [workspaceId, 500])
    }

    /** A customer's invoices, after the caller's membership was proved by the composer. */
    listForLead(workspaceId: string, leadId: string): Promise<Array<InvoiceViewRow>> {
        return this.entityManager.query<Array<InvoiceViewRow>>(LIST_LEAD_INVOICES, [workspaceId, leadId])
    }

    /** The renewal invoice of one contract period, or null when that period has none yet. */
    async forContractPeriod(workspaceId: string, contractId: string, periodEndsOn: string): Promise<OptionalInvoice> {
        const rows = await this.entityManager.query<Array<InvoiceRow>>(FIND_CONTRACT_PERIOD_INVOICE, [
            workspaceId,
            contractId,
            periodEndsOn,
        ])
        return rows[0] ?? null
    }

    /** Issues an invoice under the next number of the month; an order that has its invoice already gets that one back. */
    issue(input: NewInvoice): Promise<IssuedInvoice> {
        return this.numbered({
            billing: input,
            write: (billed) =>
                this.entityManager.query<Array<InvoiceRow>>(INSERT_INVOICE, [
                    input.workspaceId,
                    input.orderId,
                    ...billed,
                ]),
            existing: () =>
                input.orderId === null ? Promise.resolve(null) : this.ofOrder(input.workspaceId, input.orderId),
        })
    }

    /**
     * Issues the renewal invoice of a contract period under the next number of the month, with no order; a period that has
     * its invoice already gets that one back, so renewing twice bills once.
     */
    async issueRenewal(input: NewRenewalInvoice): Promise<IssuedInvoice> {
        const period = (): Promise<OptionalInvoice> =>
            this.forContractPeriod(input.workspaceId, input.contractId, input.periodEndsOn)
        const existing = await period()
        if (existing !== null) return { invoice: existing, created: false }
        return this.numbered({
            billing: input,
            write: (billed) =>
                this.entityManager.query<Array<InvoiceRow>>(INSERT_RENEWAL_INVOICE, [
                    input.workspaceId,
                    input.contractId,
                    input.periodEndsOn,
                    ...billed,
                ]),
            existing: period,
        })
    }

    /** Marks an invoice paid and answers it. */
    async markPaid(workspaceId: string, invoiceId: string): Promise<InvoiceRow> {
        const rows = await this.entityManager.query<Array<InvoiceRow>>(MARK_INVOICE_PAID, [
            workspaceId,
            invoiceId,
            this.clock.now().toISOString(),
        ])
        const [paid] = rows
        if (paid === undefined) throw new InvoicesError({ code: InvoicesErrorCode.NotFound })
        return paid
    }

    private async numbered(attempt: InvoiceInsertAttempt): Promise<IssuedInvoice> {
        const prefix = invoicePrefixOf(this.clock.now())
        const [last] = await this.entityManager.query<Array<LastInvoiceNumberRow>>(LAST_INVOICE_NUMBER, [
            attempt.billing.workspaceId,
            prefix,
        ])
        return this.insert(prefix, last?.invoice_no ?? null, 0, attempt)
    }

    private async insert(
        prefix: string,
        last: string | null,
        clashes: number,
        attempt: InvoiceInsertAttempt,
    ): Promise<IssuedInvoice> {
        if (clashes >= INVOICE_NUMBER_ATTEMPTS) throw new InvoicesError({ code: InvoicesErrorCode.NotNumbered })
        const now = this.clock.now()
        const { billing } = attempt
        const [created] = await attempt.write([
            billing.leadId,
            nextInvoiceNumber(prefix, last, clashes),
            billing.amountVnd,
            dueAtOf(now).toISOString(),
            billing.issuedBy,
            now.toISOString(),
        ])
        if (created !== undefined) return { invoice: created, created: true }
        const existing = await attempt.existing()
        if (existing !== null) return { invoice: existing, created: false }
        return this.insert(prefix, last, clashes + 1, attempt)
    }
}
