import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InvoicesError, InvoicesErrorCode } from "./errors/invoices.error"
import { INVOICE_NUMBER_ATTEMPTS, dueAtOf, invoicePrefixOf, nextInvoiceNumber } from "./invoice-number.policy"
import type { IssuedInvoice, NewInvoice, OptionalInvoice } from "./invoices.contracts"
import type {
    InvoiceAccountingRow,
    InvoiceListingRow,
    InvoiceRow,
    LastInvoiceNumberRow,
} from "./persistence/invoices.rows"
import {
    FIND_INVOICE,
    FIND_INVOICE_OF_ORDER,
    INSERT_INVOICE,
    LAST_INVOICE_NUMBER,
    LIST_ACCOUNTING_INVOICES,
    LIST_ISSUED_INVOICES,
    MARK_INVOICE_PAID,
} from "./persistence/invoices.sql"

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

    /** The invoice an order has, or null. */
    async ofOrder(workspaceId: string, orderId: string): Promise<OptionalInvoice> {
        const rows = await this.entityManager.query<Array<InvoiceRow>>(FIND_INVOICE_OF_ORDER, [workspaceId, orderId])
        return rows[0] ?? null
    }

    /** The newest unpaid invoices of the payment's origin, so simulation cannot settle live sales. */
    listIssued(workspaceId: string, limit: number, origin: string = "live"): Promise<Array<InvoiceListingRow>> {
        return this.entityManager.query<Array<InvoiceListingRow>>(LIST_ISSUED_INVOICES, [workspaceId, limit, origin])
    }

    /** The newest invoices and their related records for the accounting book. */
    listAccounting(workspaceId: string, limit: number = 1000): Promise<Array<InvoiceAccountingRow>> {
        return this.entityManager.query<Array<InvoiceAccountingRow>>(LIST_ACCOUNTING_INVOICES, [workspaceId, limit])
    }

    /** Issues an invoice under the next number of the month; an order that has its invoice already gets that one back. */
    async issue(input: NewInvoice): Promise<IssuedInvoice> {
        const prefix = invoicePrefixOf(this.clock.now())
        const [last] = await this.entityManager.query<Array<LastInvoiceNumberRow>>(LAST_INVOICE_NUMBER, [
            input.workspaceId,
            prefix,
        ])
        return this.insert(input, prefix, last?.invoice_no ?? null, 0)
    }

    /** Marks an invoice paid only within the payment's origin and answers it. */
    async markPaid(workspaceId: string, invoiceId: string, origin: string = "live"): Promise<InvoiceRow> {
        const rows = await this.entityManager.query<Array<InvoiceRow>>(MARK_INVOICE_PAID, [
            workspaceId,
            invoiceId,
            this.clock.now().toISOString(),
            origin,
        ])
        const [paid] = rows
        if (paid === undefined) throw new InvoicesError({ code: InvoicesErrorCode.NotFound })
        return paid
    }

    private async insert(input: NewInvoice, prefix: string, last: string | null, skip: number): Promise<IssuedInvoice> {
        if (skip >= INVOICE_NUMBER_ATTEMPTS) throw new InvoicesError({ code: InvoicesErrorCode.NotNumbered })
        const now = this.clock.now()
        const rows = await this.entityManager.query<Array<InvoiceRow>>(INSERT_INVOICE, [
            input.workspaceId,
            input.orderId,
            input.leadId,
            nextInvoiceNumber(prefix, last, skip),
            input.amountVnd,
            dueAtOf(now).toISOString(),
            input.origin,
            input.issuedBy,
            now.toISOString(),
        ])
        const [created] = rows
        if (created !== undefined) return { invoice: created, created: true }
        const existing = input.orderId === null ? null : await this.ofOrder(input.workspaceId, input.orderId)
        if (existing !== null) return { invoice: existing, created: false }
        return this.insert(input, prefix, last, skip + 1)
    }
}
