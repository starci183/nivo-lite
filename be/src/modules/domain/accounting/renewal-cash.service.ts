import { Injectable } from "@nestjs/common"
import type { EntityManager, ObjectLiteral, SelectQueryBuilder } from "typeorm"
import { ContractEntity } from "@modules/domain/contracts"
import { InboundEventEntity } from "@modules/domain/inbound-events"
import { InvoiceEntity } from "@modules/domain/invoices"
import { LeadEntity } from "@modules/domain/leads"
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

/** How one part of the story is read: the amount its tally sums, the columns of its list and the columns that order it. */
interface PartSpec {
    readonly amount: string
    readonly columns: ReadonlyArray<string>
    readonly order: ReadonlyArray<string>
}

/** A statement over the invoices, contracts, leads and inbound events of the workspace, tables other capabilities own. */
type Statement = SelectQueryBuilder<ObjectLiteral>

const VN_ZONE = "Asia/Ho_Chi_Minh"

/** The count and the total of every row `rows` selects, whatever the list bound. */
const tallyOf = async (rows: Statement, amount: string): Promise<Tally> => {
    const tally = await rows
        .select("count(*)::int", "count")
        .addSelect(`coalesce(sum(${amount}), 0)::float8`, "total")
        .getRawOne<Tally>()
    return tally ?? { count: 0, total: 0 }
}

/** One part of the story: the same statement tallied over every row and listed over the first `bound` rows in order. */
const partOf = async <T>(rows: () => Statement, spec: PartSpec, bound: number): Promise<Part<T>> => {
    const tally = await tallyOf(rows(), spec.amount)
    const ordered = spec.order.reduce(
        (statement, column, index) =>
            index === 0 ? statement.orderBy(column, "ASC") : statement.addOrderBy(column, "ASC"),
        rows().select([...spec.columns]),
    )
    const items = await ordered.limit(bound).getRawMany<T>()
    return { tally, items }
}

const invoicesOf = (manager: EntityManager, query: RenewalCashQuery): Statement =>
    manager
        .createQueryBuilder(InvoiceEntity, "i")
        .where("i.workspace_id = :workspaceId", { workspaceId: query.workspaceId })

const renewalsOf = (manager: EntityManager, query: RenewalCashQuery): Statement =>
    invoicesOf(manager, query).innerJoin(
        ContractEntity,
        "c",
        "c.id = i.contract_id AND c.workspace_id = i.workspace_id",
    )

/** The renewal invoices issued in the window. */
const issuedOf = (manager: EntityManager, query: RenewalCashQuery): Promise<Part<RenewalInvoiceItemFacts>> =>
    partOf(
        () =>
            renewalsOf(manager, query)
                .andWhere("i.status <> 'cancelled'")
                .andWhere("i.issued_at >= :from AND i.issued_at < :to", { from: query.from, to: query.to }),
        {
            amount: "i.amount_vnd",
            columns: [
                "i.invoice_no AS invoice_no",
                "i.amount_vnd::float8 AS amount_vnd",
                "c.customer_name AS customer_name",
            ],
            order: ["i.issued_at", "i.invoice_no"],
        },
        query.bound,
    )

/** The renewal invoices paid in the window, with the contract end date now. */
const paidOf = (manager: EntityManager, query: RenewalCashQuery): Promise<Part<RenewalPaidItemFacts>> =>
    partOf(
        () =>
            renewalsOf(manager, query)
                .andWhere("i.status = 'paid'")
                .andWhere("i.paid_at >= :from AND i.paid_at < :to", { from: query.from, to: query.to }),
        {
            amount: "i.amount_vnd",
            columns: [
                "i.invoice_no AS invoice_no",
                "i.amount_vnd::float8 AS amount_vnd",
                "c.customer_name AS customer_name",
                "c.ends_on::text AS ends_on",
                "(c.ends_on > i.period_ends_on) AS extended",
            ],
            order: ["i.paid_at", "i.invoice_no"],
        },
        query.bound,
    )

