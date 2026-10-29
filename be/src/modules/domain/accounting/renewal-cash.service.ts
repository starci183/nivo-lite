import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ContractsReadService } from "@modules/domain/contracts"
import type { ContractFacts } from "@modules/domain/contracts"
import { InboundPaymentsReadService } from "@modules/domain/inbound-events"
import { InvoicesCashReadService } from "@modules/domain/invoices"
import type { CashInvoice } from "@modules/domain/invoices"
import { LeadReadService } from "@modules/domain/leads"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    ExpiringItemFacts,
    RenewalCashFacts,
    RenewalInvoiceItemFacts,
    RenewalPaidItemFacts,
    UnmatchedItemFacts,
    UnpaidItemFacts,
} from "./renewal-cash.contracts"

/** What the reader is asked: the window in Vietnam, the first day and horizon day, and how many items each list holds. */
export interface RenewalCashQuery {
    /** The workspace. */
    readonly workspaceId: string
    /** Start of the window. */
    readonly from: Date
    /** End of the window, exclusive. */
    readonly to: Date
    /** The first day, `yyyy-mm-dd`. */
    readonly day: string
    /** The horizon day, `yyyy-mm-dd`. */
    readonly horizonDay: string
    /** How many items each list holds. */
    readonly bound: number
}

/** The count and the total of one part of the story. */
interface Tally {
    readonly count: number
    readonly total: number
}

/** One part of the story: every row counted and totalled, and the first rows listed. */
interface Part<T> {
    readonly tally: Tally
    readonly items: Array<T>
}

/** An invoice beside the contract it renews. */
interface RenewedInvoice {
    readonly invoice: CashInvoice
    readonly contract: ContractFacts
}

/** The most invoices or contracts one list of the story weighs before its bound. */
const ROW_LIMIT = 5000

const VN_OFFSET_MS = 7 * 3_600_000
const DAY_MS = 86_400_000

/** The count and total of the rows, and the first `bound` of them as the list. */
const partOf = <R, T>(
    rows: ReadonlyArray<R>,
    amountOf: (row: R) => number,
    itemOf: (row: R) => T,
    bound: number,
): Part<T> => ({
    tally: { count: rows.length, total: rows.reduce((sum, row) => sum + amountOf(row), 0) },
    items: rows.slice(0, bound).map(itemOf),
})

/** The calendar day of an instant in Vietnam, `yyyy-mm-dd`. */
const vnDayOf = (at: Date): string => new Date(at.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10)

/** The first instant after the horizon day in Vietnam. */
const afterHorizon = (horizonDay: string): Date => new Date(Date.parse(`${horizonDay}T00:00:00+07:00`) + DAY_MS)

