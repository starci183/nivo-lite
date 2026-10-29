import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InvoicesError, InvoicesErrorCode } from "./errors/invoices.error"
import { INVOICE_COLUMNS, INVOICE_RETURNING, INVOICE_VIEW_COLUMNS, selectColumns } from "./invoice-columns.policy"
import { INVOICE_NUMBER_ATTEMPTS, dueAtOf, invoicePrefixOf, nextInvoiceNumber } from "./invoice-number.policy"
import type {
    ClaimableState,
    InvoiceAccountingRecord,
    InvoiceListingRecord,
    InvoiceRecord,
    InvoiceViewRecord,
    IssuedInvoice,
    NewInvoice,
    NewRenewalInvoice,
    OptionalInvoice,
    ReconcileInvoiceRecord,
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
    readonly write: (billed: BilledInvoice) => Promise<Array<InvoiceRecord>>
    /** The invoice the conflict found already in place, or null when only the number was taken. */
    readonly existing: () => Promise<OptionalInvoice>
}

/** The most invoices a reconciliation reads. */
const RECONCILE_LIMIT = 50

/** The most invoices the Sales handoffs read. */
const WORKBENCH_LIMIT = 500

/** The most invoices one customer shows. */
const LEAD_LIMIT = 1000

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
            .getRawOne<InvoiceRecord>()
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
        const invoice = await ordered.limit(1).getRawOne<InvoiceRecord>()
        return invoice ?? null
    }

    /** The invoice an order has, or null. */
    async ofOrder(workspaceId: string, orderId: string): Promise<OptionalInvoice> {
        const invoice = await this.invoiceQuery(workspaceId)
            .andWhere("i.orderId = :orderId", { orderId })
            .limit(1)
            .getRawOne<InvoiceRecord>()
        return invoice ?? null
    }

    /** The newest unpaid invoices a payment can settle. */
    listIssued(workspaceId: string, limit: number): Promise<Array<InvoiceListingRecord>> {
        return this.invoiceQuery(workspaceId)
            .addSelect("o.order_no", "order_no")
            .addSelect("l.contact_name", "contact_name")
            .leftJoin("orders", "o", "o.id = i.order_id")
            .leftJoin("leads", "l", "l.id = i.lead_id")
            .andWhere("i.status = 'issued'")
            .orderBy("i.created_at", "DESC")
            .limit(limit)
            .getRawMany<InvoiceListingRecord>()
    }

    /** The newest invoices and their related records for the accounting book. */
    listAccounting(workspaceId: string, limit: number = 1000): Promise<Array<InvoiceAccountingRecord>> {
        return this.viewQuery(workspaceId)
            .addSelect(
                "CASE WHEN o.id IS NULL THEN NULL ELSE jsonb_build_object('order_no', o.order_no, 'items', o.items, 'amount_vnd', o.amount_vnd::float8, 'status', o.status) END",
                "order",
            )
            .addSelect(
                "CASE WHEN l.id IS NULL THEN NULL ELSE jsonb_build_object('contact_name', l.contact_name, 'company', l.company) END",
                "lead",
            )
            .leftJoin("orders", "o", "o.id = i.order_id AND o.workspace_id = i.workspace_id")
            .leftJoin("leads", "l", "l.id = i.lead_id AND l.workspace_id = i.workspace_id")
            .orderBy("i.created_at", "DESC")
            .addOrderBy("i.id", "DESC")
            .limit(limit)
            .getRawMany<InvoiceAccountingRecord>()
    }

    /** The invoices named by a reconciliation, at most fifty, after the caller proved membership. */
    listForReconcile(workspaceId: string, ids: ReadonlyArray<string>): Promise<Array<ReconcileInvoiceRecord>> {
        if (ids.length === 0) return Promise.resolve([])
        return this.entityManager
            .createQueryBuilder(InvoiceEntity, "i")
            .select("i.id", "id")
            .addSelect("i.invoiceNo", "invoice_no")
            .addSelect("i.amount_vnd::float8", "amount_vnd")
            .addSelect("i.status", "status")
            .addSelect("l.contact_name", "customer")
            .addSelect("NULLIF(l.company, '')", "company")
            .addSelect("o.order_no", "order_no")
            .addSelect("NULLIF(o.items, '')", "order_items")
            .addSelect("o.status", "order_status")
            .addSelect("to_json(i.issued_at) #>> '{}'", "issued_at")
            .addSelect("to_json(i.due_at) #>> '{}'", "due_at")
            .leftJoin("orders", "o", "o.id = i.order_id AND o.workspace_id = i.workspace_id")
            .leftJoin("leads", "l", "l.id = i.lead_id AND l.workspace_id = i.workspace_id")
            .where("i.workspaceId = :workspaceId AND i.id = ANY(:ids)", {
                workspaceId,
                ids: ids.slice(0, RECONCILE_LIMIT),
            })
            .limit(RECONCILE_LIMIT)
            .getRawMany<ReconcileInvoiceRecord>()
    }

    /** The invoices shown in Sales handoffs, after the caller's membership was proved by the composer. */
    listForWorkbench(workspaceId: string): Promise<Array<InvoiceViewRecord>> {
        return this.viewQuery(workspaceId)
            .orderBy("i.created_at", "ASC")
            .addOrderBy("i.id", "ASC")
            .limit(WORKBENCH_LIMIT)
            .getRawMany<InvoiceViewRecord>()
    }

    /** A customer's invoices, after the caller's membership was proved by the composer. */
    listForLead(workspaceId: string, leadId: string): Promise<Array<InvoiceViewRecord>> {
        return this.viewQuery(workspaceId)
            .andWhere("i.leadId = :leadId", { leadId })
            .orderBy("i.created_at", "ASC")
            .addOrderBy("i.id", "ASC")
            .limit(LEAD_LIMIT)
            .getRawMany<InvoiceViewRecord>()
    }

    /** The renewal invoice of one contract period, or null when that period has none yet. */
    async forContractPeriod(workspaceId: string, contractId: string, periodEndsOn: string): Promise<OptionalInvoice> {
        const invoice = await this.invoiceQuery(workspaceId)
            .andWhere("i.contractId = :contractId AND i.period_ends_on = :periodEndsOn", { contractId, periodEndsOn })
            .limit(1)
            .getRawOne<InvoiceRecord>()
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
    ): Promise<InvoiceRecord> {
        const result = await manager
            .createQueryBuilder(InvoiceEntity, "i")
            .update()
            .set({ status: "paid", paidAt: this.clock.now() })
            .where("workspace_id = :workspaceId AND id = :invoiceId AND status <> 'paid'", { workspaceId, invoiceId })
            .returning(INVOICE_RETURNING)
            .execute()
        const [paid] = result.raw as Array<InvoiceRecord>
        if (paid !== undefined) return paid
        const standing = await selectColumns(manager.createQueryBuilder(InvoiceEntity, "i"), INVOICE_COLUMNS)
            .where("i.workspaceId = :workspaceId AND i.id = :invoiceId", { workspaceId, invoiceId })
            .limit(1)
            .getRawOne<InvoiceRecord>()
        if (standing === undefined) throw new InvoicesError({ code: InvoicesErrorCode.NotFound })
        return standing
    }

    /** The invoices of a workspace, selected as invoice records. */
    private invoiceQuery(workspaceId: string): SelectQueryBuilder<InvoiceEntity> {
        return selectColumns(this.entityManager.createQueryBuilder(InvoiceEntity, "i"), INVOICE_COLUMNS).where(
            "i.workspaceId = :workspaceId",
            { workspaceId },
        )
    }

    /** The invoices of a workspace, selected with their dates as ISO text. */
    private viewQuery(workspaceId: string): SelectQueryBuilder<InvoiceEntity> {
        return selectColumns(this.entityManager.createQueryBuilder(InvoiceEntity, "i"), INVOICE_VIEW_COLUMNS).where(
            "i.workspaceId = :workspaceId",
            { workspaceId },
        )
    }

    /** Writes an issued invoice; no row when the number is taken or the order or period has its invoice already. */
    private async writeInvoice(
        invoice: Partial<InvoiceEntity> & Pick<InvoiceEntity, "workspaceId" | "leadId" | "invoiceNo" | "amountVnd">,
    ): Promise<Array<InvoiceRecord>> {
        const result = await this.entityManager
            .createQueryBuilder(InvoiceEntity, "i")
            .insert()
            .values({ ...invoice, status: "issued" })
            .orIgnore()
            .returning(INVOICE_RETURNING)
            .execute()
        return result.raw as Array<InvoiceRecord>
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