/** The invoices still unpaid that fall due before the horizon. */
const unpaidOf = (manager: EntityManager, query: RenewalCashQuery): Promise<Part<UnpaidItemFacts>> =>
    partOf(
        () =>
            invoicesOf(manager, query)
                .leftJoin(ContractEntity, "c", "c.id = i.contract_id AND c.workspace_id = i.workspace_id")
                .leftJoin(LeadEntity, "l", "l.id = i.lead_id AND l.workspace_id = i.workspace_id")
                .andWhere("i.status = 'issued' AND i.due_at IS NOT NULL")
                .andWhere(`i.due_at < (:horizonDay::date + 1)::timestamp AT TIME ZONE '${VN_ZONE}'`, {
                    horizonDay: query.horizonDay,
                }),
        {
            amount: "i.amount_vnd",
            columns: [
                "i.invoice_no AS invoice_no",
                "i.amount_vnd::float8 AS amount_vnd",
                "coalesce(c.customer_name, l.contact_name) AS customer_name",
                `to_char(i.due_at AT TIME ZONE '${VN_ZONE}', 'YYYY-MM-DD') AS due_on`,
            ],
            order: ["i.due_at", "i.invoice_no"],
        },
        query.bound,
    )

/** The active contracts ending before the horizon with no renewal invoice for their period. */
const expiringOf = (manager: EntityManager, query: RenewalCashQuery): Promise<Part<ExpiringItemFacts>> =>
    partOf(
        () =>
            manager
                .createQueryBuilder(ContractEntity, "c")
                .where("c.workspace_id = :workspaceId AND c.status = 'active'", { workspaceId: query.workspaceId })
                .andWhere("c.ends_on >= :day::date AND c.ends_on <= :horizonDay::date", {
                    day: query.day,
                    horizonDay: query.horizonDay,
                })
                .andWhere(
                    (outer) =>
                        `NOT EXISTS ${outer
                            .subQuery()
                            .select("1")
                            .from(InvoiceEntity, "i")
                            .where(
                                "i.workspace_id = c.workspace_id AND i.contract_id = c.id AND i.period_ends_on = c.ends_on",
                            )
                            .andWhere("i.status <> 'cancelled'")
                            .getQuery()}`,
                ),
        {
            amount: "c.amount_vnd",
            columns: [
                "c.customer_name AS customer_name",
                "c.plan AS plan",
                "c.ends_on::text AS ends_on",
                "c.amount_vnd::float8 AS amount_vnd",
            ],
            order: ["c.ends_on", "c.customer_name"],
        },
        query.bound,
    )

/** The payments received that still wait for a decision. */
const unmatchedOf = (manager: EntityManager, query: RenewalCashQuery): Promise<Part<UnmatchedItemFacts>> =>
    partOf(
        () =>
            manager
                .createQueryBuilder(InboundEventEntity, "e")
                .where("e.workspace_id = :workspaceId AND e.kind = 'payment' AND e.status = 'needs_decision'", {
                    workspaceId: query.workspaceId,
                }),
        {
            amount: "e.amount_vnd",
            columns: [
                "e.amount_vnd::float8 AS amount_vnd",
                "e.sender_name AS sender_name",
                "coalesce(e.external_ref, e.body) AS memo",
            ],
            order: ["e.created_at"],
        },
        query.bound,
    )

@Injectable()
/** Reads the renewal-to-cash story of a window from the invoices, contracts, leads and inbound payments of the workspace. */
export class RenewalCashService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * The renewal-to-cash story of a window, read only, in one snapshot: the renewal invoices issued in it, the renewal
     * invoices paid in it with the contract end date now, the invoices still unpaid that fall due before the horizon, the
     * active contracts ending before the horizon with no renewal invoice for their period, and the payments received that
     * still wait for a decision. Each list is bounded; the counts and totals cover every row.
     */
    read(query: RenewalCashQuery): Promise<RenewalCashFacts> {
        return this.entityManager.transaction("REPEATABLE READ", async (manager) => {
            const issued = await issuedOf(manager, query)
            const paid = await paidOf(manager, query)
            const unpaid = await unpaidOf(manager, query)
            const expiring = await expiringOf(manager, query)
            const unmatched = await unmatchedOf(manager, query)
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
}
