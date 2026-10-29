import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { LeadReadService } from "@modules/domain/leads"
import type { LeadCard } from "@modules/domain/leads"
import { OrdersLabelReadService } from "@modules/domain/orders"
import type { OrderSummary } from "@modules/domain/orders"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InvoicesError, InvoicesErrorCode } from "./errors/invoices.error"
import { INVOICE_COLUMNS, INVOICE_RETURNING, INVOICE_VIEW_COLUMNS, selectColumns } from "./invoice-columns.policy"
import { INVOICE_NUMBER_ATTEMPTS, dueAtOf, invoicePrefixOf, nextInvoiceNumber } from "./invoice-number.policy"
import type {
    ClaimableState,
    InvoiceAccountingRow,
    InvoiceListingRecord,
    InvoiceRow,
    InvoiceViewRow,
    IssuedInvoice,
    NewInvoice,
    NewRenewalInvoice,
    OptionalInvoice,
    ReconcileInvoiceRow,
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

/** A reconciliation row before its order and customer are read: the invoice with the ids it bills. */
type ReconcileInvoiceIds = Omit<
    ReconcileInvoiceRow,
    "customer" | "company" | "order_no" | "order_items" | "order_status"
> & { readonly order_id: string | null; readonly lead_id: string | null }

/** The most invoices a reconciliation reads. */
const RECONCILE_LIMIT = 50

/** The most invoices the Sales handoffs read. */
const WORKBENCH_LIMIT = 500

/** The most invoices one customer shows. */
const LEAD_LIMIT = 1000

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
        private readonly orders: OrdersLabelReadService,
        private readonly leads: LeadReadService,
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

    /** The newest unpaid invoices a payment can settle. */
    async listIssued(workspaceId: string, limit: number): Promise<Array<InvoiceListingRecord>> {
        const invoices = await this.invoiceQuery(workspaceId)
            .andWhere("i.status = 'issued'")
            .orderBy("i.created_at", "DESC")
            .limit(limit)
            .getRawMany<InvoiceRow>()
        const { orders, leads } = await this.relatedOf(workspaceId, invoices)
        return invoices.map((invoice) => ({
            ...invoice,
            order_no: orders.get(invoice.order_id ?? "")?.orderNo ?? null,
            contact_name: leads.get(invoice.lead_id ?? "")?.contactName ?? null,
        }))
    }

    /** The newest invoices and their related records for the accounting book. */
    async listAccounting(workspaceId: string, limit: number = 1000): Promise<Array<InvoiceAccountingRow>> {
        const invoices = await this.viewQuery(workspaceId)
            .orderBy("i.created_at", "DESC")
            .addOrderBy("i.id", "DESC")
            .limit(limit)
            .getRawMany<InvoiceViewRow>()
        const { orders, leads } = await this.relatedOf(workspaceId, invoices)
        return invoices.map((invoice) => {
            const order = orders.get(invoice.order_id ?? "")
            const lead = leads.get(invoice.lead_id ?? "")
            return {
                ...invoice,
                order:
                    order === undefined
                        ? null
                        : {
                              order_no: order.orderNo,
                              items: order.items,
                              amount_vnd: order.amountVnd,
                              status: order.status,
                          },
                lead: lead === undefined ? null : { contact_name: lead.contactName, company: lead.company },
            }
        })
    }

    /** The invoices named by a reconciliation, at most fifty, after the caller proved membership. */
    async listForReconcile(workspaceId: string, ids: ReadonlyArray<string>): Promise<Array<ReconcileInvoiceRow>> {
        if (ids.length === 0) return []
        const invoices = await this.entityManager
            .createQueryBuilder(InvoiceEntity, "i")
            .select("i.id", "id")
            .addSelect("i.orderId", "order_id")
            .addSelect("i.leadId", "lead_id")
            .addSelect("i.invoiceNo", "invoice_no")
            .addSelect("i.amount_vnd::float8", "amount_vnd")
            .addSelect("i.status", "status")
            .addSelect("to_json(i.issued_at) #>> '{}'", "issued_at")
            .addSelect("to_json(i.due_at) #>> '{}'", "due_at")
            .where("i.workspaceId = :workspaceId AND i.id IN (:...ids)", {
                workspaceId,
                ids: ids.slice(0, RECONCILE_LIMIT),
            })
            .limit(RECONCILE_LIMIT)
            .getRawMany<ReconcileInvoiceIds>()
        const { orders, leads } = await this.relatedOf(workspaceId, invoices)
        return invoices.map(({ order_id: orderId, lead_id: leadId, ...invoice }) => {
            const order = orders.get(orderId ?? "")
            const lead = leads.get(leadId ?? "")
            return {
                ...invoice,
                customer: lead?.contactName ?? null,
                company: lead === undefined || lead.company === "" ? null : lead.company,
                order_no: order?.orderNo ?? null,
                order_items: order === undefined || order.items === "" ? null : order.items,
                order_status: order?.status ?? null,
            }
        })
    }

    /** The invoices shown in Sales handoffs, after the caller's membership was proved by the composer. */
    listForWorkbench(workspaceId: string): Promise<Array<InvoiceViewRow>> {
        return this.viewQuery(workspaceId)
            .orderBy("i.created_at", "ASC")
            .addOrderBy("i.id", "ASC")
            .limit(WORKBENCH_LIMIT)
            .getRawMany<InvoiceViewRow>()
    }

    /** A customer's invoices, after the caller's membership was proved by the composer. */
    listForLead(workspaceId: string, leadId: string): Promise<Array<InvoiceViewRow>> {
        return this.viewQuery(workspaceId)
            .andWhere("i.leadId = :leadId", { leadId })
            .orderBy("i.created_at", "ASC")
            .addOrderBy("i.id", "ASC")
            .limit(LEAD_LIMIT)
            .getRawMany<InvoiceViewRow>()
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

    /** The orders and customers the invoices bill, by id; one that does not exist (or is not named) is missing. */
    private async relatedOf(
        workspaceId: string,
        invoices: ReadonlyArray<{ readonly order_id: string | null; readonly lead_id: string | null }>,
    ): Promise<{ orders: Map<string, OrderSummary>; leads: Map<string, LeadCard> }> {
        const orderIds = invoices.flatMap((invoice) => (invoice.order_id === null ? [] : [invoice.order_id]))
        const leadIds = invoices.flatMap((invoice) => (invoice.lead_id === null ? [] : [invoice.lead_id]))
        const orders = await this.orders.summariesOf(workspaceId, orderIds)
        const leads = await this.leads.cardsOf(workspaceId, leadIds)
        return {
            orders: new Map(orders.map((order) => [order.id, order])),
            leads: new Map(leads.map((lead) => [lead.id, lead])),
        }
    }

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
