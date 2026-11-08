import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InvoicesError, InvoicesErrorCode } from "./errors/invoices.error"
import { INVOICE_COLUMNS, INVOICE_RETURNING, selectColumns } from "./invoice-columns.policy"
import { INVOICE_NUMBER_ATTEMPTS, dueAtOf, invoicePrefixOf, nextInvoiceNumber } from "./invoice-number.policy"
import type {
    ClaimableState,
    InvoiceRow,
    IssuedInvoice,
    NewInvoice,
    NewRenewalInvoice,
    OptionalInvoice,
} from "./invoices.contracts"
import { InvoiceEntity } from "./persistence/entities"

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

/** The part of an issued invoice every way of issuing shares: the customer, the number, the amount, the due date, the issuer and the issue time. */
interface BilledInvoice {
    /** The customer, or null. */
    readonly leadId: string | null
    /** The number. */
    readonly invoiceNo: string
    /** The amount, VND. */
    readonly amountVnd: number
    /** When payment is due. */
    readonly dueAt: Date
    /** The display name of the issuer, or null. */
    readonly issuedBy: string | null
    /** The issue time. */
    readonly issuedAt: Date
}

/**
 * One way of writing an invoice under a number: the billing, the insert that takes the billed part, and the invoice already
 * in place after a conflict, if any.
 */
interface InvoiceInsertAttempt {
    /** What the invoice bills. */
    readonly billing: InvoiceBilling
    /** Inserts with the billed part; no row when the insert conflicted. */
    readonly write: (billed: BilledInvoice) => Promise<Array<InvoiceRow>>
    /** The invoice the conflict found already in place, or null when only the number was taken. */
    readonly existing: () => Promise<OptionalInvoice>
}

/** True when a RETURNING row carries the invoice shape the returning clause gives it. */
const isInvoiceRow = (value: unknown): value is InvoiceRow =>
    typeof value === "object" && value !== null && "id" in value && typeof value.id === "string"

/** The invoice rows a write answered; the driver answers a list of rows. */
const returnedInvoices = (raw: unknown): Array<InvoiceRow> => [raw].flat().filter(isInvoiceRow)