@Injectable()
/** Reads the renewal-to-cash story of a window from the invoices, contracts, leads and inbound payments of the workspace. */
export class RenewalCashService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly contracts: ContractsReadService,
        private readonly leads: LeadReadService,
        private readonly invoices: InvoicesCashReadService,
        private readonly payments: InboundPaymentsReadService,
    ) {}

    /**
     * The renewal-to-cash story of a window, read only, in one snapshot: the renewal invoices issued in it, the renewal
     * invoices paid in it with the contract end date now, the invoices still unpaid that fall due before the horizon, the
     * active contracts ending before the horizon with no renewal invoice for their period, and the payments received that
     * still wait for a decision. Each list is bounded; the counts and totals cover every row the story weighs.
     */
    read(query: RenewalCashQuery): Promise<RenewalCashFacts> {
        return this.entityManager.transaction("REPEATABLE READ", async () => {
            const issued = await this.issuedOf(query)
            const paid = await this.paidOf(query)
            const unpaid = await this.unpaidOf(query)
            const expiring = await this.expiringOf(query)
            const unmatched = await this.unmatchedOf(query)
            return {
                issued_count: issued.tally.count,
                issued_total: issued.tally.total,
                issued: issued.items,
                paid_count: paid.tally.count,
                paid_total: paid.tally.total,
                paid: paid.items,
                unpaid_count: unpaid.tally.count,
                unpaid_total: unpaid.tally.total,
                unpaid: unpaid.items,
                expiring_count: expiring.tally.count,
                expiring_total: expiring.tally.total,
                expiring: expiring.items,
                unmatched_count: unmatched.tally.count,
                unmatched_total: unmatched.tally.total,
                unmatched: unmatched.items,
            }
        })
    }

    /** The contracts the invoices name, by contract id. */
    private async contractsOf(
        workspaceId: string,
        invoices: ReadonlyArray<CashInvoice>,
    ): Promise<Map<string, ContractFacts>> {
        const ids = new Set(invoices.flatMap((invoice) => (invoice.contractId === null ? [] : [invoice.contractId])))
        if (ids.size === 0) return new Map()
        const found = await this.contracts.contractsByIds(workspaceId, [...ids], ROW_LIMIT)
        return new Map(found.map((contract) => [contract.id, contract]))
    }

    /** The invoices that renew a contract of the workspace, each beside its contract, in the order they came. */
    private async renewalsOf(
        query: RenewalCashQuery,
        invoices: ReadonlyArray<CashInvoice>,
    ): Promise<Array<RenewedInvoice>> {
        const byId = await this.contractsOf(query.workspaceId, invoices)
        return invoices.flatMap((invoice) => {
            const contract = invoice.contractId === null ? undefined : byId.get(invoice.contractId)
            return contract === undefined ? [] : [{ invoice, contract }]
        })
    }

    /** The renewal invoices issued in the window. */
    private async issuedOf(query: RenewalCashQuery): Promise<Part<RenewalInvoiceItemFacts>> {
        const invoices = await this.invoices.renewalsIssued(query.workspaceId, query.from, query.to, ROW_LIMIT)
        return partOf(
            await this.renewalsOf(query, invoices),
            (row) => row.invoice.amountVnd,
            (row) => ({
                invoice_no: row.invoice.invoiceNo,
                amount_vnd: row.invoice.amountVnd,
                customer_name: row.contract.customerName,
            }),
            query.bound,
        )
    }

    /** The renewal invoices paid in the window, with the contract end date now. */
    private async paidOf(query: RenewalCashQuery): Promise<Part<RenewalPaidItemFacts>> {
        const invoices = await this.invoices.renewalsPaid(query.workspaceId, query.from, query.to, ROW_LIMIT)
        return partOf(
            await this.renewalsOf(query, invoices),
            (row) => row.invoice.amountVnd,
            (row) => ({
                invoice_no: row.invoice.invoiceNo,
                amount_vnd: row.invoice.amountVnd,
                customer_name: row.contract.customerName,
                ends_on: row.contract.endsOn,
                extended: row.invoice.periodEndsOn !== null && row.contract.endsOn > row.invoice.periodEndsOn,
            }),
            query.bound,
        )
    }

    /** The invoices still unpaid that fall due before the horizon. */
    private async unpaidOf(query: RenewalCashQuery): Promise<Part<UnpaidItemFacts>> {
        const invoices = await this.invoices.unpaidDueBefore(
            query.workspaceId,
            afterHorizon(query.horizonDay),
            ROW_LIMIT,
        )
        const contracts = await this.contractsOf(query.workspaceId, invoices)
        const leadIds = invoices.flatMap((invoice) => (invoice.leadId === null ? [] : [invoice.leadId]))
        const cards = new Map((await this.leads.cardsOf(query.workspaceId, leadIds)).map((card) => [card.id, card]))
        return partOf(
            invoices,
            (invoice) => invoice.amountVnd,
            (invoice) => ({
                invoice_no: invoice.invoiceNo,
                amount_vnd: invoice.amountVnd,
                customer_name:
                    (invoice.contractId === null ? undefined : contracts.get(invoice.contractId)?.customerName) ??
                    (invoice.leadId === null ? undefined : cards.get(invoice.leadId)?.contactName) ??
                    null,
                due_on: vnDayOf(invoice.dueAt ?? new Date(0)),
            }),
            query.bound,
        )
    }

    /** The active contracts ending before the horizon with no renewal invoice for their period. */
    private async expiringOf(query: RenewalCashQuery): Promise<Part<ExpiringItemFacts>> {
        const ending = await this.contracts.activeEndingBetween(
            query.workspaceId,
            query.day,
            query.horizonDay,
            ROW_LIMIT,
        )
        const periods = await this.invoices.invoicedPeriods(
            query.workspaceId,
            ending.map((contract) => contract.id),
        )
        const taken = new Set(periods.map((period) => `${period.contractId}|${period.periodEndsOn}`))
        return partOf(
            ending.filter((contract) => !taken.has(`${contract.id}|${contract.endsOn}`)),
            (contract) => contract.amountVnd ?? 0,
            (contract) => ({
                customer_name: contract.customerName,
                plan: contract.plan,
                ends_on: contract.endsOn,
                amount_vnd: contract.amountVnd,
            }),
            query.bound,
        )
    }

    /** The payments received that still wait for a decision. */
    private async unmatchedOf(query: RenewalCashQuery): Promise<Part<UnmatchedItemFacts>> {
        const waiting = await this.payments.unmatched(query.workspaceId, query.bound)
        return {
            tally: { count: waiting.count, total: waiting.total },
            items: waiting.items.map((item) => ({
                amount_vnd: item.amountVnd,
                sender_name: item.senderName,
                memo: item.memo,
            })),
        }
    }
}