@Injectable()
/** The invoices of a workspace: the only writer of public.invoices. */
export class InvoicesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** The invoice of the workspace, or null when there is none with that id. */
    async find(workspaceId: string, invoiceId: string): Promise<OptionalInvoice> {
        const invoice = await this.invoiceQuery(workspaceId)
            .andWhere("i.id = :invoiceId", { invoiceId })
            .limit(1)
            .getRawOne<InvoiceRow>()
        return invoice ?? null
    }

    /** The customer's newest open ("issued") or paid invoice, or null. */
    async latestOfLead(workspaceId: string, leadId: string, status: ClaimableState): Promise<OptionalInvoice> {
        const query = this.invoiceQuery(workspaceId).andWhere("i.leadId = :leadId AND i.status = :status", {
            leadId,
            status,
        })
        const ordered =
            status === "paid"
                ? query.orderBy("i.paid_at", "DESC", "NULLS LAST").addOrderBy("i.created_at", "DESC")
                : query.orderBy("i.created_at", "DESC")
        const invoice = await ordered.limit(1).getRawOne<InvoiceRow>()
        return invoice ?? null
    }

    /** The invoice an order has, or null. */
    async ofOrder(workspaceId: string, orderId: string): Promise<OptionalInvoice> {
        const invoice = await this.invoiceQuery(workspaceId)
            .andWhere("i.orderId = :orderId", { orderId })
            .limit(1)
            .getRawOne<InvoiceRow>()
        return invoice ?? null
    }

    /** The renewal invoice of one contract period, or null when that period has none yet. */
    async forContractPeriod(workspaceId: string, contractId: string, periodEndsOn: string): Promise<OptionalInvoice> {
        const invoice = await this.invoiceQuery(workspaceId)
            .andWhere("i.contractId = :contractId AND i.period_ends_on = :periodEndsOn", { contractId, periodEndsOn })
            .limit(1)
            .getRawOne<InvoiceRow>()
        return invoice ?? null
    }

    /** Issues an invoice under the next number of the month; an order that has its invoice already gets that one back. */
    issue(input: NewInvoice): Promise<IssuedInvoice> {
        return this.numbered({
            billing: input,
            write: (billed) => this.writeInvoice({ workspaceId: input.workspaceId, orderId: input.orderId, ...billed }),
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
                this.writeInvoice({
                    workspaceId: input.workspaceId,
                    contractId: input.contractId,
                    periodEndsOn: input.periodEndsOn,
                    ...billed,
                }),
            existing: period,
        })
    }

    /**
     * Marks an invoice paid and answers it. Paid stays paid: an invoice already paid keeps its `paid_at` and is answered as it
     * stands, so a repeated settlement changes nothing. A supplied manager keeps the write in the caller's transaction.
     */
    async markPaid(
        workspaceId: string,
        invoiceId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<InvoiceRow> {
        const result = await manager
            .createQueryBuilder(InvoiceEntity, "i")
            .update()
            .set({ status: "paid", paidAt: this.clock.now() })
            .where("workspace_id = :workspaceId AND id = :invoiceId AND status <> 'paid'", { workspaceId, invoiceId })
            .returning(INVOICE_RETURNING)
            .execute()
        const [paid] = returnedInvoices(result.raw)
        if (paid !== undefined) return paid
        const standing = await selectColumns(manager.createQueryBuilder(InvoiceEntity, "i"), INVOICE_COLUMNS)
            .where("i.workspaceId = :workspaceId AND i.id = :invoiceId", { workspaceId, invoiceId })
            .limit(1)
            .getRawOne<InvoiceRow>()
        if (standing === undefined) throw new InvoicesError({ code: InvoicesErrorCode.NotFound })
        return standing
    }

    private invoiceQuery(workspaceId: string): SelectQueryBuilder<InvoiceEntity> {
        return selectColumns(this.entityManager.createQueryBuilder(InvoiceEntity, "i"), INVOICE_COLUMNS).where(
            "i.workspaceId = :workspaceId",
            { workspaceId },
        )
    }

    /** Writes an issued invoice; no row when the number is taken or the order or period has its invoice already. */
    private async writeInvoice(
        invoice: Partial<InvoiceEntity> & Pick<InvoiceEntity, "workspaceId" | "leadId" | "invoiceNo" | "amountVnd">,
    ): Promise<Array<InvoiceRow>> {
        const result = await this.entityManager
            .createQueryBuilder(InvoiceEntity, "i")
            .insert()
            .values({ ...invoice, status: "issued" })
            .orIgnore()
            .returning(INVOICE_RETURNING)
            .execute()
        return returnedInvoices(result.raw)
    }

    private async numbered(attempt: InvoiceInsertAttempt): Promise<IssuedInvoice> {
        const prefix = invoicePrefixOf(this.clock.now())
        const last = await this.entityManager
            .createQueryBuilder(InvoiceEntity, "i")
            .select("max(i.invoiceNo)", "invoice_no")
            .where("i.workspaceId = :workspaceId AND i.invoiceNo LIKE :pattern", {
                workspaceId: attempt.billing.workspaceId,
                pattern: `${prefix}%`,
            })
            .getRawOne<{ invoice_no: string | null }>()
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
        const [created] = await attempt.write({
            leadId: billing.leadId,
            invoiceNo: nextInvoiceNumber(prefix, last, clashes),
            amountVnd: billing.amountVnd,
            dueAt: dueAtOf(now),
            issuedBy: billing.issuedBy,
            issuedAt: now,
        })
        if (created !== undefined) return { invoice: created, created: true }
        const existing = await attempt.existing()
        if (existing !== null) return { invoice: existing, created: false }
        return this.insert(prefix, last, clashes + 1, attempt)
    }
}
